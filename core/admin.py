from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .agents.models import Conversation, Message
from .events.models import Event
from .projects.models import CommentVote, ProjectComment
from .quizzes.models import Quiz, QuizAttempt, QuizQuestion
from .referrals.models import Referral, ReferralCode
from .taxonomy.models import Taxonomy, UserInteraction, UserTag
from .tools.models import Tool, ToolBookmark, ToolComparison, ToolReview

# Direct domain imports
from .users.models import User


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


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'first_name', 'last_name', 'is_staff', 'date_joined']
    list_filter = ['role', 'is_staff', 'is_superuser', 'is_active', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            'Role & Profile',
            {
                'fields': ('role', 'avatar_url', 'bio'),
            },
        ),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            'Role & Profile',
            {
                'fields': ('role', 'email', 'first_name', 'last_name'),
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


@admin.register(Tool)
class ToolAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'category',
        'pricing_model',
        'is_featured',
        'is_verified',
        'is_active',
        'view_count',
        'popularity_score',
        'created_at',
    ]
    list_filter = [
        'category',
        'pricing_model',
        'is_featured',
        'is_verified',
        'is_active',
        'has_free_tier',
        'requires_api_key',
        'created_at',
    ]
    search_fields = ['name', 'tagline', 'description', 'tags']
    readonly_fields = ['slug', 'view_count', 'popularity_score', 'created_at', 'updated_at']
    ordering = ['-created_at']
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        ('Basic Information', {'fields': ('name', 'slug', 'tagline', 'description', 'category', 'tags')}),
        ('Media & Branding', {'fields': ('logo_url', 'banner_url', 'screenshot_urls', 'demo_video_url')}),
        (
            'Links & Social',
            {
                'fields': (
                    'website_url',
                    'documentation_url',
                    'pricing_url',
                    'github_url',
                    'twitter_handle',
                    'discord_url',
                )
            },
        ),
        (
            'Pricing & Access',
            {'fields': ('pricing_model', 'starting_price', 'has_free_tier', 'requires_api_key', 'requires_waitlist')},
        ),
        (
            'Content Sections',
            {
                'fields': (
                    'overview',
                    'key_features',
                    'use_cases',
                    'usage_tips',
                    'best_practices',
                    'limitations',
                    'alternatives',
                ),
                'classes': ('collapse',),
            },
        ),
        (
            'Technical Details',
            {
                'fields': ('model_info', 'integrations', 'api_available', 'languages_supported'),
                'classes': ('collapse',),
            },
        ),
        ('SEO', {'fields': ('meta_description', 'keywords'), 'classes': ('collapse',)}),
        ('Status & Metrics', {'fields': ('is_active', 'is_featured', 'is_verified', 'view_count', 'popularity_score')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'last_verified_at'), 'classes': ('collapse',)}),
    )


@admin.register(ToolReview)
class ToolReviewAdmin(admin.ModelAdmin):
    list_display = ['tool', 'user', 'rating', 'title_preview', 'is_approved', 'helpful_count', 'created_at']
    list_filter = ['rating', 'is_approved', 'is_verified_user', 'created_at']
    search_fields = ['tool__name', 'user__username', 'title', 'content']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    raw_id_fields = ['tool', 'user']

    @admin.display(description='Title')
    def title_preview(self, obj):
        return obj.title[:50] if obj.title else '(No title)'


@admin.register(ToolComparison)
class ToolComparisonAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'tool_count', 'is_public', 'created_at']
    list_filter = ['is_public', 'created_at']
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = ['slug', 'created_at', 'updated_at']
    ordering = ['-created_at']
    filter_horizontal = ['tools']
    raw_id_fields = ['user']

    @admin.display(description='Tools')
    def tool_count(self, obj):
        return obj.tools.count()


@admin.register(ToolBookmark)
class ToolBookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'tool', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'tool__name']
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    raw_id_fields = ['user', 'tool']


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


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = [
        'title',
        'start_date',
        'end_date',
        'location',
        'is_all_day',
        'is_published',
        'created_by',
        'created_at',
    ]
    list_filter = ['is_published', 'is_all_day', 'start_date', 'created_at']
    search_fields = ['title', 'description', 'location']
    readonly_fields = ['created_at', 'updated_at', 'created_by']
    ordering = ['-start_date']
    raw_id_fields = ['created_by']

    fieldsets = (
        ('Event Information', {'fields': ('title', 'description', 'start_date', 'end_date', 'is_all_day')}),
        ('Location & Links', {'fields': ('location', 'event_url')}),
        ('Display', {'fields': ('color', 'thumbnail', 'is_published')}),
        ('Metadata', {'fields': ('created_by', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # If creating new event
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
