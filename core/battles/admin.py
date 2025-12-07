"""
Django Admin configuration for Prompt Battles.

Provides admin interfaces for managing battles, submissions, and matchmaking.
"""

from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    BattleInvitation,
    BattleMatchmakingQueue,
    BattleSubmission,
    BattleVote,
    ChallengeType,
    PromptBattle,
)


@admin.register(ChallengeType)
class ChallengeTypeAdmin(admin.ModelAdmin):
    """Admin for challenge types."""

    list_display = [
        'name',
        'key',
        'is_active',
        'difficulty',
        'default_duration_minutes',
        'winner_points',
        'created_at',
    ]
    list_filter = ['is_active', 'difficulty']
    search_fields = ['name', 'key', 'description']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        (None, {'fields': ('name', 'key', 'description', 'is_active')}),
        (
            'Configuration',
            {
                'fields': (
                    'difficulty',
                    'default_duration_minutes',
                    'min_submission_length',
                    'max_submission_length',
                )
            },
        ),
        ('Points', {'fields': ('winner_points', 'participation_points')}),
        (
            'Templates',
            {
                'fields': ('templates', 'variables', 'judging_criteria'),
                'classes': ('collapse',),
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )


class BattleSubmissionInline(admin.TabularInline):
    """Inline for viewing submissions in battle admin."""

    model = BattleSubmission
    extra = 0
    readonly_fields = [
        'user',
        'prompt_text_preview',
        'image_preview',
        'score',
        'submitted_at',
        'evaluated_at',
    ]
    fields = [
        'user',
        'prompt_text_preview',
        'image_preview',
        'score',
        'submitted_at',
    ]

    @admin.display(description='Prompt')
    def prompt_text_preview(self, obj):
        """Show truncated prompt text."""
        if obj.prompt_text:
            return obj.prompt_text[:100] + '...' if len(obj.prompt_text) > 100 else obj.prompt_text
        return '-'

    @admin.display(description='Image')
    def image_preview(self, obj):
        """Show thumbnail of generated image."""
        if obj.generated_output_url:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-height: 50px;" /></a>',
                obj.generated_output_url,
                obj.generated_output_url,
            )
        return '-'

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PromptBattle)
class PromptBattleAdmin(admin.ModelAdmin):
    """Admin for prompt battles."""

    list_display = [
        'id',
        'challenger',
        'opponent',
        'status',
        'phase',
        'winner',
        'challenge_type',
        'created_at',
    ]
    list_filter = ['status', 'phase', 'match_source', 'challenge_type']
    search_fields = [
        'challenger__username',
        'opponent__username',
        'challenge_text',
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'created_at',
        'started_at',
        'completed_at',
        'expires_at',
    ]
    raw_id_fields = ['challenger', 'opponent', 'winner', 'challenge_type']
    inlines = [BattleSubmissionInline]

    fieldsets = (
        (
            None,
            {
                'fields': (
                    'challenger',
                    'opponent',
                    'challenge_type',
                    'challenge_text',
                )
            },
        ),
        ('Status', {'fields': ('status', 'phase', 'winner', 'match_source')}),
        (
            'Timing',
            {
                'fields': (
                    'duration_minutes',
                    'started_at',
                    'expires_at',
                    'completed_at',
                )
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('created_at',),
                'classes': ('collapse',),
            },
        ),
    )

    actions = ['cancel_battles', 'force_complete']

    @admin.action(description='Cancel selected battles')
    def cancel_battles(self, request, queryset):
        """Cancel selected battles."""
        from .models import BattleStatus

        count = queryset.exclude(status__in=[BattleStatus.COMPLETED, BattleStatus.CANCELLED]).update(
            status=BattleStatus.CANCELLED
        )
        self.message_user(request, f'{count} battles cancelled.')

    @admin.action(description='Force complete selected battles')
    def force_complete(self, request, queryset):
        """Force complete stuck battles."""
        from .models import BattlePhase, BattleStatus

        count = 0
        for battle in queryset.exclude(status=BattleStatus.COMPLETED):
            battle.status = BattleStatus.COMPLETED
            battle.phase = BattlePhase.COMPLETE
            battle.completed_at = timezone.now()
            battle.save(update_fields=['status', 'phase', 'completed_at'])
            count += 1

        self.message_user(request, f'{count} battles force completed.')


