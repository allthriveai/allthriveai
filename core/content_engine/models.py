"""Data models for Content Engine."""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models

from core.taxonomy.models import Taxonomy


class BrandVoice(models.Model):
    """Brand voice settings for content generation."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='brand_voice',
    )

    # Tone & Style
    tone = models.CharField(
        max_length=255,
        blank=True,
        help_text='E.g., "Casual but insightful", "Professional and direct"',
    )
    personality_traits = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text='E.g., ["curious", "practical", "enthusiastic"]',
    )

    # Content
    topics = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text='E.g., ["AI agents", "autonomous coding", "developer tools"]',
    )
    signature_phrases = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text='E.g., ["Let\'s build", "Ship it"]',
    )
    default_cta = models.CharField(
        max_length=255,
        blank=True,
        help_text='E.g., "Follow for more AI dev tips"',
    )

    # Visual
    primary_color = models.CharField(
        max_length=7,
        blank=True,
        help_text='Hex color, e.g., #1a1a2e',
    )
    accent_color = models.CharField(
        max_length=7,
        blank=True,
        help_text='Hex color, e.g., #e94560',
    )
    visual_style = models.CharField(
        max_length=255,
        blank=True,
        help_text='E.g., "Dark mode, code snippets, minimal"',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Brand Voice'
        verbose_name_plural = 'Brand Voices'

    def __str__(self):
        return f'Brand Voice for {self.user.username}'


class ContentGoal(models.Model):
    """User content goals to guide Echo conversations and content strategy."""

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        PAUSED = 'paused', 'Paused'

    class GoalType(models.TextChoices):
        AUDIENCE_GROWTH = 'audience_growth', 'Grow Audience'
        ENGAGEMENT = 'engagement', 'Increase Engagement'
        BRAND_AWARENESS = 'brand_awareness', 'Build Brand Awareness'
        LEAD_GENERATION = 'lead_generation', 'Generate Leads'
        PRODUCT_LAUNCH = 'product_launch', 'Launch Product/Service'
        THOUGHT_LEADERSHIP = 'thought_leadership', 'Establish Thought Leadership'
        COMMUNITY = 'community', 'Build Community'
        CUSTOM = 'custom', 'Custom Goal'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_goals',
    )
    title = models.CharField(
        max_length=255,
        help_text='Short description of the goal',
    )
    description = models.TextField(
        blank=True,
        help_text='Detailed description of what you want to achieve',
    )
    goal_type = models.CharField(
        max_length=50,
        choices=GoalType.choices,
        default=GoalType.CUSTOM,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    # Optional target metrics
    target_metric = models.CharField(
        max_length=255,
        blank=True,
        help_text='E.g., "10,000 followers", "100 email subscribers"',
    )
    target_date = models.DateField(
        null=True,
        blank=True,
        help_text='Target completion date',
    )

    # Priority for ordering
    priority = models.PositiveIntegerField(
        default=0,
        help_text='Higher number = higher priority',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', '-priority']),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'


class ContentIdea(models.Model):
    """A content idea in the pipeline."""

    class Status(models.TextChoices):
        SAVED = 'saved', 'Saved'
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        ARCHIVED = 'archived', 'Archived'

    class Source(models.TextChoices):
        MCP = 'mcp', 'MCP (CLI)'
        WEB = 'web', 'Web'
        MOBILE = 'mobile', 'Mobile'
        BRAINSTORM = 'brainstorm', 'Brainstorm Session'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_ideas',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    hook = models.TextField(
        blank=True,
        help_text='Attention-grabbing opener for the content',
    )
    content_pillar = models.CharField(
        max_length=100,
        blank=True,
        help_text='Content category: AI, productivity, coding, etc. (deprecated - use pillar FK)',
    )
    pillar = models.ForeignKey(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_ideas',
        limit_choices_to={'taxonomy_type': 'content_pillar'},
        help_text='Content pillar taxonomy',
    )
    brainstorm_session = models.ForeignKey(
        'BrainstormSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ideas',
        help_text='Brainstorm session that generated this idea',
    )
    platforms = ArrayField(
        models.CharField(max_length=50),
        default=list,
        help_text='Target platforms: linkedin, youtube, twitter',
    )
    source = models.CharField(
        max_length=50,
        choices=Source.choices,
        default=Source.WEB,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SAVED,
        db_index=True,
    )

    # Planning
    planned_for_week = models.DateField(
        null=True,
        blank=True,
        help_text='Week this idea is planned for',
    )
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return self.title


class ContentClip(models.Model):
    """A content clip with review workflow."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        READY_FOR_REVIEW = 'ready_for_review', 'Ready for Review'
        NEEDS_CHANGES = 'needs_changes', 'Needs Changes'
        APPROVED = 'approved', 'Approved'
        SCHEDULED = 'scheduled', 'Scheduled'
        PUBLISHED = 'published', 'Published'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_clips',
    )
    idea = models.ForeignKey(
        ContentIdea,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clips',
    )
    # Note: Animation data stored in scenes JSONField below
    # Can link to Project model later if needed

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Clip content (can store animation data here or in Project)
    scenes = models.JSONField(
        default=list,
        blank=True,
        help_text='Animation scenes data',
    )
    duration = models.PositiveIntegerField(
        default=0,
        help_text='Duration in milliseconds',
    )
    style = models.JSONField(
        default=dict,
        blank=True,
        help_text='Visual style: colors, fonts, etc.',
    )

    # Review workflow
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    review_notes = models.TextField(
        blank=True,
        help_text='Feedback for iteration',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return self.title


class ScheduledPost(models.Model):
    """A post scheduled for publishing."""

    class Platform(models.TextChoices):
        LINKEDIN = 'linkedin', 'LinkedIn'
        YOUTUBE = 'youtube', 'YouTube'
        TWITTER = 'twitter', 'Twitter'

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        PUBLISHING = 'publishing', 'Publishing'
        PUBLISHED = 'published', 'Published'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scheduled_posts',
    )
    clip = models.ForeignKey(
        ContentClip,
        on_delete=models.CASCADE,
        related_name='scheduled_posts',
    )

    # Platform & content
    platform = models.CharField(
        max_length=20,
        choices=Platform.choices,
        db_index=True,
    )
    text_content = models.TextField(help_text='Post caption')
    platform_specific = models.JSONField(
        default=dict,
        blank=True,
        help_text='Platform-specific data: YouTube title, tags, etc.',
    )

    # Scheduling
    scheduled_for = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True,
    )

    # Results
    published_at = models.DateTimeField(null=True, blank=True)
    platform_post_id = models.CharField(max_length=255, blank=True)
    platform_url = models.URLField(blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_for']
        indexes = [
            models.Index(fields=['user', 'status', 'scheduled_for']),
            models.Index(fields=['status', 'scheduled_for']),
        ]

    def __str__(self):
        return f'{self.clip.title} → {self.platform} @ {self.scheduled_for}'


class BrainstormSession(models.Model):
    """A brainstorming session for planning content."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='brainstorm_sessions',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this session is currently active',
    )

    # Session data
    messages = models.JSONField(
        default=list,
        help_text='Chat messages from the brainstorm session',
    )
    generated_ideas = models.ManyToManyField(
        ContentIdea,
        blank=True,
        related_name='brainstorm_sessions',
    )

    # Planning period
    target_week = models.DateField(
        null=True,
        blank=True,
        help_text='Week being planned',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Brainstorm: {self.title}'


class Strategy(models.Model):
    """
    User's social media content strategy.

    Consolidates goals, platforms, cadence, schedule, topics, and voice
    into a single model that Echo can reference for contextual coaching.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='strategy',
    )

    # Goals (why) - what user wants to achieve
    goals = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text='E.g., ["grow audience", "get consulting clients"]',
    )

    # Platforms (where) - where they post
    platforms = ArrayField(
        models.CharField(max_length=50),
        default=list,
        blank=True,
        help_text='E.g., ["linkedin", "twitter"]',
    )

    # Cadence (how often) - posts per week total
    posts_per_week = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Total posts per week across all platforms',
    )

    # Schedule (when) - platform-specific posting days
    schedule = models.JSONField(
        default=dict,
        blank=True,
        help_text='E.g., {"linkedin": ["Mon", "Wed"], "twitter": ["Tue", "Thu"]}',
    )

    # Pillars (what topics) - content themes
    pillars = ArrayField(
        models.CharField(max_length=100),
        default=list,
        blank=True,
        help_text='E.g., ["AI", "productivity", "coding"]',
    )

    # Voice (how you sound) - brief description of tone
    voice = models.TextField(
        blank=True,
        help_text='E.g., "professional but approachable, no jargon, use examples"',
    )

    # Recommendations - Echo's coaching advice for reference
    recommendations = models.JSONField(
        default=dict,
        blank=True,
        help_text='Stores Echo coaching advice for reference',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Strategy'
        verbose_name_plural = 'Strategies'

    def __str__(self):
        platforms_str = ', '.join(self.platforms) if self.platforms else 'No platforms'
        return f'Strategy for {self.user.username}: {platforms_str}'
