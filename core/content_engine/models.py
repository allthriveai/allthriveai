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
