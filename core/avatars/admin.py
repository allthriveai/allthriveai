"""Admin configuration for avatars app."""

from django.contrib import admin
from django.utils.html import format_html

from .models import AvatarGenerationIteration, AvatarGenerationSession, UserAvatar


class AvatarGenerationIterationInline(admin.TabularInline):
    """Inline admin for avatar generation iterations."""

    model = AvatarGenerationIteration
    extra = 0
    readonly_fields = ('prompt', 'image_url', 'order', 'is_selected', 'generation_time_ms', 'created_at')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(UserAvatar)
class UserAvatarAdmin(admin.ModelAdmin):
    """Admin for user avatars."""

    list_display = (
        'user',
        'creation_mode',
        'template_used',
        'is_current',
        'avatar_preview',
        'created_at',
    )
    list_filter = ('creation_mode', 'is_current', 'created_at')
    search_fields = ('user__username', 'user__email', 'original_prompt')
    readonly_fields = ('avatar_preview_large', 'created_at')
    raw_id_fields = ('user',)
    ordering = ('-created_at',)

    @admin.display(description='Preview')
    def avatar_preview(self, obj):
        """Display a small avatar preview."""
        if obj.image_url:
            return format_html(
                '<img src="{}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />',
                obj.image_url,
            )
        return '-'

    @admin.display(description='Avatar Preview')
    def avatar_preview_large(self, obj):
        """Display a larger avatar preview in detail view."""
        if obj.image_url:
            return format_html(
                '<img src="{}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover;" />',
                obj.image_url,
            )
        return '-'


@admin.register(AvatarGenerationSession)
class AvatarGenerationSessionAdmin(admin.ModelAdmin):
    """Admin for avatar generation sessions."""

    list_display = (
        'user',
        'creation_mode',
        'status',
        'iteration_count',
        'achievement_awarded',
        'created_at',
    )
    list_filter = ('status', 'creation_mode', 'achievement_awarded', 'created_at')
    search_fields = ('user__username', 'user__email', 'conversation_id')
    readonly_fields = ('conversation_id', 'created_at', 'updated_at')
    raw_id_fields = ('user', 'saved_avatar')
    inlines = [AvatarGenerationIterationInline]
    ordering = ('-created_at',)

    @admin.display(description='Iterations')
    def iteration_count(self, obj):
        """Display the number of iterations in this session."""
        return obj.iterations.count()
