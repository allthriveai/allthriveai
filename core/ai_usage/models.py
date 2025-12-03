"""
AI Usage Tracking Models

Tracks all AI API usage, costs, and provides analytics for business intelligence.
"""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone

User = get_user_model()


class AIProviderPricing(models.Model):
    """
    Tracks pricing for different AI models and providers.
    Prices change over time, so we version this for historical accuracy.
    """

    provider = models.CharField(max_length=50, db_index=True, help_text='e.g., openai, anthropic, cohere')
    model = models.CharField(max_length=100, db_index=True, help_text='e.g., gpt-4, claude-3-opus')

    # Pricing per 1 million tokens
    input_price_per_million = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='USD per 1M input tokens',
    )
    output_price_per_million = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='USD per 1M output tokens',
    )

    # Metadata
    effective_date = models.DateTimeField(default=timezone.now, help_text='When this pricing became effective')
    is_active = models.BooleanField(default=True, help_text='Whether this is the current active pricing')
    notes = models.TextField(blank=True, help_text='Any notes about this pricing version')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI Provider Pricing'
        verbose_name_plural = 'AI Provider Pricing'
        ordering = ['-effective_date']
        indexes = [
            models.Index(fields=['provider', 'model', '-effective_date']),
            models.Index(fields=['is_active', '-effective_date']),
        ]

    def __str__(self):
        return (
            f'{self.provider}/{self.model} - '
            f'In: ${self.input_price_per_million}/1M, Out: ${self.output_price_per_million}/1M'
        )

    @property
    def display_name(self):
        """Human-readable display name."""
        return f'{self.provider.title()} {self.model}'


