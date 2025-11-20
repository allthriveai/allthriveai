"""Admin interface for points tracking."""

from django.contrib import admin

from .models import PointsHistory


@admin.register(PointsHistory)
class PointsHistoryAdmin(admin.ModelAdmin):
    """Admin interface for PointsHistory."""

    list_display = ['user', 'activity_type', 'points_awarded', 'description', 'created_at']
    list_filter = ['activity_type', 'created_at']
    search_fields = ['user__username', 'user__email', 'description']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    fieldsets = (
        (
            None,
            {
                'fields': ('user', 'activity_type', 'points_awarded', 'description'),
            },
        ),
        (
            'Additional Data',
            {
                'fields': ('metadata',),
            },
        ),
        (
            'Tracking',
            {
                'fields': ('id', 'created_at'),
            },
        ),
    )
