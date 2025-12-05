"""Admin interface for SMS models."""

from django.contrib import admin

from core.sms.models import SMSLog


@admin.register(SMSLog)
class SMSLogAdmin(admin.ModelAdmin):
    """Admin for SMS logs."""

    list_display = [
        'id',
        'to_phone_masked',
        'message_type',
        'status',
        'user',
        'created_at',
        'sent_at',
    ]
    list_filter = ['status', 'message_type', 'created_at']
    search_fields = ['to_phone', 'provider_sid', 'user__username', 'user__email']
    readonly_fields = [
        'provider_sid',
        'error_code',
        'error_message',
        'created_at',
        'sent_at',
        'delivered_at',
    ]
    ordering = ['-created_at']

    fieldsets = [
        (
            'Message',
            {
                'fields': ['user', 'to_phone', 'message_type', 'body'],
            },
        ),
        (
            'Status',
            {
                'fields': ['status', 'provider_sid', 'error_code', 'error_message'],
            },
        ),
        (
            'Timestamps',
            {
                'fields': ['created_at', 'sent_at', 'delivered_at'],
            },
        ),
        (
            'Related Object',
            {
                'fields': ['related_object_type', 'related_object_id'],
                'classes': ['collapse'],
            },
        ),
        (
            'Cost',
            {
                'fields': ['cost_cents'],
                'classes': ['collapse'],
            },
        ),
    ]

    @admin.display(description='To Phone')
    def to_phone_masked(self, obj):
        """Show masked phone number for privacy."""
        if obj.to_phone and len(obj.to_phone) > 6:
            return f'{obj.to_phone[:6]}****'
        return obj.to_phone

    def has_add_permission(self, request):
        """Disable adding logs manually - they're created by the system."""
        return False

    def has_change_permission(self, request, obj=None):
        """Allow viewing but not editing most fields."""
        return True

    def has_delete_permission(self, request, obj=None):
        """Allow deleting old logs."""
        return True
