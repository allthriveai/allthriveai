"""
Business logic services for Community Messaging

Contains complex operations that span multiple models or require
external service integration (moderation, notifications, etc.)
"""

import logging
from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from .models import (
    DirectMessageThread,
    Message,
    ModerationAction,
    ModerationQueue,
    Room,
    RoomMembership,
    UserBlock,
)

logger = logging.getLogger(__name__)


class RoomService:
    """Service for room operations."""

    @staticmethod
    def create_room(
        name: str,
        creator,
        description: str = '',
        icon: str = 'comments',
        visibility: str = 'public',
        room_type: str = 'forum',
    ) -> Room:
        """
        Create a new room with the creator as owner.

        Args:
            name: Room display name
            creator: User creating the room
            description: Room description
            icon: FontAwesome icon name (e.g., 'comments', 'robot', 'book')
            visibility: 'public', 'private', or 'unlisted'
            room_type: 'forum', 'circle', or 'dm'

        Returns:
            Created Room instance
        """
        # Generate unique slug
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while Room.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1

        with transaction.atomic():
            room = Room.objects.create(
                name=name,
                slug=slug,
                description=description,
                icon=icon,
                visibility=visibility,
                room_type=room_type,
                creator=creator,
            )

            # Add creator as owner
            RoomMembership.objects.create(
                room=room,
                user=creator,
                role='owner',
            )

            # Update room member count
            room.member_count = 1
            room.save(update_fields=['member_count'])

        logger.info(f'Room created: {room.name} by user {creator.id}')
        return room

    @staticmethod
    def create_general_forum() -> Room:
        """
        Create the default General forum if it doesn't exist.

        Returns:
            The General forum Room instance
        """
        room, created = Room.objects.get_or_create(
            slug='general',
            defaults={
                'name': 'General',
                'description': 'Welcome to the community! Introduce yourself and chat about anything.',
                'icon': 'comments',
                'visibility': 'public',
                'room_type': 'forum',
                'is_default': True,
                'position': 0,
            },
        )
        if created:
            logger.info('Created default General forum')
        return room

    @staticmethod
    def join_room(room: Room, user) -> RoomMembership:
        """
        Add a user to a room.

        Args:
            room: Room to join
            user: User joining

        Returns:
            RoomMembership instance
        """
        membership, created = RoomMembership.objects.get_or_create(
            room=room,
            user=user,
            defaults={'role': 'member'},
        )

        if created:
            # Update room member count
            room.member_count = RoomMembership.objects.filter(room=room, is_active=True).exclude(role='banned').count()
            room.save(update_fields=['member_count'])
            logger.info(f'User {user.id} joined room {room.name}')
        elif not membership.is_active:
            membership.is_active = True
            membership.save(update_fields=['is_active'])
            logger.info(f'User {user.id} rejoined room {room.name}')

        return membership

    @staticmethod
    def leave_room(room: Room, user) -> None:
        """Remove a user from a room."""
        RoomMembership.objects.filter(room=room, user=user).update(is_active=False)

        # Update room member count
        room.member_count = RoomMembership.objects.filter(room=room, is_active=True).exclude(role='banned').count()
        room.save(update_fields=['member_count'])

        logger.info(f'User {user.id} left room {room.name}')

    @staticmethod
    def get_rooms_for_user(user, room_type: str | None = None) -> list[Room]:
        """
        Get rooms accessible to a user.

        Args:
            user: User to get rooms for
            room_type: Optional filter by room type

        Returns:
            List of Room instances
        """
        # Public rooms
        public_rooms = Room.objects.filter(
            is_active=True,
            visibility='public',
        )

        # Rooms user is a member of
        member_rooms = Room.objects.filter(
            is_active=True,
            memberships__user=user,
            memberships__is_active=True,
        ).exclude(memberships__role='banned')

        # Combine and deduplicate
        rooms = (public_rooms | member_rooms).distinct()

        if room_type:
            rooms = rooms.filter(room_type=room_type)

        return list(rooms.order_by('position', 'name'))


class DirectMessageService:
    """Service for direct message operations."""

    @staticmethod
    def get_or_create_dm_thread(
        participants: list,
        created_by,
    ) -> DirectMessageThread:
        """
        Get existing DM thread or create a new one.

        For 1:1 DMs, returns existing thread if one exists.
        For group DMs, always creates a new thread.

        Args:
            participants: List of User objects
            created_by: User creating the thread

        Returns:
            DirectMessageThread instance
        """
        is_group = len(participants) > 1

        if not is_group:
            # For 1:1 DMs, check for existing thread
            other_user = participants[0]
            existing = (
                DirectMessageThread.objects.filter(
                    is_group=False,
                    participants=created_by,
                )
                .filter(
                    participants=other_user,
                )
                .first()
            )

            if existing:
                return existing

        with transaction.atomic():
            # Create room for DM messages
            room = Room.objects.create(
                name=f'DM-{timezone.now().timestamp()}',
                slug=f'dm-{timezone.now().timestamp()}',
                room_type='dm',
                visibility='unlisted',
            )

            # Create DM thread
            thread = DirectMessageThread.objects.create(
                is_group=is_group,
                room=room,
                created_by=created_by,
            )

            # Add all participants (including creator)
            all_participants = set(participants) | {created_by}
            thread.participants.set(all_participants)

            # Create memberships
            for user in all_participants:
                RoomMembership.objects.create(
                    room=room,
                    user=user,
                    role='member',
                )

        logger.info(f'Created DM thread {thread.id} with {len(all_participants)} participants')
        return thread

    @staticmethod
    def get_dm_threads_for_user(user) -> list[DirectMessageThread]:
        """Get all DM threads for a user, ordered by last message."""
        return list(
            DirectMessageThread.objects.filter(
                participants=user,
            ).order_by('-last_message_at')
        )


