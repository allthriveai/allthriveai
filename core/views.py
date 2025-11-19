from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import connections
from django.db.utils import OperationalError
from .models import Conversation, Message, Project, User
from .serializers import ConversationSerializer, MessageSerializer, ProjectSerializer


@api_view(['GET'])
@permission_classes([AllowAny])
def db_health(request):
    """Health check endpoint to verify database connectivity.

    Returns 200 with {'status': 'ok'} when SELECT 1 succeeds, 503 otherwise.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1;')
            cursor.fetchone()
        return Response({'status': 'ok'})
    except OperationalError as e:
        return Response({'status': 'error', 'detail': str(e)}, status=503)

class ConversationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing conversations."""
    serializer_class = ConversationSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Conversation.objects.filter(user=self.request.user)
        return Conversation.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message in a conversation and get AI response."""
        conversation = self.get_object()
        message_content = request.data.get('content', '')

        if not message_content:
            return Response(
                {'error': 'Message content is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create user message
        user_message = Message.objects.create(
            conversation=conversation,
            role='user',
            content=message_content
        )

        # TODO: Integrate with AI service (OpenAI/Anthropic)
        # For now, return a placeholder response
        assistant_response = "AI response placeholder - integrate with OpenAI/Anthropic"

        assistant_message = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=assistant_response
        )

        return Response({
            'user_message': MessageSerializer(user_message).data,
            'assistant_message': MessageSerializer(assistant_message).data
        })


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing messages."""
    serializer_class = MessageSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Message.objects.filter(conversation__user=self.request.user)
        return Message.objects.none()


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user projects.

    All projects are scoped to the authenticated user; `user` is never
    client-controlled.
    """

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only return projects for the current user
        return Project.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Bind project to the authenticated user and let the model handle slug
        # generation / uniqueness on save.
        serializer.save(user=self.request.user)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_user_projects(request, username):
    """Get public showcase projects for a user by username.

    Returns only published showcase projects that are not archived.
    This endpoint is accessible to everyone, including logged-out users.

    Security:
    - Rate limited to prevent data harvesting
    - Uses select_related to prevent N+1 queries
    - Consistent response time to prevent user enumeration
    """
    import time
    from django.core.cache import cache
    from django.conf import settings
    from core.throttles import PublicProjectsThrottle, AuthenticatedProjectsThrottle
    import logging

    logger = logging.getLogger(__name__)

    # Apply throttling based on authentication status
    throttle_class = AuthenticatedProjectsThrottle if request.user.is_authenticated else PublicProjectsThrottle
    throttle = throttle_class()
    if not throttle.allow_request(request, None):
        from rest_framework.exceptions import Throttled
        raise Throttled(wait=throttle.wait())

    start_time = time.time()

    # Check cache for public projects
    is_own_profile = request.user.is_authenticated and request.user.username.lower() == username.lower()
    cache_key = f"projects:{username.lower()}:{'own' if is_own_profile else 'public'}"

    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)

    try:
        user = User.objects.get(username=username.lower())
    except User.DoesNotExist:
        # Log suspicious activity - repeated requests for non-existent users
        logger.warning(
            f"Public project access attempt for non-existent user: {username} "
            f"from IP: {request.META.get('REMOTE_ADDR')}"
        )
        # Return 404 but maintain consistent response time
        elapsed = time.time() - start_time
        if elapsed < 0.05:
            time.sleep(0.05 - elapsed)
        return Response(
            {'error': 'User not found', 'showcase': [], 'playground': []},
            status=404
        )

    # Optimize query with select_related to prevent N+1 queries
    # The serializer accesses user.username, so we fetch user data upfront
    showcase_projects = Project.objects.select_related('user').filter(
        user=user,
        is_showcase=True,
        is_archived=False
    ).order_by('-created_at')

    # If the requesting user is authenticated and viewing their own profile,
    # also include playground projects
    if is_own_profile:
        playground_projects = Project.objects.select_related('user').filter(
            user=user,
            is_archived=False
        ).order_by('-created_at')

        response_data = {
            'showcase': ProjectSerializer(showcase_projects, many=True).data,
            'playground': ProjectSerializer(playground_projects, many=True).data,
        }
        # Shorter cache for own projects (they change more frequently)
        cache.set(cache_key, response_data, settings.CACHE_TTL.get('USER_PROJECTS', 60))
    else:
        # For non-authenticated users or other users, only return showcase
        response_data = {
            'showcase': ProjectSerializer(showcase_projects, many=True).data,
            'playground': [],
        }
        # Longer cache for public projects
        cache.set(cache_key, response_data, settings.CACHE_TTL.get('PUBLIC_PROJECTS', 180))

    return Response(response_data)
