from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# AI Analytics Dashboard - must be imported to register custom admin views
from .admin.ai_analytics_admin import register_ai_analytics_dashboard
from .agents.models import Conversation, HallucinationMetrics, Message
from .projects.models import CommentVote, Project, ProjectComment
from .quizzes.models import Quiz, QuizAttempt, QuizQuestion
from .referrals.models import Referral, ReferralCode
from .taxonomy.models import Taxonomy, UserInteraction, UserTag

# Tool models are now registered in core/tools/admin.py
# Direct domain imports
from .users.models import User

register_ai_analytics_dashboard(admin.site)


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

    @admin.display(description='Content')
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content


@admin.register(HallucinationMetrics)
class HallucinationMetricsAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'feature',
        'confidence_level',
        'confidence_score',
        'flags_display',
        'has_concerns_display',
        'user',
        'created_at',
    ]
    list_filter = [
        'feature',
        'confidence_level',
        'created_at',
    ]
    search_fields = ['session_id', 'user__username', 'response_text']
    readonly_fields = ['created_at', 'response_preview']
    ordering = ['-created_at']
    raw_id_fields = ['user']
    list_per_page = 50

    fieldsets = (
        (
            'Session Info',
            {
                'fields': ('session_id', 'user', 'feature', 'created_at'),
            },
        ),
        (
            'Confidence Analysis',
            {
                'fields': ('confidence_level', 'confidence_score', 'flags'),
            },
        ),
        (
            'Response Data',
            {
                'fields': ('response_preview', 'response_text'),
                'classes': ('collapse',),
            },
        ),
        (
            'Analysis Context',
            {
                'fields': ('tool_outputs', 'metadata'),
                'classes': ('collapse',),
            },
        ),
    )

    @admin.display(description='Flags')
    def flags_display(self, obj):
        return ', '.join(obj.flags) if obj.flags else '-'

    @admin.display(
        description='Concerns',
        boolean=True,
    )
    def has_concerns_display(self, obj):
        return obj.has_concerns

    @admin.display(description='Response Preview')
    def response_preview(self, obj):
        return obj.response_text[:200] + '...' if len(obj.response_text) > 200 else obj.response_text

    def has_add_permission(self, request):
        """Prevent manual creation - these are created via Celery tasks."""
        return False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'tier', 'first_name', 'last_name', 'is_staff', 'date_joined']
    list_filter = ['role', 'tier', 'is_staff', 'is_superuser', 'is_active', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            'Role & Profile',
            {
                'fields': ('role', 'tier', 'avatar_url', 'bio'),
            },
        ),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            'Role & Profile',
            {
                'fields': ('role', 'tier', 'email', 'first_name', 'last_name'),
            },
        ),
    )


class QuizQuestionInline(admin.TabularInline):
    model = QuizQuestion
    extra = 1
    fields = ['order', 'question', 'type', 'correct_answer', 'explanation']
    ordering = ['order']


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ['title', 'topic', 'difficulty', 'estimated_time', 'question_count', 'is_published', 'created_at']
    list_filter = ['difficulty', 'topic', 'is_published', 'created_at']
    search_fields = ['title', 'description', 'topic']
    ordering = ['-created_at']
    inlines = [QuizQuestionInline]
    autocomplete_fields = ['topics_taxonomy', 'categories', 'tools']
    filter_horizontal = ['topics_taxonomy']

    def save_model(self, request, obj, form, change):
        if not change:  # If creating new quiz
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'order', 'question_preview', 'type', 'created_at']
    list_filter = ['type', 'quiz', 'created_at']
    search_fields = ['question', 'explanation']
    ordering = ['quiz', 'order']

    @admin.display(description='Question')
    def question_preview(self, obj):
        return obj.question[:80] + '...' if len(obj.question) > 80 else obj.question


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'quiz',
        'score',
        'total_questions',
        'percentage_score',
        'is_completed',
        'started_at',
        'completed_at',
    ]
    list_filter = ['quiz', 'started_at', 'completed_at']
    search_fields = ['user__username', 'quiz__title']
    ordering = ['-started_at']
    readonly_fields = ['started_at', 'percentage_score']


