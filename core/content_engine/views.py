"""API views for Content Engine."""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BrainstormSession, BrandVoice, ContentClip, ContentIdea, ScheduledPost
from .serializers import (
    BrainstormSessionSerializer,
    BrandVoiceSerializer,
    ContentClipCreateSerializer,
    ContentClipSerializer,
    ContentClipUpdateSerializer,
    ContentIdeaCreateSerializer,
    ContentIdeaSerializer,
    ScheduledPostCreateSerializer,
    ScheduledPostSerializer,
)


class BrandVoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for BrandVoice."""

    serializer_class = BrandVoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BrandVoice.objects.filter(user=self.request.user)

    def get_object(self):
        # Get or create brand voice for user
        obj, _ = BrandVoice.objects.get_or_create(user=self.request.user)
        return obj

    def list(self, request, *args, **kwargs):
        # Return single object for current user
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        # Update existing or create new
        obj, created = BrandVoice.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class ContentIdeaViewSet(viewsets.ModelViewSet):
    """ViewSet for ContentIdea."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ContentIdea.objects.filter(user=self.request.user).select_related('pillar', 'brainstorm_session')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by content pillar (legacy field)
        pillar = self.request.query_params.get('pillar')
        if pillar:
            queryset = queryset.filter(content_pillar__icontains=pillar)

        # Filter by pillar_id (FK)
        pillar_id = self.request.query_params.get('pillar_id')
        if pillar_id:
            queryset = queryset.filter(pillar_id=pillar_id)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return ContentIdeaCreateSerializer
        return ContentIdeaSerializer

    def create(self, request, *args, **kwargs):
        """Create a new content idea and return full serialized response."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        # Return the full response using ContentIdeaSerializer
        response_serializer = ContentIdeaSerializer(instance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive an idea."""
        idea = self.get_object()
        idea.status = ContentIdea.Status.ARCHIVED
        idea.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore an archived idea."""
        idea = self.get_object()
        idea.status = ContentIdea.Status.SAVED
        idea.save()
        return Response({'status': 'restored'})


class ContentClipViewSet(viewsets.ModelViewSet):
    """ViewSet for ContentClip."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ContentClip.objects.filter(user=self.request.user)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return ContentClipCreateSerializer
        if self.action in ['update', 'partial_update']:
            return ContentClipUpdateSerializer
        return ContentClipSerializer

    @action(detail=True, methods=['post'])
    def submit_for_review(self, request, pk=None):
        """Submit clip for review."""
        clip = self.get_object()
        clip.status = ContentClip.Status.READY_FOR_REVIEW
        clip.save()
        return Response({'status': 'ready_for_review'})

    @action(detail=True, methods=['post'])
    def request_changes(self, request, pk=None):
        """Request changes to a clip."""
        clip = self.get_object()
        clip.status = ContentClip.Status.NEEDS_CHANGES
        notes = request.data.get('notes', '')
        if notes:
            if clip.review_notes:
                clip.review_notes += f'\n\n---\n\nChanges requested:\n{notes}'
            else:
                clip.review_notes = f'Changes requested:\n{notes}'
        clip.save()
        return Response({'status': 'needs_changes'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a clip for scheduling."""
        clip = self.get_object()
        if clip.status not in [ContentClip.Status.READY_FOR_REVIEW, ContentClip.Status.NEEDS_CHANGES]:
            return Response(
                {'error': 'Clip must be in review status to approve'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        clip.status = ContentClip.Status.APPROVED
        clip.save()
        return Response({'status': 'approved'})


class ScheduledPostViewSet(viewsets.ModelViewSet):
    """ViewSet for ScheduledPost."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ScheduledPost.objects.filter(user=self.request.user)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by platform
        platform = self.request.query_params.get('platform')
        if platform:
            queryset = queryset.filter(platform=platform)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(scheduled_for__gte=start_date)
        if end_date:
            queryset = queryset.filter(scheduled_for__lte=end_date)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return ScheduledPostCreateSerializer
        return ScheduledPostSerializer

    @action(detail=True, methods=['post'])
    def publish_now(self, request, pk=None):
        """Publish a scheduled post immediately."""
        post = self.get_object()
        if post.status != ScheduledPost.Status.SCHEDULED:
            return Response(
                {'error': 'Post must be in scheduled status to publish'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # TODO: Trigger async publishing task
        # For now, just mark as publishing
        post.status = ScheduledPost.Status.PUBLISHING
        post.save()

        # Import and call the publish task
        from .tasks import publish_post

        publish_post.delay(post.id)

        return Response({'status': 'publishing'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a scheduled post."""
        post = self.get_object()
        if post.status != ScheduledPost.Status.SCHEDULED:
            return Response(
                {'error': 'Only scheduled posts can be cancelled'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        post.status = ScheduledPost.Status.CANCELLED
        post.save()

        # Update clip status back to approved
        post.clip.status = ContentClip.Status.APPROVED
        post.clip.save()

        return Response({'status': 'cancelled'})


class BrainstormSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for BrainstormSession."""

    serializer_class = BrainstormSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BrainstormSession.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_message(self, request, pk=None):
        """Add a message to the brainstorm session."""
        session = self.get_object()
        message = request.data.get('message')
        role = request.data.get('role', 'user')

        if not message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        session.messages.append({'role': role, 'content': message, 'timestamp': timezone.now().isoformat()})
        session.save()

        return Response({'status': 'message_added', 'messages': session.messages})

    @action(detail=True, methods=['post'])
    def generate_idea(self, request, pk=None):
        """Generate an idea from the brainstorm session."""
        session = self.get_object()
        title = request.data.get('title')
        description = request.data.get('description', '')

        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        idea = ContentIdea.objects.create(
            user=self.request.user,
            title=title,
            description=description,
            source=ContentIdea.Source.BRAINSTORM,
            planned_for_week=session.target_week,
        )
        session.generated_ideas.add(idea)

        return Response(ContentIdeaSerializer(idea).data, status=status.HTTP_201_CREATED)


class CalendarView(APIView):
    """Calendar view returning scheduled posts for a date range.

    Returns a flat array of ScheduledPost objects for the frontend calendar.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        # Get all scheduled and published posts in the date range
        queryset = ScheduledPost.objects.filter(user=user).select_related('clip')

        if start_date:
            queryset = queryset.filter(scheduled_for__gte=start_date)
        if end_date:
            queryset = queryset.filter(scheduled_for__lte=end_date)

        # Order by scheduled time
        queryset = queryset.order_by('scheduled_for')

        # Return flat array of scheduled posts
        return Response(ScheduledPostSerializer(queryset, many=True).data)


class PipelineStatsView(APIView):
    """Pipeline statistics overview."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        stats = {
            'ideas_count': ContentIdea.objects.filter(user=user, status__in=['saved', 'planned']).count(),
            'clips_draft_count': ContentClip.objects.filter(user=user, status=ContentClip.Status.DRAFT).count(),
            'clips_review_count': ContentClip.objects.filter(
                user=user, status__in=[ContentClip.Status.READY_FOR_REVIEW, ContentClip.Status.NEEDS_CHANGES]
            ).count(),
            'clips_approved_count': ContentClip.objects.filter(user=user, status=ContentClip.Status.APPROVED).count(),
            'scheduled_count': ScheduledPost.objects.filter(user=user, status=ScheduledPost.Status.SCHEDULED).count(),
            'published_count': ScheduledPost.objects.filter(user=user, status=ScheduledPost.Status.PUBLISHED).count(),
        }

        return Response(stats)
