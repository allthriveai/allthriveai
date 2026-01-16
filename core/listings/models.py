from django.conf import settings
from django.db import models

from core.integrations.utils import normalize_slug
from core.taxonomy.mixins import WeaviateSyncMixin
from core.taxonomy.models import Taxonomy
from core.tools.models import Tool


class ListingIntent(models.TextChoices):
    """Whether this listing is an Ask (need help) or Offer (providing value)."""

    ASK = 'ask', 'Ask'
    OFFER = 'offer', 'Offer'


class ListingStatus(models.TextChoices):
    """Status values for listings."""

    # Universal statuses
    DRAFT = 'draft', 'Draft'
    PUBLISHED = 'published', 'Published'
    ARCHIVED = 'archived', 'Archived'

    # Offer-specific
    PAUSED = 'paused', 'Paused'

    # Ask-specific
    OPEN = 'open', 'Open'
    IN_PROGRESS = 'in_progress', 'In Progress'
    FULFILLED = 'fulfilled', 'Fulfilled'
    CLOSED = 'closed', 'Closed'


class ListingVisibility(models.TextChoices):
    """Visibility settings for listings."""

    PUBLIC = 'public', 'Public'
    UNLISTED = 'unlisted', 'Unlisted'
    PRIVATE = 'private', 'Private'


class PricingType(models.TextChoices):
    """How pricing is structured."""

    FREE = 'free', 'Free'
    ONE_TIME = 'one_time', 'One-Time'
    HOURLY = 'hourly', 'Hourly'
    MONTHLY = 'monthly', 'Monthly'
    CUSTOM = 'custom', 'Custom'


class RecurrenceType(models.TextChoices):
    """How often a recurring service repeats."""

    WEEKLY = 'weekly', 'Weekly'
    MONTHLY = 'monthly', 'Monthly'
    AS_NEEDED = 'as_needed', 'As Needed'


class ListingQuerySet(models.QuerySet):
    """Custom QuerySet for Listing with security and performance methods."""

    def for_user(self, user):
        """Return listings accessible to the given user."""
        if user.is_admin_role:
            return self.all()
        # User's own listings + all public published listings from others
        return self.filter(
            models.Q(user=user)
            | models.Q(
                status__in=[ListingStatus.PUBLISHED, ListingStatus.OPEN],
                visibility=ListingVisibility.PUBLIC,
                is_archived=False,
            )
        )

    def public(self):
        """Return all public, published listings."""
        return self.filter(
            status__in=[ListingStatus.PUBLISHED, ListingStatus.OPEN],
            visibility=ListingVisibility.PUBLIC,
            is_archived=False,
        )

    def asks(self):
        """Return only asks."""
        return self.filter(intent=ListingIntent.ASK)

    def offers(self):
        """Return only offers."""
        return self.filter(intent=ListingIntent.OFFER)

    def by_user(self, username):
        """Return listings by username."""
        return self.filter(user__username=username)

    def by_listing_type(self, listing_type_slug):
        """Return listings of a specific type."""
        return self.filter(listing_type__slug=listing_type_slug)


