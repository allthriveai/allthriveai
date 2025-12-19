"""Admin configuration for Learning Paths."""

from django.contrib import admin

from .models import (
    Concept,
    LearnerProfile,
    LearningEvent,
    MicroLesson,
    ProjectLearningMetadata,
    UserConceptMastery,
    UserLearningPath,
)


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


@admin.register(LearnerProfile)
class LearnerProfileAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'current_difficulty_level',
        'learning_streak_days',
        'total_lessons_completed',
        'total_concepts_completed',
        'last_learning_activity',
    ]
    list_filter = ['current_difficulty_level', 'preferred_learning_style']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-last_learning_activity']


@admin.register(Concept)
class ConceptAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'topic',
        'tool',
        'base_difficulty',
        'estimated_minutes',
        'is_active',
    ]
    list_filter = ['topic', 'base_difficulty', 'is_active']
    search_fields = ['name', 'description', 'keywords']
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ['prerequisites']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['topic', 'name']


@admin.register(UserConceptMastery)
class UserConceptMasteryAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'concept',
        'mastery_level',
        'mastery_score',
        'times_practiced',
        'consecutive_correct',
        'last_practiced',
    ]
    list_filter = ['mastery_level', 'concept__topic']
    search_fields = ['user__username', 'concept__name']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-updated_at']


@admin.register(MicroLesson)
class MicroLessonAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'concept',
        'lesson_type',
        'difficulty',
        'is_ai_generated',
        'times_delivered',
        'quality_score',
        'is_active',
    ]
    list_filter = ['lesson_type', 'difficulty', 'is_ai_generated', 'is_active']
    search_fields = ['title', 'content_template', 'concept__name']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = [
        'times_delivered',
        'positive_feedback_count',
        'negative_feedback_count',
        'created_at',
        'updated_at',
    ]
    ordering = ['concept', 'lesson_type']


@admin.register(ProjectLearningMetadata)
class ProjectLearningMetadataAdmin(admin.ModelAdmin):
    list_display = [
        'project',
        'is_learning_eligible',
        'learning_quality_score',
        'complexity_level',
        'times_used_for_learning',
    ]
    list_filter = ['is_learning_eligible', 'complexity_level']
    search_fields = ['project__title', 'key_techniques', 'learning_summary']
    filter_horizontal = ['concepts']
    readonly_fields = ['times_used_for_learning', 'last_used_for_learning', 'created_at', 'updated_at']
    ordering = ['-learning_quality_score']

    actions = ['recalculate_eligibility']

    @admin.action(description='Recalculate learning eligibility')
    def recalculate_eligibility(self, request, queryset):
        for metadata in queryset:
            metadata.calculate_eligibility()
            metadata.save()
        self.message_user(request, f'Recalculated eligibility for {queryset.count()} projects.')


@admin.register(LearningEvent)
class LearningEventAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'event_type',
        'concept',
        'was_successful',
        'xp_earned',
        'created_at',
    ]
    list_filter = ['event_type', 'was_successful']
    search_fields = ['user__username', 'concept__name']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
