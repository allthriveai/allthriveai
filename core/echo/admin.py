"""Admin configuration for Echo app."""

from django.contrib import admin

from .models import EchoProfile


@admin.register(EchoProfile)
class EchoProfileAdmin(admin.ModelAdmin):
    """Admin for EchoProfile model."""

    list_display = [
        'user',
        'onboarding_phase',
        'asana_enabled',
        'created_at',
        'updated_at',
    ]
    list_filter = ['onboarding_phase', 'asana_enabled']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = [
        (None, {
            'fields': ['user', 'onboarding_phase'],
        }),
        ('Goals & Platforms', {
            'fields': ['goals', 'target_platforms', 'content_pillars'],
        }),
        ('Audience', {
            'fields': ['audience_description'],
        }),
        ('Integrations', {
            'fields': ['asana_enabled'],
        }),
        ('Preferences', {
            'fields': ['preferred_posting_times'],
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]