class Listing(WeaviateSyncMixin, models.Model):
    """Unified model for Asks and Offers in The AI Network Collective.

    Everything is a Listing. Type-specific behavior is controlled via:
    - intent: ask or offer
    - listing_type: FK to Taxonomy (project, course, service, beta_testers, etc.)

    Inherits from:
        WeaviateSyncMixin: Provides weaviate_uuid and last_indexed_at for vector search
    """

    # =========================================================================
    # IDENTITY
    # =========================================================================
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listings',
        help_text='Creator of the listing',
    )
    slug = models.SlugField(max_length=200, help_text='URL-safe identifier, unique per user')

    # =========================================================================
    # CORE CONTENT
    # =========================================================================
    title = models.CharField(max_length=200, help_text='Display name')
    description = models.TextField(help_text='Short description / pitch')
    body = models.TextField(blank=True, default='', help_text='Rich content (markdown)')
    body_html = models.TextField(blank=True, default='', help_text='Rendered HTML (cached)')

    # =========================================================================
    # INTENT & TYPE
    # =========================================================================
    intent = models.CharField(
        max_length=10,
        choices=ListingIntent.choices,
        default=ListingIntent.OFFER,
        db_index=True,
        help_text='Ask (need help) or Offer (providing value)',
    )
    listing_type = models.ForeignKey(
        Taxonomy,
        on_delete=models.PROTECT,
        related_name='listings_of_type',
        limit_choices_to={'taxonomy_type': 'listing_type', 'is_active': True},
        help_text='Type of listing (project, course, service, beta_testers, etc.)',
    )

    # =========================================================================
    # CATEGORIZATION
    # =========================================================================
    category = models.ForeignKey(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listings_in_category',
        limit_choices_to={'taxonomy_type': 'category', 'is_active': True},
        help_text='Primary category (Marketing, Development, Creative, etc.)',
    )
    topics = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='listings_with_topic',
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True},
        help_text='Topic taxonomies',
    )
    tags = models.ManyToManyField(
        Taxonomy,
        blank=True,
        related_name='listings_tagged',
        limit_choices_to={'taxonomy_type__in': ['interest', 'skill'], 'is_active': True},
        help_text='Additional tags (interests, skills)',
    )
    tools = models.ManyToManyField(
        Tool,
        blank=True,
        related_name='listings',
        help_text='Tools used or needed',
    )

    # =========================================================================
    # OWNERSHIP (for AI Agents)
    # =========================================================================
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_agent_listings',
        help_text='Human owner (required if listing_type=agent)',
    )

    # =========================================================================
    # MULTIMEDIA
    # =========================================================================
    featured_image_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Hero image for cards and social sharing',
    )
    banner_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Banner for profile display',
    )
    logo_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Logo (for projects/agents)',
    )
    media = models.JSONField(
        default=list,
        blank=True,
        help_text='Array of {type, url, caption, order}',
    )

    # =========================================================================
    # PRICING (for Offers)
    # =========================================================================
    is_paid = models.BooleanField(
        default=False,
        help_text='Free or paid?',
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Price in dollars (49.00 = $49)',
    )
    pricing_type = models.CharField(
        max_length=20,
        choices=PricingType.choices,
        default=PricingType.FREE,
        help_text='How pricing is structured',
    )
    currency = models.CharField(
        max_length=3,
        default='USD',
        help_text='Currency code',
    )
    stripe_product_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Stripe product ID (created on first sale)',
    )
    stripe_price_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Stripe price ID (created on first sale)',
    )
    accepts_credits = models.BooleanField(
        default=True,
        help_text='Can pay with AllThrive credits?',
    )
    credit_price = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Price in credits (if different from USD conversion)',
    )

    # =========================================================================
    # BUDGET (for Asks)
    # =========================================================================
    budget_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Minimum budget in dollars',
    )
    budget_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Maximum budget in dollars',
    )
    is_negotiable = models.BooleanField(
        default=False,
        help_text='Price/budget negotiable?',
    )

    # =========================================================================
    # AVAILABILITY & CAPACITY (for Services/Mentorship)
    # =========================================================================
    is_available = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Currently accepting?',
    )
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Max concurrent (e.g., "3 mentees max")',
    )
    response_time = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='E.g., "Usually responds in 24 hours"',
    )

    # =========================================================================
    # TIMELINE (for Asks)
    # =========================================================================
    deadline = models.DateField(
        null=True,
        blank=True,
        help_text='Need this by X date',
    )

    # =========================================================================
    # LOCATION & TIMEZONE (for Services/Mentorship)
    # =========================================================================
    location = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Remote / City / Country',
    )
    timezone = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="User's timezone for scheduling",
    )

    # =========================================================================
    # REQUIREMENTS & MATCHING
    # =========================================================================
    requirements = models.TextField(
        blank=True,
        default='',
        help_text='What you need from responders',
    )
    ideal_match = models.TextField(
        blank=True,
        default='',
        help_text='Description of ideal person to connect with',
    )

    # =========================================================================
    # RECURRING (for Services/Mentorship)
    # =========================================================================
    is_recurring = models.BooleanField(
        default=False,
        help_text='One-time or ongoing?',
    )
    recurrence_type = models.CharField(
        max_length=20,
        choices=RecurrenceType.choices,
        blank=True,
        default='',
        help_text='How often (weekly, monthly, as_needed)',
    )

    # =========================================================================
    # EXTERNAL LINKS
    # =========================================================================
    external_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Try it / Visit link',
    )
    source_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='GitHub, GitLab, etc.',
    )

    # =========================================================================
    # PUBLISHING & STATUS
    # =========================================================================
    status = models.CharField(
        max_length=20,
        choices=ListingStatus.choices,
        default=ListingStatus.DRAFT,
        db_index=True,
        help_text='Current status',
    )
    visibility = models.CharField(
        max_length=20,
        choices=ListingVisibility.choices,
        default=ListingVisibility.PUBLIC,
        help_text='Who can see this listing',
    )
    scheduled_publish_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When to auto-publish (if status=scheduled)',
    )
    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Admin-promoted',
    )
    is_archived = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Soft delete',
    )
    version = models.PositiveIntegerField(
        default=1,
        help_text='Current version number',
    )

    # =========================================================================
    # RELATIONSHIPS
    # =========================================================================
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text='Parent listing (ask belongs to project)',
    )

    # =========================================================================
    # ENGAGEMENT & SOCIAL (denormalized counts for performance)
    # =========================================================================
    heart_count = models.PositiveIntegerField(default=0, help_text='Total likes')
    comment_count = models.PositiveIntegerField(default=0, help_text='Total comments')
    share_count = models.PositiveIntegerField(default=0, help_text='Total shares')
    save_count = models.PositiveIntegerField(default=0, help_text='Total saves/clippings')
    view_count = models.PositiveIntegerField(default=0, help_text='Total views')
    connection_count = models.PositiveIntegerField(default=0, help_text='Total connections/responses')
    conversion_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Connections / views (computed, cached)',
    )

    # =========================================================================
    # TIMESTAMPS
    # =========================================================================
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When made public',
    )

    # =========================================================================
    # MANAGER
    # =========================================================================
    objects = ListingQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'slug'],
                name='unique_listing_slug_per_user',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'slug']),
            models.Index(fields=['intent', 'status', '-created_at']),
            models.Index(fields=['listing_type', 'status', '-created_at']),
            models.Index(fields=['user', 'intent', '-created_at']),
            models.Index(fields=['visibility', 'status', 'is_archived', '-created_at']),
            models.Index(fields=['is_available', 'status', '-created_at']),
        ]

    def __str__(self):
        return f'{self.title} ({self.user.username}/{self.slug})'

    def save(self, *args, **kwargs):
        if self.user_id:
            self._ensure_unique_slug()

        # Set published_at on first publish
        if self.status in [ListingStatus.PUBLISHED, ListingStatus.OPEN] and not self.published_at:
            from django.utils import timezone

            self.published_at = timezone.now()

        super().save(*args, **kwargs)

    def _ensure_unique_slug(self):
        """Ensure slug is set and unique for this user.

        If slug is empty, generate from title. If there is a collision for this
        user, append a numeric suffix (-2, -3, ...) until unique.
        """
        base = self.slug or self.title or 'listing'
        slug = normalize_slug(base)

        # Check if base slug is available
        existing = Listing.objects.filter(user=self.user, slug=slug).exclude(pk=self.pk)
        if not existing.exists():
            self.slug = slug
            return

        # Find all similar slugs in a single query
        similar_slugs = (
            Listing.objects.filter(user=self.user, slug__startswith=f'{slug}-')
            .exclude(pk=self.pk)
            .values_list('slug', flat=True)
        )

        # Extract numeric suffixes and find the next available number
        used_numbers = set()
        for existing_slug in similar_slugs:
            suffix = existing_slug[len(slug) + 1 :]
            if suffix.isdigit():
                used_numbers.add(int(suffix))

        # Find first available number starting from 2
        counter = 2
        while counter in used_numbers:
            counter += 1

        self.slug = f'{slug}-{counter}'

    @property
    def is_ask(self):
        """Convenience property to check if this is an ask."""
        return self.intent == ListingIntent.ASK

    @property
    def is_offer(self):
        """Convenience property to check if this is an offer."""
        return self.intent == ListingIntent.OFFER

    def update_conversion_rate(self):
        """Recalculate and save conversion rate."""
        if self.view_count > 0:
            self.conversion_rate = (self.connection_count / self.view_count) * 100
        else:
            self.conversion_rate = 0
        self.save(update_fields=['conversion_rate'])


