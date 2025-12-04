"""Models for YouTube feed curation agent integration."""

from django.conf import settings
from django.db import models


class YouTubeFeedAgent(models.Model):
    """Configuration for a YouTube channel feed curation agent.

    Each agent represents one YouTube channel and automatically creates projects
    for new video uploads. Content is attributed to the original creator with
    links back to the source.
    """

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        ERROR = 'error', 'Error'

    agent_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='youtube_feed_agent_config',
        help_text='Agent user account (role=AGENT) that owns the projects',
        limit_choices_to={'role': 'agent'},
    )

    name = models.CharField(
        max_length=255,
        help_text='Display name (e.g., "AI Daily Brief Agent")',
    )

    channel_url = models.URLField(
        max_length=500,
        unique=True,
        db_index=True,
        help_text='YouTube channel URL (e.g., https://www.youtube.com/@AIDailyBrief)',
    )

    channel_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text='YouTube channel ID (e.g., UCxxxxxx)',
    )

    channel_name = models.CharField(
        max_length=255,
        help_text='Human-readable channel name for attribution',
    )

    # Attribution text shown on all videos
    attribution_text = models.TextField(
        default='All content is owned by the original creator. Visit their YouTube channel to support them directly.',
        help_text='Attribution text displayed on video projects',
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
        help_text='Agent configuration: sync_interval_minutes, max_videos, etc.',
    )

    # ETag for conditional requests (saves API quota)
    etag = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='ETag for conditional YouTube API requests',
    )

    # Sync tracking
    last_synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last successful sync timestamp',
    )

    last_sync_status = models.CharField(
        max_length=100,
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
        db_table = 'youtube_feed_agents'
        verbose_name = 'YouTube Feed Agent'
        verbose_name_plural = 'YouTube Feed Agents'
        indexes = [
            models.Index(fields=['status', 'last_synced_at']),
            models.Index(fields=['channel_id']),
        ]

    def __str__(self):
        return f'{self.name} ({self.channel_name})'


class YouTubeFeedVideo(models.Model):
    """YouTube video metadata for a video project created by feed agent.

    Stores YouTube-specific data that doesn't fit in the standard Project model.
    """

    project = models.OneToOneField(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='youtube_feed_video',
        help_text='Associated Project (type=video)',
    )

    agent = models.ForeignKey(
        YouTubeFeedAgent,
        on_delete=models.CASCADE,
        related_name='videos',
        help_text='Agent that created this video project',
    )

    video_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text='YouTube video ID',
    )

    channel_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text='YouTube channel ID (denormalized for queries)',
    )

    channel_name = models.CharField(
        max_length=255,
        help_text='Channel name (denormalized for queries)',
    )

    permalink = models.URLField(
        max_length=500,
        help_text='Full YouTube video URL',
    )

    thumbnail_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Video thumbnail URL',
    )

    # Video metadata
    duration = models.IntegerField(
        default=0,
        help_text='Video duration in seconds',
    )

    duration_iso = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='ISO 8601 duration (e.g., PT12M34S)',
    )

    view_count = models.PositiveIntegerField(
        default=0,
        help_text='View count at last sync',
    )

    like_count = models.PositiveIntegerField(
        default=0,
        help_text='Like count at last sync',
    )

    comment_count = models.PositiveIntegerField(
        default=0,
        help_text='Comment count at last sync',
    )

    # YouTube timestamps
    published_at = models.DateTimeField(
        db_index=True,
        help_text='When the video was published on YouTube',
    )

    # Tags from YouTube
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text='Tags from YouTube video',
    )

    # Category from YouTube
    category_id = models.CharField(
        max_length=10,
        blank=True,
        default='',
        help_text='YouTube category ID',
    )

    # Full metadata from API response
    youtube_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional metadata from YouTube API',
    )

    # Sync tracking
    last_synced_at = models.DateTimeField(
        auto_now=True,
        help_text='When we last fetched updates for this video',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'youtube_feed_videos'
        verbose_name = 'YouTube Feed Video'
        verbose_name_plural = 'YouTube Feed Videos'
        indexes = [
            models.Index(fields=['channel_id', '-published_at']),
            models.Index(fields=['agent', '-published_at']),
            models.Index(fields=['video_id']),
        ]
        ordering = ['-published_at']

    def __str__(self):
        return f'{self.channel_name} - {self.video_id}'

    @property
    def youtube_url(self) -> str:
        """Get the YouTube watch URL."""
        return f'https://www.youtube.com/watch?v={self.video_id}'

    @property
    def embed_url(self) -> str:
        """Get the YouTube embed URL."""
        return f'https://www.youtube.com/embed/{self.video_id}'

    @property
    def is_short(self) -> bool:
        """Check if this is a YouTube Short (vertical video).

        YouTube Shorts were originally 60 seconds max but can now be up to 3 minutes.
        We use heuristics: short duration + minimal/no description suggests a Short.
        Videos under 90 seconds are almost certainly Shorts.
        Videos 90-180 seconds with no description are likely Shorts.
        """
        # Definitely a Short if under 90 seconds
        if self.duration <= 90:
            return True

        # Likely a Short if under 3 minutes and has no/minimal description
        if self.duration <= 180:
            description = self.youtube_metadata.get('description', '') if self.youtube_metadata else ''
            # Shorts typically have no description or very short ones
            if len(description.strip()) < 50:
                return True

        return False

    @property
    def shorts_url(self) -> str:
        """Get the YouTube Shorts URL."""
        return f'https://www.youtube.com/shorts/{self.video_id}'
