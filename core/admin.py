from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserRole, Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'user', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['title', 'user__username']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'role', 'content_preview', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content']

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'first_name', 'last_name', 'is_staff', 'date_joined']
    list_filter = ['role', 'is_staff', 'is_superuser', 'is_active', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role & Profile', {
            'fields': ('role', 'avatar_url', 'bio'),
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Role & Profile', {
            'fields': ('role', 'email', 'first_name', 'last_name'),
        }),
    )
