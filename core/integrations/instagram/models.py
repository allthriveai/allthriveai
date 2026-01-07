"""Models for Instagram integration."""

from django.conf import settings
from django.db import models


class InstagramMediaSync(models.Model):
    """Track synced Instagram media posts for a user.

    This model stores metadata about Instagram posts that have been
    fetched from the user's account, allowing users to browse and
    selectively import them as AllThrive projects.
    """

    class MediaType(models.TextChoices):
        """Instagram media types."""

        IMAGE = 'IMAGE', 'Image'
        VIDEO = 'VIDEO', 'Video'
        CAROUSEL_ALBUM = 'CAROUSEL_ALBUM', 'Carousel Album'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='instagram_synced_media',
        help_text='User who owns this Instagram media',
    )

    instagram_media_id = models.CharField(
        max_length=100,
        unique=True,
        help_text='Unique Instagram media ID',
    )

    # Project FK will be added when Instagram import goes live after Meta App Review
    # For now, store the project_id as nullable integer for future linking
    imported_project_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID of Project created from this post (if imported)',
    )

    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        help_text='Type of Instagram media',
    )

    media_url = models.URLField(
        max_length=2000,
        help_text='Direct URL to media (expires after some time)',
    )

    thumbnail_url = models.URLField(
        max_length=2000,
        blank=True,
        help_text='Thumbnail URL for videos',
    )

    permalink = models.URLField(
        max_length=500,
        help_text='Permanent Instagram URL',
    )

    caption = models.TextField(
        blank=True,
        help_text='Instagram post caption',
    )

    instagram_timestamp = models.DateTimeField(
        help_text='When the post was created on Instagram',
    )

    synced_at = models.DateTimeField(
        auto_now=True,
        help_text='When this record was last synced',
    )

    auto_imported = models.BooleanField(
        default=False,
        help_text='Whether this was auto-imported (vs manual selection)',
    )

    is_imported = models.BooleanField(
        default=False,
        help_text='Whether this has been imported as a project',
    )

    class Meta:
        ordering = ['-instagram_timestamp']
        indexes = [
            models.Index(fields=['user', 'synced_at']),
            models.Index(fields=['user', 'is_imported']),
            models.Index(fields=['instagram_media_id']),
        ]
        verbose_name = 'Instagram Media Sync'
        verbose_name_plural = 'Instagram Media Syncs'

    def __str__(self):
        return f'{self.user.username} - {self.instagram_media_id} ({self.media_type})'


class InstagramUserSettings(models.Model):
    """User-specific Instagram integration settings."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='instagram_settings',
        primary_key=True,
    )

    auto_import_enabled = models.BooleanField(
        default=False,
        help_text='Automatically import new Instagram posts as projects',
    )

    last_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last successful media sync',
    )

    sync_error = models.TextField(
        blank=True,
        help_text='Last sync error message if any',
    )

    class Meta:
        verbose_name = 'Instagram User Settings'
        verbose_name_plural = 'Instagram User Settings'

    def __str__(self):
        return f'{self.user.username} Instagram settings'
