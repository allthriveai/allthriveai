"""
Django Admin for AI Usage Tracking

Provides comprehensive admin interface with analytics and visualizations.
"""

from datetime import timedelta

from django.contrib import admin
from django.db.models import Avg, Count, Sum
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import AIProviderPricing, AIUsageLog, PlatformDailyStats, UserAICostSummary


@admin.register(AIProviderPricing)
class AIProviderPricingAdmin(admin.ModelAdmin):
    list_display = [
        'display_name',
        'input_price_display',
        'output_price_display',
        'effective_date',
        'is_active',
        'created_at',
    ]
    list_filter = ['provider', 'is_active', 'effective_date']
    search_fields = ['provider', 'model']
    readonly_fields = ['created_at']
    ordering = ['-effective_date', 'provider', 'model']

    fieldsets = (
        ('Provider Information', {'fields': ('provider', 'model', 'is_active')}),
        (
            'Pricing (per 1M tokens)',
            {'fields': ('input_price_per_million', 'output_price_per_million', 'effective_date')},
        ),
        ('Notes', {'fields': ('notes',)}),
        ('Metadata', {'fields': ('created_at',), 'classes': ('collapse',)}),
    )

    @admin.display(description='Input Price')
    def input_price_display(self, obj):
        return f'${obj.input_price_per_million:.2f}/1M'

    @admin.display(description='Output Price')
    def output_price_display(self, obj):
        return f'${obj.output_price_per_million:.2f}/1M'


