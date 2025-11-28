from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils.text import slugify

from core.taxonomy.models import Taxonomy


class Tool(models.Model):
    """
    Comprehensive model for AI tools in the directory.
    Each tool gets its own row with rich content capabilities.
    """

    class ToolCategory(models.TextChoices):
        CHAT = 'chat', 'Chat & Conversational AI'
        CODE = 'code', 'Code & Development'
        IMAGE = 'image', 'Image Generation'
        VIDEO = 'video', 'Video Generation & Editing'
        AUDIO = 'audio', 'Audio & Music'
        WRITING = 'writing', 'Writing & Content'
        RESEARCH = 'research', 'Research & Search'
        PRODUCTIVITY = 'productivity', 'Productivity & Workflow'
        DATA = 'data', 'Data & Analytics'
        DESIGN = 'design', 'Design & Creative'
        OTHER = 'other', 'Other'

    class PricingModel(models.TextChoices):
        FREE = 'free', 'Free'
        FREEMIUM = 'freemium', 'Freemium'
        SUBSCRIPTION = 'subscription', 'Subscription'
        PAY_PER_USE = 'pay_per_use', 'Pay Per Use'
        ENTERPRISE = 'enterprise', 'Enterprise Only'
        OPEN_SOURCE = 'open_source', 'Open Source'

    # Basic Information
    name = models.CharField(max_length=200, unique=True, db_index=True)
    slug = models.SlugField(max_length=200, unique=True, db_index=True)
    tagline = models.CharField(max_length=300, help_text="Short tagline (e.g., 'AI-powered conversational assistant')")
    description = models.TextField(help_text='Detailed description of what the tool does')

    # Categorization
    category = models.CharField(max_length=20, choices=ToolCategory.choices, default=ToolCategory.OTHER, db_index=True)
    tags = models.JSONField(
        default=list, blank=True, help_text="List of tags for filtering (e.g., ['NLP', 'GPT', 'OpenAI'])"
    )

    # Media & Branding
    logo_url = models.URLField(blank=True, help_text='Primary logo (square)')
    banner_url = models.URLField(blank=True, help_text='Wide banner/hero image')
    screenshot_urls = models.JSONField(
        default=list, blank=True, help_text='List of screenshot URLs to showcase the tool'
    )
    demo_video_url = models.URLField(blank=True, help_text='Demo or promotional video')

    # Links & Social
    website_url = models.URLField(help_text='Official website URL')
    documentation_url = models.URLField(blank=True)
    pricing_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    twitter_handle = models.CharField(max_length=100, blank=True)
    discord_url = models.URLField(blank=True)

    # Pricing & Access
    pricing_model = models.CharField(max_length=20, choices=PricingModel.choices, default=PricingModel.FREEMIUM)
    starting_price = models.CharField(
        max_length=100, blank=True, help_text="E.g., '$20/month', 'Free', '$0.002/1K tokens'"
    )
    has_free_tier = models.BooleanField(default=False)
    requires_api_key = models.BooleanField(default=False)
    requires_waitlist = models.BooleanField(default=False)

    # Content Sections (for tool detail page)
    overview = models.TextField(blank=True, help_text='Long-form overview/introduction (supports Markdown)')
    key_features = models.JSONField(
        default=list, blank=True, help_text="List of key features with descriptions [{title: '', description: ''}]"
    )
    use_cases = models.JSONField(
        default=list,
        blank=True,
        help_text="Specific use cases with examples [{title: '', description: '', example: ''}]",
    )
    usage_tips = models.JSONField(default=list, blank=True, help_text='Practical tips for using the tool effectively')
    best_practices = models.JSONField(default=list, blank=True, help_text='Best practices and recommendations')
    limitations = models.JSONField(default=list, blank=True, help_text='Known limitations or considerations')
    alternatives = models.JSONField(default=list, blank=True, help_text='List of alternative tool slugs')
    whats_new = models.JSONField(
        default=list,
        blank=True,
        help_text="Recent updates and what's new [{date: '2025-01-15', title: '', description: ''}]",
    )

    # Technical Details
    model_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Technical model information (e.g., {'model': 'GPT-4', 'provider': 'OpenAI'})",
    )
    integrations = models.JSONField(default=list, blank=True, help_text='List of integrations/platforms supported')
    api_available = models.BooleanField(default=False)
    languages_supported = models.JSONField(
        default=list, blank=True, help_text='Programming/natural languages supported'
    )

    # SEO & Discovery
    meta_description = models.CharField(max_length=160, blank=True, help_text='SEO meta description')
    keywords = models.JSONField(default=list, blank=True, help_text='SEO keywords')

    # Status & Metrics
    is_active = models.BooleanField(
        default=True, db_index=True, help_text='Whether this tool is visible in the directory'
    )
    is_featured = models.BooleanField(default=False, db_index=True, help_text='Featured tools appear at the top')
    is_verified = models.BooleanField(default=False, help_text='Verified by team (shows badge)')
    view_count = models.IntegerField(default=0)
    popularity_score = models.FloatField(default=0.0, help_text='Calculated popularity score for ranking')

    # Taxonomy Link (for personalization)
    taxonomy = models.OneToOneField(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tool_entity',
        help_text='Link to taxonomy entry for user personalization/tagging',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-is_featured', '-popularity_score', 'name']
        indexes = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['is_active', '-popularity_score']),
            models.Index(fields=['is_active', '-created_at']),
            models.Index(fields=['is_featured', 'is_active']),
            GinIndex(fields=['tags'], name='tool_tags_gin_idx'),
            GinIndex(fields=['keywords'], name='tool_keywords_gin_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        if not self.meta_description and self.description:
            # Auto-generate meta description from description
            self.meta_description = self.description[:157] + '...' if len(self.description) > 160 else self.description

        # Auto-create or update linked taxonomy
        if not self.taxonomy:
            taxonomy, created = Taxonomy.objects.get_or_create(
                name=self.name,
                defaults={
                    'taxonomy_type': 'tool',
                    'description': self.description,
                    'website_url': self.website_url,
                    'logo_url': self.logo_url,
                    'usage_tips': self.usage_tips,
                    'best_for': self.best_practices,
                    'is_active': self.is_active,
                },
            )
            self.taxonomy = taxonomy

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return f'/tools/{self.slug}'

    def increment_view_count(self):
        """Increment view count when tool page is visited."""
        self.view_count += 1
        self.save(update_fields=['view_count'])


class ToolReview(models.Model):
    """User reviews/ratings for tools."""

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tool_reviews')
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)], help_text='1-5 star rating')
    title = models.CharField(max_length=200, blank=True)
    content = models.TextField(blank=True)

    # Review metadata
    pros = models.JSONField(default=list, blank=True, help_text='List of pros')
    cons = models.JSONField(default=list, blank=True, help_text='List of cons')
    use_case = models.CharField(max_length=200, blank=True, help_text='What they used it for')

    # Moderation
    is_verified_user = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=True)
    helpful_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['tool', 'user']
        indexes = [
            models.Index(fields=['tool', '-created_at']),
            models.Index(fields=['tool', '-helpful_count']),
        ]

    def __str__(self):
        return f"{self.user.username}'s review of {self.tool.name}"


class ToolComparison(models.Model):
    """
    User-created comparisons between tools.
    Allows users to save and share tool comparisons.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tool_comparisons')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    tools = models.ManyToManyField(Tool, related_name='comparisons')

    is_public = models.BooleanField(default=False)
    slug = models.SlugField(max_length=200, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ToolBookmark(models.Model):
    """User bookmarks/favorites for tools."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tool_bookmarks')
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name='bookmarks')
    notes = models.TextField(blank=True, help_text='Personal notes about the tool')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'tool']

    def __str__(self):
        return f'{self.user.username} bookmarked {self.tool.name}'
