"""Admin configuration for users app."""

from django.contrib import admin

# Import invitation admin to register InvitationRequest
from core.users.invitation_admin import *  # noqa: F401, F403
from core.users.models import UsernameHistory


@admin.register(UsernameHistory)
class UsernameHistoryAdmin(admin.ModelAdmin):
    """Admin for viewing username change history."""

    list_display = ['old_username', 'get_current_username', 'user', 'changed_at']
    list_filter = ['changed_at']
    search_fields = ['old_username', 'user__username', 'user__email']
    readonly_fields = ['user', 'old_username', 'changed_at']
    ordering = ['-changed_at']
    date_hierarchy = 'changed_at'

    @admin.display(
        description='Current Username',
        ordering='user__username',
    )
    def get_current_username(self, obj):
        """Display the user's current username."""
        return obj.user.username

    def has_add_permission(self, request):
        """Disable manual creation - history is created automatically."""
        return False

    def has_change_permission(self, request, obj=None):
        """Disable editing - history should be immutable."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Allow deletion for cleanup purposes."""
        return True