class ListingHeart(models.Model):
    """Track user likes/hearts on listings."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listing_hearts',
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='hearts',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'listing'],
                name='unique_listing_heart_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['listing', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} hearts {self.listing.title}'


class ListingSave(models.Model):
    """Track user saves/bookmarks on listings (clippings)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listing_saves',
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='saves',
    )
    note = models.TextField(
        blank=True,
        default='',
        help_text='Personal note about why saved',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'listing'],
                name='unique_listing_save_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['listing', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} saved {self.listing.title}'


class ListingComment(models.Model):
    """User comments on listings with threading support."""

    class ModerationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Review'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        FLAGGED = 'flagged', 'Flagged for Manual Review'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listing_comments',
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        help_text='Reply to comment (threading)',
    )
    body = models.TextField(help_text='Comment text')
    is_edited = models.BooleanField(default=False, help_text='Was it edited?')
    is_deleted = models.BooleanField(default=False, help_text='Soft delete')

    # Moderation
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
        db_index=True,
    )
    moderation_reason = models.TextField(blank=True, default='')
    moderated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['listing', 'moderation_status', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['parent', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} on {self.listing.title}: {self.body[:50]}'


class ListingVersion(models.Model):
    """Version history for listings. Created on publish."""

    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='versions',
    )
    version = models.PositiveIntegerField(help_text='Version number (1, 2, 3...)')
    title = models.CharField(max_length=200)
    description = models.TextField()
    body = models.TextField(blank=True, default='')
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Snapshot of other fields',
    )
    change_summary = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='What changed in this version',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='listing_versions_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        constraints = [
            models.UniqueConstraint(
                fields=['listing', 'version'],
                name='unique_listing_version',
            )
        ]
        indexes = [
            models.Index(fields=['listing', '-version']),
        ]

    def __str__(self):
        return f'{self.listing.title} v{self.version}'


class ListingView(models.Model):
    """Track listing views for analytics and trending."""

    class ViewSource(models.TextChoices):
        EXPLORE = 'explore', 'Explore Feed'
        PROFILE = 'profile', 'Profile Page'
        DIRECT = 'direct', 'Direct Link'
        SEARCH = 'search', 'Search Results'
        RELATED = 'related', 'Related Listings'

    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='views',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listing_views',
        help_text='User who viewed (null for anonymous)',
    )
    session_key = models.CharField(
        max_length=40,
        blank=True,
        default='',
        help_text='Session key for anonymous view deduplication',
    )
    source = models.CharField(
        max_length=20,
        choices=ViewSource.choices,
        default=ViewSource.DIRECT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['listing', '-created_at']),
            models.Index(fields=['listing', 'created_at']),
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        viewer = self.user.username if self.user else 'anonymous'
        return f'{viewer} viewed {self.listing.title}'
