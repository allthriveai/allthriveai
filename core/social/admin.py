"""Django admin configuration for social connections."""

from django.contrib import admin

from .models import SocialConnection


@admin.register(SocialConnection)
class SocialConnectionAdmin(admin.ModelAdmin):
    """Admin interface for SocialConnection model."""

    list_display = [
        'user',
        'provider',
        'provider_username',
        'provider_email',
        'is_active',
        'is_token_expired',
        'created_at',
        'updated_at',
    ]
    list_filter = [
        'provider',
        'is_active',
        'created_at',
        'updated_at',
    ]
    search_fields = [
        'user__username',
        'user__email',
        'provider_username',
        'provider_email',
        'provider_user_id',
    ]
    readonly_fields = [
        'created_at',
        'updated_at',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_expires_at',
    ]
    fieldsets = (
        (
            'Connection Info',
            {
                'fields': (
                    'user',
                    'provider',
                    'is_active',
                )
            },
        ),
        (
            'Provider Data',
            {
                'fields': (
                    'provider_user_id',
                    'provider_username',
                    'provider_email',
                    'profile_url',
                    'avatar_url',
                )
            },
        ),
        (
            'Token Info',
            {
                'fields': (
                    'scopes',
                    'token_expires_at',
                    'access_token_encrypted',
                    'refresh_token_encrypted',
                ),
                'classes': ('collapse',),
            },
        ),
        (
            'Extra Data',
            {
                'fields': ('extra_data',),
                'classes': ('collapse',),
            },
        ),
        (
            'Timestamps',
            {
                'fields': (
                    'created_at',
                    'updated_at',
                )
            },
        ),
    )
    date_hierarchy = 'created_at'

    @admin.display(
        description='Token Expired',
        boolean=True,
    )
    def is_token_expired(self, obj):
        """Display token expiration status."""
        if obj.token_expires_at is None:
            return 'N/A'
        return obj.is_token_expired()
