"""Admin configuration for Learning Paths."""

from django.contrib import admin

from .models import (
    Concept,
    ContentGap,
    LearnerProfile,
    LearningEvent,
    LearningOutcome,
    MicroLesson,
    ProjectLearningMetadata,
    UserConceptMastery,
    UserLearningPath,
    UserSkillProficiency,
)


@admin.register(UserLearningPath)
class UserLearningPathAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'topic',
        'topic_taxonomy',
        'current_skill_level',
        'topic_points',
        'quizzes_completed',
        'side_quests_completed',
        'progress_percentage',
        'last_activity_at',
    ]
    list_filter = ['topic', 'topic_taxonomy', 'current_skill_level']
    search_fields = ['user__username', 'user__email']
    autocomplete_fields = ['topic_taxonomy']
    readonly_fields = [
        'progress_percentage',
        'points_to_next_level',
        'started_at',
        'last_activity_at',
    ]
    ordering = ['-last_activity_at']

    fieldsets = (
        ('User & Topic', {'fields': ('user', 'topic', 'topic_taxonomy')}),
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
        'topic_taxonomy',
        'tool',
        'base_difficulty',
        'estimated_minutes',
        'is_active',
    ]
    list_filter = ['topic', 'topic_taxonomy', 'base_difficulty', 'is_active']
    search_fields = ['name', 'description', 'keywords']
    prepopulated_fields = {'slug': ('name',)}
    autocomplete_fields = ['topic_taxonomy', 'tool']
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


@admin.register(ContentGap)
class ContentGapAdmin(admin.ModelAdmin):
    """Admin for tracking content gaps - topics/modalities users request but we don't have."""

    list_display = [
        'topic',
        'modality',
        'gap_type',
        'request_count',
        'unique_user_count',
        'status',
        'last_requested_at',
    ]
    list_filter = ['modality', 'gap_type', 'status']
    search_fields = ['topic', 'topic_normalized']
    readonly_fields = [
        'topic_normalized',
        'first_requested_at',
        'last_requested_at',
        'first_requested_by',
        'results_returned',
    ]
    ordering = ['-request_count', '-last_requested_at']
    date_hierarchy = 'first_requested_at'

    fieldsets = (
        ('Gap Details', {'fields': ('topic', 'topic_normalized', 'modality', 'gap_type')}),
        ('Request Stats', {'fields': ('request_count', 'unique_user_count', 'results_returned')}),
        ('Status', {'fields': ('status', 'resolved_at', 'resolution_notes', 'matched_taxonomy')}),
        (
            'Timestamps & Context',
            {
                'fields': ('first_requested_at', 'last_requested_at', 'first_requested_by', 'context'),
                'classes': ('collapse',),
            },
        ),
    )

    actions = ['mark_resolved', 'mark_in_progress', 'mark_ignored']

    @admin.action(description='Mark selected gaps as resolved')
    def mark_resolved(self, request, queryset):
        from django.utils import timezone

        queryset.update(status='resolved', resolved_at=timezone.now())
        self.message_user(request, f'Marked {queryset.count()} gaps as resolved.')

    @admin.action(description='Mark selected gaps as in progress')
    def mark_in_progress(self, request, queryset):
        queryset.update(status='in_progress')
        self.message_user(request, f'Marked {queryset.count()} gaps as in progress.')

    @admin.action(description='Mark selected gaps as ignored')
    def mark_ignored(self, request, queryset):
        queryset.update(status='ignored')
        self.message_user(request, f'Marked {queryset.count()} gaps as ignored.')


@admin.register(LearningOutcome)
class LearningOutcomeAdmin(admin.ModelAdmin):
    """Admin for learning outcomes based on Bloom's Taxonomy."""

    list_display = [
        'verb',
        'skill',
        'bloom_level',
        'proficiency_gained',
        'estimated_hours',
        'is_active',
    ]
    list_filter = ['bloom_level', 'proficiency_gained', 'is_active']
    search_fields = ['verb', 'description', 'skill__name', 'assessment_criteria']
    filter_horizontal = ['prerequisites']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['skill', 'bloom_level']


@admin.register(UserSkillProficiency)
class UserSkillProficiencyAdmin(admin.ModelAdmin):
    """Admin for tracking user proficiency in skills."""

    list_display = [
        'user',
        'skill',
        'proficiency_level',
        'last_practiced_at',
        'last_updated_at',
    ]
    list_filter = ['proficiency_level', 'skill__name']
    search_fields = ['user__username', 'user__email', 'skill__name']
    filter_horizontal = ['outcomes_achieved']
    readonly_fields = ['first_assessed_at', 'last_updated_at']
    ordering = ['-last_updated_at']
