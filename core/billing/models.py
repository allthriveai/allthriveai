"""
Billing and Subscription Models

This module defines all models for the AllThrive billing system including:
- Subscription tiers and user subscriptions
- Token packages and user token balances
- Transaction and audit logging
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

User = get_user_model()


class SubscriptionTier(models.Model):
    """
    Defines available subscription tiers.

    Tiers based on Feature Matrix:
    - Free/Explorer: $0/quarter
    - Community Pro: $54/quarter (7-day trial)
    - Pro Learn: $105/quarter
    - Creator/Mentor: TBD
    """

    TIER_CHOICES = [
        ('free', 'Free / Explorer'),
        ('community_pro', 'Community Pro'),
        ('pro_learn', 'Pro Learn'),
        ('creator_mentor', 'Creator / Mentor'),
    ]

    slug = models.SlugField(unique=True, max_length=50, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    tier_type = models.CharField(max_length=20, choices=TIER_CHOICES, unique=True)

    # Pricing
    price_monthly = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Price in USD per month',
    )
    price_annual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Price in USD per year',
    )

    # Stripe Integration
    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    stripe_price_id_monthly = models.CharField(max_length=255, blank=True, null=True, unique=True)
    stripe_price_id_annual = models.CharField(max_length=255, blank=True, null=True, unique=True)

    # Trial period (in days)
    trial_period_days = models.IntegerField(default=0, help_text='Free trial period in days')

    # Tier limits and features (from Feature Matrix)
    monthly_ai_requests = models.IntegerField(default=0, help_text='Monthly AI request limit (0 = unlimited)')
    has_marketplace_access = models.BooleanField(default=False)
    has_go1_courses = models.BooleanField(default=False)
    has_ai_mentor = models.BooleanField(default=False)
    has_quests = models.BooleanField(default=False)
    has_circles = models.BooleanField(default=False)
    has_projects = models.BooleanField(default=False)
    has_creator_tools = models.BooleanField(default=False)
    has_analytics = models.BooleanField(default=False)

    # Metadata
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0, help_text='Order to display on pricing page')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'price_monthly']
        verbose_name = 'Subscription Tier'
        verbose_name_plural = 'Subscription Tiers'
        indexes = [
            models.Index(fields=['tier_type']),
            models.Index(fields=['is_active', 'display_order']),
        ]

    def __str__(self):
        return f'{self.name} (${self.price_monthly}/mo)'


class UserSubscription(models.Model):
    """
    Tracks a user's current subscription status.

    Each user has one active subscription record.
    Historical subscriptions are tracked via SubscriptionChange.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('trialing', 'Trialing'),
        ('past_due', 'Past Due'),
        ('canceled', 'Canceled'),
        ('unpaid', 'Unpaid'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT, related_name='subscriptions')

    # Subscription status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)

    # Stripe Integration
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True, unique=True)

    # Billing dates
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)

    # AI usage tracking (resets monthly)
    ai_requests_used_this_month = models.IntegerField(default=0)
    ai_requests_reset_date = models.DateField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Subscription'
        verbose_name_plural = 'User Subscriptions'
        indexes = [
            models.Index(fields=['status', 'current_period_end']),
            models.Index(fields=['stripe_customer_id']),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.tier.name} ({self.status})'

    @property
    def is_active(self):
        """Check if subscription is currently active."""
        return self.status in ['active', 'trialing']

    @property
    def is_trial(self):
        """Check if user is in trial period."""
        return self.status == 'trialing'

    def can_make_ai_request(self):
        """Check if user can make another AI request."""
        # Reset counter if new month
        if self.ai_requests_reset_date and self.ai_requests_reset_date < timezone.now().date():
            self.ai_requests_used_this_month = 0
            self.ai_requests_reset_date = timezone.now().date()
            self.save()

        # 0 means unlimited
        if self.tier.monthly_ai_requests == 0:
            return True

        return self.ai_requests_used_this_month < self.tier.monthly_ai_requests


class TokenPackage(models.Model):
    """
    Defines available token packages for purchase.

    Packages from Feature Matrix:
    - Starter: 100,000 tokens for $5
    - Booster: 500,000 tokens for $20
    - Power: 1,000,000 tokens for $35

    Tokens never expire.
    """

    PACKAGE_CHOICES = [
        ('starter', 'Starter'),
        ('booster', 'Booster'),
        ('power', 'Power'),
    ]

    slug = models.SlugField(unique=True, max_length=50, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    package_type = models.CharField(max_length=20, choices=PACKAGE_CHOICES, unique=True)

    # Token amount
    token_amount = models.IntegerField(validators=[MinValueValidator(1)], help_text='Number of tokens in this package')

    # Pricing
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))], help_text='Price in USD'
    )

    # Stripe Integration
    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    stripe_price_id = models.CharField(max_length=255, blank=True, null=True, unique=True)

    # Metadata
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0, help_text='Order to display in token shop')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'price']
        verbose_name = 'Token Package'
        verbose_name_plural = 'Token Packages'
        indexes = [
            models.Index(fields=['is_active', 'display_order']),
        ]

    def __str__(self):
        return f'{self.name} - {self.token_amount:,} tokens for ${self.price}'

    @property
    def price_per_token(self):
        """Calculate price per token in cents."""
        return (self.price / self.token_amount) * 100


