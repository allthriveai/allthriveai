"""
Admin configuration for Creator Marketplace models.
"""

from django.contrib import admin

from .models import CreatorAccount, Order, Product, ProductAccess, ProductAsset


@admin.register(CreatorAccount)
class CreatorAccountAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'onboarding_status',
        'charges_enabled',
        'payouts_enabled',
        'total_earnings',
        'is_active',
        'created_at',
    ]
    list_filter = ['onboarding_status', 'charges_enabled', 'payouts_enabled', 'is_active']
    search_fields = ['user__username', 'user__email', 'stripe_connect_account_id']
    readonly_fields = ['stripe_connect_account_id', 'total_earnings', 'pending_balance', 'created_at', 'updated_at']
    raw_id_fields = ['user']

    fieldsets = (
        (None, {'fields': ('user', 'is_active')}),
        (
            'Stripe Connect',
            {
                'fields': (
                    'stripe_connect_account_id',
                    'onboarding_status',
                    'charges_enabled',
                    'payouts_enabled',
                )
            },
        ),
        (
            'Earnings',
            {
                'fields': (
                    'total_earnings',
                    'pending_balance',
                    'default_currency',
                )
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


class ProductAssetInline(admin.TabularInline):
    model = ProductAsset
    extra = 0
    fields = ['title', 'asset_type', 'file_path', 'file_size', 'order', 'is_preview']
    readonly_fields = ['file_size']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'project_title',
        'creator',
        'product_type',
        'status',
        'price_display',
        'total_sales',
        'is_featured',
        'created_at',
    ]
    list_filter = ['product_type', 'status', 'is_featured', 'source_type']
    search_fields = ['project__title', 'creator__username', 'creator__email']
    readonly_fields = ['total_sales', 'total_revenue', 'created_at', 'updated_at', 'published_at']
    raw_id_fields = ['project', 'creator']
    inlines = [ProductAssetInline]

    fieldsets = (
        (None, {'fields': ('project', 'creator', 'product_type', 'status', 'is_featured')}),
        (
            'Pricing',
            {
                'fields': (
                    'price',
                    'currency',
                    'stripe_product_id',
                    'stripe_price_id',
                )
            },
        ),
        (
            'Import Source',
            {
                'fields': (
                    'source_type',
                    'source_url',
                    'source_metadata',
                ),
                'classes': ('collapse',),
            },
        ),
        (
            'Metrics',
            {
                'fields': (
                    'total_sales',
                    'total_revenue',
                )
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'published_at'), 'classes': ('collapse',)}),
    )

    @admin.display(
        description='Product Title',
        ordering='project__title',
    )
    def project_title(self, obj):
        return obj.project.title

    @admin.display(description='Price')
    def price_display(self, obj):
        return f'${obj.price} {obj.currency.upper()}'


@admin.register(ProductAsset)
class ProductAssetAdmin(admin.ModelAdmin):
    list_display = ['title', 'product', 'asset_type', 'file_size_display', 'order', 'is_preview']
    list_filter = ['asset_type', 'is_preview']
    search_fields = ['title', 'product__project__title']
    raw_id_fields = ['product']

    @admin.display(description='File Size')
    def file_size_display(self, obj):
        if obj.file_size < 1024:
            return f'{obj.file_size} B'
        elif obj.file_size < 1024 * 1024:
            return f'{obj.file_size / 1024:.1f} KB'
        else:
            return f'{obj.file_size / (1024 * 1024):.1f} MB'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'buyer',
        'product_title',
        'creator',
        'amount_paid',
        'status',
        'created_at',
    ]
    list_filter = ['status', 'currency']
    search_fields = [
        'buyer__username',
        'buyer__email',
        'creator__username',
        'product__project__title',
        'stripe_payment_intent_id',
    ]
    readonly_fields = [
        'stripe_payment_intent_id',
        'stripe_transfer_id',
        'amount_paid',
        'platform_fee',
        'stripe_fee',
        'creator_payout',
        'access_granted_at',
        'created_at',
        'updated_at',
    ]
    raw_id_fields = ['buyer', 'product', 'creator']

    fieldsets = (
        (None, {'fields': ('buyer', 'product', 'creator', 'status')}),
        (
            'Payment Details',
            {
                'fields': (
                    'amount_paid',
                    'platform_fee',
                    'stripe_fee',
                    'creator_payout',
                    'currency',
                )
            },
        ),
        (
            'Stripe References',
            {
                'fields': (
                    'stripe_payment_intent_id',
                    'stripe_transfer_id',
                )
            },
        ),
        (
            'Access',
            {
                'fields': ('access_granted_at',),
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Product')
    def product_title(self, obj):
        if obj.product:
            return obj.product.project.title
        return 'N/A'


@admin.register(ProductAccess)
class ProductAccessAdmin(admin.ModelAdmin):
    list_display = ['user', 'product_title', 'granted_at', 'expires_at', 'is_active', 'is_valid']
    list_filter = ['is_active']
    search_fields = ['user__username', 'user__email', 'product__project__title']
    raw_id_fields = ['user', 'product', 'order']
    readonly_fields = ['granted_at']

    @admin.display(description='Product')
    def product_title(self, obj):
        return obj.product.project.title

    @admin.display(
        description='Valid',
        boolean=True,
    )
    def is_valid(self, obj):
        return obj.is_valid
