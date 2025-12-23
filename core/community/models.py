"""
Models for the Community Messaging system.

This module defines models for:
- Room: Forum, circle chat, or DM thread containers
- Thread: Conversation threads within rooms
- Message: Individual messages in rooms or threads
- MessageReaction: Emoji reactions on messages
- RoomMembership: User membership and roles in rooms
- DirectMessageThread: Private 1:1 or group DM threads
- ModerationAction: Track moderation actions
- ModerationQueue: Queue flagged content for review
- UserBlock: User blocking relationships
"""

import logging
import uuid

from django.conf import settings
from django.core.validators import MaxLengthValidator, MinValueValidator
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class Room(models.Model):
    """
    A room is a container for messages - can be a forum, circle chat, or DM thread.

    Forums are user-created (trust-gated) or admin-created topic rooms.
    Circle chats are auto-created for weekly Thrive Circles.
    DM threads link to DirectMessageThread for participant management.
    """

    ROOM_TYPE_CHOICES = [
        ('forum', 'Forum'),
        ('circle', 'Circle Chat'),
        ('dm', 'Direct Message'),
    ]

    VISIBILITY_CHOICES = [
        ('public', 'Public'),  # Anyone can join
        ('private', 'Private'),  # Invite only, visible in listings
        ('unlisted', 'Unlisted'),  # Invite only, hidden from listings
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Room identity
    name = models.CharField(max_length=100, help_text='Room display name')
    slug = models.SlugField(max_length=100, unique=True, help_text='URL-friendly identifier')
    description = models.TextField(blank=True, help_text='Room description')
    icon = models.CharField(
        max_length=50,
        default='comments',
        help_text='FontAwesome icon name (e.g., "comments", "robot", "book")',
    )

    # Room type and visibility
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES, default='forum')
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='public')

    # Ownership
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_rooms',
        help_text='User who created this room (null for system-created)',
    )

    # Circle integration (for circle chat rooms)
    circle = models.OneToOneField(
        'thrive_circle.Circle',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chat_room',
        help_text='Associated circle for circle chat rooms',
    )

    # Threading settings
    auto_thread = models.BooleanField(
        default=False,
        help_text='Automatically create threads for each message',
    )

    # Display settings
    position = models.IntegerField(default=0, help_text='Display order')
    is_default = models.BooleanField(
        default=False,
        help_text='Is this the default room (e.g., General)',
    )

    # Rate limiting
    slow_mode_seconds = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Seconds users must wait between messages (0 = disabled)',
    )

    # Trust requirements
    min_trust_to_join = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Minimum trust level to join (0 = anyone)',
    )
    min_trust_to_post = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text='Minimum trust level to post (0 = anyone)',
    )

    # Cached stats
    member_count = models.IntegerField(default=0, help_text='Cached member count')
    message_count = models.IntegerField(default=0, help_text='Cached message count')
    online_count = models.IntegerField(default=0, help_text='Cached online user count')
    last_message_at = models.DateTimeField(null=True, blank=True, help_text='Last message timestamp')

    # Status
    is_archived = models.BooleanField(default=False, help_text='Archived rooms are read-only')
    is_active = models.BooleanField(default=True, help_text='Inactive rooms are hidden')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'name']
        verbose_name = 'Room'
        verbose_name_plural = 'Rooms'
        indexes = [
            models.Index(fields=['room_type', 'visibility', 'is_active']),
            models.Index(fields=['slug']),
            models.Index(fields=['creator', '-created_at']),
            models.Index(fields=['circle']),
            models.Index(fields=['is_default', 'is_active']),
            models.Index(fields=['-last_message_at']),
        ]

    def __str__(self):
        return self.name


