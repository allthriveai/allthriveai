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


class ImageGenerationSession(BaseModel):
    """Tracks a Nano Banana image generation session with iterations.

    Each session represents a conversation where the user creates/refines
    images. When the user creates a project from the session, the iterations
    are used to generate a "creative journey" summary.
    """

    conversation_id = models.CharField(
        max_length=255, db_index=True, help_text='WebSocket conversation ID (e.g., project-123)'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='image_generation_sessions'
    )
    final_image_url = models.CharField(max_length=500, blank=True, help_text='URL of the final/selected image')
    project = models.ForeignKey(
        'core.Project',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='image_generation_sessions',
        help_text='Project created from this session (if any)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['conversation_id']),
        ]

    def __str__(self):
        return f'ImageGenSession {self.id} - {self.user.username if self.user else "Unknown"}'

    @property
    def iteration_count(self):
        return self.iterations.count()

    def get_creative_journey_data(self):
        """Get iteration data formatted for AI summary generation."""
        return [
            {
                'order': iteration.order,
                'prompt': iteration.prompt,
                'gemini_response': iteration.gemini_response_text,
                'image_url': iteration.image_url,
            }
            for iteration in self.iterations.order_by('order')
        ]


class ImageGenerationIteration(models.Model):
    """Individual iteration in an image generation session.

    Each iteration represents one prompt-response cycle where the user
    provides a prompt and receives a generated image.
    """

    session = models.ForeignKey(ImageGenerationSession, on_delete=models.CASCADE, related_name='iterations')
    prompt = models.TextField(help_text="User's prompt for this iteration")
    image_url = models.CharField(max_length=500, help_text='URL of the generated image')
    gemini_response_text = models.TextField(blank=True, help_text="Gemini's text response accompanying the image")
    order = models.PositiveIntegerField(default=0, help_text='Order of this iteration in the session')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['session', 'order']),
        ]

    def __str__(self):
        return f'Iteration {self.order} - {self.prompt[:50]}...'
