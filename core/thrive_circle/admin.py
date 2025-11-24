"""Admin interface for Thrive Circle."""

from django.contrib import admin

from .models import UserTier, XPActivity


@admin.register(UserTier)
class UserTierAdmin(admin.ModelAdmin):
    """Admin for UserTier model."""

    list_display = ['user', 'tier', 'total_xp', 'updated_at']
    list_filter = ['tier']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-total_xp']

    fieldsets = (
        ('User Information', {'fields': ('user', 'tier', 'total_xp')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(XPActivity)
class XPActivityAdmin(admin.ModelAdmin):
    """Admin for XPActivity model."""

    list_display = ['user', 'amount', 'activity_type', 'tier_at_time', 'created_at']
    list_filter = ['activity_type', 'tier_at_time', 'created_at']
    search_fields = ['user__username', 'description']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    fieldsets = (
        ('Activity Details', {'fields': ('user', 'amount', 'activity_type', 'description', 'tier_at_time')}),
        ('Timestamp', {'fields': ('created_at',)}),
    )