class AIUsageLog(models.Model):
    """
    Comprehensive logging of every AI request with full cost attribution.
    This is your source of truth for cost analysis and business intelligence.
    """

    STATUS_CHOICES = [
        ('success', 'Success'),
        ('error', 'Error'),
        ('timeout', 'Timeout'),
        ('rate_limited', 'Rate Limited'),
    ]

    REQUEST_TYPE_CHOICES = [
        ('completion', 'Completion'),
        ('chat', 'Chat'),
        ('embedding', 'Embedding'),
        ('image', 'Image Generation'),
        ('audio', 'Audio'),
    ]

    # User & Context
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_usage_logs')
    session_id = models.CharField(max_length=255, blank=True, help_text='Session ID for tracking user sessions')

    # Request Details
    feature = models.CharField(
        max_length=100, db_index=True, help_text='Feature that made the request (e.g., chat, project_generation)'
    )
    request_type = models.CharField(max_length=50, choices=REQUEST_TYPE_CHOICES, default='completion')

    # AI Provider Info
    provider = models.CharField(max_length=50, db_index=True, help_text='AI provider (openai, anthropic, etc.)')
    model = models.CharField(max_length=100, db_index=True, help_text='Model used (gpt-4, claude-3-opus, etc.)')

    # Token Usage
    input_tokens = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    output_tokens = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    total_tokens = models.IntegerField(default=0, validators=[MinValueValidator(0)])

    # Cost Calculation (in USD)
    input_cost = models.DecimalField(
        max_digits=10, decimal_places=6, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))]
    )
    output_cost = models.DecimalField(
        max_digits=10, decimal_places=6, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))]
    )
    total_cost = models.DecimalField(
        max_digits=10, decimal_places=6, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))]
    )
    pricing_version = models.ForeignKey(
        AIProviderPricing,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text='Pricing version used for calculation',
    )

    # Performance Metrics
    latency_ms = models.IntegerField(null=True, blank=True, help_text='Request latency in milliseconds')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='success', db_index=True)
    error_message = models.TextField(blank=True)

    # Metadata (stored as JSON for flexibility)
    request_metadata = models.JSONField(
        default=dict, blank=True, help_text='Additional request metadata (prompt length, temperature, etc.)'
    )
    response_metadata = models.JSONField(
        default=dict, blank=True, help_text='Additional response metadata (finish reason, model version, etc.)'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'AI Usage Log'
        verbose_name_plural = 'AI Usage Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['feature', '-created_at']),
            models.Index(fields=['provider', 'model', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['-created_at', 'total_cost']),  # For cost analysis over time
        ]
        permissions = [
            ('view_all_usage_logs', 'Can view all AI usage logs'),
            ('view_usage_details', 'Can view detailed usage information'),
        ]

    def __str__(self):
        # Privacy-safe representation (no email)
        return f'User {self.user.id} - {self.feature} - {self.provider}/{self.model} - ${self.total_cost:.4f}'

    @property
    def cost_per_token(self):
        """Calculate cost per token for this request."""
        if self.total_tokens > 0:
            return self.total_cost / self.total_tokens
        return Decimal('0')


class UserAICostSummary(models.Model):
    """
    Pre-aggregated daily summaries for fast analytics.
    Updated in real-time or by daily batch job.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_cost_summaries')
    date = models.DateField(db_index=True, help_text='Date of this summary')

    # Daily Aggregates
    total_requests = models.IntegerField(default=0, help_text='Total AI requests made this day')
    total_tokens = models.BigIntegerField(default=0, help_text='Total tokens used this day')
    total_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0'), help_text='Total cost in USD for this day'
    )

    # Breakdowns (stored as JSON for flexibility)
    cost_by_feature = models.JSONField(
        default=dict, blank=True, help_text="Cost breakdown by feature {'chat': 0.50, 'project_gen': 1.20}"
    )
    cost_by_provider = models.JSONField(
        default=dict, blank=True, help_text="Cost breakdown by provider {'openai': 1.20, 'anthropic': 0.50}"
    )
    requests_by_feature = models.JSONField(
        default=dict, blank=True, help_text="Request count by feature {'chat': 10, 'project_gen': 5}"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User AI Cost Summary'
        verbose_name_plural = 'User AI Cost Summaries'
        unique_together = [['user', 'date']]
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['date', '-total_cost']),
            models.Index(fields=['-total_cost']),  # For finding high-cost users
        ]
        permissions = [
            ('view_all_user_costs', 'Can view all user AI costs'),
            ('view_cau_metrics', 'Can view CAU analytics'),
            ('view_pii', 'Can view personally identifiable information'),
            ('export_usage_data', 'Can export usage data'),
        ]

    def __str__(self):
        # Privacy-safe representation (no email)
        return f'User {self.user.id} - {self.date} - ${self.total_cost:.2f}'

    @classmethod
    def get_user_monthly_cost(cls, user, year=None, month=None):
        """Get total cost for a user in a given month."""
        if year is None or month is None:
            now = timezone.now()
            year = now.year
            month = now.month

        summaries = cls.objects.filter(user=user, date__year=year, date__month=month)

        return summaries.aggregate(total=Sum('total_cost'))['total'] or Decimal('0')

    @classmethod
    def get_top_users_by_cost(cls, days=30, limit=10):
        """Get users with highest costs in the last N days."""
        start_date = timezone.now().date() - timedelta(days=days)

        return (
            cls.objects.filter(date__gte=start_date)
            .values('user__email', 'user__id')
            .annotate(total_cost=Sum('total_cost'), total_requests=Sum('total_requests'))
            .order_by('-total_cost')[:limit]
        )

    @classmethod
    def get_cau(cls, days=30, start_date=None, end_date=None):
        """
        Calculate Cost per Active User (CAU) for a date range.

        Active User = any user who made at least 1 AI request in the period.
        CAU = Total AI Cost / Number of Active Users

        Args:
            days: Number of days to look back (default: 30)
            start_date: Optional explicit start date
            end_date: Optional explicit end date

        Returns:
            dict with: {
                'cau': Decimal,
                'total_cost': Decimal,
                'active_users': int,
                'avg_cost_per_user': Decimal,
                'period_days': int,
                'start_date': date,
                'end_date': date
            }
        """
        from django.core.cache import cache

        # Create cache key
        cache_key = f'cau_{days}_{start_date}_{end_date}'

        # Try to get from cache (5 minute TTL)
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result

        # Determine date range
        if start_date and end_date:
            summaries = cls.objects.filter(date__gte=start_date, date__lte=end_date)
            period_days = (end_date - start_date).days + 1
        else:
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days - 1)  # -1 to include today
            summaries = cls.objects.filter(date__gte=start_date, date__lte=end_date)
            period_days = days

        # Get total cost
        total_cost = summaries.aggregate(total=Sum('total_cost'))['total'] or Decimal('0')

        # Get unique users who made requests (active users)
        active_users = summaries.values('user').distinct().count()

        # Calculate CAU
        cau = total_cost / active_users if active_users > 0 else Decimal('0')

        result = {
            'cau': cau,
            'total_cost': total_cost,
            'active_users': active_users,
            'avg_cost_per_user': cau,  # Same as CAU
            'period_days': period_days,
            'start_date': start_date,
            'end_date': end_date,
        }

        # Cache for 5 minutes (300 seconds)
        cache.set(cache_key, result, 300)

        return result