class Thread(models.Model):
    """
    A conversation thread within a room.

    Threads can be created automatically (if room.auto_thread) or manually
    by replying to a specific message.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Parent room
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='threads',
    )

    # Thread origin (optional - if started from a message)
    parent_message = models.ForeignKey(
        'Message',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_threads',
        help_text='Message that started this thread',
    )

    # Thread details
    title = models.CharField(max_length=200, blank=True, help_text='Thread title')
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_threads',
    )

    # Status
    is_locked = models.BooleanField(default=False, help_text='Locked threads cannot receive new messages')
    is_pinned = models.BooleanField(default=False, help_text='Pinned threads appear at top')
    is_resolved = models.BooleanField(default=False, help_text='Thread marked as resolved')

    # Cached stats
    message_count = models.IntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True)

    # Auto-archive
    auto_archive_after_hours = models.IntegerField(
        null=True,
        blank=True,
        help_text='Auto-archive after X hours of inactivity',
    )
    is_archived = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-last_message_at']
        verbose_name = 'Thread'
        verbose_name_plural = 'Threads'
        indexes = [
            models.Index(fields=['room', '-last_message_at']),
            models.Index(fields=['room', 'is_pinned', '-created_at']),
            models.Index(fields=['creator', '-created_at']),
            models.Index(fields=['parent_message']),
        ]

    def __str__(self):
        return self.title or f'Thread in {self.room.name}'


class Message(models.Model):
    """
    A message in a room or thread.

    Messages support text, images, files, embeds, and system messages.
    """

    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('file', 'File'),
        ('embed', 'Embed'),
        ('system', 'System'),
        ('deleted', 'Deleted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Location
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    thread = models.ForeignKey(
        Thread,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='messages',
        help_text='Thread this message belongs to (null = room-level message)',
    )

    # Author
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='community_messages',
    )

    # Content
    content = models.TextField(
        validators=[MaxLengthValidator(4000)],
        help_text='Message content (max 4000 chars)',
    )
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')

    # Rich content (stored as JSON)
    attachments = models.JSONField(
        default=list,
        blank=True,
        help_text='List of attachment objects: [{url, name, size, type}]',
    )
    embeds = models.JSONField(
        default=list,
        blank=True,
        help_text='List of embed objects: [{url, title, description, thumbnail}]',
    )
    mentions = models.JSONField(
        default=list,
        blank=True,
        help_text='List of mentioned user IDs',
    )

    # Reply tracking
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
        help_text='Message this is replying to',
    )

    # Cached reaction counts
    reaction_counts = models.JSONField(
        default=dict,
        blank=True,
        help_text='Cached reaction counts: {emoji: count}',
    )

    # Moderation flags
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_flagged = models.BooleanField(default=False, help_text='Flagged for moderation review')
    is_hidden = models.BooleanField(default=False, help_text='Hidden by moderator')
    is_pinned = models.BooleanField(default=False, help_text='Pinned message in room')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
        indexes = [
            # Primary query: room messages by time
            models.Index(fields=['room', 'created_at']),
            # Thread messages by time
            models.Index(fields=['thread', 'created_at']),
            # User message history
            models.Index(fields=['author', '-created_at']),
            # Moderation queries
            models.Index(fields=['is_flagged', '-created_at']),
            models.Index(fields=['is_pinned', 'room']),
            # Cursor-based pagination (for scalability)
            models.Index(fields=['room', '-created_at', 'id']),
        ]

    def __str__(self):
        preview = self.content[:50] + '...' if len(self.content) > 50 else self.content
        return f'{self.author}: {preview}'

    def mark_as_edited(self):
        """Mark message as edited."""
        self.is_edited = True
        self.edited_at = timezone.now()
        self.save(update_fields=['is_edited', 'edited_at', 'updated_at'])


class MessageReaction(models.Model):
    """
    Emoji reaction on a message.

    Users can react with any emoji, with one reaction per emoji per user.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='reactions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_reactions',
    )
    emoji = models.CharField(max_length=10, help_text='Emoji character')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['message', 'user', 'emoji']
        ordering = ['created_at']
        verbose_name = 'Message Reaction'
        verbose_name_plural = 'Message Reactions'
        indexes = [
            models.Index(fields=['message', 'emoji']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} reacted {self.emoji} to message'


class RoomMembership(models.Model):
    """
    User membership in a room with role and permissions.

    Roles determine what actions a user can take in the room.
    """

    ROLE_CHOICES = [
        ('owner', 'Owner'),  # Full control
        ('admin', 'Admin'),  # Can manage members and settings
        ('moderator', 'Moderator'),  # Can moderate messages
        ('trusted', 'Trusted'),  # Bypasses slow mode
        ('member', 'Member'),  # Normal member
        ('muted', 'Muted'),  # Cannot send messages
        ('banned', 'Banned'),  # Cannot access room
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_memberships',
    )

    # Role and permissions
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')

    # Trust tracking
    trust_score = models.IntegerField(default=0, help_text='Room-specific trust score')
    messages_sent = models.IntegerField(default=0, help_text='Messages sent in this room')
    warnings_count = models.IntegerField(default=0, help_text='Number of warnings received')

    # Notification preferences
    notifications_enabled = models.BooleanField(default=True)
    notification_level = models.CharField(
        max_length=20,
        default='mentions',
        choices=[
            ('all', 'All Messages'),
            ('mentions', 'Mentions Only'),
            ('none', 'None'),
        ],
    )

    # Status
    is_active = models.BooleanField(default=True)
    last_read_at = models.DateTimeField(null=True, blank=True, help_text='Last message read timestamp')

    # Timestamps
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['room', 'user']
        ordering = ['role', 'joined_at']
        verbose_name = 'Room Membership'
        verbose_name_plural = 'Room Memberships'
        indexes = [
            models.Index(fields=['room', 'role', 'is_active']),
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['user', 'role']),
        ]

    def __str__(self):
        return f'{self.user.username} in {self.room.name} ({self.get_role_display()})'


