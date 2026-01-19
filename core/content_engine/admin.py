"""Admin configuration for Content Engine."""

from django.contrib import admin

from .models import BrainstormSession, BrandVoice, ContentClip, ContentIdea, ScheduledPost


@admin.register(BrandVoice)
class BrandVoiceAdmin(admin.ModelAdmin):
    list_display = ['user', 'tone', 'updated_at']
    search_fields = ['user__username', 'user__email', 'tone']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ContentIdea)
class ContentIdeaAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'content_pillar', 'source', 'created_at']
    list_filter = ['status', 'source', 'content_pillar']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'


@admin.register(ContentClip)
class ContentClipAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'idea', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user', 'idea']


@admin.register(ScheduledPost)
class ScheduledPostAdmin(admin.ModelAdmin):
    list_display = ['clip', 'user', 'platform', 'status', 'scheduled_for', 'published_at']
    list_filter = ['platform', 'status']
    search_fields = ['clip__title', 'user__username', 'text_content']
    readonly_fields = ['created_at', 'updated_at', 'published_at', 'platform_post_id', 'platform_url']
    raw_id_fields = ['user', 'clip']
    date_hierarchy = 'scheduled_for'


@admin.register(BrainstormSession)
class BrainstormSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'target_week', 'created_at']
    search_fields = ['title', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user']
    filter_horizontal = ['generated_ideas']
