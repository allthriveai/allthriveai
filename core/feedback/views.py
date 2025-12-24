from django.db.models import Count, Exists, F, OuterRef
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.pagination import CustomPageNumberPagination

from .models import FeedbackItem, FeedbackVote
from .serializers import (
    FeedbackCommentSerializer,
    FeedbackItemCreateSerializer,
    FeedbackItemSerializer,
)


class FeedbackSubmitThrottle(UserRateThrottle):
    """Limit feedback submissions."""

    rate = '30/hour'


class FeedbackVoteThrottle(UserRateThrottle):
    """Limit votes."""

    rate = '100/hour'


class FeedbackCommentThrottle(UserRateThrottle):
    """Limit comments."""

    rate = '30/hour'


class FeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for feedback items with voting and comments."""

    permission_classes = [IsAuthenticated]  # Members only
    pagination_class = CustomPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['feedback_type', 'status']
    search_fields = ['title', 'description']
    ordering_fields = ['vote_count', 'created_at']
    ordering = ['-vote_count', '-created_at']

    def get_queryset(self):
        """Optimize queries with select_related and annotate has_voted + comment_count."""
        qs = FeedbackItem.objects.select_related('user')

        # Filter to user's own submissions if accessed via /me/feedback/
        if self.basename == 'me-feedback':
            qs = qs.filter(user=self.request.user)

        # Annotate comment count (avoids N+1)
        qs = qs.annotate(annotated_comment_count=Count('comments'))

        # Annotate whether current user has voted (avoids N+1)
        if self.request.user.is_authenticated:
            qs = qs.annotate(
                user_has_voted=Exists(FeedbackVote.objects.filter(user=self.request.user, feedback_item=OuterRef('pk')))
            )
        return qs

    def get_serializer_class(self):
        """Use create serializer for POST, full serializer otherwise."""
        if self.action == 'create':
            return FeedbackItemCreateSerializer
        return FeedbackItemSerializer

    def get_throttles(self):
        """Apply stricter throttle for create/vote/comment actions."""
        if self.action == 'create':
            return [FeedbackSubmitThrottle()]
        if self.action == 'toggle_vote':
            return [FeedbackVoteThrottle()]
        if self.action == 'comments' and self.request.method == 'POST':
            return [FeedbackCommentThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        """Create feedback item and return full serialized response."""
        from .tasks import generate_haven_response

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)

        # Trigger Haven's auto-comment (async via Celery)
        generate_haven_response.delay(instance.id, request.user.id)

        # Return the full serialized object with user data
        response_serializer = FeedbackItemSerializer(instance, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle-vote')
    def toggle_vote(self, request, pk=None):
        """Toggle vote on a feedback item."""
        item = self.get_object()

        # Prevent voting on own submission
        if item.user_id == request.user.id:
            return Response({'error': 'Cannot vote on your own submission'}, status=status.HTTP_400_BAD_REQUEST)

        existing_vote = FeedbackVote.objects.filter(user=request.user, feedback_item=item).first()

        if existing_vote:
            existing_vote.delete()
            item.vote_count = F('vote_count') - 1
            voted = False
        else:
            FeedbackVote.objects.create(user=request.user, feedback_item=item)
            item.vote_count = F('vote_count') + 1
            voted = True

        item.save(update_fields=['vote_count'])
        item.refresh_from_db()

        # Return snake_case - axios interceptors convert to camelCase
        return Response(
            {
                'voted': voted,
                'vote_count': item.vote_count,
            }
        )

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        """List or add comments on a feedback item."""
        from .tasks import generate_haven_comment_reply

        item = self.get_object()

        if request.method == 'GET':
            comments = item.comments.select_related('user')
            serializer = FeedbackCommentSerializer(comments, many=True)
            return Response(serializer.data)

        # POST - add comment
        serializer = FeedbackCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user, feedback_item=item)

        # Trigger Haven's reply (async via Celery)
        generate_haven_comment_reply.delay(item.id, comment.id)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='comments/(?P<comment_id>[^/.]+)')
    def delete_comment(self, request, pk=None, comment_id=None):
        """Delete own comment."""
        item = self.get_object()
        comment = get_object_or_404(item.comments, pk=comment_id)

        # Only allow deleting own comments (or admin)
        if comment.user_id != request.user.id and not request.user.is_staff:
            return Response(
                {'error': "Cannot delete another user's comment"},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='admin-update')
    def admin_update(self, request, pk=None):
        """Admin-only endpoint to update status and admin response."""
        # Only staff/admin can use this
        if not request.user.is_staff:
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        item = self.get_object()

        # Update allowed fields
        if 'status' in request.data:
            if request.data['status'] in ['open', 'in_progress', 'completed', 'declined']:
                item.status = request.data['status']
            else:
                return Response(
                    {'error': 'Invalid status value'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if 'admin_response' in request.data:
            item.admin_response = request.data['admin_response']

        item.save()

        # Return updated item
        serializer = FeedbackItemSerializer(item, context={'request': request})
        return Response(serializer.data)
