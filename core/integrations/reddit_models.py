"""Models for Reddit curation agent integration."""

from django.conf import settings
from django.db import models


class RedditCommunityAgent(models.Model):
    """Configuration for a Reddit community curation agent.

    Each agent represents one subreddit and automatically creates projects
    for Reddit threads using RSS feeds.
    """

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        ERROR = 'error', 'Error'

    agent_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reddit_agent_config',
        help_text='Agent user account (role=AGENT) that owns the projects',
        limit_choices_to={'role': 'agent'},
    )

    name = models.CharField(
        max_length=255,
        help_text='Display name (e.g., "ClaudeCode Reddit Agent")',
    )

    subreddit = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text='Target subreddit name (e.g., "ClaudeCode")',
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
        help_text='Agent configuration: min_score, min_comments, sync_interval_minutes, etc.',
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
        db_table = 'reddit_community_agents'
        verbose_name = 'Reddit Community Agent'
        verbose_name_plural = 'Reddit Community Agents'
        indexes = [
            models.Index(fields=['status', 'last_synced_at']),
            models.Index(fields=['subreddit']),
        ]

    def __str__(self):
        return f'{self.name} (r/{self.subreddit})'

    @property
    def rss_feed_url(self):
        """Get the RSS feed URL for this subreddit based on settings."""
        feed_type = self.settings.get('feed_type', 'top')  # hot, top, new
        time_period = self.settings.get('time_period', 'week')  # day, week, month, year, all

        base_url = f'https://www.reddit.com/r/{self.subreddit}'

        if feed_type == 'top':
            return f'{base_url}/top/.rss?t={time_period}'
        elif feed_type == 'new':
            return f'{base_url}/new/.rss'
        else:  # hot (default)
            return f'{base_url}/.rss'


class RedditThread(models.Model):
    """Reddit-specific metadata for a thread project.

    Stores Reddit data that doesn't fit in the standard Project model,
    including Reddit-specific IDs, scores, and sync state.
    """

    project = models.OneToOneField(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='reddit_thread',
        help_text='Associated Project (type=reddit_thread)',
    )

    agent = models.ForeignKey(
        RedditCommunityAgent,
        on_delete=models.CASCADE,
        related_name='threads',
        help_text='Agent that created this thread',
    )

    reddit_post_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text='Reddit post ID (e.g., "t3_1pa4e7t")',
    )

    subreddit = models.CharField(
        max_length=100,
        db_index=True,
        help_text='Subreddit name (denormalized for queries)',
    )

    author = models.CharField(
        max_length=100,
        help_text='Reddit username of post author',
    )

    permalink = models.URLField(
        max_length=500,
        help_text='Full Reddit URL to the thread',
    )

    # Reddit metrics (updated on each sync)
    score = models.IntegerField(
        default=0,
        help_text='Reddit upvote score (at last sync)',
    )

    num_comments = models.IntegerField(
        default=0,
        help_text='Number of comments (at last sync)',
    )

    thumbnail_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Reddit thumbnail URL from RSS feed',
    )

    # Reddit timestamps
    created_utc = models.DateTimeField(
        help_text='When the post was created on Reddit',
    )

    # Sync tracking
    last_synced_at = models.DateTimeField(
        auto_now=True,
        help_text='When we last fetched updates for this thread',
    )

    # Metadata from RSS feed
    reddit_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional metadata from Reddit RSS feed',
    )

    # Content moderation tracking
    class ModerationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        SKIPPED = 'skipped', 'Skipped'

    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.APPROVED,
        db_index=True,
        help_text='Content moderation status',
    )

    moderation_reason = models.TextField(
        blank=True,
        default='',
        help_text='Reason for moderation decision',
    )

    moderation_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Full moderation results from text and image checks',
    )

    moderated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When content was moderated',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reddit_threads'
        verbose_name = 'Reddit Thread'
        verbose_name_plural = 'Reddit Threads'
        indexes = [
            models.Index(fields=['subreddit', '-created_utc']),
            models.Index(fields=['agent', '-created_utc']),
            models.Index(fields=['-score']),
            models.Index(fields=['-num_comments']),
            models.Index(fields=['reddit_post_id']),
        ]
        ordering = ['-created_utc']

    def __str__(self):
        return f'r/{self.subreddit} - {self.reddit_post_id}'
