from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.db import models
from django.utils.text import slugify

from core.taxonomy.mixins import WeaviateSyncMixin
from core.taxonomy.models import Taxonomy


class Company(models.Model):
    """
    Company/vendor that creates tools and technologies.

    Examples: Anthropic, OpenAI, Google, Meta, Redis Labs, Vercel
    Groups related products under a parent organization.
    """

    name = models.CharField(max_length=200, unique=True, db_index=True)
    slug = models.SlugField(max_length=200, unique=True, db_index=True)
    description = models.TextField(blank=True, help_text='About the company')
    tagline = models.CharField(max_length=300, blank=True, help_text='Short company tagline')

    # Branding
    logo_url = models.URLField(blank=True, help_text='Company logo')
    banner_url = models.URLField(blank=True, help_text='Company banner image')

    # Links
    website_url = models.URLField(blank=True)
    careers_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    twitter_handle = models.CharField(max_length=100, blank=True)
    linkedin_url = models.URLField(blank=True)

    # Company info
    founded_year = models.PositiveIntegerField(null=True, blank=True)
    headquarters = models.CharField(max_length=200, blank=True, help_text='e.g., San Francisco, CA')
    company_size = models.CharField(max_length=50, blank=True, help_text='e.g., 100-500 employees')

    # Funding & Size (for enterprise decision-making)
    funding_stage = models.CharField(
        max_length=20,
        choices=[
            ('bootstrapped', 'Bootstrapped'),
            ('seed', 'Seed'),
            ('series_a', 'Series A'),
            ('series_b', 'Series B'),
            ('series_c_plus', 'Series C+'),
            ('public', 'Public'),
            ('acquired', 'Acquired'),
        ],
        blank=True,
    )
    total_funding = models.CharField(max_length=50, blank=True, help_text='e.g., "$50M"')
    employee_count_range = models.CharField(
        max_length=20,
        choices=[
            ('1-10', '1-10'),
            ('11-50', '11-50'),
            ('51-200', '51-200'),
            ('201-500', '201-500'),
            ('501-1000', '501-1000'),
            ('1000+', '1000+'),
        ],
        blank=True,
    )

    # Compliance certifications
    has_soc2 = models.BooleanField(default=False)
    has_hipaa = models.BooleanField(default=False)
    has_gdpr = models.BooleanField(default=False)

    # Status
    is_active = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, help_text='Featured companies appear prominently')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Companies'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return f'/companies/{self.slug}'

    @property
    def tool_count(self):
        """Count of tools/technologies from this company."""
        return self.tools.filter(is_active=True).count()


