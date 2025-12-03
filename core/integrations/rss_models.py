"""Models for RSS feed curation agent integration."""

from django.conf import settings
from django.db import models


class RSSFeedAgent(models.Model):
    """Configuration for an RSS feed curation agent.

    Each agent represents one RSS feed source and automatically creates projects
    for RSS feed items.
    """

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        ERROR = 'error', 'Error'

    agent_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='rss_agent_config',
        help_text='Agent user account (role=AGENT) that owns the projects',
        limit_choices_to={'role': 'agent'},
    )

    name = models.CharField(
        max_length=255,
        help_text='Display name (e.g., "Google Research Blog Agent")',
    )

    feed_url = models.URLField(
        max_length=500,
        unique=True,
        db_index=True,
        help_text='RSS/Atom feed URL',
    )

    source_name = models.CharField(
        max_length=200,
        help_text='Human-readable source name (e.g., "Google Research Blog")',
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
        help_text='Agent status (active/paused/error)',
    )

    # Sync settings stored as JSON
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text='Agent configuration: sync_interval_minutes, max_items, etc.',
    )

    # Sync tracking
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last successful sync timestamp',
    )

    last_sync_status = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Status message from last sync',
    )

    last_sync_error = models.TextField(
        blank=True,
        default='',
        help_text='Error message from last failed sync',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rss_feed_agents'
        verbose_name = 'RSS Feed Agent'
        verbose_name_plural = 'RSS Feed Agents'
        indexes = [
            models.Index(fields=['status', 'last_synced_at']),
            models.Index(fields=['feed_url']),
        ]

    def __str__(self):
        return f'{self.name} ({self.source_name})'


class RSSFeedItem(models.Model):
    """RSS feed item metadata for an article project.

    Stores RSS-specific data that doesn't fit in the standard Project model.
    """

    project = models.OneToOneField(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='rss_feed_item',
        help_text='Associated Project (type=rss_article)',
    )

    agent = models.ForeignKey(
        RSSFeedAgent,
        on_delete=models.CASCADE,
        related_name='feed_items',
        help_text='Agent that created this feed item',
    )

    feed_item_id = models.CharField(
        max_length=500,
        unique=True,
        db_index=True,
        help_text='Unique identifier from RSS feed (guid or link)',
    )

    source_name = models.CharField(
        max_length=200,
        db_index=True,
        help_text='Source name (denormalized for queries)',
    )

    author = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Article author (if available)',
    )

    permalink = models.URLField(
        max_length=500,
        help_text='Full URL to the article',
    )

    thumbnail_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Thumbnail/featured image URL from RSS feed',
    )

    # Categories/tags from RSS feed
    categories = models.JSONField(
        default=list,
        blank=True,
        help_text='Categories/tags from RSS feed',
    )

    # RSS timestamps
    published_at = models.DateTimeField(
        help_text='When the article was published',
    )

    # Sync tracking
    last_synced_at = models.DateTimeField(
        auto_now=True,
        help_text='When we last fetched updates for this item',
    )

    # Metadata from RSS feed
    rss_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional metadata from RSS feed',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rss_feed_items'
        verbose_name = 'RSS Feed Item'
        verbose_name_plural = 'RSS Feed Items'
        indexes = [
            models.Index(fields=['source_name', '-published_at']),
            models.Index(fields=['agent', '-published_at']),
            models.Index(fields=['feed_item_id']),
        ]
        ordering = ['-published_at']

    def __str__(self):
        return f'{self.source_name} - {self.feed_item_id}'
