"""Admin configuration for Learning Paths."""

from django.contrib import admin

from .models import UserLearningPath


@admin.register(UserLearningPath)
class UserLearningPathAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'topic',
        'current_skill_level',
        'topic_points',
        'quizzes_completed',
        'side_quests_completed',
        'progress_percentage',
        'last_activity_at',
    ]
    list_filter = ['topic', 'current_skill_level']
    search_fields = ['user__username', 'user__email']
    readonly_fields = [
        'progress_percentage',
        'points_to_next_level',
        'started_at',
        'last_activity_at',
    ]
    ordering = ['-last_activity_at']

    fieldsets = (
        ('User & Topic', {'fields': ('user', 'topic')}),
        (
            'Progress',
            {
                'fields': (
                    'current_skill_level',
                    'topic_points',
                    'progress_percentage',
                    'points_to_next_level',
                )
            },
        ),
        ('Quizzes', {'fields': ('quizzes_completed', 'quizzes_total')}),
        ('Side Quests', {'fields': ('side_quests_completed', 'side_quests_total')}),
        ('Timestamps', {'fields': ('started_at', 'last_activity_at'), 'classes': ('collapse',)}),
    )
