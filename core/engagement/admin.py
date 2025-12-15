"""Admin configuration for engagement tracking."""

from django.contrib import admin

from .models import EngagementEvent


@admin.register(EngagementEvent)
class EngagementEventAdmin(admin.ModelAdmin):
    """Admin for EngagementEvent model."""

    list_display = ['user', 'event_type', 'project', 'processed', 'created_at']
    list_filter = ['event_type', 'processed', 'created_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'processed_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'project')
