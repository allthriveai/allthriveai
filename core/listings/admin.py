from django.contrib import admin

from core.listings.models import (
    Listing,
    ListingComment,
    ListingHeart,
    ListingSave,
    ListingVersion,
    ListingView,
)


class ListingVersionInline(admin.TabularInline):
    model = ListingVersion
    extra = 0
    readonly_fields = ['version', 'title', 'created_by', 'created_at']
    can_delete = False


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'user',
        'intent',
        'listing_type',
        'status',
        'visibility',
        'is_available',
        'heart_count',
        'view_count',
        'created_at',
    ]
    list_filter = [
        'intent',
        'status',
        'visibility',
        'is_available',
        'is_featured',
        'is_archived',
        'is_paid',
        'created_at',
    ]
    search_fields = ['title', 'description', 'user__username', 'user__email']
    readonly_fields = [
        'created_at',
        'updated_at',
        'published_at',
        'heart_count',
        'comment_count',
        'share_count',
        'save_count',
        'view_count',
        'connection_count',
        'conversion_rate',
    ]
    raw_id_fields = ['user', 'owner', 'parent', 'listing_type', 'category']
    filter_horizontal = ['topics', 'tags', 'tools']
    inlines = [ListingVersionInline]

    fieldsets = (
        ('Identity', {'fields': ('user', 'slug', 'title', 'description')}),
        ('Content', {'fields': ('body', 'body_html')}),
        ('Type & Intent', {'fields': ('intent', 'listing_type', 'owner')}),
        (
            'Categorization',
            {'fields': ('category', 'topics', 'tags', 'tools')},
        ),
        (
            'Media',
            {
                'fields': ('featured_image_url', 'banner_url', 'logo_url', 'media'),
                'classes': ['collapse'],
            },
        ),
        (
            'Pricing',
            {
                'fields': (
                    'is_paid',
                    'price',
                    'pricing_type',
                    'currency',
                    'stripe_product_id',
                    'stripe_price_id',
                    'accepts_credits',
                    'credit_price',
                ),
                'classes': ['collapse'],
            },
        ),
        (
            'Budget (Asks)',
            {
                'fields': ('budget_min', 'budget_max', 'is_negotiable'),
                'classes': ['collapse'],
            },
        ),
        (
            'Availability',
            {
                'fields': ('is_available', 'capacity', 'response_time', 'deadline'),
                'classes': ['collapse'],
            },
        ),
        (
            'Location',
            {
                'fields': ('location', 'timezone'),
                'classes': ['collapse'],
            },
        ),
        (
            'Requirements',
            {
                'fields': ('requirements', 'ideal_match'),
                'classes': ['collapse'],
            },
        ),
        (
            'Recurring',
            {
                'fields': ('is_recurring', 'recurrence_type'),
                'classes': ['collapse'],
            },
        ),
        (
            'Links',
            {
                'fields': ('external_url', 'source_url'),
                'classes': ['collapse'],
            },
        ),
        (
            'Publishing',
            {
                'fields': (
                    'status',
                    'visibility',
                    'scheduled_publish_at',
                    'is_featured',
                    'is_archived',
                    'version',
                    'parent',
                ),
            },
        ),
        (
            'Engagement (Read Only)',
            {
                'fields': (
                    'heart_count',
                    'comment_count',
                    'share_count',
                    'save_count',
                    'view_count',
                    'connection_count',
                    'conversion_rate',
                ),
                'classes': ['collapse'],
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at', 'published_at'),
                'classes': ['collapse'],
            },
        ),
    )


@admin.register(ListingHeart)
class ListingHeartAdmin(admin.ModelAdmin):
    list_display = ['user', 'listing', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'listing__title']
    raw_id_fields = ['user', 'listing']


@admin.register(ListingSave)
class ListingSaveAdmin(admin.ModelAdmin):
    list_display = ['user', 'listing', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'listing__title', 'note']
    raw_id_fields = ['user', 'listing']


@admin.register(ListingComment)
class ListingCommentAdmin(admin.ModelAdmin):
    list_display = ['user', 'listing', 'moderation_status', 'is_deleted', 'created_at']
    list_filter = ['moderation_status', 'is_deleted', 'created_at']
    search_fields = ['user__username', 'listing__title', 'body']
    raw_id_fields = ['user', 'listing', 'parent']


@admin.register(ListingVersion)
class ListingVersionAdmin(admin.ModelAdmin):
    list_display = ['listing', 'version', 'created_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['listing__title', 'title']
    raw_id_fields = ['listing', 'created_by']


@admin.register(ListingView)
class ListingViewAdmin(admin.ModelAdmin):
    list_display = ['listing', 'user', 'source', 'created_at']
    list_filter = ['source', 'created_at']
    search_fields = ['listing__title', 'user__username']
    raw_id_fields = ['listing', 'user']
