from django.contrib import admin

from .models import FeedbackComment, FeedbackItem, FeedbackVote


@admin.register(FeedbackItem)
class FeedbackItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'feedback_type', 'status', 'user', 'vote_count', 'created_at']
    list_filter = ['feedback_type', 'status', 'created_at']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['vote_count', 'created_at', 'updated_at']
    ordering = ['-vote_count', '-created_at']

    fieldsets = (
        (None, {'fields': ('user', 'feedback_type', 'title', 'description')}),
        ('Status', {'fields': ('status', 'admin_response')}),
        ('Metrics', {'fields': ('vote_count', 'created_at', 'updated_at')}),
    )


@admin.register(FeedbackVote)
class FeedbackVoteAdmin(admin.ModelAdmin):
    list_display = ['user', 'feedback_item', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'feedback_item__title']
    readonly_fields = ['created_at']


@admin.register(FeedbackComment)
class FeedbackCommentAdmin(admin.ModelAdmin):
    list_display = ['user', 'feedback_item', 'content_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'feedback_item__title', 'content']
    readonly_fields = ['created_at', 'updated_at']

    @admin.display(description='Content')
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
