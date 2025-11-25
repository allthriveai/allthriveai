"""Admin interface for Thrive Circle."""

from django.contrib import admin

from .models import PointActivity


@admin.register(PointActivity)
class PointActivityAdmin(admin.ModelAdmin):
    """Admin for PointActivity model."""

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
