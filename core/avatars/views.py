"""API views for avatars."""

import time
from urllib.parse import urlparse

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import AvatarGenerationIteration, AvatarGenerationSession, UserAvatar
from .serializers import (
    AvatarGenerationSessionCreateSerializer,
    AvatarGenerationSessionSerializer,
    SetCurrentAvatarSerializer,
    UserAvatarSerializer,
)


class AvatarGenerationThrottle(UserRateThrottle):
    """Rate limit avatar generation to 60 per minute (increased for dev)."""

    rate = '60/min'


# Allowed domains for reference images (prevent SSRF)
ALLOWED_IMAGE_DOMAINS = {
    'localhost',
    '127.0.0.1',
    'storage.googleapis.com',
    's3.amazonaws.com',
    'minio',  # Docker internal
    'allthrive-media.s3.us-west-2.amazonaws.com',  # Production S3
    'allthrive-staging-media.s3.us-west-2.amazonaws.com',  # Staging S3
}


def is_safe_url(url: str) -> bool:
    """Validate that a URL is safe to fetch (prevents SSRF attacks).

    Uses strict domain matching to prevent bypass attacks like:
    - malicious-s3.amazonaws.com (would match via endswith)
    - evil.com.localhost (would match localhost)
    """
    if not url:
        return True  # No URL is safe

    try:
        parsed = urlparse(url)
        # Must be http or https
        if parsed.scheme not in ('http', 'https'):
            return False

        # Check domain against allowlist
        hostname = parsed.hostname or ''
        hostname = hostname.lower()  # Normalize to lowercase

        for allowed in ALLOWED_IMAGE_DOMAINS:
            allowed = allowed.lower()
            if hostname == allowed:
                # Exact match
                return True
            # Check for valid subdomain: must be preceded by a dot only
            # e.g., "cdn.s3.amazonaws.com" is valid, "malicious-s3.amazonaws.com" is not
            if hostname.endswith('.' + allowed):
                # Ensure the character before the allowed domain is only a dot
                # This prevents "evil-s3.amazonaws.com" from matching "s3.amazonaws.com"
                prefix = hostname[: -len(allowed) - 1]
                # Prefix should be a valid subdomain (alphanumeric and hyphens, separated by dots)
                if prefix and all(part and part[0].isalnum() and part[-1].isalnum() for part in prefix.split('.')):
                    return True
        return False
    except Exception:
        return False


class UserAvatarViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user avatars.

    Endpoints:
    - GET /api/me/avatars/ - List all user's avatars (max 10)
    - GET /api/me/avatars/{id}/ - Get specific avatar details
    - DELETE /api/me/avatars/{id}/ - Soft delete an avatar
    - POST /api/me/avatars/set-current/ - Set avatar as current
    - GET /api/me/avatars/current/ - Get current avatar
    """

    serializer_class = UserAvatarSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only avatars for the current user."""
        return UserAvatar.objects.filter(user=self.request.user, deleted_at__isnull=True).order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        """Soft delete an avatar."""
        instance = self.get_object()

        # Don't allow deleting the current avatar without setting a new one
        if instance.is_current:
            # Find another avatar to set as current
            other_avatar = (
                UserAvatar.objects.filter(user=request.user, deleted_at__isnull=True).exclude(id=instance.id).first()
            )

            if other_avatar:
                other_avatar.is_current = True
                other_avatar.save(update_fields=['is_current'])

        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='set-current')
    def set_current(self, request):
        """
        Set an avatar as the current avatar.

        POST data: { "avatar_id": 123 }
        """
        serializer = SetCurrentAvatarSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        avatar_id = serializer.validated_data['avatar_id']

        with transaction.atomic():
            # Unset current from all avatars
            UserAvatar.objects.filter(user=request.user, is_current=True, deleted_at__isnull=True).update(
                is_current=False
            )

            # Set the new current avatar
            avatar = UserAvatar.objects.get(id=avatar_id, user=request.user)
            avatar.is_current = True
            avatar.save(update_fields=['is_current'])

            # Update user's avatar_url
            request.user.avatar_url = avatar.image_url
            request.user.save(update_fields=['avatar_url'])

        return Response(UserAvatarSerializer(avatar).data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the user's current avatar."""
        avatar = UserAvatar.objects.filter(user=request.user, is_current=True, deleted_at__isnull=True).first()

        if not avatar:
            return Response({'detail': 'No current avatar set.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(UserAvatarSerializer(avatar).data)


class AvatarGenerationSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for managing avatar generation sessions.

    Sessions are created via WebSocket when avatar generation starts.
    This ViewSet provides read-only access for history and status.

    Endpoints:
    - GET /api/me/avatar-sessions/ - List all generation sessions
    - GET /api/me/avatar-sessions/{id}/ - Get specific session details
    - GET /api/me/avatar-sessions/active/ - Get active generation session
    - POST /api/me/avatar-sessions/start/ - Start a new generation session
    - POST /api/me/avatar-sessions/{id}/accept/ - Accept and save iteration as avatar
    - POST /api/me/avatar-sessions/{id}/abandon/ - Abandon the session
    """

    serializer_class = AvatarGenerationSessionSerializer
    permission_classes = [IsAuthenticated]
    # Throttle is applied per-action below, not globally

    def get_queryset(self):
        """Return only sessions for the current user."""
        return (
            AvatarGenerationSession.objects.filter(user=self.request.user, deleted_at__isnull=True)
            .prefetch_related('iterations')
            .select_related('saved_avatar')
        )

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the user's active generation session."""
        session = (
            AvatarGenerationSession.objects.filter(
                user=request.user, status__in=['generating', 'ready'], deleted_at__isnull=True
            )
            .prefetch_related('iterations')
            .first()
        )

        if not session:
            return Response({'detail': 'No active session.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(AvatarGenerationSessionSerializer(session).data)

    @action(detail=False, methods=['post'], throttle_classes=[AvatarGenerationThrottle])
    def start(self, request):
        """
        Start a new avatar generation session.

        This creates the session record. The actual generation
        happens via WebSocket events.

        POST data:
        {
            "creation_mode": "scratch" | "template" | "make_me" | "dicebear",
            "template_used": "wizard" (optional, required for template mode),
            "reference_image_url": "https://..." (optional, required for make_me mode)
        }
        """
        # Check for existing active session
        existing = AvatarGenerationSession.objects.filter(
            user=request.user, status__in=['generating', 'ready'], deleted_at__isnull=True
        ).first()

        if existing:
            # Auto-abandon 'ready' sessions (user wants to try again)
            if existing.status == 'ready':
                existing.status = 'abandoned'
                existing.save(update_fields=['status', 'updated_at'])
            else:
                # Block if still generating
                return Response(
                    {'detail': 'You already have an active session.', 'session_id': existing.id},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = AvatarGenerationSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validate reference image URL for SSRF protection
        reference_image_url = serializer.validated_data.get('reference_image_url')
        if reference_image_url and not is_safe_url(reference_image_url):
            return Response(
                {'detail': 'Invalid reference image URL. Only approved image hosts are allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate conversation ID
        conversation_id = f'avatar-{request.user.id}-{int(time.time() * 1000)}'

        session = AvatarGenerationSession.objects.create(
            user=request.user,
            conversation_id=conversation_id,
            creation_mode=serializer.validated_data['creation_mode'],
            template_used=serializer.validated_data.get('template_used', ''),
            reference_image_url=serializer.validated_data.get('reference_image_url') or '',
            status='generating',
        )

        return Response(AvatarGenerationSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], throttle_classes=[AvatarGenerationThrottle])
    def accept(self, request, pk=None):
        """
        Accept an iteration and save it as the user's avatar.

        POST data: { "iteration_id": 123 }
        """
        iteration_id = request.data.get('iteration_id')
        if not iteration_id:
            return Response({'detail': 'iteration_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate iteration_id is a positive integer
        try:
            iteration_id = int(iteration_id)
            if iteration_id <= 0:
                raise ValueError('iteration_id must be positive')
        except (TypeError, ValueError):
            return Response({'detail': 'iteration_id must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Lock the session to prevent race conditions
            try:
                session = AvatarGenerationSession.objects.select_for_update().get(
                    pk=pk, user=request.user, deleted_at__isnull=True
                )
            except AvatarGenerationSession.DoesNotExist:
                return Response({'detail': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

            if session.status not in ['generating', 'ready']:
                return Response({'detail': 'Session is not in an active state.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                iteration = session.iterations.get(id=iteration_id)
            except AvatarGenerationIteration.DoesNotExist:
                return Response({'detail': 'Iteration not found in this session.'}, status=status.HTTP_404_NOT_FOUND)

            # Mark iteration as selected
            iteration.is_selected = True
            iteration.save(update_fields=['is_selected'])

            # Unset current from all existing avatars
            UserAvatar.objects.filter(user=request.user, is_current=True, deleted_at__isnull=True).update(
                is_current=False
            )

            # Create the avatar
            avatar = UserAvatar.objects.create(
                user=request.user,
                image_url=iteration.image_url,
                creation_mode=session.creation_mode,
                template_used=session.template_used,
                original_prompt=iteration.prompt,
                is_current=True,
            )

            # Update session
            session.status = 'accepted'
            session.saved_avatar = avatar
            session.save(update_fields=['status', 'saved_avatar', 'updated_at'])

            # Update user's avatar_url and increment counter
            request.user.avatar_url = avatar.image_url
            request.user.ai_avatars_created = (request.user.ai_avatars_created or 0) + 1
            request.user.save(update_fields=['avatar_url', 'ai_avatars_created'])

        # Check for achievement (handled by achievement system's check_and_award_achievements)
        # The tracking_field 'ai_avatars_created' will be checked automatically

        return Response(AvatarGenerationSessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def abandon(self, request, pk=None):
        """Abandon an active generation session."""
        session = self.get_object()

        if session.status not in ['generating', 'ready']:
            return Response({'detail': 'Session is not in an active state.'}, status=status.HTTP_400_BAD_REQUEST)

        session.status = 'abandoned'
        session.save(update_fields=['status', 'updated_at'])

        return Response(AvatarGenerationSessionSerializer(session).data)
