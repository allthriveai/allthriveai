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

    CONVERSATION_TYPE_CHOICES = [
        ('ava_chat', 'Ava Sidebar Chat'),
        ('ava_learn', 'Ava Learn Chat'),
        ('ava_explore', 'Ava Explore Chat'),
        ('learning_path', 'Learning Path Chat'),
        ('avatar', 'Avatar Generation'),
        ('image', 'Image Generation'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='conversations'
    )
    title = models.CharField(max_length=255, blank=True)
    conversation_id = models.CharField(
        max_length=255,
        db_index=True,
        default='',
        blank=True,
        help_text='WebSocket conversation ID (e.g., ava-chat-123, ava-learn-456)',
    )
    conversation_type = models.CharField(
        max_length=50,
        db_index=True,
        default='ava_chat',
        choices=CONVERSATION_TYPE_CHOICES,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['-updated_at', 'deleted_at']),
        ]
        constraints = [
            # SECURITY: User-scoped uniqueness (only when user exists and conversation_id is not empty)
            models.UniqueConstraint(
                fields=['user', 'conversation_id'],
                name='unique_user_conversation_id',
                condition=models.Q(user__isnull=False) & ~models.Q(conversation_id=''),
            )
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


class HallucinationMetrics(models.Model):
    """
    Lightweight LLM response quality tracking - ADMIN ONLY.

    Zero user-facing impact:
    - Inserted async via Celery (fire-and-forget)
    - No queries in request path
    - Used only for admin dashboards & analysis

    Tracks confidence scores to identify hallucinations.
    """

    # Context (indexed for dashboard queries)
    session_id = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=False,  # Not needed for admin queries
    )
    feature = models.CharField(max_length=50, db_index=True, help_text='Agent type: project_agent, auth_chat, etc.')

    # Quality metrics (what we care about)
    confidence_level = models.CharField(
        max_length=20,
        db_index=True,
        choices=[
            ('high', 'High (80-100%)'),
            ('medium', 'Medium (60-79%)'),
            ('low', 'Low (40-59%)'),
            ('uncertain', 'Uncertain (0-39%)'),
        ],
    )
    confidence_score = models.FloatField(db_index=True, help_text='0.0-1.0')
    flags = models.JSONField(default=list, help_text='Issues detected: overconfident, no_tool_citation, etc.')

    # Response data (truncated for storage efficiency)
    response_text = models.TextField(help_text='First 1000 chars of LLM response')

    # Analysis context (JSONB for flexibility)
    tool_outputs = models.JSONField(default=list, help_text='Tool results for verification')
    metadata = models.JSONField(default=dict, help_text='Extra: latency_ms, token_count, etc.')

    # Timestamp (for time-series analysis)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'agents_hallucination_metrics'
        ordering = ['-created_at']
        indexes = [
            # Dashboard queries
            models.Index(fields=['feature', '-created_at']),
            models.Index(fields=['confidence_level', '-created_at']),
            models.Index(fields=['confidence_score']),  # For aggregations
        ]

    def __str__(self):
        return f'{self.feature} - {self.confidence_level} ({self.confidence_score:.2f})'

    @property
    def has_concerns(self) -> bool:
        """Quick check if response has quality issues."""
        return self.confidence_level in ['low', 'uncertain'] or len(self.flags) > 0

    @classmethod
    def get_summary_stats(cls, days: int = 7):
        """
        Admin dashboard summary statistics.

        Returns:
            {
                'total': 1234,
                'by_level': {'high': 980, 'medium': 200, ...},
                'hallucination_rate': 0.04,
                'avg_score': 0.87,
            }
        """
        from datetime import timedelta

        from django.db.models import Avg, Count
        from django.utils import timezone

        cutoff = timezone.now() - timedelta(days=days)
        queryset = cls.objects.filter(created_at__gte=cutoff)

        total = queryset.count()
        if total == 0:
            return {'total': 0, 'by_level': {}, 'hallucination_rate': 0.0, 'avg_score': 0.0}

        by_level = dict(
            queryset.values('confidence_level').annotate(count=Count('id')).values_list('confidence_level', 'count')
        )
        avg_score = queryset.aggregate(avg=Avg('confidence_score'))['avg'] or 0.0

        uncertain_count = by_level.get('uncertain', 0)
        hallucination_rate = (uncertain_count / total) if total > 0 else 0.0

        return {
            'total': total,
            'by_level': by_level,
            'hallucination_rate': hallucination_rate,
            'avg_score': avg_score,
        }
