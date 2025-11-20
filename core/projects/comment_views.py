"""
API views for project comments and votes.
"""

from django.db import transaction
from django.db.models import Case, Count, IntegerField, When
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.projects.comment_serializers import CommentCreateSerializer, ProjectCommentSerializer
from core.projects.models import CommentVote, Project, ProjectComment


class CommentCreateThrottle(UserRateThrottle):
    """Rate limit for comment creation to prevent spam."""

    rate = '10/hour'


class ProjectCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for project comments with moderation."""

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = ProjectCommentSerializer

    def get_throttles(self):
        """Apply throttling only to create action."""
        if self.action == 'create':
            return [CommentCreateThrottle()]
        return []

    def get_queryset(self):
        """
        Get comments for a project with optimized vote counts.
        Only show approved comments to non-staff users.
        """
        project_id = self.kwargs.get('project_pk')
        queryset = ProjectComment.objects.filter(project_id=project_id)

        # Non-staff users only see approved comments
        if not self.request.user.is_authenticated or not self.request.user.is_staff:
            queryset = queryset.filter(moderation_status=ProjectComment.ModerationStatus.APPROVED)

        # Annotate with vote counts to avoid N+1 queries
        queryset = (
            queryset.select_related('user', 'project')
            .annotate(
                _upvote_count=Count(Case(When(votes__vote_type='up', then=1), output_field=IntegerField())),
                _downvote_count=Count(Case(When(votes__vote_type='down', then=1), output_field=IntegerField())),
            )
            .annotate(
                _score=Count(Case(When(votes__vote_type='up', then=1), output_field=IntegerField()))
                - Count(Case(When(votes__vote_type='down', then=1), output_field=IntegerField()))
            )
        )

        return queryset

    def get_serializer_class(self):
        """Use different serializer for create action."""
        if self.action == 'create':
            return CommentCreateSerializer
        return ProjectCommentSerializer

    def create(self, request, *args, **kwargs):
        """Create a new comment with moderation."""
        project_id = self.kwargs.get('project_pk')
        project = get_object_or_404(Project, id=project_id)

        # Check for duplicate comments (same user, project, content within 5 minutes)
        from datetime import timedelta

        from django.utils import timezone

        content = request.data.get('content', '').strip()
        recent_threshold = timezone.now() - timedelta(minutes=5)

        duplicate = ProjectComment.objects.filter(
            user=request.user, project=project, content=content, created_at__gte=recent_threshold
        ).exists()

        if duplicate:
            return Response(
                {'error': 'You already posted this comment recently. Please wait before posting duplicate content.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Create comment with moderation
        comment = serializer.save(user=request.user, project=project)

        # Return full comment data
        output_serializer = ProjectCommentSerializer(comment, context={'request': request})

        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def vote(self, request, project_pk=None, pk=None):
        """
        Vote on a comment (upvote or downvote).

        Request body:
            {
                "vote_type": "up" or "down"
            }

        If user already voted, update their vote. If they vote the same way,
        remove the vote (toggle behavior).
        """
        comment = self.get_object()
        vote_type = request.data.get('vote_type')

        if vote_type not in ['up', 'down']:
            return Response({'error': 'vote_type must be "up" or "down"'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Check if user already voted
            existing_vote = CommentVote.objects.filter(user=request.user, comment=comment).first()

            if existing_vote:
                if existing_vote.vote_type == vote_type:
                    # Toggle - remove vote
                    existing_vote.delete()
                    action_taken = 'removed'
                else:
                    # Change vote
                    existing_vote.vote_type = vote_type
                    existing_vote.save()
                    action_taken = 'updated'
            else:
                # Create new vote
                CommentVote.objects.create(user=request.user, comment=comment, vote_type=vote_type)
                action_taken = 'created'

        # Return updated comment data
        serializer = ProjectCommentSerializer(comment, context={'request': request})

        return Response({'action': action_taken, 'comment': serializer.data})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_comment(request, project_pk, comment_id):
    """
    Delete a comment (only owner or staff can delete).
    """
    comment = get_object_or_404(ProjectComment, id=comment_id, project_id=project_pk)

    # Check permissions
    if comment.user != request.user and not request.user.is_staff:
        return Response(
            {'error': 'You do not have permission to delete this comment'}, status=status.HTTP_403_FORBIDDEN
        )

    comment.delete()

    return Response({'message': 'Comment deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
