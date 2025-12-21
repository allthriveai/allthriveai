"""Django admin configuration for Community models."""

from django.contrib import admin

from .models import (
    DirectMessageThread,
    Message,
    MessageReaction,
    ModerationAction,
    ModerationQueue,
    Room,
    RoomMembership,
    Thread,
    UserBlock,
)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'room_type', 'visibility', 'member_count', 'is_active', 'created_at']
    list_filter = ['room_type', 'visibility', 'is_active', 'is_default']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['member_count', 'message_count', 'online_count', 'last_message_at']
    ordering = ['-created_at']


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ['title', 'room', 'creator', 'is_locked', 'is_pinned', 'message_count', 'created_at']
    list_filter = ['is_locked', 'is_pinned', 'is_resolved', 'is_archived']
    search_fields = ['title', 'room__name']
    readonly_fields = ['message_count', 'last_message_at']
    ordering = ['-created_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'author', 'room', 'message_type', 'is_flagged', 'created_at']
    list_filter = ['message_type', 'is_flagged', 'is_hidden', 'is_pinned', 'is_edited']
    search_fields = ['content', 'author__username', 'room__name']
    readonly_fields = ['reaction_counts', 'created_at', 'updated_at']
    ordering = ['-created_at']

    @admin.display(description='Content')
    def short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content


@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ['message', 'user', 'emoji', 'created_at']
    list_filter = ['emoji']
    search_fields = ['user__username']
    ordering = ['-created_at']


@admin.register(RoomMembership)
class RoomMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'room', 'role', 'messages_sent', 'is_active', 'joined_at']
    list_filter = ['role', 'is_active', 'notifications_enabled']
    search_fields = ['user__username', 'room__name']
    ordering = ['-joined_at']


@admin.register(DirectMessageThread)
class DirectMessageThreadAdmin(admin.ModelAdmin):
    list_display = ['id', 'is_group', 'name', 'created_by', 'last_message_at', 'created_at']
    list_filter = ['is_group']
    search_fields = ['name', 'created_by__username']
    ordering = ['-last_message_at']


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ['action_type', 'source', 'target_user', 'moderator', 'is_active', 'created_at']
    list_filter = ['action_type', 'source', 'is_active']
    search_fields = ['target_user__username', 'moderator__username', 'reason']
    readonly_fields = ['ai_scores', 'created_at']
    ordering = ['-created_at']


@admin.register(ModerationQueue)
class ModerationQueueAdmin(admin.ModelAdmin):
    list_display = ['message', 'status', 'ai_flagged', 'report_count', 'reviewed_by', 'created_at']
    list_filter = ['status', 'ai_flagged']
    search_fields = ['message__content', 'reviewed_by__username']
    readonly_fields = ['ai_scores', 'report_reasons', 'created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(UserBlock)
class UserBlockAdmin(admin.ModelAdmin):
    list_display = ['blocker', 'blocked', 'created_at']
    search_fields = ['blocker__username', 'blocked__username']
    ordering = ['-created_at']
