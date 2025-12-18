"""
Messaging models for direct messaging between users.

Implements double opt-in consent:
1. User A sends ConnectionRequest to User B via a project
2. User B accepts/declines
3. If accepted, DirectMessageThread is created
4. Users can exchange DirectMessages in the thread
"""

from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class ConnectionRequest(models.Model):
    """
    Tracks connection requests between users for messaging.
    Implements double opt-in: requester initiates, recipient approves.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        EXPIRED = 'expired', 'Expired'

    # The user requesting to message the project owner
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_connection_requests',
    )
    # The project owner receiving the request
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_connection_requests',
    )
    # The project this request originated from
    project = models.ForeignKey(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='connection_requests',
    )
    # Intro message explaining why they want to connect
    intro_message = models.TextField(
        max_length=500,
        help_text='Brief intro message explaining why you want to connect',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    # When the recipient responded to the request
    responded_at = models.DateTimeField(null=True, blank=True)
    # Auto-expire after 7 days if not responded
    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # One pending request per requester per project
            models.UniqueConstraint(
                fields=['requester', 'project'],
                condition=models.Q(status='pending'),
                name='unique_pending_request_per_project',
            ),
            # Cannot send request to yourself
            models.CheckConstraint(
                check=~models.Q(requester=models.F('recipient')),
                name='no_self_connection_request',
            ),
        ]
        indexes = [
            models.Index(fields=['recipient', 'status', '-created_at']),
            models.Index(fields=['requester', '-created_at']),
            models.Index(fields=['project', 'status']),
            models.Index(fields=['expires_at', 'status']),
        ]

    def __str__(self):
        return f'Request from {self.requester.username} to {self.recipient.username} ({self.status})'

    def save(self, *args, **kwargs):
        # Set expiry date if not set (7 days from now)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @transaction.atomic
    def accept(self):
        """Accept the connection request and create a message thread.

        Uses atomic transaction to ensure status and thread are created together.
        """
        self.status = self.Status.ACCEPTED
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at', 'updated_at'])

        # Create the thread if it doesn't exist
        thread, created = DirectMessageThread.objects.get_or_create_for_users(
            self.requester,
            self.recipient,
            defaults={
                'originating_project': self.project,
                'connection_request': self,
            },
        )
        return thread

    def decline(self):
        """Decline the connection request."""
        self.status = self.Status.DECLINED
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at', 'updated_at'])


class DirectMessageThreadManager(models.Manager):
    """Custom manager for DirectMessageThread."""

    @transaction.atomic
    def get_or_create_for_users(self, user1, user2, defaults=None):
        """
        Get or create a thread between two users.
        Ensures only one thread exists per user pair.

        Uses atomic transaction and select_for_update to prevent race conditions.
        """
        # Try to find existing thread between these users
        # Use select_for_update to lock the rows and prevent race conditions
        thread = self.select_for_update().filter(participants=user1).filter(participants=user2).first()

        if thread:
            return thread, False

        # Create new thread
        defaults = defaults or {}
        thread = self.create(**defaults)
        thread.participants.add(user1, user2)
        return thread, True

    def for_user(self, user):
        """Get all threads for a user, ordered by last message."""
        return self.filter(
            participants=user,
            deleted_at__isnull=True,
        ).order_by('-last_message_at')


class DirectMessageThread(models.Model):
    """
    A conversation thread between two users.
    Created after a ConnectionRequest is accepted.
    """

    # The two participants in this thread
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='message_threads',
    )
    # The project where they first connected (optional context)
    originating_project = models.ForeignKey(
        'core.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='originated_threads',
    )
    # Link back to the original connection request
    connection_request = models.OneToOneField(
        ConnectionRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='thread',
    )
    # Denormalized for quick "inbox" queries
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_message_preview = models.CharField(max_length=100, blank=True)
    last_message_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )

    # Soft delete support
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = DirectMessageThreadManager()

    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['-last_message_at']),
        ]

    def __str__(self):
        usernames = ', '.join(p.username for p in self.participants.all()[:2])
        return f'Thread: {usernames}'

    def get_other_participant(self, user):
        """Get the other participant in the thread."""
        return self.participants.exclude(id=user.id).first()

    def update_last_message(self, message):
        """Update denormalized last message fields."""
        self.last_message_at = message.created_at
        self.last_message_preview = message.content[:100]
        self.last_message_sender = message.sender
        self.save(update_fields=['last_message_at', 'last_message_preview', 'last_message_sender', 'updated_at'])

    def get_unread_count(self, user):
        """Get count of unread messages for a user."""
        return self.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class DirectMessage(models.Model):
    """
    Individual message in a thread.
    """

    class ModerationStatus(models.TextChoices):
        APPROVED = 'approved', 'Approved'
        PENDING = 'pending', 'Pending Review'
        FLAGGED = 'flagged', 'Flagged'
        REMOVED = 'removed', 'Removed'

    thread = models.ForeignKey(
        DirectMessageThread,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_direct_messages',
    )
    content = models.TextField(max_length=5000)

    # Read receipt
    read_at = models.DateTimeField(null=True, blank=True)

    # Moderation (same pattern as ProjectComment)
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.APPROVED,
        db_index=True,
    )
    moderation_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['thread', 'created_at']),
            models.Index(fields=['sender', '-created_at']),
            models.Index(fields=['thread', 'read_at']),
        ]

    def __str__(self):
        return f'Message from {self.sender.username}: {self.content[:50]}...'

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        if is_new:
            # Use transaction to ensure message and thread update happen together
            with transaction.atomic():
                super().save(*args, **kwargs)
                self.thread.update_last_message(self)
        else:
            super().save(*args, **kwargs)

    def mark_as_read(self):
        """Mark this message as read."""
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])


class MessageReport(models.Model):
    """
    Track reports against messages for moderation.
    """

    class ReportReason(models.TextChoices):
        SPAM = 'spam', 'Spam'
        HARASSMENT = 'harassment', 'Harassment'
        INAPPROPRIATE = 'inappropriate', 'Inappropriate Content'
        SCAM = 'scam', 'Scam / Fraud'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        RESOLVED = 'resolved', 'Resolved'
        DISMISSED = 'dismissed', 'Dismissed'

    message = models.ForeignKey(
        DirectMessage,
        on_delete=models.CASCADE,
        related_name='reports',
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_reports_filed',
    )
    reason = models.CharField(max_length=20, choices=ReportReason.choices)
    description = models.TextField(blank=True, max_length=500)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='message_reports_resolved',
    )
    resolution_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['message', 'reporter'],
                name='unique_report_per_user_per_message',
            ),
        ]
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'Report on message {self.message_id} by {self.reporter.username}'


class UserBlock(models.Model):
    """
    Track blocked users.
    Blocked users cannot send connection requests or messages to the blocker.
    """

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_users',
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_by',
    )
    reason = models.TextField(blank=True, max_length=500)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['blocker', 'blocked'],
                name='unique_user_block',
            ),
            models.CheckConstraint(
                check=~models.Q(blocker=models.F('blocked')),
                name='no_self_block',
            ),
        ]
        indexes = [
            models.Index(fields=['blocker']),
            models.Index(fields=['blocked']),
        ]

    def __str__(self):
        return f'{self.blocker.username} blocked {self.blocked.username}'

    @classmethod
    def is_blocked(cls, blocker, blocked):
        """Check if blocker has blocked the blocked user."""
        return cls.objects.filter(blocker=blocker, blocked=blocked).exists()

    @classmethod
    def either_blocked(cls, user1, user2):
        """Check if either user has blocked the other."""
        return cls.objects.filter(
            models.Q(blocker=user1, blocked=user2) | models.Q(blocker=user2, blocked=user1)
        ).exists()
