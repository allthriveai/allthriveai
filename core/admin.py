from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserRole, Conversation, Message, ReferralCode, Referral
from .models import Taxonomy, UserTag, UserInteraction
from .quiz_models import Quiz, QuizQuestion, QuizAttempt


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
    
    def question_preview(self, obj):
        return obj.question[:80] + '...' if len(obj.question) > 80 else obj.question
    question_preview.short_description = 'Question'


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ['user', 'quiz', 'score', 'total_questions', 'percentage_score', 'is_completed', 'started_at', 'completed_at']
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
    
    def is_valid_display(self, obj):
        return obj.is_valid()
    is_valid_display.boolean = True
    is_valid_display.short_description = 'Valid'


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
    list_display = ['name', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['category', 'name']


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
    
    def keywords_preview(self, obj):
        keywords = obj.extracted_keywords[:5] if obj.extracted_keywords else []
        return ', '.join(keywords) if keywords else 'None'
    keywords_preview.short_description = 'Keywords'
