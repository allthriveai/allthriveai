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
        'skill_level_badge',
        'status_badge',
        'email_sent_badge',
        'features_preview',
        'reason_preview',
        'created_at',
        'reviewed_by',
    ]
    list_filter = ['status', 'skill_level', 'created_at', 'approval_email_sent_at']
    search_fields = ['name', 'email', 'reason']
    readonly_fields = [
        'email',
        'name',
        'reason',
        'skill_level',
        'excited_features_display',
        'desired_integrations_display',
        'ip_address',
        'user_agent',
        'created_at',
        'updated_at',
        'reviewed_at',
        'approval_email_sent_at',
    ]
    ordering = ['-created_at']
    actions = ['approve_requests', 'reject_requests', 'resend_approval_emails']

    fieldsets = (
        (
            'Request Details',
            {
                'fields': ('name', 'email', 'skill_level', 'reason'),
            },
        ),
        (
            'Feature Interests',
            {
                'fields': ('excited_features_display', 'desired_integrations_display'),
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
        description='Skill Level',
        ordering='skill_level',
    )
    def skill_level_badge(self, obj):
        """Display skill level as a colored badge."""
        if not obj.skill_level:
            return format_html('<span style="color: #94a3b8; font-size: 11px;">—</span>')
        colors = {
            'beginner': '#22d3ee',  # cyan
            'intermediate': '#a78bfa',  # purple
            'advanced': '#22c55e',  # green
        }
        color = colors.get(obj.skill_level, '#94a3b8')
        return format_html(
            '<span style="background-color: {}; color: #0f172a; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px; font-weight: bold;">{}</span>',
            color,
            obj.get_skill_level_display(),
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

    @admin.display(
        description='Email Sent',
        ordering='approval_email_sent_at',
    )
    def email_sent_badge(self, obj):
        """Display whether approval email was sent."""
        if obj.status != InvitationRequest.Status.APPROVED:
            return format_html('<span style="color: #94a3b8; font-size: 11px;">—</span>')
        if obj.approval_email_sent_at:
            return format_html(
                '<span style="background-color: #22c55e; color: white; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: bold;" '
                'title="Sent {}">✓ SENT</span>',
                obj.approval_email_sent_at.strftime('%Y-%m-%d %H:%M'),
            )
        return format_html(
            '<span style="background-color: #ef4444; color: white; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px; font-weight: bold;">NOT SENT</span>'
        )

    @admin.display(description='Reason')
    def reason_preview(self, obj):
        """Show truncated reason."""
        if obj.reason:
            return obj.reason[:50] + '...' if len(obj.reason) > 50 else obj.reason
        return '-'

    @admin.display(description='Interested In')
    def features_preview(self, obj):
        """Show abbreviated features list for list display."""
        features = obj.get_excited_features_display()
        if not features:
            return '-'
        if len(features) <= 2:
            return ', '.join(features)
        return f'{features[0]}, +{len(features) - 1} more'

    @admin.display(description='Excited About')
    def excited_features_display(self, obj):
        """Show full list of excited features as HTML badges."""
        features = obj.get_excited_features_display()
        if not features:
            return '-'
        badges = ''.join(
            f'<span style="background-color: #22d3ee; color: #0f172a; padding: 2px 8px; '
            f'border-radius: 12px; font-size: 12px; margin: 2px; display: inline-block;">'
            f'{feature}</span>'
            for feature in features
        )
        return format_html(badges)

    @admin.display(description='Desired Integrations')
    def desired_integrations_display(self, obj):
        """Show list of desired integrations as HTML badges."""
        integrations = obj.get_desired_integrations_display()
        if not integrations:
            return '-'
        badges = ''.join(
            f'<span style="background-color: #a78bfa; color: #0f172a; padding: 2px 8px; '
            f'border-radius: 12px; font-size: 12px; margin: 2px; display: inline-block;">'
            f'{integration}</span>'
            for integration in integrations
        )
        return format_html(badges)

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

    @admin.action(description='Resend approval emails (only to approved without email sent)')
    def resend_approval_emails(self, request, queryset):
        """Resend approval emails to approved requests that haven't received one."""
        # Only resend to approved requests that don't have email sent timestamp
        needs_email = queryset.filter(
            status=InvitationRequest.Status.APPROVED,
            approval_email_sent_at__isnull=True,
        )
        sent_count = 0
        failed_count = 0
        skipped_count = queryset.count() - needs_email.count()

        for invitation in needs_email:
            try:
                send_approval_email(invitation)
                sent_count += 1
            except Exception as e:
                failed_count += 1
                self.message_user(
                    request,
                    f'Failed to send to {invitation.email}: {e}',
                    messages.ERROR,
                )

        if sent_count:
            self.message_user(
                request,
                f'Successfully sent {sent_count} approval email(s).',
                messages.SUCCESS,
            )
        if skipped_count:
            self.message_user(
                request,
                f'Skipped {skipped_count} (already sent or not approved).',
                messages.INFO,
            )
        if failed_count:
            self.message_user(
                request,
                f'Failed to send {failed_count} email(s).',
                messages.WARNING,
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
