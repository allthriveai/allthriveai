"""Django Admin for Weekly Challenges."""

from django import forms
from django.contrib import admin
from django.utils.html import format_html

from core.challenges.models import (
    ChallengeParticipant,
    ChallengeSponsor,
    ChallengeSubmission,
    ChallengeVote,
    WeeklyChallenge,
)


@admin.register(ChallengeSponsor)
class ChallengeSponsorAdmin(admin.ModelAdmin):
    """Admin for challenge sponsors."""

    list_display = [
        'name',
        'slug',
        'is_active',
        'is_verified',
        'total_challenges_sponsored',
        'created_at',
    ]
    list_filter = ['is_active', 'is_verified']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['total_challenges_sponsored', 'total_prize_value', 'created_at']


class ChallengeSubmissionInline(admin.TabularInline):
    """Inline for viewing submissions in challenge admin."""

    model = ChallengeSubmission
    extra = 0
    readonly_fields = ['user', 'title', 'vote_count', 'submitted_at', 'is_featured']
    fields = ['user', 'title', 'vote_count', 'is_featured', 'is_disqualified', 'submitted_at']
    can_delete = False
    max_num = 10
    ordering = ['-vote_count']


class WeeklyChallengeForm(forms.ModelForm):
    """Custom form for WeeklyChallenge with better widgets."""

    class Meta:
        model = WeeklyChallenge
        fields = [
            'title',
            'slug',
            'description',
            'prompt',
            'status',
            'week_number',
            'year',
            'starts_at',
            'submission_deadline',
            'voting_deadline',
            'ends_at',
            'max_submissions_per_user',
            'allow_voting',
            'require_project_link',
            'allow_external_submissions',
            'hero_image_url',
            'theme_color',
            'is_featured',
            'sponsor',
            'prizes',
            'points_config',
            'suggested_tools',
            'created_by',
        ]
        widgets = {
            'description': forms.Textarea(
                attrs={
                    'rows': 4,
                    'placeholder': (
                        'Full challenge description and rules. This will be displayed on the challenge detail page.'
                    ),
                }
            ),
            'prompt': forms.Textarea(
                attrs={
                    'rows': 3,
                    'placeholder': (
                        'The creative prompt for participants. E.g., "Create a landscape that reimagines nature..."'
                    ),
                }
            ),
            'prizes': forms.Textarea(
                attrs={
                    'rows': 5,
                    'placeholder': (
                        '{"1st": {"type": "cash", "amount": 100, "description": "First place prize"}, "2nd": {...}}'
                    ),
                }
            ),
            'points_config': forms.Textarea(
                attrs={
                    'rows': 5,
                    'placeholder': '{"submit": 50, "early_bird": 25, "vote_cast": 5, ...}',
                }
            ),
            'suggested_tools': forms.Textarea(
                attrs={
                    'rows': 4,
                    'placeholder': '[{"name": "Midjourney", "url": "https://...", "icon": "..."}, ...]',
                }
            ),
        }
        help_texts = {
            'title': 'Challenge title shown to users (e.g., "AI Art Week: Dreamscapes")',
            'description': 'Detailed description of the challenge, rules, and judging criteria',
            'prompt': 'The actual creative prompt participants will respond to',
            'week_number': 'Week of the year (1-52)',
            'status': ('Draft = not visible, Upcoming = visible but not started, Active = accepting submissions'),
            'theme_color': 'Color for UI styling (purple, cyan, green, orange, red, blue)',
            'prizes': 'JSON format prizes configuration',
            'points_config': 'Points awarded for different activities (leave empty for defaults)',
            'suggested_tools': 'List of recommended AI tools in JSON format',
        }


