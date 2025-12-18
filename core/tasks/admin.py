from django.contrib import admin

from .models import Task, TaskDashboard, TaskOption


@admin.register(TaskOption)
class TaskOptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'option_type', 'color', 'order', 'is_active', 'is_default', 'is_closed_status']
    list_filter = ['option_type', 'is_active', 'is_default']
    search_fields = ['name', 'slug']
    ordering = ['option_type', 'order']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'priority', 'assignee', 'due_date', 'created_at', 'is_archived']
    list_filter = ['status', 'priority', 'task_type', 'is_archived', 'assignee']
    search_fields = ['title', 'description']
    raw_id_fields = ['assignee', 'created_by', 'updated_by']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(TaskDashboard)
class TaskDashboardAdmin(admin.ModelAdmin):
    list_display = ['name', 'view_mode', 'is_default', 'is_shared', 'created_by', 'created_at']
    list_filter = ['view_mode', 'is_default', 'is_shared']
    search_fields = ['name', 'slug']
    raw_id_fields = ['created_by']
    prepopulated_fields = {'slug': ('name',)}
