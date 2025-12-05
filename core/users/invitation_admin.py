"""Admin configuration for invitation requests."""

from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html

from core.users.invitation_models import InvitationRequest
from core.users.invitation_views import send_approval_email


@admin.register(InvitationRequest)
class InvitationRequestAdmin(admin.ModelAdmin):
    """Admin interface for managing invitation requests."""

    list_display = [
        'name',
        'email',
        'status_badge',
        'reason_preview',
        'created_at',
        'reviewed_by',
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'email', 'reason']
    readonly_fields = [
        'email',
        'name',
        'reason',
        'ip_address',
        'user_agent',
        'created_at',
        'updated_at',
        'reviewed_at',
    ]
    ordering = ['-created_at']
    actions = ['approve_requests', 'reject_requests']

    fieldsets = (
        (
            'Request Details',
            {
                'fields': ('name', 'email', 'reason'),
            },
        ),
        (
            'Status',
            {
                'fields': ('status', 'reviewed_by', 'review_notes', 'reviewed_at'),
            },
        ),
        (
            'Metadata',
            {
                'fields': ('ip_address', 'user_agent', 'created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )

    @admin.display(
        description='Status',
        ordering='status',
    )
    def status_badge(self, obj):
        """Display status as a colored badge."""
        colors = {
            'pending': '#fbbf24',  # yellow
            'approved': '#22c55e',  # green
            'rejected': '#ef4444',  # red
        }
        color = colors.get(obj.status, '#94a3b8')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px; font-weight: bold;">{}</span>',
            color,
            obj.status.upper(),
        )

    @admin.display(description='Reason')
    def reason_preview(self, obj):
        """Show truncated reason."""
        if obj.reason:
            return obj.reason[:50] + '...' if len(obj.reason) > 50 else obj.reason
        return '-'

    @admin.action(description='Approve selected requests and send invitation emails')
    def approve_requests(self, request, queryset):
        """Bulk approve invitation requests."""
        pending = queryset.filter(status=InvitationRequest.Status.PENDING)
        approved_count = 0
        failed_count = 0

        for invitation in pending:
            try:
                invitation.status = InvitationRequest.Status.APPROVED
                invitation.reviewed_by = request.user
                invitation.reviewed_at = timezone.now()
                invitation.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

                # Send approval email
                send_approval_email(invitation)
                approved_count += 1

            except Exception as e:
                failed_count += 1
                self.message_user(
                    request,
                    f'Failed to approve {invitation.email}: {e}',
                    messages.ERROR,
                )

        if approved_count:
            self.message_user(
                request,
                f'Successfully approved {approved_count} request(s) and sent invitation emails.',
                messages.SUCCESS,
            )
        if failed_count:
            self.message_user(
                request,
                f'Failed to approve {failed_count} request(s).',
                messages.WARNING,
            )

    @admin.action(description='Reject selected requests')
    def reject_requests(self, request, queryset):
        """Bulk reject invitation requests."""
        pending = queryset.filter(status=InvitationRequest.Status.PENDING)
        count = pending.update(
            status=InvitationRequest.Status.REJECTED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(
            request,
            f'Rejected {count} request(s).',
            messages.SUCCESS,
        )

    def save_model(self, request, obj, form, change):
        """Handle individual approval/rejection from edit form."""
        if change:
            original = InvitationRequest.objects.get(pk=obj.pk)

            # If status changed to approved, send email
            if original.status != obj.status:
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()

                if obj.status == InvitationRequest.Status.APPROVED:
                    try:
                        send_approval_email(obj)
                        self.message_user(
                            request,
                            f'Approval email sent to {obj.email}',
                            messages.SUCCESS,
                        )
                    except Exception as e:
                        self.message_user(
                            request,
                            f'Failed to send approval email: {e}',
                            messages.ERROR,
                        )

        super().save_model(request, obj, form, change)