@admin.register(WeeklyChallenge)
class WeeklyChallengeAdmin(admin.ModelAdmin):
    """Admin for weekly challenges."""

    form = WeeklyChallengeForm

    list_display = [
        'title',
        'status_badge',
        'week_number',
        'year',
        'sponsor',
        'submission_count',
        'participant_count',
        'date_range',
    ]
    list_filter = ['status', 'year', 'is_featured', 'sponsor']
    search_fields = ['title', 'slug', 'description', 'prompt']
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'starts_at'
    readonly_fields = [
        'submission_count',
        'participant_count',
        'total_votes',
        'created_at',
        'updated_at',
        'preview_info',
    ]
    inlines = [ChallengeSubmissionInline]

    list_per_page = 25
    save_on_top = True

    fieldsets = (
        (
            '📝 Basic Info',
            {
                'fields': ('title', 'slug', 'description', 'prompt', 'status'),
                'description': 'Core challenge information that participants will see',
            },
        ),
        (
            '📅 Timing',
            {
                'fields': (
                    'week_number',
                    'year',
                    'starts_at',
                    'submission_deadline',
                    'voting_deadline',
                    'ends_at',
                ),
                'description': 'Set all dates and deadlines for the challenge lifecycle',
            },
        ),
        (
            '⚙️ Configuration',
            {
                'fields': (
                    'max_submissions_per_user',
                    'allow_voting',
                    'require_project_link',
                    'allow_external_submissions',
                ),
                'description': 'Challenge rules and restrictions',
            },
        ),
        (
            '🎨 Visual & Branding',
            {
                'fields': ('hero_image_url', 'theme_color', 'is_featured'),
                'description': 'Visual elements for the challenge page',
            },
        ),
        (
            '🏆 Sponsor & Rewards',
            {
                'fields': ('sponsor', 'prizes', 'points_config', 'suggested_tools'),
                'description': 'Prizes, points, and recommended tools (use JSON format)',
            },
        ),
        (
            '📊 Stats (Read-only)',
            {
                'fields': (
                    'preview_info',
                    'submission_count',
                    'participant_count',
                    'total_votes',
                ),
                'classes': ('collapse',),
            },
        ),
        ('🔧 Metadata', {'fields': ('created_by', 'created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    actions = ['activate_challenges', 'start_voting_period', 'complete_challenges']

    @admin.display(description='Status')
    def status_badge(self, obj):
        """Display status with color badge."""
        colors = {
            'draft': 'gray',
            'upcoming': 'blue',
            'active': 'green',
            'voting': 'orange',
            'completed': 'purple',
            'cancelled': 'red',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display(),
        )

    @admin.display(description='Date Range')
    def date_range(self, obj):
        """Display start to end date range."""
        return format_html(
            '{} → {}',
            obj.starts_at.strftime('%b %d') if obj.starts_at else '—',
            obj.ends_at.strftime('%b %d, %Y') if obj.ends_at else '—',
        )

    @admin.display(description='Challenge Preview')
    def preview_info(self, obj):
        """Display preview information."""
        return format_html(
            '<div style="font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 5px;">'
            '<strong>Challenge Preview</strong><br><br>'
            '📌 <strong>Title:</strong> {}<br>'
            '📝 <strong>Prompt:</strong> {}<br>'
            '🎨 <strong>Theme Color:</strong> {}<br>'
            '📊 <strong>Status:</strong> {}<br>'
            '👥 <strong>Participants:</strong> {}<br>'
            '📮 <strong>Submissions:</strong> {}<br>'
            '</div>',
            obj.title,
            obj.prompt[:100] + '...' if len(obj.prompt) > 100 else obj.prompt,
            obj.theme_color,
            obj.get_status_display(),
            obj.participant_count,
            obj.submission_count,
        )

    @admin.action(description='Activate selected challenges')
    def activate_challenges(self, request, queryset):
        """Activate selected challenges."""
        count = queryset.filter(status='upcoming').update(status='active')
        self.message_user(request, f'{count} challenge(s) activated.')

    @admin.action(description='Start voting period')
    def start_voting_period(self, request, queryset):
        """Move challenges to voting period."""
        count = queryset.filter(status='active').update(status='voting')
        self.message_user(request, f'{count} challenge(s) moved to voting period.')

    @admin.action(description='Complete selected challenges')
    def complete_challenges(self, request, queryset):
        """Complete selected challenges."""
        count = queryset.filter(status__in=['active', 'voting']).update(status='completed')
        self.message_user(request, f'{count} challenge(s) completed.')


@admin.register(ChallengeSubmission)
class ChallengeSubmissionAdmin(admin.ModelAdmin):
    """Admin for challenge submissions."""

    list_display = [
        'title',
        'user',
        'challenge',
        'vote_count',
        'final_rank',
        'is_featured',
        'is_disqualified',
        'submitted_at',
    ]
    list_filter = [
        'challenge',
        'is_featured',
        'is_disqualified',
        'is_early_bird',
    ]
    search_fields = ['title', 'description', 'user__username']
    readonly_fields = [
        'vote_count',
        'participation_points',
        'bonus_points',
        'prize_points',
        'submitted_at',
    ]
    raw_id_fields = ['user', 'challenge', 'project']
    date_hierarchy = 'submitted_at'

    fieldsets = (
        ('Submission', {'fields': ('challenge', 'user', 'title', 'description')}),
        ('Content', {'fields': ('project', 'image_url', 'external_url', 'ai_tool_used')}),
        ('Scoring', {'fields': ('vote_count', 'judge_score', 'final_rank')}),
        ('Points', {'fields': ('participation_points', 'bonus_points', 'prize_points')}),
        (
            'Flags',
            {
                'fields': (
                    'is_featured',
                    'is_early_bird',
                    'is_disqualified',
                    'disqualification_reason',
                )
            },
        ),
    )

    actions = ['feature_submissions', 'unfeature_submissions', 'disqualify_submissions']

    @admin.action(description='Feature selected submissions')
    def feature_submissions(self, request, queryset):
        """Feature selected submissions."""
        count = queryset.update(is_featured=True)
        self.message_user(request, f'{count} submission(s) featured.')

    @admin.action(description='Unfeature selected submissions')
    def unfeature_submissions(self, request, queryset):
        """Unfeature selected submissions."""
        count = queryset.update(is_featured=False)
        self.message_user(request, f'{count} submission(s) unfeatured.')

    @admin.action(description='Disqualify selected submissions')
    def disqualify_submissions(self, request, queryset):
        """Disqualify selected submissions."""
        count = queryset.update(is_disqualified=True)
        self.message_user(request, f'{count} submission(s) disqualified.')


@admin.register(ChallengeVote)
class ChallengeVoteAdmin(admin.ModelAdmin):
    """Admin for challenge votes."""

    list_display = ['voter', 'submission', 'weight', 'created_at']
    list_filter = ['created_at']
    search_fields = ['voter__username', 'submission__title']
    raw_id_fields = ['voter', 'submission']
    readonly_fields = ['created_at']


@admin.register(ChallengeParticipant)
class ChallengeParticipantAdmin(admin.ModelAdmin):
    """Admin for challenge participants."""

    list_display = [
        'user',
        'challenge',
        'submission_count',
        'votes_cast',
        'votes_received',
        'total_points_earned',
        'best_rank',
    ]
    list_filter = ['challenge']
    search_fields = ['user__username']
    raw_id_fields = ['user', 'challenge']
    readonly_fields = [
        'submission_count',
        'votes_cast',
        'votes_received',
        'total_points_earned',
        'best_rank',
        'joined_at',
    ]
