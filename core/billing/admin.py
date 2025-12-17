"""
Django Admin for Billing Models
"""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    CreditPack,
    SubscriptionChange,
    SubscriptionTier,
    TokenPackage,
    TokenPurchase,
    TokenTransaction,
    UserCreditPackSubscription,
    UserSubscription,
    UserTokenBalance,
)


@admin.register(SubscriptionTier)
class SubscriptionTierAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'tier_type',
        'price_display',
        'trial_period_days',
        'monthly_ai_requests',
        'is_active',
        'display_order',
    ]
    list_filter = ['is_active', 'tier_type']
    search_fields = ['name', 'slug', 'description']
    ordering = ['display_order', 'price_monthly']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {'fields': ('name', 'slug', 'tier_type', 'description', 'is_active', 'display_order')}),
        ('Pricing', {'fields': ('price_monthly', 'price_annual', 'trial_period_days')}),
        (
            'Stripe Integration',
            {
                'fields': ('stripe_product_id', 'stripe_price_id_monthly', 'stripe_price_id_annual'),
                'classes': ('collapse',),
            },
        ),
        (
            'Features & Limits',
            {
                'fields': (
                    'monthly_ai_requests',
                    'has_marketplace_access',
                    'has_go1_courses',
                    'has_ai_mentor',
                    'has_quests',
                    'has_circles',
                    'has_projects',
                    'has_creator_tools',
                    'has_analytics',
                )
            },
        ),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Price')
    def price_display(self, obj):
        """Display formatted price."""
        return f'${obj.price_monthly}/mo (${obj.price_annual}/year)'


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'tier',
        'status_badge',
        'current_period_end',
        'ai_usage_display',
        'created_at',
    ]
    list_filter = ['status', 'tier', 'created_at']
    search_fields = ['user__email', 'user__username', 'stripe_customer_id', 'stripe_subscription_id']
    readonly_fields = [
        'stripe_customer_id',
        'stripe_subscription_id',
        'created_at',
        'updated_at',
        'ai_usage_progress',
    ]
    raw_id_fields = ['user']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('User & Tier', {'fields': ('user', 'tier', 'status')}),
        ('Stripe Integration', {'fields': ('stripe_customer_id', 'stripe_subscription_id'), 'classes': ('collapse',)}),
        (
            'Billing Dates',
            {
                'fields': (
                    'current_period_start',
                    'current_period_end',
                    'trial_start',
                    'trial_end',
                    'canceled_at',
                )
            },
        ),
        (
            'AI Usage',
            {
                'fields': (
                    'ai_requests_used_this_month',
                    'ai_requests_reset_date',
                    'ai_usage_progress',
                )
            },
        ),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Status')
    def status_badge(self, obj):
        """Display status with color coding."""
        colors = {
            'active': '#28a745',
            'trialing': '#17a2b8',
            'past_due': '#ffc107',
            'canceled': '#dc3545',
            'unpaid': '#dc3545',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='AI Usage')
    def ai_usage_display(self, obj):
        """Display AI usage in compact format."""
        if obj.tier.monthly_ai_requests == 0:
            return f'{obj.ai_requests_used_this_month} (unlimited)'
        return f'{obj.ai_requests_used_this_month} / {obj.tier.monthly_ai_requests}'

    @admin.display(description='AI Usage Progress')
    def ai_usage_progress(self, obj):
        """Display AI usage as progress bar."""
        if obj.tier.monthly_ai_requests == 0:
            return format_html('<div>{} requests (unlimited)</div>', obj.ai_requests_used_this_month)

        percentage = (obj.ai_requests_used_this_month / obj.tier.monthly_ai_requests) * 100
        color = '#28a745' if percentage < 80 else '#ffc107' if percentage < 100 else '#dc3545'

        return format_html(
            '<div style="width: 200px;">'
            '<div style="background-color: #e9ecef; border-radius: 4px; overflow: hidden;">'
            '<div style="background-color: {}; width: {}%; height: 20px; '
            'text-align: center; color: white; line-height: 20px; font-size: 11px;">'
            '{:.0f}%'
            '</div>'
            '</div>'
            '<div style="font-size: 11px; margin-top: 2px;">{} / {}</div>'
            '</div>',
            color,
            min(percentage, 100),
            percentage,
            obj.ai_requests_used_this_month,
            obj.tier.monthly_ai_requests,
        )