class Tool(WeaviateSyncMixin, models.Model):
    """
    Comprehensive model for AI tools and technologies in the directory.
    Supports both AI tools (ChatGPT, Claude) and technologies (React, Python).

    Inherits from:
        WeaviateSyncMixin: Provides weaviate_uuid and last_indexed_at for vector search
    """

    class ToolType(models.TextChoices):
        AI_TOOL = 'ai_tool', 'AI Tool'
        TECHNOLOGY = 'technology', 'Technology'

    class ToolCategory(models.TextChoices):
        # AI Tool categories
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
        # Technology categories
        LANGUAGE = 'language', 'Programming Language'
        FRAMEWORK = 'framework', 'Framework & Library'
        DATABASE = 'database', 'Database'
        INFRASTRUCTURE = 'infrastructure', 'Infrastructure & DevOps'
        CLOUD = 'cloud', 'Cloud Platform'
        TESTING = 'testing', 'Testing & QA'
        # General
        OTHER = 'other', 'Other'

    class PricingModel(models.TextChoices):
        FREE = 'free', 'Free'
        FREEMIUM = 'freemium', 'Freemium'
        SUBSCRIPTION = 'subscription', 'Subscription'
        PAY_PER_USE = 'pay_per_use', 'Pay Per Use'
        ENTERPRISE = 'enterprise', 'Enterprise Only'
        OPEN_SOURCE = 'open_source', 'Open Source'

    class RarityTier(models.TextChoices):
        COMMON = 'common', 'Common'
        UNCOMMON = 'uncommon', 'Uncommon'
        RARE = 'rare', 'Rare'
        EPIC = 'epic', 'Epic'
        LEGENDARY = 'legendary', 'Legendary'

    class GameElement(models.TextChoices):
        CREATIVE = 'creative', 'Creative'
        ANALYTICAL = 'analytical', 'Analytical'
        GENERATIVE = 'generative', 'Generative'
        PRODUCTIVE = 'productive', 'Productive'
        INFRASTRUCTURE = 'infrastructure', 'Infrastructure'
        OTHER = 'other', 'Other'

    # Basic Information
    name = models.CharField(max_length=200, unique=True, db_index=True)
    slug = models.SlugField(max_length=200, unique=True, db_index=True)
    tagline = models.CharField(max_length=300, help_text="Short tagline (e.g., 'AI-powered conversational assistant')")
    description = models.TextField(help_text='Detailed description of what the tool does')

    # Type & Categorization
    tool_type = models.CharField(
        max_length=20,
        choices=ToolType.choices,
        default=ToolType.AI_TOOL,
        db_index=True,
        help_text='Whether this is an AI tool or a technology',
    )
    category = models.CharField(max_length=20, choices=ToolCategory.choices, default=ToolCategory.OTHER, db_index=True)
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tools',
        help_text='Parent company/vendor (e.g., Anthropic for Claude)',
    )
    # Topics for discovery (replaces tags JSONField)
    topics = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='tools',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topics for discovery (e.g., Vector Databases, RAG, Authentication)',
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

    # Comparison & Decision Metadata (for Ember discovery)
    pricing_tiers = models.JSONField(
        default=list,
        blank=True,
        help_text='Pricing tier breakdown: [{name, price, features, limits}]',
    )
    ideal_for = models.JSONField(
        default=list,
        blank=True,
        help_text='Ideal user profiles: ["startups", "RAG applications", "high-throughput"]',
    )
    not_ideal_for = models.JSONField(
        default=list,
        blank=True,
        help_text='Use cases where NOT recommended (for Ember to cite)',
    )
    differentiators = models.JSONField(
        default=list,
        blank=True,
        help_text='Comparison vs competitors: [{vs: slug, pros: [], cons: []}]',
    )
    sdk_languages = models.JSONField(
        default=list,
        blank=True,
        help_text='Official SDKs: ["python", "javascript", "go"]',
    )
    hosting_options = models.JSONField(
        default=list,
        blank=True,
        help_text='Deployment options: ["managed_cloud", "self_hosted", "kubernetes"]',
    )
    compliance_certs = models.JSONField(
        default=list,
        blank=True,
        help_text='Certifications: ["soc2", "hipaa", "gdpr", "iso27001"]',
    )
    support_tiers = models.JSONField(
        default=list,
        blank=True,
        help_text='Support options: [{tier, response_time, channels}]',
    )

    # Game/Trading Card Attributes
    superpowers = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of tool strengths: [{title: str, description: str}]',
    )
    game_stats = models.JSONField(
        default=dict,
        blank=True,
        help_text='Numerical stats for game mechanics: {power, speed, versatility, ease_of_use, value} (1-10 scale)',
    )
    rarity = models.CharField(
        max_length=20,
        choices=RarityTier.choices,
        default=RarityTier.COMMON,
        db_index=True,
        help_text='Tool rarity for game collection mechanics',
    )
    synergy_tools = models.JSONField(
        default=list,
        blank=True,
        help_text='List of tool slugs that combo well with this tool',
    )

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
            models.Index(fields=['tool_type', 'is_active']),
            models.Index(fields=['tool_type', 'category', 'is_active']),
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['is_active', '-popularity_score']),
            models.Index(fields=['is_active', '-created_at']),
            models.Index(fields=['is_featured', 'is_active']),
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
            # First try to find existing taxonomy by slug (handles case variations)
            expected_slug = slugify(self.name)
            try:
                taxonomy = Taxonomy.objects.get(slug=expected_slug)
            except Taxonomy.DoesNotExist:
                # Try by name, or create new
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

    @property
    def element(self) -> str:
        """Map category to game element type for trading card mechanics."""
        ELEMENT_MAP = {
            # Creative element
            'image': 'creative',
            'video': 'creative',
            'audio': 'creative',
            'design': 'creative',
            # Analytical element
            'data': 'analytical',
            'research': 'analytical',
            'code': 'analytical',
            'testing': 'analytical',
            # Generative element
            'writing': 'generative',
            'chat': 'generative',
            # Productive element
            'productivity': 'productive',
            # Infrastructure element
            'database': 'infrastructure',
            'cloud': 'infrastructure',
            'infrastructure': 'infrastructure',
            'language': 'infrastructure',
            'framework': 'infrastructure',
        }
        return ELEMENT_MAP.get(self.category, 'other')


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
