"""Models for AI-generated user avatars."""

from django.conf import settings
from django.db import models

from core.agents.models import BaseModel


class UserAvatar(BaseModel):
    """Stores a user's avatar (current or historical).

    Users can have up to 10 avatars stored. When a new avatar is created
    and the limit is exceeded, the oldest non-current avatar is deleted.
    """

    # Class constants
    MAX_AVATARS = 10

    CREATION_MODE_CHOICES = [
        ('make_me', 'Make Me (Photo-based)'),
        ('template', 'Template'),
        ('scratch', 'Build from Scratch'),
        ('dicebear', 'DiceBear Preset'),
        ('legacy', 'Legacy (Pre-existing)'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='avatars',
    )
    image_url = models.URLField(
        max_length=500,
        help_text='URL of the avatar image stored in MinIO/S3',
    )
    creation_mode = models.CharField(
        max_length=20,
        choices=CREATION_MODE_CHOICES,
        help_text='How this avatar was created',
    )
    template_used = models.CharField(
        max_length=50,
        blank=True,
        help_text='Template name if creation_mode is "template" (e.g., wizard, robot)',
    )
    original_prompt = models.TextField(
        blank=True,
        help_text='The prompt used to generate this avatar',
    )
    is_current = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether this is the user's current active avatar",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_current']),
            models.Index(fields=['user', '-created_at']),
        ]
        verbose_name = 'User Avatar'
        verbose_name_plural = 'User Avatars'

    def __str__(self):
        status = ' (current)' if self.is_current else ''
        return f'{self.user.username} - {self.get_creation_mode_display()}{status}'

    def save(self, *args, **kwargs):
        """Ensure only one avatar is marked as current per user."""
        if self.is_current:
            # Unset current flag on all other avatars for this user
            UserAvatar.objects.filter(user=self.user, is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

        # Enforce max 10 avatars per user (delete oldest non-current)
        self._enforce_avatar_limit()

    def _enforce_avatar_limit(self):
        """Delete oldest non-current avatars if user has more than MAX_AVATARS."""
        # Filter out soft-deleted avatars
        user_avatars = UserAvatar.objects.filter(user=self.user, deleted_at__isnull=True).order_by('-created_at')
        avatar_count = user_avatars.count()

        if avatar_count > self.MAX_AVATARS:
            # Get IDs of avatars to keep (newest MAX_AVATARS, prioritizing current)
            current_avatar = user_avatars.filter(is_current=True).first()
            avatars_to_keep = list(user_avatars[: self.MAX_AVATARS].values_list('id', flat=True))

            # Ensure current avatar is always kept
            if current_avatar and current_avatar.id not in avatars_to_keep:
                avatars_to_keep[-1] = current_avatar.id

            # Soft delete avatars not in the keep list
            UserAvatar.objects.filter(user=self.user, deleted_at__isnull=True).exclude(id__in=avatars_to_keep).delete()

    def set_as_current(self):
        """Set this avatar as the user's current avatar."""
        from django.db import transaction

        with transaction.atomic():
            self.is_current = True
            self.save(update_fields=['is_current'])

            # Also update user's avatar_url field for backwards compatibility
            self.user.avatar_url = self.image_url
            self.user.save(update_fields=['avatar_url'])


class AvatarGenerationSession(BaseModel):
    """Tracks an in-progress avatar generation with iterations.

    Each session represents one avatar creation attempt, which may involve
    multiple refinement iterations before the user accepts a final result.
    """

    STATUS_CHOICES = [
        ('generating', 'Generating'),
        ('ready', 'Ready for Review'),
        ('accepted', 'Accepted'),
        ('abandoned', 'Abandoned'),
        ('failed', 'Failed'),
    ]

    conversation_id = models.CharField(
        max_length=255,
        unique=True,
        help_text='WebSocket conversation ID (pattern: avatar-{user_id}-{timestamp})',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='avatar_sessions',
    )

    # Links to final saved avatar (null until accepted)
    saved_avatar = models.OneToOneField(
        UserAvatar,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='generation_session',
        help_text='The final saved avatar if session was accepted',
    )

    # Creation mode and template (for "Create a Character" path)
    creation_mode = models.CharField(
        max_length=20,
        choices=UserAvatar.CREATION_MODE_CHOICES,
        default='scratch',
    )
    template_used = models.CharField(
        max_length=50,
        blank=True,
        help_text='Template name if using template mode',
    )

    # For "Make Me" mode - reference photo
    reference_image_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Reference photo URL for "Make Me" mode (deleted after 24 hours)',
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='generating',
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text='Error message if generation failed',
    )

    achievement_awarded = models.BooleanField(
        default=False,
        help_text='Whether the Prompt Engineer achievement was awarded for this session',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name = 'Avatar Generation Session'
        verbose_name_plural = 'Avatar Generation Sessions'

    def __str__(self):
        return f'{self.user.username} - {self.get_status_display()} ({self.created_at.strftime("%Y-%m-%d %H:%M")})'

    @classmethod
    def create_conversation_id(cls, user_id: int) -> str:
        """Generate a unique conversation ID for an avatar session."""
        import time

        timestamp = int(time.time() * 1000)
        return f'avatar-{user_id}-{timestamp}'


class AvatarGenerationIteration(models.Model):
    """Individual iteration in avatar generation.

    Each iteration represents one generation attempt within a session.
    Users can refine their avatar multiple times before accepting.
    """

    session = models.ForeignKey(
        AvatarGenerationSession,
        on_delete=models.CASCADE,
        related_name='iterations',
    )
    prompt = models.TextField(
        help_text='The prompt used for this iteration',
    )
    image_url = models.URLField(
        max_length=500,
        help_text='URL of the generated avatar image',
    )
    order = models.IntegerField(
        default=0,
        help_text='Order of this iteration within the session (0-indexed)',
    )
    is_selected = models.BooleanField(
        default=False,
        help_text='Whether this iteration was selected as the final avatar',
    )
    generation_time_ms = models.IntegerField(
        null=True,
        blank=True,
        help_text='Time taken to generate this image in milliseconds',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['session', 'order']),
        ]
        verbose_name = 'Avatar Generation Iteration'
        verbose_name_plural = 'Avatar Generation Iterations'

    def __str__(self):
        selected = ' (selected)' if self.is_selected else ''
        return f'Iteration {self.order + 1}{selected} - {self.prompt[:50]}...'