@admin.register(TokenPackage)
class TokenPackageAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'package_type',
        'token_amount_display',
        'price_display',
        'price_per_token_display',
        'is_active',
        'display_order',
    ]
    list_filter = ['is_active', 'package_type']
    search_fields = ['name', 'slug', 'description']
    ordering = ['display_order', 'price']
    readonly_fields = ['created_at', 'updated_at', 'price_per_token']

    fieldsets = (
        (
            'Basic Information',
            {'fields': ('name', 'slug', 'package_type', 'description', 'is_active', 'display_order')},
        ),
        ('Package Details', {'fields': ('token_amount', 'price', 'price_per_token')}),
        ('Stripe Integration', {'fields': ('stripe_product_id', 'stripe_price_id'), 'classes': ('collapse',)}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Tokens')
    def token_amount_display(self, obj):
        """Display formatted token amount."""
        return f'{obj.token_amount:,} tokens'

    @admin.display(description='Price')
    def price_display(self, obj):
        """Display formatted price."""
        return f'${obj.price}'

    @admin.display(description='Price/Token')
    def price_per_token_display(self, obj):
        """Display price per token in cents."""
        return f'${obj.price_per_token:.4f}'


@admin.register(UserTokenBalance)
class UserTokenBalanceAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'balance_display',
        'total_purchased_display',
        'total_used_display',
        'last_purchase_date',
    ]
    search_fields = ['user__email', 'user__username']
    readonly_fields = [
        'balance',
        'total_purchased',
        'total_used',
        'last_purchase_date',
        'created_at',
        'updated_at',
    ]
    raw_id_fields = ['user']
    date_hierarchy = 'last_purchase_date'

    fieldsets = (
        ('User', {'fields': ('user',)}),
        ('Balance', {'fields': ('balance', 'last_purchase_date')}),
        ('Lifetime Statistics', {'fields': ('total_purchased', 'total_used')}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Current Balance')
    def balance_display(self, obj):
        """Display formatted balance."""
        return f'{obj.balance:,}'

    @admin.display(description='Total Purchased')
    def total_purchased_display(self, obj):
        """Display formatted total purchased."""
        return f'{obj.total_purchased:,}'

    @admin.display(description='Total Used')
    def total_used_display(self, obj):
        """Display formatted total used."""
        return f'{obj.total_used:,}'


@admin.register(TokenPurchase)
class TokenPurchaseAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'package',
        'token_amount_display',
        'price_paid',
        'status_badge',
        'created_at',
    ]
    list_filter = ['status', 'package', 'created_at']
    search_fields = [
        'user__email',
        'user__username',
        'stripe_payment_intent_id',
        'stripe_charge_id',
    ]
    readonly_fields = [
        'stripe_payment_intent_id',
        'stripe_charge_id',
        'completed_at',
        'refunded_at',
        'created_at',
        'updated_at',
    ]
    raw_id_fields = ['user']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Purchase Details', {'fields': ('user', 'package', 'token_amount', 'price_paid', 'status')}),
        ('Stripe Integration', {'fields': ('stripe_payment_intent_id', 'stripe_charge_id'), 'classes': ('collapse',)}),
        ('Timestamps', {'fields': ('completed_at', 'refunded_at', 'created_at', 'updated_at')}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Tokens')
    def token_amount_display(self, obj):
        """Display formatted token amount."""
        return f'{obj.token_amount:,} tokens'

    @admin.display(description='Status')
    def status_badge(self, obj):
        """Display status with color coding."""
        colors = {
            'pending': '#ffc107',
            'completed': '#28a745',
            'failed': '#dc3545',
            'refunded': '#6c757d',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display(),
        )


@admin.register(TokenTransaction)
class TokenTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'transaction_type',
        'amount_display',
        'balance_after_display',
        'ai_model',
        'created_at',
    ]
    list_filter = ['transaction_type', 'ai_provider', 'created_at']
    search_fields = ['user__email', 'user__username', 'description', 'ai_model']
    readonly_fields = ['created_at']
    raw_id_fields = ['user', 'related_purchase']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Transaction Details', {'fields': ('user', 'transaction_type', 'amount', 'balance_after', 'description')}),
        ('AI Context', {'fields': ('ai_provider', 'ai_model'), 'classes': ('collapse',)}),
        ('Related Data', {'fields': ('related_purchase',), 'classes': ('collapse',)}),
        ('Metadata', {'fields': ('created_at',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Amount')
    def amount_display(self, obj):
        """Display amount with +/- sign."""
        sign = '+' if obj.amount > 0 else ''
        color = '#28a745' if obj.amount > 0 else '#dc3545'
        return format_html('<span style="color: {}; font-weight: bold;">{}{:,}</span>', color, sign, obj.amount)

    @admin.display(description='Balance After')
    def balance_after_display(self, obj):
        """Display formatted balance."""
        return f'{obj.balance_after:,}'


@admin.register(SubscriptionChange)
class SubscriptionChangeAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'change_type',
        'tier_change_display',
        'effective_date',
        'created_at',
    ]
    list_filter = ['change_type', 'effective_date', 'created_at']
    search_fields = ['user__email', 'user__username', 'reason']
    readonly_fields = ['created_at']
    raw_id_fields = ['user', 'subscription']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Change Details', {'fields': ('user', 'subscription', 'change_type', 'from_tier', 'to_tier')}),
        ('Context', {'fields': ('reason', 'metadata', 'effective_date')}),
        ('Metadata', {'fields': ('created_at',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Tier Change')
    def tier_change_display(self, obj):
        """Display tier change with arrow."""
        if obj.from_tier:
            return format_html('{} → {}', obj.from_tier.name, obj.to_tier.name)
        return obj.to_tier.name


@admin.register(CreditPack)
class CreditPackAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'credits_display',
        'price_display',
        'is_active',
        'sort_order',
    ]
    list_filter = ['is_active']
    search_fields = ['name']
    ordering = ['sort_order', 'credits_per_month']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Basic Information', {'fields': ('name', 'is_active', 'sort_order')}),
        ('Pack Details', {'fields': ('credits_per_month', 'price_cents')}),
        ('Stripe Integration', {'fields': ('stripe_product_id', 'stripe_price_id'), 'classes': ('collapse',)}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Credits/Month')
    def credits_display(self, obj):
        """Display formatted credits."""
        return f'{obj.credits_per_month:,}'

    @admin.display(description='Price')
    def price_display(self, obj):
        """Display formatted price."""
        return f'${obj.price_cents / 100:.0f}/mo'


@admin.register(UserCreditPackSubscription)
class UserCreditPackSubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'user_email',
        'credit_pack',
        'status_badge',
        'credit_balance_display',
        'current_period_end',
        'created_at',
    ]
    list_filter = ['status', 'credit_pack', 'created_at']
    search_fields = ['user__email', 'user__username', 'stripe_subscription_id']
    readonly_fields = [
        'stripe_subscription_id',
        'created_at',
        'updated_at',
    ]
    raw_id_fields = ['user']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('User & Pack', {'fields': ('user', 'credit_pack', 'status')}),
        ('Stripe Integration', {'fields': ('stripe_subscription_id',), 'classes': ('collapse',)}),
        (
            'Billing Period',
            {
                'fields': (
                    'current_period_start',
                    'current_period_end',
                    'credits_this_period',
                )
            },
        ),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='User')
    def user_email(self, obj):
        """Display user email with link."""
        url = reverse('admin:auth_user_change', args=[obj.user.pk])
        return format_html('<a href="{}">{}</a>', url, obj.user.email)

    @admin.display(description='Status')
    def status_badge(self, obj):
        """Display status with color coding."""
        colors = {
            'active': '#28a745',
            'past_due': '#ffc107',
            'canceled': '#dc3545',
            'inactive': '#6c757d',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='Credit Balance')
    def credit_balance_display(self, obj):
        """Display user's credit pack balance."""
        try:
            balance = obj.user.token_balance.credit_pack_balance
            return f'{balance:,}'
        except UserTokenBalance.DoesNotExist:
            return '0'
