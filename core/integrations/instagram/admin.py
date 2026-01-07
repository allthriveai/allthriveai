"""Admin configuration for Instagram integration."""

from django.contrib import admin

from .models import InstagramMediaSync, InstagramUserSettings


@admin.register(InstagramMediaSync)
class InstagramMediaSyncAdmin(admin.ModelAdmin):
    """Admin for Instagram synced media."""

    list_display = [
        'user',
        'instagram_media_id',
        'media_type',
        'is_imported',
        'auto_imported',
        'instagram_timestamp',
        'synced_at',
    ]
    list_filter = ['media_type', 'is_imported', 'auto_imported', 'synced_at']
    search_fields = ['user__username', 'instagram_media_id', 'caption']
    readonly_fields = [
        'instagram_media_id',
        'media_type',
        'media_url',
        'thumbnail_url',
        'permalink',
        'instagram_timestamp',
        'synced_at',
    ]
    raw_id_fields = ['user']

    fieldsets = (
        ('User', {'fields': ('user', 'imported_project_id')}),
        (
            'Instagram Data',
            {
                'fields': (
                    'instagram_media_id',
                    'media_type',
                    'caption',
                    'permalink',
                    'media_url',
                    'thumbnail_url',
                    'instagram_timestamp',
                )
            },
        ),
        ('Import Status', {'fields': ('is_imported', 'auto_imported', 'synced_at')}),
    )


@admin.register(InstagramUserSettings)
class InstagramUserSettingsAdmin(admin.ModelAdmin):
    """Admin for Instagram user settings."""

    list_display = ['user', 'auto_import_enabled', 'last_sync_at', 'has_error']
    list_filter = ['auto_import_enabled']
    search_fields = ['user__username']
    readonly_fields = ['last_sync_at']
    raw_id_fields = ['user']

    @admin.display(
        description='Sync Error',
        boolean=True,
    )
    def has_error(self, obj):
        return bool(obj.sync_error)