class UserTokenBalance(models.Model):
    """
    Tracks a user's current token balance.

    Tokens never expire and can be purchased in packages.
    Each user has one balance record.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='token_balance')

    # Current balance
    balance = models.IntegerField(default=0, validators=[MinValueValidator(0)], help_text='Current token balance')

    # Lifetime stats
    total_purchased = models.IntegerField(default=0, help_text='Total tokens ever purchased')
    total_used = models.IntegerField(default=0, help_text='Total tokens ever used')

    # Metadata
    last_purchase_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Token Balance'
        verbose_name_plural = 'User Token Balances'

    def __str__(self):
        return f'{self.user.email} - {self.balance:,} tokens'

    def add_tokens(self, amount, source='purchase'):
        """Add tokens to balance."""
        self.balance += amount
        if source == 'purchase':
            self.total_purchased += amount
            self.last_purchase_date = timezone.now()
        self.save()

    def deduct_tokens(self, amount):
        """Deduct tokens from balance."""
        if amount > self.balance:
            raise ValueError('Insufficient token balance')
        self.balance -= amount
        self.total_used += amount
        self.save()

    def has_sufficient_balance(self, amount):
        """Check if user has enough tokens."""
        return self.balance >= amount


class TokenPurchase(models.Model):
    """
    Records token package purchases.

    Each purchase is a one-time payment processed through Stripe.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='token_purchases')
    package = models.ForeignKey(TokenPackage, on_delete=models.PROTECT, related_name='purchases')

    # Purchase details
    token_amount = models.IntegerField(help_text='Tokens purchased')
    price_paid = models.DecimalField(max_digits=10, decimal_places=2, help_text='Amount paid in USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)

    # Stripe Integration
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, default='')
    stripe_charge_id = models.CharField(max_length=255, blank=True, default='')

    # Timestamps
    completed_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Token Purchase'
        verbose_name_plural = 'Token Purchases'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['stripe_payment_intent_id']),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.package.name} ({self.status})'

    def mark_completed(self):
        """Mark purchase as completed and add tokens to user balance."""
        if self.status == 'completed':
            return

        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save()

        # Add tokens to user's balance
        balance, _ = UserTokenBalance.objects.get_or_create(user=self.user)
        balance.add_tokens(self.token_amount, source='purchase')


class TokenTransaction(models.Model):
    """
    Logs individual token usage and additions.

    Provides audit trail for all token movements.
    """

    TRANSACTION_TYPES = [
        ('purchase', 'Purchase'),
        ('usage', 'Usage'),
        ('refund', 'Refund'),
        ('bonus', 'Bonus'),
        ('adjustment', 'Adjustment'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='token_transactions')

    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, db_index=True)
    amount = models.IntegerField(help_text='Positive for additions, negative for usage')
    balance_after = models.IntegerField(help_text='Balance after this transaction')

    # Context
    description = models.CharField(max_length=255, blank=True)
    related_purchase = models.ForeignKey(
        TokenPurchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions'
    )

    # Metadata for AI usage tracking
    ai_provider = models.CharField(max_length=50, blank=True, help_text='e.g., openai, anthropic')
    ai_model = models.CharField(max_length=100, blank=True, help_text='e.g., gpt-4, claude-3')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Token Transaction'
        verbose_name_plural = 'Token Transactions'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type', '-created_at']),
        ]

    def __str__(self):
        sign = '+' if self.amount > 0 else ''
        return f'{self.user.email} - {sign}{self.amount} tokens ({self.transaction_type})'


class SubscriptionChange(models.Model):
    """
    Audit log for subscription changes.

    Tracks all subscription tier changes, cancellations, and renewals.
    """

    CHANGE_TYPES = [
        ('created', 'Created'),
        ('upgraded', 'Upgraded'),
        ('downgraded', 'Downgraded'),
        ('canceled', 'Canceled'),
        ('renewed', 'Renewed'),
        ('reactivated', 'Reactivated'),
        ('trial_started', 'Trial Started'),
        ('trial_converted', 'Trial Converted'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subscription_changes')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.CASCADE, related_name='change_history')

    # Change details
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPES, db_index=True)
    from_tier = models.ForeignKey(
        SubscriptionTier, on_delete=models.PROTECT, related_name='changes_from', null=True, blank=True
    )
    to_tier = models.ForeignKey(SubscriptionTier, on_delete=models.PROTECT, related_name='changes_to')

    # Context
    reason = models.TextField(blank=True, help_text='Reason for change')
    metadata = models.JSONField(default=dict, blank=True, help_text='Additional metadata (e.g., proration, MRR impact)')

    # Timestamps
    effective_date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Subscription Change'
        verbose_name_plural = 'Subscription Changes'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['change_type', '-created_at']),
        ]

    def __str__(self):
        if self.from_tier:
            return f'{self.user.email} - {self.from_tier.name} → {self.to_tier.name} ({self.change_type})'
        return f'{self.user.email} - {self.to_tier.name} ({self.change_type})'