@admin.register(BattleSubmission)
class BattleSubmissionAdmin(admin.ModelAdmin):
    """Admin for battle submissions."""

    list_display = [
        'id',
        'battle',
        'user',
        'submission_type',
        'score',
        'image_preview',
        'submitted_at',
        'evaluated_at',
    ]
    list_filter = ['submission_type', 'submitted_at']
    search_fields = ['user__username', 'prompt_text']
    ordering = ['-submitted_at']
    readonly_fields = [
        'submitted_at',
        'evaluated_at',
        'image_preview_large',
        'criteria_scores',
        'evaluation_feedback',
    ]
    raw_id_fields = ['battle', 'user']

    fieldsets = (
        (None, {'fields': ('battle', 'user', 'submission_type')}),
        ('Content', {'fields': ('prompt_text', 'generated_output_url', 'image_preview_large')}),
        ('Evaluation', {'fields': ('score', 'criteria_scores', 'evaluation_feedback', 'evaluated_at')}),
        (
            'Timestamps',
            {
                'fields': ('submitted_at',),
            },
        ),
    )

    @admin.display(description='Image')
    def image_preview(self, obj):
        """Show thumbnail of generated image."""
        if obj.generated_output_url:
            return format_html(
                '<img src="{}" style="max-height: 40px;" />',
                obj.generated_output_url,
            )
        return '-'

    @admin.display(description='Generated Image')
    def image_preview_large(self, obj):
        """Show larger preview of generated image."""
        if obj.generated_output_url:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-width: 400px;" /></a>',
                obj.generated_output_url,
                obj.generated_output_url,
            )
        return '-'


@admin.register(BattleVote)
class BattleVoteAdmin(admin.ModelAdmin):
    """Admin for battle votes."""

    list_display = [
        'id',
        'battle',
        'submission',
        'voter',
        'vote_source',
        'score',
        'created_at',
    ]
    list_filter = ['vote_source', 'created_at']
    search_fields = ['voter__username']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'criteria_scores']
    raw_id_fields = ['battle', 'submission', 'voter']


@admin.register(BattleInvitation)
class BattleInvitationAdmin(admin.ModelAdmin):
    """Admin for battle invitations."""

    list_display = [
        'id',
        'sender',
        'recipient',
        'status',
        'invitation_type',
        'created_at',
        'expires_at',
    ]
    list_filter = ['status', 'invitation_type']
    search_fields = ['sender__username', 'recipient__username', 'recipient_phone']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'responded_at', 'sms_sent_at']
    raw_id_fields = ['sender', 'recipient', 'battle']


@admin.register(BattleMatchmakingQueue)
class BattleMatchmakingQueueAdmin(admin.ModelAdmin):
    """Admin for matchmaking queue."""

    list_display = [
        'user',
        'match_type',
        'challenge_type',
        'queued_at',
        'expires_at',
        'is_expired_display',
    ]
    list_filter = ['match_type', 'challenge_type']
    search_fields = ['user__username']
    ordering = ['queued_at']
    readonly_fields = ['queued_at']
    raw_id_fields = ['user', 'challenge_type']

    actions = ['clear_expired']

    @admin.display(description='Status')
    def is_expired_display(self, obj):
        """Show if queue entry is expired."""
        if obj.is_expired:
            return format_html('<span style="color: red;">Expired</span>')
        return format_html('<span style="color: green;">Active</span>')

    @admin.action(description='Clear expired queue entries')
    def clear_expired(self, request, queryset):
        """Clear expired entries from queue."""
        count = queryset.filter(expires_at__lt=timezone.now()).delete()[0]
        self.message_user(request, f'{count} expired entries cleared.')
