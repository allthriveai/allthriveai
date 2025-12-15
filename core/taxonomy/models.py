from django.conf import settings
from django.db import models
from django.utils.text import slugify


class TopicDefinition(models.Model):
    """Cached AI-generated topic definitions.

    When users click on a topic tag, we display a dictionary-style definition.
    Definitions are generated once via AI and then cached permanently.
    Similar topics (e.g., "ai-agents", "agents", "AI Agents") can map to the
    same canonical definition via the aliases field.
    """

    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    display_name = models.CharField(max_length=100, help_text='Canonical display name (properly capitalized)')
    description = models.TextField(help_text='AI-generated dictionary-style definition (2-3 sentences)')
    aliases = models.JSONField(default=list, blank=True, help_text='Alternative slugs that map to this definition')
    project_count = models.PositiveIntegerField(default=0, help_text='Cached count of projects with this topic')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_name']
        verbose_name = 'Topic Definition'
        verbose_name_plural = 'Topic Definitions'

    def __str__(self):
        return f'{self.display_name} ({self.slug})'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.display_name)
        super().save(*args, **kwargs)


class Taxonomy(models.Model):
    """Unified taxonomy for the system.

    Taxonomy supports two types:
    - 'tool'     -> represents a Tool entry (1:1 with core.tools.Tool)
    - 'category' -> represents a predefined category for filtering projects
    """

    class TaxonomyType(models.TextChoices):
        TOOL = 'tool', 'Tool'
        CATEGORY = 'category', 'Category'

    taxonomy_type = models.CharField(
        max_length=10, choices=TaxonomyType.choices, default=TaxonomyType.TOOL, db_index=True
    )

    # Common fields
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True, help_text='URL-friendly identifier')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, help_text='Whether this taxonomy is available for selection')

    # Topic-only fields (safe to leave blank for tools)
    color = models.CharField(
        max_length=50, blank=True, default='', help_text="Display color for topics (e.g., 'blue', 'teal')"
    )

    # Additional fields for tools (ignored for topics)
    website_url = models.URLField(blank=True, null=True, help_text='Official website URL')
    logo_url = models.URLField(blank=True, null=True, help_text='Logo image URL')
    usage_tips = models.JSONField(default=list, blank=True, help_text='List of usage tips/bullet points')
    best_for = models.JSONField(default=list, blank=True, help_text='List of use cases when this tool is best')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['taxonomy_type', 'name']
        verbose_name_plural = 'Taxonomies'
        indexes = [
            models.Index(fields=['taxonomy_type', 'is_active']),
        ]

    def __str__(self):
        return f'{self.name} ({self.get_taxonomy_type_display()})'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class UserTag(models.Model):
    """Tags associated with a user for personalization and content filtering.

    Tags can be either manually selected by the user or auto-generated based on
    their interactions with the site (projects, conversations, etc.).
    """

    class TagSource(models.TextChoices):
        MANUAL = 'manual', 'Manually Selected'
        AUTO_PROJECT = 'auto_project', 'Auto-generated from Projects'
        AUTO_CONVERSATION = 'auto_conversation', 'Auto-generated from Conversations'
        AUTO_ACTIVITY = 'auto_activity', 'Auto-generated from Activity'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tags')
    taxonomy = models.ForeignKey(
        Taxonomy,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text='Link to taxonomy if this is a taxonomy-based tag',
    )
    name = models.CharField(max_length=100, help_text='Tag name (can be custom or from taxonomy)')
    source = models.CharField(
        max_length=20,
        choices=TagSource.choices,
        default=TagSource.MANUAL,
    )
    confidence_score = models.FloatField(default=1.0, help_text='Confidence score for auto-generated tags (0.0-1.0)')
    interaction_count = models.IntegerField(default=0, help_text='Number of interactions that generated this tag')
    decay_factor = models.FloatField(
        default=1.0,
        help_text='Recency decay factor (0.0-1.0). Auto-generated tags decay over time if not reinforced.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-confidence_score', '-interaction_count', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'],
                name='unique_user_tag',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'source']),
            models.Index(fields=['user', '-confidence_score']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.name} ({self.get_source_display()})'


class UserInteraction(models.Model):
    """Track user interactions for auto-generating tags and personalization insights."""

    class InteractionType(models.TextChoices):
        PROJECT_VIEW = 'project_view', 'Viewed Project'
        PROJECT_CREATE = 'project_create', 'Created Project'
        CONVERSATION = 'conversation', 'Had Conversation'
        SEARCH = 'search', 'Searched'
        CONTENT_VIEW = 'content_view', 'Viewed Content'
        GAME_404_START = 'game_404_start', '404 Game Started'
        GAME_404_COMPLETE = 'game_404_complete', '404 Game Completed'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interactions')
    interaction_type = models.CharField(max_length=30, choices=InteractionType.choices)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional context about the interaction (e.g., project_id, search_query, content_type)',
    )
    extracted_keywords = models.JSONField(
        default=list, blank=True, help_text='Keywords extracted from this interaction'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['interaction_type', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.get_interaction_type_display()} at {self.created_at}'
