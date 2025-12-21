"""
REST API Views for Community Messaging

Provides endpoints for:
- Rooms: List, create, join, leave, manage
- Messages: List, create, edit, delete, react
- Threads: List, create, manage
- DMs: List threads, create threads
- Moderation: Queue, actions
"""

import logging

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DirectMessageThread,
    Message,
    MessageReaction,
    ModerationQueue,
    Room,
    RoomMembership,
    Thread,
)
from .permissions import (
    CanCreateRoom,
    IsDMParticipant,
    IsMessageAuthor,
    IsRoomMember,
    IsRoomModerator,
    IsRoomOwnerOrAdmin,
)
from .serializers import (
    DirectMessageCreateSerializer,
    DirectMessageThreadSerializer,
    MessageCreateSerializer,
    MessageReactionSerializer,
    MessageSerializer,
    ModerationQueueSerializer,
    RoomCreateSerializer,
    RoomListSerializer,
    RoomMembershipSerializer,
    RoomSerializer,
    ThreadSerializer,
)
from .services import (
    BlockService,
    DirectMessageService,
    ModerationService,
    RoomService,
)

logger = logging.getLogger(__name__)


class RoomViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Room operations.

    Endpoints:
    - GET /rooms/ - List accessible rooms
    - POST /rooms/ - Create a new room (trust-gated)
    - GET /rooms/{id}/ - Get room details
    - PATCH /rooms/{id}/ - Update room (owner/admin only)
    - DELETE /rooms/{id}/ - Archive room (owner only)
    - POST /rooms/{id}/join/ - Join room
    - POST /rooms/{id}/leave/ - Leave room
    - GET /rooms/{id}/members/ - List room members
    """

    permission_classes = [IsAuthenticated]
    # Disable pagination for room list - rooms are few enough to not need it
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        room_type = self.request.query_params.get('type')

        # Public rooms + rooms user is member of
        public = Q(visibility='public', is_active=True)
        member = Q(
            memberships__user=user,
            memberships__is_active=True,
            is_active=True,
        )
        member = member & ~Q(memberships__role='banned')

        queryset = Room.objects.filter(public | member).distinct()

        if room_type:
            queryset = queryset.filter(room_type=room_type)

        return queryset.order_by('position', 'name')

    def get_serializer_class(self):
        if self.action == 'list':
            return RoomListSerializer
        if self.action == 'create':
            return RoomCreateSerializer
        return RoomSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), CanCreateRoom()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsRoomOwnerOrAdmin()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsRoomOwnerOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        room = RoomService.create_room(
            name=serializer.validated_data['name'],
            creator=self.request.user,
            description=serializer.validated_data.get('description', ''),
            icon=serializer.validated_data.get('icon', 'comments'),
            visibility=serializer.validated_data.get('visibility', 'public'),
        )
        serializer.instance = room

    def perform_destroy(self, instance):
        # Soft delete - archive the room
        instance.is_archived = True
        instance.is_active = False
        instance.save()
        logger.info(f'Room {instance.name} archived by user {self.request.user.id}')

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a room."""
        room = self.get_object()

        # Check if room is joinable
        if room.visibility == 'unlisted':
            return Response(
                {'error': 'This room is invite-only.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check trust requirements
        user_trust = getattr(request.user, 'trust_level', 0)
        if user_trust < room.min_trust_to_join:
            return Response(
                {'error': 'You do not meet the trust requirements to join this room.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership = RoomService.join_room(room, request.user)
        return Response(
            RoomMembershipSerializer(membership).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a room."""
        room = self.get_object()
        RoomService.leave_room(room, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List room members."""
        room = self.get_object()
        memberships = (
            RoomMembership.objects.filter(
                room=room,
                is_active=True,
            )
            .exclude(role='banned')
            .select_related('user')
        )

        serializer = RoomMembershipSerializer(memberships, many=True)
        return Response(serializer.data)


class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Message operations.

    Endpoints:
    - GET /rooms/{room_id}/messages/ - List messages (cursor-based pagination)
    - POST /rooms/{room_id}/messages/ - Send a message
    - PATCH /messages/{id}/ - Edit message (author only)
    - DELETE /messages/{id}/ - Delete message (author/moderator)
    - POST /messages/{id}/react/ - Add reaction
    - DELETE /messages/{id}/react/ - Remove reaction
    - POST /messages/{id}/report/ - Report message
    """

    permission_classes = [IsAuthenticated, IsRoomMember]

    def get_queryset(self):
        room_id = self.kwargs.get('room_id')
        if room_id:
            queryset = Message.objects.filter(
                room_id=room_id,
                is_hidden=False,
            ).select_related('author')
        else:
            queryset = Message.objects.none()

        # Apply blocked user filter
        blocked_ids = BlockService.get_blocked_user_ids(self.request.user)
        if blocked_ids:
            queryset = queryset.exclude(author_id__in=blocked_ids)

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return MessageCreateSerializer
        return MessageSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsMessageAuthor()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsMessageAuthor() | IsRoomModerator()]
        return super().get_permissions()

    def list(self, request, room_id=None):
        """List messages with cursor-based pagination."""
        queryset = self.get_queryset()

        # Cursor-based pagination
        cursor = request.query_params.get('cursor')
        limit = min(int(request.query_params.get('limit', 50)), 100)

        if cursor:
            try:
                cursor_message = Message.objects.get(id=cursor)
                queryset = queryset.filter(created_at__lt=cursor_message.created_at)
            except Message.DoesNotExist:
                pass

        messages = list(queryset[:limit])
        serializer = self.get_serializer(reversed(messages), many=True)

        return Response(
            {
                'messages': serializer.data,
                'has_more': len(messages) == limit,
                'cursor': str(messages[-1].id) if messages else None,
            }
        )

    def create(self, request, room_id=None):
        """Send a new message."""
        room = get_object_or_404(Room, id=room_id, is_active=True)

        # Check post permissions
        self.check_object_permissions(request, room)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check for content moderation
        content = serializer.validated_data['content']
        moderation_result = ModerationService.check_content(content)

        if moderation_result.get('flagged') and moderation_result.get('scores', {}).get('severe', 0) > 0.7:
            return Response(
                {'error': 'Your message was blocked by content moderation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create message
        message = Message.objects.create(
            room=room,
            author=request.user,
            content=content,
            attachments=serializer.validated_data.get('attachments', []),
            mentions=serializer.validated_data.get('mentions', []),
        )

        # Handle reply
        reply_to_id = serializer.validated_data.get('reply_to_id')
        if reply_to_id:
            try:
                message.reply_to = Message.objects.get(id=reply_to_id, room=room)
                message.save(update_fields=['reply_to'])
            except Message.DoesNotExist:
                pass

        # Flag for moderation if needed
        if moderation_result.get('flagged'):
            ModerationService.flag_message(
                message,
                ai_flagged=True,
                ai_scores=moderation_result.get('scores'),
                ai_reason=moderation_result.get('reason'),
            )

        # Update room stats
        room.last_message_at = message.created_at
        room.message_count = room.message_count + 1
        room.save(update_fields=['last_message_at', 'message_count'])

        return Response(
            MessageSerializer(message).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post', 'delete'])
    def react(self, request, pk=None, room_id=None):
        """Add or remove a reaction."""
        message = self.get_object()
        emoji = request.data.get('emoji', '')

        if not emoji:
            return Response(
                {'error': 'Emoji is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.method == 'POST':
            reaction, created = MessageReaction.objects.get_or_create(
                message=message,
                user=request.user,
                emoji=emoji,
            )
            if created:
                # Update cached reaction counts
                counts = message.reaction_counts or {}
                counts[emoji] = counts.get(emoji, 0) + 1
                message.reaction_counts = counts
                message.save(update_fields=['reaction_counts'])

            return Response(
                MessageReactionSerializer(reaction).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        else:
            deleted, _ = MessageReaction.objects.filter(
                message=message,
                user=request.user,
                emoji=emoji,
            ).delete()

            if deleted:
                # Update cached reaction counts
                counts = message.reaction_counts or {}
                if emoji in counts:
                    counts[emoji] = max(0, counts[emoji] - 1)
                    if counts[emoji] == 0:
                        del counts[emoji]
                message.reaction_counts = counts
                message.save(update_fields=['reaction_counts'])

            return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None, room_id=None):
        """Report a message for moderation."""
        message = self.get_object()
        reason = request.data.get('reason', '')

        ModerationService.report_message(message, request.user, reason)

        return Response(
            {'message': 'Report submitted. Thank you for helping keep our community safe.'},
            status=status.HTTP_200_OK,
        )


class ThreadViewSet(viewsets.ModelViewSet):
    """ViewSet for Thread operations."""

    permission_classes = [IsAuthenticated, IsRoomMember]
    serializer_class = ThreadSerializer

    def get_queryset(self):
        room_id = self.kwargs.get('room_id')
        return Thread.objects.filter(
            room_id=room_id,
            is_archived=False,
        ).order_by('-is_pinned', '-last_message_at')


class DirectMessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Direct Message operations.

    Endpoints:
    - GET /messages/dm/ - List DM threads
    - POST /messages/dm/ - Create new DM thread
    - GET /messages/dm/{id}/ - Get DM thread details
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DirectMessageThreadSerializer

    def get_queryset(self):
        return DirectMessageThread.objects.filter(
            participants=self.request.user,
        ).order_by('-last_message_at')

    def get_permissions(self):
        if self.action in ('retrieve', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsDMParticipant()]
        return super().get_permissions()

    def create(self, request):
        """Create a new DM thread."""
        serializer = DirectMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from core.users.models import User

        participant_ids = serializer.validated_data['participant_ids']
        participants = list(User.objects.filter(id__in=participant_ids, is_active=True))

        # Check if any participants have blocked the user
        for participant in participants:
            if BlockService.is_blocked(participant, request.user):
                return Response(
                    {'error': 'Cannot message one or more of these users.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        thread = DirectMessageService.get_or_create_dm_thread(
            participants=participants,
            created_by=request.user,
        )

        # Send initial message if provided
        initial_message = serializer.validated_data.get('initial_message')
        if initial_message:
            Message.objects.create(
                room=thread.room,
                author=request.user,
                content=initial_message,
            )
            thread.last_message_at = Message.objects.filter(room=thread.room).latest('created_at').created_at
            thread.save(update_fields=['last_message_at'])

        return Response(
            DirectMessageThreadSerializer(thread).data,
            status=status.HTTP_201_CREATED,
        )


class ModerationQueueViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Moderation Queue operations.

    Staff only - for reviewing flagged content.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ModerationQueueSerializer

    def get_queryset(self):
        if not self.request.user.is_staff:
            return ModerationQueue.objects.none()
        return ModerationQueue.objects.filter(
            status='pending',
        ).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve flagged content."""
        if not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)

        queue_item = self.get_object()
        queue_item.status = 'approved'
        queue_item.reviewed_by = request.user
        queue_item.reviewed_at = timezone.now()
        queue_item.review_notes = request.data.get('notes', '')
        queue_item.save()

        # Unflag message
        queue_item.message.is_flagged = False
        queue_item.message.save(update_fields=['is_flagged'])

        return Response(self.get_serializer(queue_item).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject and hide flagged content."""
        if not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)

        queue_item = self.get_object()
        queue_item.status = 'rejected'
        queue_item.reviewed_by = request.user
        queue_item.reviewed_at = timezone.now()
        queue_item.review_notes = request.data.get('notes', '')
        queue_item.save()

        # Hide message
        queue_item.message.is_hidden = True
        queue_item.message.save(update_fields=['is_hidden'])

        # Create moderation action
        ModerationService.take_action(
            action_type='hide',
            target_user=queue_item.message.author,
            moderator=request.user,
            message=queue_item.message,
            reason=request.data.get('notes', 'Content policy violation'),
        )

        return Response(self.get_serializer(queue_item).data)


class BlockView(APIView):
    """
    API for blocking/unblocking users.

    POST /community/block/ - Block a user
    DELETE /community/block/ - Unblock a user
    GET /community/block/ - List blocked users
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List blocked users."""
        from core.users.models import User

        blocked_ids = BlockService.get_blocked_user_ids(request.user)
        blocked_users = User.objects.filter(id__in=blocked_ids).values('id', 'username')
        return Response(list(blocked_users))

    def post(self, request):
        """Block a user."""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from core.users.models import User

        try:
            blocked = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        BlockService.block_user(request.user, blocked)
        return Response({'message': f'Blocked {blocked.username}'})

    def delete(self, request):
        """Unblock a user."""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from core.users.models import User

        try:
            blocked = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        BlockService.unblock_user(request.user, blocked)
        return Response({'message': f'Unblocked {blocked.username}'})