@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'feature',
        'provider_model',
        'tokens_display',
        'cost_display',
        'status_badge',
        'latency_display',
        'created_at',
    ]
    list_filter = ['feature', 'provider', 'model', 'status', 'request_type', ('created_at', admin.DateFieldListFilter)]
    search_fields = ['user__email', 'user__username', 'feature', 'session_id']
    readonly_fields = [
        'created_at',
        'user',
        'feature',
        'provider',
        'model',
        'input_tokens',
        'output_tokens',
        'total_tokens',
        'input_cost',
        'output_cost',
        'total_cost',
        'pricing_version',
        'latency_ms',
        'status',
        'request_metadata',
        'response_metadata',
    ]
    date_hierarchy = 'created_at'

    fieldsets = (
        ('User & Context', {'fields': ('user', 'session_id', 'feature', 'request_type')}),
        ('AI Provider', {'fields': ('provider', 'model', 'pricing_version')}),
        (
            'Token Usage',
            {
                'fields': ('input_tokens', 'output_tokens', 'total_tokens'),
                'description': 'Token counts for this request',
            },
        ),
        (
            'Cost Analysis',
            {'fields': ('input_cost', 'output_cost', 'total_cost'), 'description': 'Calculated costs in USD'},
        ),
        ('Performance', {'fields': ('latency_ms', 'status', 'error_message')}),
        ('Metadata', {'fields': ('request_metadata', 'response_metadata'), 'classes': ('collapse',)}),
        ('Timestamp', {'fields': ('created_at',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        # Only show email to users with PII viewing permission
        request = getattr(self, '_request', None)
        if request and request.user.has_perm('ai_usage.view_pii'):
            display_text = obj.user.email
        else:
            # Anonymize: show partial email
            email = obj.user.email
            username, domain = email.split('@') if '@' in email else (email, '')
            display_text = f'{username[:2]}***@{domain}' if domain else f'{username[:2]}***'
        return format_html('<a href="{}">{}</a>', url, display_text)

    @admin.display(description='Provider/Model')
    def provider_model(self, obj):
        return f'{obj.provider}/{obj.model}'

    @admin.display(description='Tokens')
    def tokens_display(self, obj):
        return format_html(
            '<span title="Input: {:,} | Output: {:,}">{:,}</span>',
            obj.input_tokens,
            obj.output_tokens,
            obj.total_tokens,
        )

    @admin.display(description='Cost')
    def cost_display(self, obj):
        # Color code by cost
        if obj.total_cost > 1:
            color = '#dc3545'  # Red for high cost
        elif obj.total_cost > 0.1:
            color = '#ffc107'  # Yellow for medium cost
        else:
            color = '#28a745'  # Green for low cost

        return format_html('<span style="color: {}; font-weight: bold;">${:.6f}</span>', color, obj.total_cost)

    @admin.display(description='Status')
    def status_badge(self, obj):
        colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'timeout': '#ffc107',
            'rate_limited': '#17a2b8',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='Latency')
    def latency_display(self, obj):
        if obj.latency_ms is None:
            return '-'
        if obj.latency_ms > 5000:
            color = '#dc3545'  # Red for slow
        elif obj.latency_ms > 2000:
            color = '#ffc107'  # Yellow for medium
        else:
            color = '#28a745'  # Green for fast
        return format_html('<span style="color: {};">{:,}ms</span>', color, obj.latency_ms)

    def changelist_view(self, request, extra_context=None):
        """Add summary statistics to the changelist view."""
        # Store request for use in display methods
        self._request = request
        response = super().changelist_view(request, extra_context)

        try:
            qs = response.context_data['cl'].queryset
        except (AttributeError, KeyError):
            return response

        # Calculate summary metrics
        metrics = {
            'total_cost': qs.aggregate(Sum('total_cost'))['total_cost__sum'] or 0,
            'total_requests': qs.count(),
            'total_tokens': qs.aggregate(Sum('total_tokens'))['total_tokens__sum'] or 0,
            'avg_cost': qs.aggregate(Avg('total_cost'))['total_cost__avg'] or 0,
            'avg_latency': qs.aggregate(Avg('latency_ms'))['latency_ms__avg'] or 0,
            'success_rate': (qs.filter(status='success').count() / qs.count() * 100) if qs.count() > 0 else 0,
        }

        # CAU (Cost per Active User) metrics
        from .models import UserAICostSummary

        cau_30d = UserAICostSummary.get_cau(days=30)
        metrics['cau_30d'] = cau_30d

        # Top features by cost
        metrics['by_feature'] = list(
            qs.values('feature').annotate(cost=Sum('total_cost'), count=Count('id')).order_by('-cost')[:5]
        )

        # Top providers by cost
        metrics['by_provider'] = list(
            qs.values('provider', 'model').annotate(cost=Sum('total_cost'), count=Count('id')).order_by('-cost')[:5]
        )

        # Today vs Yesterday comparison
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        metrics['today_cost'] = qs.filter(created_at__date=today).aggregate(Sum('total_cost'))['total_cost__sum'] or 0
        metrics['yesterday_cost'] = (
            qs.filter(created_at__date=yesterday).aggregate(Sum('total_cost'))['total_cost__sum'] or 0
        )

        response.context_data['metrics'] = metrics
        return response


@admin.register(UserAICostSummary)
class UserAICostSummaryAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'date',
        'total_requests_display',
        'total_tokens_display',
        'total_cost_display',
        'top_feature',
        'updated_at',
    ]
    list_filter = ['date', ('updated_at', admin.DateFieldListFilter)]
    search_fields = ['user__email', 'user__username']
    readonly_fields = [
        'user',
        'date',
        'total_requests',
        'total_tokens',
        'total_cost',
        'cost_by_feature',
        'cost_by_provider',
        'requests_by_feature',
        'created_at',
        'updated_at',
    ]
    date_hierarchy = 'date'

    fieldsets = (
        ('User & Date', {'fields': ('user', 'date')}),
        (
            'Daily Totals',
            {
                'fields': ('total_requests', 'total_tokens', 'total_cost'),
                'description': 'Aggregated totals for this day',
            },
        ),
        (
            'Breakdowns',
            {
                'fields': ('cost_by_feature', 'cost_by_provider', 'requests_by_feature'),
                'description': 'Detailed breakdowns by feature and provider',
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        # Only show email to users with PII viewing permission
        request = getattr(self, '_request', None)
        if request and request.user.has_perm('ai_usage.view_pii'):
            display_text = obj.user.email
        else:
            # Anonymize: show partial email
            email = obj.user.email
            username, domain = email.split('@') if '@' in email else (email, '')
            display_text = f'{username[:2]}***@{domain}' if domain else f'{username[:2]}***'
        return format_html('<a href="{}">{}</a>', url, display_text)

    @admin.display(description='Requests')
    def total_requests_display(self, obj):
        return f'{obj.total_requests:,}'

    @admin.display(description='Tokens')
    def total_tokens_display(self, obj):
        return f'{obj.total_tokens:,}'

    @admin.display(description='Cost')
    def total_cost_display(self, obj):
        if obj.total_cost > 10:
            color = '#dc3545'
        elif obj.total_cost > 1:
            color = '#ffc107'
        else:
            color = '#28a745'
        return format_html('<span style="color: {}; font-weight: bold;">${:.2f}</span>', color, obj.total_cost)

    @admin.display(description='Top Feature')
    def top_feature(self, obj):
        if not obj.cost_by_feature:
            return '-'
        top = max(obj.cost_by_feature.items(), key=lambda x: float(x[1]))
        return f'{top[0]} (${float(top[1]):.2f})'

    def changelist_view(self, request, extra_context=None):
        """Add summary statistics to the changelist view."""
        # Store request for use in display methods
        self._request = request
        response = super().changelist_view(request, extra_context)

        try:
            qs = response.context_data['cl'].queryset
        except (AttributeError, KeyError):
            return response

        # Calculate summary metrics
        metrics = {
            'total_cost': qs.aggregate(Sum('total_cost'))['total_cost__sum'] or 0,
            'total_requests': qs.aggregate(Sum('total_requests'))['total_requests__sum'] or 0,
            'total_tokens': qs.aggregate(Sum('total_tokens'))['total_tokens__sum'] or 0,
            'unique_users': qs.values('user').distinct().count(),
            'avg_daily_cost': qs.aggregate(Avg('total_cost'))['total_cost__avg'] or 0,
        }

        # CAU (Cost per Active User) metrics
        from .models import UserAICostSummary

        # Get CAU for different time periods
        cau_7d = UserAICostSummary.get_cau(days=7)
        cau_30d = UserAICostSummary.get_cau(days=30)
        cau_90d = UserAICostSummary.get_cau(days=90)

        metrics['cau_7d'] = cau_7d
        metrics['cau_30d'] = cau_30d
        metrics['cau_90d'] = cau_90d

        # Top spending users
        metrics['top_users'] = list(
            qs.values('user__email')
            .annotate(total_cost=Sum('total_cost'), total_requests=Sum('total_requests'))
            .order_by('-total_cost')[:10]
        )

        response.context_data['metrics'] = metrics
        return response


@admin.register(PlatformDailyStats)
class PlatformDailyStatsAdmin(admin.ModelAdmin):
    list_display = [
        'date',
        'total_users_display',
        'new_users_today',
        'dau',
        'total_ai_requests_display',
        'total_ai_cost_display',
        'cau_display',
        'new_projects_today',
        'updated_at',
    ]
    list_filter = [('date', admin.DateFieldListFilter)]
    search_fields = ['date']
    actions = ['run_aggregation_for_selected', 'run_aggregation_today', 'run_aggregation_yesterday']

    @admin.action(description='Re-aggregate stats for selected dates')
    def run_aggregation_for_selected(self, request, queryset):
        from .tasks import aggregate_platform_daily_stats

        for obj in queryset:
            aggregate_platform_daily_stats(str(obj.date))
        self.message_user(request, f'Re-aggregated stats for {queryset.count()} date(s)')

    @admin.action(description='Run aggregation for TODAY')
    def run_aggregation_today(self, request, queryset):
        from .tasks import aggregate_platform_daily_stats

        today = timezone.now().date()
        result = aggregate_platform_daily_stats(str(today))
        self.message_user(request, f'Aggregated stats for today ({today}): {result}')

    @admin.action(description='Run aggregation for YESTERDAY')
    def run_aggregation_yesterday(self, request, queryset):
        from .tasks import aggregate_platform_daily_stats

        yesterday = (timezone.now() - timedelta(days=1)).date()
        result = aggregate_platform_daily_stats(str(yesterday))
        self.message_user(request, f'Aggregated stats for yesterday ({yesterday}): {result}')

    readonly_fields = [
        'date',
        'total_users',
        'new_users_today',
        'active_users_today',
        'dau',
        'wau',
        'mau',
        'total_ai_requests',
        'total_ai_tokens',
        'total_ai_cost',
        'ai_users_today',
        'cau',
        'ai_by_feature',
        'ai_by_provider',
        'total_projects',
        'new_projects_today',
        'total_project_views',
        'total_project_clicks',
        'total_comments',
        'total_quests_completed',
        'total_quiz_attempts',
        'total_events_created',
        'total_tool_reviews',
        'revenue_today',
        'new_subscribers_today',
        'total_subscribers',
        'avg_hallucination_score',
        'hallucination_flags_count',
        'created_at',
        'updated_at',
    ]
    date_hierarchy = 'date'
    ordering = ['-date']

    fieldsets = (
        (
            'Date',
            {
                'fields': ('date',),
            },
        ),
        (
            'User Growth',
            {
                'fields': (
                    'total_users',
                    'new_users_today',
                    'active_users_today',
                    'dau',
                    'wau',
                    'mau',
                ),
            },
        ),
        (
            'AI Usage',
            {
                'fields': (
                    'total_ai_requests',
                    'total_ai_tokens',
                    'total_ai_cost',
                    'ai_users_today',
                    'cau',
                    'ai_by_feature',
                    'ai_by_provider',
                ),
            },
        ),
        (
            'Content & Engagement',
            {
                'fields': (
                    'total_projects',
                    'new_projects_today',
                    'total_project_views',
                    'total_project_clicks',
                    'total_comments',
                    'total_quests_completed',
                    'total_quiz_attempts',
                    'total_events_created',
                    'total_tool_reviews',
                ),
            },
        ),
        (
            'Revenue',
            {
                'fields': (
                    'revenue_today',
                    'new_subscribers_today',
                    'total_subscribers',
                ),
            },
        ),
        (
            'Quality Metrics',
            {
                'fields': (
                    'avg_hallucination_score',
                    'hallucination_flags_count',
                ),
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )

    @admin.display(description='Total Users')
    def total_users_display(self, obj):
        return format_html(
            '<span style="font-weight: bold;">{:,}</span> <span style="color: #28a745;">(+{})</span>',
            obj.total_users,
            obj.new_users_today,
        )

    @admin.display(description='AI Requests')
    def total_ai_requests_display(self, obj):
        return f'{obj.total_ai_requests:,}'

    @admin.display(description='AI Cost')
    def total_ai_cost_display(self, obj):
        if obj.total_ai_cost > 100:
            color = '#dc3545'
        elif obj.total_ai_cost > 10:
            color = '#ffc107'
        else:
            color = '#28a745'
        return format_html('<span style="color: {}; font-weight: bold;">${:.2f}</span>', color, obj.total_ai_cost)

    @admin.display(description='CAU')
    def cau_display(self, obj):
        return f'${obj.cau:.2f}'

    def has_add_permission(self, request):
        """Prevent manual creation - these are created by Celery tasks."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Prevent deletion - maintain historical data."""
        return False
