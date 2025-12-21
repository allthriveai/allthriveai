"""
Custom permissions for Community Messaging

Handles access control for rooms, messages, and moderation.
"""

from rest_framework import permissions

from .models import Room, RoomMembership


class IsRoomMember(permissions.BasePermission):
    """
    Permission check for room access.

    Public rooms are accessible to all authenticated users.
    Private/unlisted rooms require membership.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Handle Room objects directly
        if isinstance(obj, Room):
            room = obj
        elif hasattr(obj, 'room'):
            room = obj.room
        else:
            return False

        # Public rooms are accessible to all authenticated users
        if room.visibility == 'public':
            return True

        # Check membership for private/unlisted rooms
        return (
            RoomMembership.objects.filter(
                room=room,
                user=request.user,
                is_active=True,
            )
            .exclude(role='banned')
            .exists()
        )


class CanPostInRoom(permissions.BasePermission):
    """
    Permission check for posting in a room.

    Checks:
    - User is authenticated
    - User is not muted or banned
    - Room is not archived
    - User meets trust requirements
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Handle Room objects directly
        if isinstance(obj, Room):
            room = obj
        elif hasattr(obj, 'room'):
            room = obj.room
        else:
            return False

        # Cannot post in archived rooms
        if room.is_archived:
            return False

        # Check membership status
        try:
            membership = RoomMembership.objects.get(room=room, user=request.user)
            if membership.role in ('muted', 'banned'):
                return False
        except RoomMembership.DoesNotExist:
            # Public rooms allow posting without explicit membership
            if room.visibility != 'public':
                return False

        # Check trust requirements
        user_trust = getattr(request.user, 'trust_level', 0)
        if user_trust < room.min_trust_to_post:
            return False

        return True


class IsRoomModerator(permissions.BasePermission):
    """
    Permission check for moderation actions.

    Moderators can:
    - Delete messages
    - Mute/ban users
    - Lock threads
    - Pin messages
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Staff always have moderation access
        if request.user.is_staff:
            return True

        # Handle Room objects directly
        if isinstance(obj, Room):
            room = obj
        elif hasattr(obj, 'room'):
            room = obj.room
        else:
            return False

        # Check for moderator role
        try:
            membership = RoomMembership.objects.get(room=room, user=request.user)
            return membership.role in ('owner', 'admin', 'moderator')
        except RoomMembership.DoesNotExist:
            return False


class IsRoomOwnerOrAdmin(permissions.BasePermission):
    """
    Permission check for room management.

    Owners/admins can:
    - Update room settings
    - Manage roles
    - Archive rooms
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        # Staff always have admin access
        if request.user.is_staff:
            return True

        # Handle Room objects directly
        if isinstance(obj, Room):
            room = obj
        elif hasattr(obj, 'room'):
            room = obj.room
        else:
            return False

        # Check for admin role
        try:
            membership = RoomMembership.objects.get(room=room, user=request.user)
            return membership.role in ('owner', 'admin')
        except RoomMembership.DoesNotExist:
            return False


class CanCreateRoom(permissions.BasePermission):
    """
    Permission check for room creation.

    Trust-gated: Users must have sent 10+ messages and be active 7+ days.
    """

    message = 'You need to be active for at least 7 days and send 10 messages to create a room.'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Staff can always create rooms
        if request.user.is_staff:
            return True

        # Check trust requirements
        # TODO: Implement proper trust calculation based on user activity
        user = request.user

        # Check account age (7 days)
        from datetime import timedelta

        from django.utils import timezone

        if user.date_joined > timezone.now() - timedelta(days=7):
            return False

        # Check message count (10 messages across all rooms)
        total_messages = RoomMembership.objects.filter(
            user=user,
            is_active=True,
        ).values_list('messages_sent', flat=True)

        if sum(total_messages) < 10:
            return False

        return True


class IsDMParticipant(permissions.BasePermission):
    """
    Permission check for DM thread access.

    Only participants can access a DM thread.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        from .models import DirectMessageThread

        if isinstance(obj, DirectMessageThread):
            return obj.participants.filter(id=request.user.id).exists()

        return False


class IsMessageAuthor(permissions.BasePermission):
    """
    Permission check for message editing/deletion.

    Only the author can edit/delete their own messages.
    (Moderators use separate permissions)
    """

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False

        from .models import Message

        if isinstance(obj, Message):
            return obj.author_id == request.user.id

        return False
