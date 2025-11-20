from django.conf import settings
from django.db import models


class SoftDeleteManager(models.Manager):
    """Manager that excludes soft-deleted objects by default."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class BaseModel(models.Model):
    """Base model with soft delete capability and audit timestamps.

    All models that need soft deletion should inherit from this.
    Soft deleted objects are excluded from default queries but can be
    accessed via all_objects manager.
    """

    deleted_at = models.DateTimeField(
        null=True, blank=True, db_index=True, help_text='Timestamp when object was soft deleted'
    )

    objects = SoftDeleteManager()
    all_objects = models.Manager()  # Include soft-deleted objects

    class Meta:
        abstract = True

    def soft_delete(self):
        """Mark object as deleted without removing from database."""
        from django.utils import timezone

        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])

    def restore(self):
        """Restore a soft-deleted object."""
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])

    @property
    def is_deleted(self):
        """Check if object is soft-deleted."""
        return self.deleted_at is not None


class Conversation(BaseModel):
    """Model to store AI conversation history.

    Supports soft deletion to maintain audit trail even when user deletes conversations.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='conversations'
    )
    title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['-updated_at', 'deleted_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'Unknown'
        return f'{self.title or "Conversation"} - {username}'


class Message(models.Model):
    """Model to store individual messages in a conversation.

    Messages are CASCADE deleted if conversation is hard-deleted,
    but soft-deletion of conversation preserves messages.
    """

    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['conversation', 'role']),
        ]

    def __str__(self):
        return f'{self.role}: {self.content[:50]}...'
