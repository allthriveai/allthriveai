"""
API views for project comments and votes.
"""

import logging
import time

from django.db import transaction
from django.db.models import Case, Count, IntegerField, When
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.logging_utils import StructuredLogger
from core.projects.comment_serializers import CommentCreateSerializer, ProjectCommentSerializer
from core.projects.models import CommentVote, Project, ProjectComment

logger = logging.getLogger(__name__)


class CommentCreateThrottle(UserRateThrottle):
    """Rate limit for comment creation to prevent spam."""

    rate = '100/hour'  # Increased for development


class ProjectCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for project comments with moderation."""

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = ProjectCommentSerializer
    pagination_class = None  # Disable pagination for comments

    def destroy(self, request, *args, **kwargs):
        """
        Delete a comment (only owner or admin can delete).

        Overrides default ModelViewSet.destroy() to add permission checks.
        """
        from core.users.models import UserRole

        start_time = time.time()
        comment = self.get_object()
        project_pk = self.kwargs.get('project_pk')

        # Check permissions: owner or admin can delete
        is_owner = comment.user == request.user
        is_admin = request.user.role == UserRole.ADMIN

        if not is_owner and not is_admin:
            StructuredLogger.log_validation_error(
                message='Unauthorized comment deletion attempt',
                user=request.user,
                errors={'comment_id': comment.id, 'reason': 'Not owner or admin'},
                logger_instance=logger,
            )
            return Response(
                {'error': 'You do not have permission to delete this comment'}, status=status.HTTP_403_FORBIDDEN
            )

        try:
            comment.delete()

            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='delete_comment',
                user=request.user,
                success=True,
                duration_ms=duration_ms,
                metadata={'comment_id': comment.id, 'project_id': project_pk},
                logger_instance=logger,
            )

            return Response({'message': 'Comment deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

        except Exception as error:
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='delete_comment',
                user=request.user,
                success=False,
                duration_ms=duration_ms,
                metadata={'comment_id': comment.id, 'project_id': project_pk},
                error=error,
                logger_instance=logger,
            )
            raise

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
        start_time = time.time()
        project_id = self.kwargs.get('project_pk')
        queryset = ProjectComment.objects.filter(project_id=project_id)

        # Non-admin users only see approved comments
        if not self.request.user.is_authenticated or not self.request.user.is_admin_role:
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

        # Log query performance
        duration_ms = (time.time() - start_time) * 1000
        StructuredLogger.log_db_operation(
            operation='list',
            model='ProjectComment',
            success=True,
            duration_ms=duration_ms,
            record_count=queryset.count(),
            logger_instance=logger,
        )

        return queryset

    def get_serializer_class(self):
        """Use different serializer for create action."""
        if self.action == 'create':
            return CommentCreateSerializer
        return ProjectCommentSerializer

    def create(self, request, *args, **kwargs):
        """Create a new comment with moderation."""
        start_time = time.time()
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
            StructuredLogger.log_validation_error(
                message='Duplicate comment attempt',
                user=request.user,
                errors={'duplicate': 'Comment posted within 5 minutes'},
                logger_instance=logger,
            )
            return Response(
                {'error': 'You already posted this comment recently. Please wait before posting duplicate content.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            # Create comment with moderation
            comment = serializer.save(user=request.user, project=project)

            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='create_comment',
                user=request.user,
                success=True,
                duration_ms=duration_ms,
                metadata={
                    'project_id': project.id,
                    'comment_id': comment.id,
                    'moderation_status': comment.moderation_status,
                    'content_length': len(content),
                },
                logger_instance=logger,
            )

            # Return full comment data with completed quests
            output_serializer = ProjectCommentSerializer(comment, context={'request': request})
            response_data = output_serializer.data

            # Track quest completion only for comments on OTHER users' projects
            if project.user != request.user:
                from core.thrive_circle.quest_tracker import track_quest_action
                from core.thrive_circle.signals import _mark_as_tracked
                from core.thrive_circle.utils import format_completed_quests

                # Mark as tracked to prevent double-tracking from signal
                _mark_as_tracked('comment_created', request.user.id, str(comment.id))

                # Explicitly track the action and get completed quest IDs
                completed_ids = track_quest_action(
                    request.user,
                    'comment_created',
                    {
                        'project_id': project.id,
                        'comment_id': comment.id,
                    },
                )

                if completed_ids:
                    response_data['completed_quests'] = format_completed_quests(request.user, completed_ids)

            return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as error:
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='create_comment',
                user=request.user,
                success=False,
                duration_ms=duration_ms,
                metadata={'project_id': project.id, 'content_length': len(content)},
                error=error,
                logger_instance=logger,
            )
            raise

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
        start_time = time.time()
        comment = self.get_object()
        vote_type = request.data.get('vote_type')

        if vote_type not in ['up', 'down']:
            StructuredLogger.log_validation_error(
                message='Invalid vote type',
                user=request.user,
                errors={'vote_type': f'Invalid value: {vote_type}'},
                logger_instance=logger,
            )
            return Response({'error': 'vote_type must be "up" or "down"'}, status=status.HTTP_400_BAD_REQUEST)

        try:
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

            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='vote_comment',
                user=request.user,
                success=True,
                duration_ms=duration_ms,
                metadata={'comment_id': comment.id, 'vote_type': vote_type, 'action': action_taken},
                logger_instance=logger,
            )

            # Return updated comment data
            serializer = ProjectCommentSerializer(comment, context={'request': request})
            return Response({'action': action_taken, 'comment': serializer.data})

        except Exception as error:
            duration_ms = (time.time() - start_time) * 1000
            StructuredLogger.log_service_operation(
                service_name='CommentService',
                operation='vote_comment',
                user=request.user,
                success=False,
                duration_ms=duration_ms,
                metadata={'comment_id': comment.id, 'vote_type': vote_type},
                error=error,
                logger_instance=logger,
            )
            raise


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_comment(request, project_pk, comment_id):
    """
    Delete a comment (only owner or admin can delete).
    """
    from core.users.models import UserRole

    start_time = time.time()
    comment = get_object_or_404(ProjectComment, id=comment_id, project_id=project_pk)

    # Check permissions: owner or admin can delete
    is_owner = comment.user == request.user
    is_admin = request.user.role == UserRole.ADMIN

    if not is_owner and not is_admin:
        StructuredLogger.log_validation_error(
            message='Unauthorized comment deletion attempt',
            user=request.user,
            errors={'comment_id': comment_id, 'reason': 'Not owner or admin'},
            logger_instance=logger,
        )
        return Response(
            {'error': 'You do not have permission to delete this comment'}, status=status.HTTP_403_FORBIDDEN
        )

    try:
        comment.delete()

        duration_ms = (time.time() - start_time) * 1000
        StructuredLogger.log_service_operation(
            service_name='CommentService',
            operation='delete_comment',
            user=request.user,
            success=True,
            duration_ms=duration_ms,
            metadata={'comment_id': comment_id, 'project_id': project_pk},
            logger_instance=logger,
        )

        return Response({'message': 'Comment deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

    except Exception as error:
        duration_ms = (time.time() - start_time) * 1000
        StructuredLogger.log_service_operation(
            service_name='CommentService',
            operation='delete_comment',
            user=request.user,
            success=False,
            duration_ms=duration_ms,
            metadata={'comment_id': comment_id, 'project_id': project_pk},
            error=error,
            logger_instance=logger,
        )
        raise
