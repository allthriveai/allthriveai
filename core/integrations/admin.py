"""Django admin configuration for integration models."""

from django.contrib import admin

from .rss_models import RSSFeedAgent, RSSFeedItem
from .youtube_feed_models import YouTubeFeedAgent, YouTubeFeedVideo


@admin.register(RSSFeedAgent)
class RSSFeedAgentAdmin(admin.ModelAdmin):
    """Admin interface for RSS feed agents."""

    list_display = ['name', 'source_name', 'status', 'last_synced_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'source_name', 'feed_url']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Basic Info', {'fields': ('agent_user', 'name', 'source_name', 'feed_url', 'status')}),
        ('Settings', {'fields': ('settings',)}),
        ('Sync Status', {'fields': ('last_synced_at', 'last_sync_status', 'last_sync_error')}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(RSSFeedItem)
class RSSFeedItemAdmin(admin.ModelAdmin):
    """Admin interface for RSS feed items."""

    list_display = ['feed_item_id', 'source_name', 'author', 'published_at', 'created_at']
    list_filter = ['source_name', 'published_at']
    search_fields = ['feed_item_id', 'source_name', 'author', 'project__title']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Project Link', {'fields': ('project', 'agent')}),
        ('RSS Info', {'fields': ('feed_item_id', 'source_name', 'author', 'permalink', 'thumbnail_url')}),
        ('Content', {'fields': ('categories', 'published_at')}),
        (
            'Metadata',
            {'fields': ('rss_metadata', 'last_synced_at', 'created_at', 'updated_at'), 'classes': ('collapse',)},
        ),
    )


@admin.register(YouTubeFeedAgent)
class YouTubeFeedAgentAdmin(admin.ModelAdmin):
    """Admin interface for YouTube feed agents."""

    list_display = ['name', 'channel_name', 'status', 'last_synced_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'channel_name', 'channel_id', 'channel_url']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Basic Info', {'fields': ('agent_user', 'name', 'channel_name', 'channel_url', 'channel_id', 'status')}),
        ('Attribution', {'fields': ('attribution_text',)}),
        ('Settings', {'fields': ('settings', 'etag')}),
        ('Sync Status', {'fields': ('last_synced_at', 'last_sync_status', 'last_sync_error')}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(YouTubeFeedVideo)
class YouTubeFeedVideoAdmin(admin.ModelAdmin):
    """Admin interface for YouTube feed videos."""

    list_display = ['video_id', 'channel_name', 'view_count', 'like_count', 'published_at', 'created_at']
    list_filter = ['channel_name', 'published_at']
    search_fields = ['video_id', 'channel_name', 'project__title']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Project Link', {'fields': ('project', 'agent')}),
        ('YouTube Info', {'fields': ('video_id', 'channel_id', 'channel_name', 'permalink', 'thumbnail_url')}),
        ('Metrics', {'fields': ('duration', 'duration_iso', 'view_count', 'like_count', 'comment_count')}),
        ('Content', {'fields': ('tags', 'category_id', 'published_at')}),
        (
            'Metadata',
            {'fields': ('youtube_metadata', 'last_synced_at', 'created_at', 'updated_at'), 'classes': ('collapse',)},
        ),
    )
