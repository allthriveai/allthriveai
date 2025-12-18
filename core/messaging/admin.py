from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ConnectionRequest,
    DirectMessage,
    DirectMessageThread,
    MessageReport,
    UserBlock,
)


@admin.register(ConnectionRequest)
class ConnectionRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'requester_link',
        'recipient_link',
        'project_link',
        'status',
        'created_at',
        'expires_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = [
        'requester__username',
        'requester__email',
        'recipient__username',
        'recipient__email',
        'project__title',
    ]
    raw_id_fields = ['requester', 'recipient', 'project']
    readonly_fields = ['created_at', 'updated_at', 'responded_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    @admin.display(description='Requester')
    def requester_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.requester.id,
            obj.requester.username,
        )

    @admin.display(description='Recipient')
    def recipient_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.recipient.id,
            obj.recipient.username,
        )

    @admin.display(description='Project')
    def project_link(self, obj):
        return format_html(
            '<a href="/admin/projects/project/{}/change/">{}</a>',
            obj.project.id,
            obj.project.title[:50],
        )


class DirectMessageInline(admin.TabularInline):
    model = DirectMessage
    extra = 0
    readonly_fields = ['sender', 'content', 'created_at', 'read_at', 'moderation_status']
    can_delete = False
    max_num = 20
    ordering = ['-created_at']


@admin.register(DirectMessageThread)
class DirectMessageThreadAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'get_participants',
        'originating_project',
        'last_message_at',
        'message_count',
        'created_at',
    ]
    list_filter = ['created_at', 'last_message_at']
    search_fields = [
        'participants__username',
        'participants__email',
        'originating_project__title',
    ]
    raw_id_fields = ['originating_project', 'connection_request', 'last_message_sender']
    readonly_fields = ['created_at', 'updated_at', 'last_message_at', 'last_message_preview']
    filter_horizontal = ['participants']
    inlines = [DirectMessageInline]
    ordering = ['-last_message_at']

    @admin.display(description='Participants')
    def get_participants(self, obj):
        return ', '.join(p.username for p in obj.participants.all()[:3])

    @admin.display(description='Messages')
    def message_count(self, obj):
        return obj.messages.count()


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'sender_link',
        'thread_link',
        'content_preview',
        'moderation_status',
        'read_at',
        'created_at',
    ]
    list_filter = ['moderation_status', 'created_at', 'read_at']
    search_fields = ['sender__username', 'content']
    raw_id_fields = ['thread', 'sender']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    @admin.display(description='Sender')
    def sender_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.sender.id,
            obj.sender.username,
        )

    @admin.display(description='Thread')
    def thread_link(self, obj):
        return format_html(
            '<a href="/admin/messaging/directmessagethread/{}/change/">Thread #{}</a>',
            obj.thread.id,
            obj.thread.id,
        )

    @admin.display(description='Content')
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content

    actions = ['mark_approved', 'mark_flagged', 'mark_removed']

    @admin.action(description='Mark selected messages as approved')
    def mark_approved(self, request, queryset):
        queryset.update(moderation_status=DirectMessage.ModerationStatus.APPROVED)

    @admin.action(description='Mark selected messages as flagged')
    def mark_flagged(self, request, queryset):
        queryset.update(moderation_status=DirectMessage.ModerationStatus.FLAGGED)

    @admin.action(description='Mark selected messages as removed')
    def mark_removed(self, request, queryset):
        queryset.update(moderation_status=DirectMessage.ModerationStatus.REMOVED)


@admin.register(MessageReport)
class MessageReportAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'message_preview',
        'reporter_link',
        'reason',
        'status',
        'created_at',
        'resolved_at',
    ]
    list_filter = ['status', 'reason', 'created_at']
    search_fields = ['reporter__username', 'description', 'message__content']
    raw_id_fields = ['message', 'reporter', 'resolved_by']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    @admin.display(description='Message')
    def message_preview(self, obj):
        content = obj.message.content[:50]
        return content + '...' if len(obj.message.content) > 50 else content

    @admin.display(description='Reporter')
    def reporter_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.reporter.id,
            obj.reporter.username,
        )

    actions = ['resolve_reports', 'dismiss_reports']

    @admin.action(description='Resolve selected reports')
    def resolve_reports(self, request, queryset):
        from django.utils import timezone

        queryset.update(
            status=MessageReport.Status.RESOLVED,
            resolved_by=request.user,
            resolved_at=timezone.now(),
        )

    @admin.action(description='Dismiss selected reports')
    def dismiss_reports(self, request, queryset):
        from django.utils import timezone

        queryset.update(
            status=MessageReport.Status.DISMISSED,
            resolved_by=request.user,
            resolved_at=timezone.now(),
        )


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['id', 'blocker_link', 'blocked_link', 'reason_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['blocker__username', 'blocked__username', 'reason']
    raw_id_fields = ['blocker', 'blocked']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    @admin.display(description='Blocker')
    def blocker_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.blocker.id,
            obj.blocker.username,
        )

    @admin.display(description='Blocked')
    def blocked_link(self, obj):
        return format_html(
            '<a href="/admin/users/user/{}/change/">{}</a>',
            obj.blocked.id,
            obj.blocked.username,
        )

    @admin.display(description='Reason')
    def reason_preview(self, obj):
        if not obj.reason:
            return '-'
        return obj.reason[:50] + '...' if len(obj.reason) > 50 else obj.reason
