"""Models for content source integrations."""

from django.conf import settings
from django.db import models


class ContentSource(models.Model):
    """Track content sources for automatic syncing (YouTube channels, RSS feeds, etc.)."""

    class PlatformType(models.TextChoices):
        YOUTUBE = 'youtube', 'YouTube'
        # Future: RSS, VIMEO, LOOM, etc.

    class SyncFrequency(models.TextChoices):
        EVERY_2_HOURS = 'every_2_hours', 'Every 2 Hours'
        EVERY_4_HOURS = 'every_4_hours', 'Every 4 Hours'
        DAILY = 'daily', 'Once Daily'
        MANUAL = 'manual', 'Manual Only'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_sources',
        help_text='User who owns this content source',
    )

    platform = models.CharField(
        max_length=20, choices=PlatformType.choices, help_text='Platform type (YouTube, RSS, etc.)'
    )

    # For YouTube: channel ID or video ID
    # For RSS: feed URL hash
    source_identifier = models.CharField(
        max_length=255, help_text='Platform-specific ID (channel ID for YouTube, feed hash for RSS)'
    )

    source_url = models.URLField(help_text='Original URL (e.g., https://youtube.com/channel/UC...)')

    display_name = models.CharField(max_length=255, help_text='User-friendly name for this source (e.g., channel name)')

    # Sync settings
    sync_enabled = models.BooleanField(default=True, help_text='Enable automatic syncing')

    sync_frequency = models.CharField(
        max_length=20,
        choices=SyncFrequency.choices,
        default=SyncFrequency.EVERY_2_HOURS,
        help_text='How often to check for new content',
    )

    last_synced_at = models.DateTimeField(null=True, blank=True, help_text='When this source was last synced')

    last_sync_status = models.CharField(
        max_length=20, default='pending', help_text='Status of last sync (success, error, quota_exceeded, etc.)'
    )

    last_sync_error = models.TextField(blank=True, help_text='Error message from last failed sync')

    # Platform-specific settings (JSON)
    # For YouTube: stores etag, last_video_count, etc.
    metadata = models.JSONField(
        default=dict, blank=True, help_text='Platform-specific metadata (ETags, video counts, etc.)'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'content_sources'
        unique_together = [['user', 'platform', 'source_identifier']]
        indexes = [
            models.Index(fields=['sync_enabled', 'last_synced_at']),
            models.Index(fields=['user', 'platform']),
        ]
        verbose_name = 'Content Source'
        verbose_name_plural = 'Content Sources'

    def __str__(self):
        return f'{self.display_name} ({self.platform}) - {self.user.username}'