class ModerationService:
    """Service for content moderation."""

    @staticmethod
    def check_content(content: str) -> dict:
        """
        Check content for moderation issues.

        Uses OpenAI Moderation API (free tier).

        Args:
            content: Text content to check

        Returns:
            Dict with 'flagged', 'scores', 'reason'
        """
        # TODO: Integrate with OpenAI Moderation API
        # For now, return safe result
        return {
            'flagged': False,
            'scores': {},
            'reason': None,
        }

    @staticmethod
    def flag_message(
        message: Message,
        ai_flagged: bool = False,
        ai_scores: dict = None,
        ai_reason: str = '',
    ) -> ModerationQueue:
        """Add a message to the moderation queue."""
        queue_item, created = ModerationQueue.objects.get_or_create(
            message=message,
            defaults={
                'ai_flagged': ai_flagged,
                'ai_scores': ai_scores or {},
                'ai_reason': ai_reason,
            },
        )

        if not created and ai_flagged:
            queue_item.ai_flagged = True
            queue_item.ai_scores = ai_scores or {}
            queue_item.ai_reason = ai_reason
            queue_item.save()

        # Mark message as flagged
        message.is_flagged = True
        message.save(update_fields=['is_flagged'])

        logger.info(f'Message {message.id} flagged for moderation')
        return queue_item

    @staticmethod
    def report_message(message: Message, reporter, reason: str) -> ModerationQueue:
        """Report a message for moderation review."""
        queue_item, _ = ModerationQueue.objects.get_or_create(message=message)

        # Add reporter
        queue_item.reporters.add(reporter)
        queue_item.report_count = queue_item.reporters.count()

        # Add reason
        reasons = queue_item.report_reasons or []
        reasons.append({'user_id': str(reporter.id), 'reason': reason})
        queue_item.report_reasons = reasons
        queue_item.save()

        # Mark message as flagged if enough reports
        if queue_item.report_count >= 3:
            message.is_flagged = True
            message.save(update_fields=['is_flagged'])

        logger.info(f'Message {message.id} reported by user {reporter.id}')
        return queue_item

    @staticmethod
    def take_action(
        action_type: str,
        target_user,
        moderator,
        room: Room = None,
        message: Message = None,
        reason: str = '',
        duration_hours: int = None,
    ) -> ModerationAction:
        """
        Take a moderation action.

        Args:
            action_type: Type of action (warn, mute, ban, etc.)
            target_user: User being moderated
            moderator: User taking action (or None for system)
            room: Room context (optional)
            message: Message context (optional)
            reason: Reason for action
            duration_hours: Duration for temp actions

        Returns:
            ModerationAction instance
        """
        expires_at = None
        if duration_hours:
            expires_at = timezone.now() + timedelta(hours=duration_hours)

        action = ModerationAction.objects.create(
            action_type=action_type,
            source='admin' if moderator else 'system',
            target_user=target_user,
            moderator=moderator,
            target_room=room,
            target_message=message,
            reason=reason,
            expires_at=expires_at,
        )

        # Apply the action
        if action_type == 'mute' and room:
            RoomMembership.objects.filter(room=room, user=target_user).update(role='muted')
        elif action_type == 'ban' and room:
            RoomMembership.objects.filter(room=room, user=target_user).update(role='banned')
        elif action_type == 'hide' and message:
            message.is_hidden = True
            message.save(update_fields=['is_hidden'])
        elif action_type == 'delete' and message:
            message.message_type = 'deleted'
            message.content = '[Message deleted]'
            message.save(update_fields=['message_type', 'content'])

        logger.info(f'Moderation action {action_type} on user {target_user.id} by {moderator}')
        return action


class BlockService:
    """Service for user blocking."""

    @staticmethod
    def block_user(blocker, blocked) -> UserBlock:
        """Block a user."""
        block, created = UserBlock.objects.get_or_create(
            blocker=blocker,
            blocked=blocked,
        )
        if created:
            logger.info(f'User {blocker.id} blocked user {blocked.id}')
        return block

    @staticmethod
    def unblock_user(blocker, blocked) -> None:
        """Unblock a user."""
        deleted, _ = UserBlock.objects.filter(
            blocker=blocker,
            blocked=blocked,
        ).delete()
        if deleted:
            logger.info(f'User {blocker.id} unblocked user {blocked.id}')

    @staticmethod
    def get_blocked_user_ids(user) -> list[UUID]:
        """Get list of user IDs blocked by a user."""
        return list(UserBlock.objects.filter(blocker=user).values_list('blocked_id', flat=True))

    @staticmethod
    def is_blocked(blocker, blocked) -> bool:
        """Check if a user is blocked."""
        return UserBlock.objects.filter(blocker=blocker, blocked=blocked).exists()
