"""Django admin configuration for integration models."""

from django.contrib import admin

from .reddit_models import DeletedRedditThread, RedditCommunityAgent, RedditThread
from .rss_models import RSSFeedAgent, RSSFeedItem


@admin.register(RedditCommunityAgent)
class RedditCommunityAgentAdmin(admin.ModelAdmin):
    """Admin interface for Reddit community agents."""

    list_display = ['name', 'subreddit', 'status', 'last_synced_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'subreddit']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Basic Info', {'fields': ('agent_user', 'name', 'subreddit', 'status')}),
        ('Settings', {'fields': ('settings',)}),
        ('Sync Status', {'fields': ('last_synced_at', 'last_sync_status', 'last_sync_error')}),
        ('Metadata', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(RedditThread)
class RedditThreadAdmin(admin.ModelAdmin):
    """Admin interface for Reddit threads."""

    list_display = ['reddit_post_id', 'subreddit', 'author', 'score', 'num_comments', 'created_utc']
    list_filter = ['subreddit', 'moderation_status', 'created_utc']
    search_fields = ['reddit_post_id', 'subreddit', 'author', 'project__title']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at', 'moderated_at']

    fieldsets = (
        ('Project Link', {'fields': ('project', 'agent')}),
        ('Reddit Info', {'fields': ('reddit_post_id', 'subreddit', 'author', 'permalink', 'thumbnail_url')}),
        ('Metrics', {'fields': ('score', 'num_comments', 'created_utc')}),
        ('Moderation', {'fields': ('moderation_status', 'moderation_reason', 'moderation_data', 'moderated_at')}),
        (
            'Metadata',
            {'fields': ('reddit_metadata', 'last_synced_at', 'created_at', 'updated_at'), 'classes': ('collapse',)},
        ),
    )


@admin.register(DeletedRedditThread)
class DeletedRedditThreadAdmin(admin.ModelAdmin):
    """Admin interface for deleted/rejected Reddit threads.

    This tracks:
    1. Threads deleted by admins (to prevent recreation)
    2. Threads that failed content moderation (to prevent re-checking)
    """

    list_display = ['reddit_post_id', 'subreddit', 'deletion_type', 'agent', 'deleted_by', 'deleted_at']
    list_filter = ['deletion_type', 'subreddit', 'deleted_at', 'agent']
    search_fields = ['reddit_post_id', 'subreddit', 'deletion_reason']
    readonly_fields = ['deleted_at']

    fieldsets = (
        ('Thread Info', {'fields': ('reddit_post_id', 'subreddit', 'agent')}),
        ('Rejection Details', {'fields': ('deletion_type', 'deleted_by', 'deleted_at', 'deletion_reason')}),
    )

    def has_add_permission(self, request):
        """Allow manual creation of deletion records."""
        return True

    def has_change_permission(self, request, obj=None):
        """Allow editing deletion records (e.g., to update reason)."""
        return True

    def has_delete_permission(self, request, obj=None):
        """Allow deletion of records if thread should be allowed back."""
        return True


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