@admin.register(ReferralCode)
class ReferralCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'user', 'uses_count', 'max_uses', 'is_active', 'is_valid_display', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['code', 'user__username', 'user__email']
    ordering = ['-created_at']
    readonly_fields = ['code', 'created_at', 'updated_at']

    @admin.display(
        description='Valid',
        boolean=True,
    )
    def is_valid_display(self, obj):
        return obj.is_valid()


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ['referrer', 'referred_user', 'referral_code', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['referrer__username', 'referred_user__username', 'referral_code__code']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    raw_id_fields = ['referrer', 'referred_user', 'referral_code']


@admin.register(Taxonomy)
class TaxonomyAdmin(admin.ModelAdmin):
    list_display = ['name', 'taxonomy_type', 'color', 'has_website', 'has_logo', 'is_active', 'created_at']
    list_filter = ['taxonomy_type', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['taxonomy_type', 'name']
    list_per_page = 50

    fieldsets = (
        ('Basic Information', {'fields': ('taxonomy_type', 'name', 'description', 'color', 'is_active')}),
        (
            'Tool Details',
            {
                'fields': ('website_url', 'logo_url', 'usage_tips', 'best_for'),
                'classes': ('collapse',),
                'description': 'Additional information for tools',
            },
        ),
    )

    @admin.display(
        description='Website',
        boolean=True,
    )
    def has_website(self, obj):
        return bool(obj.website_url)

    @admin.display(
        description='Logo',
        boolean=True,
    )
    def has_logo(self, obj):
        return bool(obj.logo_url)


@admin.register(UserTag)
class UserTagAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'taxonomy', 'source', 'confidence_score', 'interaction_count', 'created_at']
    list_filter = ['source', 'created_at']
    search_fields = ['user__username', 'name', 'taxonomy__name']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['user', 'taxonomy']


@admin.register(UserInteraction)
class UserInteractionAdmin(admin.ModelAdmin):
    list_display = ['user', 'interaction_type', 'created_at', 'keywords_preview']
    list_filter = ['interaction_type', 'created_at']
    search_fields = ['user__username']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    raw_id_fields = ['user']

    @admin.display(description='Keywords')
    def keywords_preview(self, obj):
        keywords = obj.extracted_keywords[:5] if obj.extracted_keywords else []
        return ', '.join(keywords) if keywords else 'None'


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'user',
        'project',
        'content_preview',
        'moderation_status',
        'created_at',
    ]
    list_filter = ['moderation_status', 'created_at', 'moderated_at']
    search_fields = ['user__username', 'project__title', 'content']
    readonly_fields = ['created_at', 'updated_at', 'moderated_at', 'moderation_data']
    ordering = ['-created_at']
    raw_id_fields = ['user', 'project']

    fieldsets = (
        ('Comment', {'fields': ('user', 'project', 'content')}),
        (
            'Moderation',
            {
                'fields': (
                    'moderation_status',
                    'moderation_reason',
                    'moderation_data',
                    'moderated_at',
                ),
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    actions = ['approve_comments', 'reject_comments', 'flag_comments']

    @admin.display(description='Content')
    def content_preview(self, obj):
        return obj.content[:80] + '...' if len(obj.content) > 80 else obj.content

    @admin.action(description='Approve selected comments')
    def approve_comments(self, request, queryset):
        updated = queryset.update(moderation_status=ProjectComment.ModerationStatus.APPROVED)
        self.message_user(request, f'{updated} comments approved.')

    @admin.action(description='Reject selected comments')
    def reject_comments(self, request, queryset):
        updated = queryset.update(moderation_status=ProjectComment.ModerationStatus.REJECTED)
        self.message_user(request, f'{updated} comments rejected.')

    @admin.action(description='Flag selected comments for review')
    def flag_comments(self, request, queryset):
        updated = queryset.update(moderation_status=ProjectComment.ModerationStatus.FLAGGED)
        self.message_user(request, f'{updated} comments flagged for review.')


@admin.register(CommentVote)
class CommentVoteAdmin(admin.ModelAdmin):
    list_display = ['user', 'comment', 'vote_type', 'created_at']
    list_filter = ['vote_type', 'created_at']
    search_fields = ['user__username', 'comment__content']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    raw_id_fields = ['user', 'comment']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin for Projects with special support for AI-generated lessons."""

    list_display = [
        'title',
        'user',
        'content_type_taxonomy',
        'difficulty_taxonomy',
        'is_lesson_display',
        'is_private',
        'created_at',
    ]
    list_filter = [
        'content_type_taxonomy',
        'difficulty_taxonomy',
        'is_private',
        'is_archived',
        'created_at',
    ]
    search_fields = ['title', 'description', 'user__username', 'slug']
    ordering = ['-created_at']
    raw_id_fields = ['user']
    autocomplete_fields = ['content_type_taxonomy', 'difficulty_taxonomy']
    filter_horizontal = ['tools', 'topics']
    readonly_fields = ['created_at', 'updated_at', 'published_date']
    list_per_page = 50

    fieldsets = (
        ('Project Info', {'fields': ('user', 'title', 'slug', 'description')}),
        (
            'Classification',
            {
                'fields': ('type', 'content_type_taxonomy', 'difficulty_taxonomy', 'tools', 'topics'),
            },
        ),
        (
            'Visibility',
            {
                'fields': ('is_private', 'is_showcased', 'is_archived'),
            },
        ),
        (
            'Content',
            {
                'fields': ('content',),
                'description': 'JSON content data. For AI lessons, contains lesson_data.',
            },
        ),
        (
            'Media',
            {
                'fields': ('featured_image', 'banner'),
                'classes': ('collapse',),
            },
        ),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'published_date'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Is Lesson', boolean=True)
    def is_lesson_display(self, obj):
        """Check if this project is marked as a lesson via ProjectLearningMetadata."""
        from core.learning_paths.models import ProjectLearningMetadata

        try:
            metadata = ProjectLearningMetadata.objects.filter(project=obj).first()
            return metadata.is_lesson if metadata else False
        except Exception:
            return False

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return (
            super()
            .get_queryset(request)
            .select_related(
                'user',
                'content_type_taxonomy',
                'difficulty_taxonomy',
            )
        )
