"""
Creator Marketplace Models

This module defines the models for the creator marketplace feature:
- CreatorAccount: Stripe Connect account for payouts
- Product: Commerce data for sellable digital products
- ProductAsset: Downloadable files associated with products
- Order: Purchase records for tracking sales
"""

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.projects.models import Project


class CreatorAccount(models.Model):
    """Stripe Connect account for creator payouts.

    Each creator has one account that stores their Stripe Connect credentials
    and payout settings.
    """

    class OnboardingStatus(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        PENDING = 'pending', 'Pending'
        COMPLETE = 'complete', 'Complete'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='creator_account',
    )
    stripe_connect_account_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text='Stripe Express Connect account ID',
    )
    onboarding_status = models.CharField(
        max_length=20,
        choices=OnboardingStatus.choices,
        default=OnboardingStatus.NOT_STARTED,
        db_index=True,
    )
    charges_enabled = models.BooleanField(
        default=False,
        help_text='Whether the account can accept charges',
    )
    payouts_enabled = models.BooleanField(
        default=False,
        help_text='Whether the account can receive payouts',
    )
    total_earnings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Total earnings after platform fees',
    )
    pending_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Balance pending payout',
    )
    default_currency = models.CharField(
        max_length=3,
        default='usd',
        help_text='Default currency for payouts',
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether the creator account is active',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Creator Account'
        verbose_name_plural = 'Creator Accounts'

    def __str__(self):
        return f'{self.user.username} - Creator Account'

    @property
    def is_onboarded(self):
        """Check if the creator has completed Stripe onboarding."""
        return (
            self.onboarding_status == self.OnboardingStatus.COMPLETE and self.charges_enabled and self.payouts_enabled
        )


class Product(models.Model):
    """Commerce data for sellable digital products.

    Products are linked to Projects via OneToOne relationship. The Project stores
    the content/layout while Product stores commerce-specific data like pricing,
    status, and sales metrics.
    """

    class ProductType(models.TextChoices):
        COURSE = 'course', 'Course'
        PROMPT_PACK = 'prompt_pack', 'Prompt Pack'
        TEMPLATE = 'template', 'Template'
        EBOOK = 'ebook', 'E-Book'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    # Link to Project for content storage
    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name='product',
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='products',
    )
    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    # Pricing
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Price in the specified currency',
    )
    currency = models.CharField(
        max_length=3,
        default='usd',
    )
    stripe_product_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Stripe Product ID',
    )
    stripe_price_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Stripe Price ID',
    )

    # Import source metadata
    source_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Import source type (youtube, pdf, notion, etc.)',
    )
    source_url = models.URLField(
        max_length=500,
        blank=True,
        default='',
        help_text='Original source URL if imported',
    )
    source_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional metadata from import source',
    )

    # Sales metrics
    total_sales = models.PositiveIntegerField(
        default=0,
        help_text='Total number of sales',
    )
    total_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Total revenue generated',
    )

    # Featured/visibility
    is_featured = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Featured on marketplace homepage',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the product was first published',
    )

    class Meta:
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['creator', 'status', '-created_at']),
            models.Index(fields=['product_type', 'status', '-created_at']),
            models.Index(fields=['status', 'is_featured', '-created_at']),
        ]

    def __str__(self):
        return f'{self.project.title} - {self.get_product_type_display()}'

    def publish(self):
        """Publish the product to the marketplace."""
        if self.status != self.Status.PUBLISHED:
            self.status = self.Status.PUBLISHED
            if not self.published_at:
                self.published_at = timezone.now()
            self.save(update_fields=['status', 'published_at', 'updated_at'])

    def archive(self):
        """Archive the product (soft delete from marketplace)."""
        self.status = self.Status.ARCHIVED
        self.save(update_fields=['status', 'updated_at'])

    @property
    def platform_fee_rate(self):
        """Platform fee rate (5%)."""
        return Decimal('0.05')

    def calculate_creator_payout(self, amount: Decimal, stripe_fee: Decimal = Decimal('0')) -> Decimal:
        """Calculate creator payout after platform fee and Stripe fees."""
        platform_fee = amount * self.platform_fee_rate
        return amount - platform_fee - stripe_fee


class ProductAsset(models.Model):
    """Downloadable files associated with products.

    For courses, these might be supplementary materials.
    For templates/ebooks, these are the actual deliverables.
    """

    class AssetType(models.TextChoices):
        DOWNLOAD = 'download', 'Downloadable File'
        VIDEO = 'video', 'Video File'
        AUDIO = 'audio', 'Audio File'
        DOCUMENT = 'document', 'Document'

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='assets',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    asset_type = models.CharField(
        max_length=20,
        choices=AssetType.choices,
        default=AssetType.DOWNLOAD,
    )
    file_path = models.CharField(
        max_length=500,
        help_text='Storage path (MinIO/S3)',
    )
    file_size = models.PositiveBigIntegerField(
        default=0,
        help_text='File size in bytes',
    )
    content_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='MIME type',
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text='Display order',
    )
    is_preview = models.BooleanField(
        default=False,
        help_text='Available for free preview',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Product Asset'
        verbose_name_plural = 'Product Assets'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.title} - {self.product.project.title}'


class Order(models.Model):
    """Purchase records for tracking sales.

    Each order represents a completed purchase of a product.
    """

    class OrderStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders',
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales',
    )

    # Payment details
    amount_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Total amount paid by buyer',
    )
    platform_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Platform fee (5%)',
    )
    stripe_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Stripe processing fee',
    )
    creator_payout = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Amount paid to creator after fees',
    )
    currency = models.CharField(
        max_length=3,
        default='usd',
    )

    # Stripe references
    stripe_payment_intent_id = models.CharField(
        max_length=255,
        unique=True,
        help_text='Stripe PaymentIntent ID',
    )
    stripe_transfer_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Stripe Transfer ID for creator payout',
    )

    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True,
    )

    # Access tracking
    access_granted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When product access was granted to buyer',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['buyer', 'status', '-created_at']),
            models.Index(fields=['creator', 'status', '-created_at']),
            models.Index(fields=['product', 'status', '-created_at']),
        ]

    def __str__(self):
        product_title = self.product.project.title if self.product else 'Unknown'
        buyer_name = self.buyer.username if self.buyer else 'Unknown'
        return f'Order {self.id}: {buyer_name} -> {product_title}'

    def grant_access(self):
        """Grant product access to the buyer after successful payment."""
        if not self.access_granted_at:
            self.access_granted_at = timezone.now()
            self.save(update_fields=['access_granted_at', 'updated_at'])

    def mark_as_paid(self):
        """Mark order as paid and grant access."""
        self.status = self.OrderStatus.PAID
        self.grant_access()
        self.save(update_fields=['status', 'updated_at'])


class ProductAccess(models.Model):
    """Track user access to purchased products.

    Separate from Order to support future features like:
    - Gifting products
    - Team access
    - Promotional access
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='product_access',
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='access_grants',
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='access_grants',
        help_text='Order that granted this access (null for promotional/gifted)',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Access expiration (null for lifetime access)',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Product Access'
        verbose_name_plural = 'Product Access'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'product'],
                name='unique_product_access_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['product', 'is_active']),
        ]

    def __str__(self):
        return f'{self.user.username} has access to {self.product.project.title}'

    @property
    def is_valid(self):
        """Check if access is currently valid."""
        if not self.is_active:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True
