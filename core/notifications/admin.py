"""Admin configuration for notifications module."""

from django.contrib import admin

from core.notifications.models import EmailLog, EmailPreferences, SMSPreferences


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    """Admin interface for email logs."""

    list_display = [
        'id',
        'user',
        'email_type',
        'subject',
        'status',
        'created_at',
    ]
    list_filter = ['status', 'email_type', 'created_at']
    search_fields = ['user__email', 'recipient_email', 'subject', 'ses_message_id']
    readonly_fields = [
        'user',
        'email_type',
        'subject',
        'recipient_email',
        'status',
        'error_message',
        'ses_message_id',
        'created_at',
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    def has_add_permission(self, request):
        """Prevent manual log creation."""
        return False

    def has_change_permission(self, request, obj=None):
        """Logs are read-only."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow deletion for cleanup."""
        return True


@admin.register(EmailPreferences)
class EmailPreferencesAdmin(admin.ModelAdmin):
    """Admin interface for email preferences."""

    list_display = [
        'user',
        'email_billing',
        'email_battles',
        'email_achievements',
        'email_social',
        'email_quests',
        'email_marketing',
        'updated_at',
    ]
    list_filter = [
        'email_billing',
        'email_battles',
        'email_achievements',
        'email_social',
        'email_quests',
        'email_marketing',
    ]
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['unsubscribe_token', 'created_at', 'updated_at']
    raw_id_fields = ['user']


@admin.register(SMSPreferences)
class SMSPreferencesAdmin(admin.ModelAdmin):
    """Admin interface for SMS preferences."""

    list_display = [
        'user',
        'sms_battle_invitations',
        'sms_battle_results',
        'sms_battle_reminders',
        'sms_streak_alerts',
        'consent_given_at',
        'consent_method',
        'updated_at',
    ]
    list_filter = [
        'sms_battle_invitations',
        'sms_battle_results',
        'sms_battle_reminders',
        'sms_streak_alerts',
        'consent_method',
    ]
    search_fields = ['user__email', 'user__username']
    readonly_fields = [
        'consent_given_at',
        'consent_method',
        'consent_ip_address',
        'consent_revoked_at',
        'created_at',
        'updated_at',
    ]
    raw_id_fields = ['user']

    fieldsets = [
        (
            'User',
            {
                'fields': ['user'],
            },
        ),
        (
            'SMS Preferences',
            {
                'fields': [
                    'sms_battle_invitations',
                    'sms_battle_results',
                    'sms_battle_reminders',
                    'sms_streak_alerts',
                ],
            },
        ),
        (
            'Consent Tracking (TCPA)',
            {
                'fields': [
                    'consent_given_at',
                    'consent_method',
                    'consent_ip_address',
                    'consent_revoked_at',
                ],
                'classes': ['collapse'],
            },
        ),
        (
            'Timestamps',
            {
                'fields': ['created_at', 'updated_at'],
                'classes': ['collapse'],
            },
        ),
    ]