class DirectMessageThread(models.Model):
    """
    A direct message thread between users.

    Supports both 1:1 and group DMs.
    The actual messages are stored in a linked Room (room_type='dm').
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Participants
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='dm_threads',
        help_text='Users in this DM thread',
    )

    # Thread settings
    is_group = models.BooleanField(default=False, help_text='True if more than 2 participants')
    name = models.CharField(max_length=100, blank=True, help_text='Group DM name (optional)')

    # Linked room for messages
    room = models.OneToOneField(
        Room,
        on_delete=models.CASCADE,
        related_name='dm_thread',
        null=True,
        blank=True,
        help_text='Room containing DM messages',
    )

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_dm_threads',
    )
    last_message_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at']
        verbose_name = 'Direct Message Thread'
        verbose_name_plural = 'Direct Message Threads'
        indexes = [
            models.Index(fields=['-last_message_at']),
            models.Index(fields=['created_by', '-created_at']),
        ]

    def __str__(self):
        if self.name:
            return self.name
        return f'DM Thread {self.id}'


class ModerationAction(models.Model):
    """
    Track all moderation actions for audit and appeals.
    """

    ACTION_TYPE_CHOICES = [
        ('warn', 'Warning'),
        ('delete', 'Delete Message'),
        ('mute', 'Mute User'),
        ('unmute', 'Unmute User'),
        ('ban', 'Ban User'),
        ('unban', 'Unban User'),
        ('hide', 'Hide Message'),
        ('unhide', 'Unhide Message'),
        ('lock', 'Lock Thread'),
        ('unlock', 'Unlock Thread'),
        ('approve', 'Approve Content'),
    ]

    SOURCE_CHOICES = [
        ('ai', 'AI Moderation'),
        ('community', 'Community Report'),
        ('admin', 'Admin/Moderator'),
        ('system', 'Automated System'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Action details
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    reason = models.TextField(blank=True, help_text='Reason for action')

    # Who performed the action
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderation_actions_taken',
        help_text='Moderator who took action (null for automated)',
    )

    # Target of action
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='moderation_actions_received',
    )
    target_message = models.ForeignKey(
        Message,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderation_actions',
    )
    target_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderation_actions',
    )

    # Duration (for temp mutes/bans)
    expires_at = models.DateTimeField(null=True, blank=True, help_text='When action expires')
    is_active = models.BooleanField(default=True, help_text='Is this action still in effect')

    # AI moderation details
    ai_scores = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI moderation scores: {category: score}',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Moderation Action'
        verbose_name_plural = 'Moderation Actions'
        indexes = [
            models.Index(fields=['target_user', '-created_at']),
            models.Index(fields=['moderator', '-created_at']),
            models.Index(fields=['action_type', '-created_at']),
            models.Index(fields=['source', '-created_at']),
            models.Index(fields=['is_active', 'expires_at']),
        ]

    def __str__(self):
        return f'{self.get_action_type_display()} on {self.target_user.username}'


class ModerationQueue(models.Model):
    """
    Queue for flagged content awaiting human review.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('escalated', 'Escalated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Content to review
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='moderation_queue_entries',
    )

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # AI moderation results
    ai_flagged = models.BooleanField(default=False)
    ai_scores = models.JSONField(default=dict, blank=True)
    ai_reason = models.TextField(blank=True, help_text='AI explanation for flagging')

    # Community reports
    report_count = models.IntegerField(default=0)
    reporters = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='reported_queue_items',
        blank=True,
    )
    report_reasons = models.JSONField(
        default=list,
        blank=True,
        help_text='List of report reasons from users',
    )

    # Review
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_queue_items',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Moderation Queue Entry'
        verbose_name_plural = 'Moderation Queue'
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['ai_flagged', 'status']),
            models.Index(fields=['reviewed_by', '-reviewed_at']),
        ]

    def __str__(self):
        return f'Queue item for message {self.message.id} ({self.get_status_display()})'


class UserBlock(models.Model):
    """
    User blocking relationship.

    When blocked, the blocked user's messages are hidden from the blocker,
    and they cannot send DMs to the blocker.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocking',
        help_text='User who blocked',
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_by',
        help_text='User who is blocked',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['blocker', 'blocked']
        ordering = ['-created_at']
        verbose_name = 'User Block'
        verbose_name_plural = 'User Blocks'
        indexes = [
            models.Index(fields=['blocker']),
            models.Index(fields=['blocked']),
        ]

    def __str__(self):
        return f'{self.blocker.username} blocked {self.blocked.username}'
