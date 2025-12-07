"""Django Admin configuration for Tools."""

from django.contrib import admin

from .models import Tool, ToolBookmark, ToolComparison, ToolReview


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'category',
        'pricing_model',
        'is_featured',
        'is_verified',
        'is_active',
        'view_count',
        'popularity_score',
        'created_at',
    ]
    list_filter = [
        'category',
        'pricing_model',
        'is_featured',
        'is_verified',
        'is_active',
        'has_free_tier',
        'requires_api_key',
        'created_at',
    ]
    search_fields = ['name', 'tagline', 'description', 'tags']
    readonly_fields = ['slug', 'view_count', 'popularity_score', 'created_at', 'updated_at']
    ordering = ['-created_at']
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        ('Basic Information', {'fields': ('name', 'slug', 'tagline', 'description', 'category', 'tags')}),
        ('Media & Branding', {'fields': ('logo_url', 'banner_url', 'screenshot_urls', 'demo_video_url')}),
        (
            'Links & Social',
            {
                'fields': (
                    'website_url',
                    'documentation_url',
                    'pricing_url',
                    'github_url',
                    'twitter_handle',
                    'discord_url',
                )
            },
        ),
        (
            'Pricing & Access',
            {'fields': ('pricing_model', 'starting_price', 'has_free_tier', 'requires_api_key', 'requires_waitlist')},
        ),
        (
            'Content Sections',
            {
                'fields': (
                    'overview',
                    'key_features',
                    'use_cases',
                    'usage_tips',
                    'best_practices',
                    'limitations',
                    'alternatives',
                    'whats_new',
                ),
                'classes': ('collapse',),
            },
        ),
        (
            'Technical Details',
            {
                'fields': ('model_info', 'integrations', 'api_available', 'languages_supported'),
                'classes': ('collapse',),
            },
        ),
        ('SEO', {'fields': ('meta_description', 'keywords'), 'classes': ('collapse',)}),
        ('Status & Metrics', {'fields': ('is_active', 'is_featured', 'is_verified', 'view_count', 'popularity_score')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'last_verified_at'), 'classes': ('collapse',)}),
    )


@admin.register(ToolReview)
class ToolReviewAdmin(admin.ModelAdmin):
    list_display = ['tool', 'user', 'rating', 'title_preview', 'is_approved', 'helpful_count', 'created_at']
    list_filter = ['rating', 'is_approved', 'is_verified_user', 'created_at']
    search_fields = ['tool__name', 'user__username', 'title', 'content']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    raw_id_fields = ['tool', 'user']

    @admin.display(description='Title')
    def title_preview(self, obj):
        return obj.title[:50] if obj.title else '(No title)'


@admin.register(ToolComparison)
class ToolComparisonAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'tool_count', 'is_public', 'created_at']
    list_filter = ['is_public', 'created_at']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['slug', 'created_at', 'updated_at']
    ordering = ['-created_at']
    filter_horizontal = ['tools']
    raw_id_fields = ['user']

    @admin.display(description='Tools')
    def tool_count(self, obj):
        return obj.tools.count()


@admin.register(ToolBookmark)
class ToolBookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'tool', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'tool__name']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    raw_id_fields = ['user', 'tool']
