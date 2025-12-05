"""Admin interface for Thrive Circle."""

from django import forms
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Circle,
    CircleChallenge,
    CircleMembership,
    Kudos,
    PointActivity,
    QuestCategory,
    SideQuest,
    UserSideQuest,
)


@admin.register(PointActivity)
class PointActivityAdmin(admin.ModelAdmin):
    """Admin for PointActivity model."""

    list_display = ['user', 'amount', 'activity_type', 'tier_at_time', 'created_at']
    list_filter = ['activity_type', 'tier_at_time', 'created_at']
    search_fields = ['user__username', 'description']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    fieldsets = (
        ('Activity Details', {'fields': ('user', 'amount', 'activity_type', 'description', 'tier_at_time')}),
        ('Timestamp', {'fields': ('created_at',)}),
    )


# =============================================================================
# Circle Admin
# =============================================================================


class CircleMembershipInline(admin.TabularInline):
    """Inline for viewing circle members."""

    model = CircleMembership
    extra = 0
    readonly_fields = ['user', 'joined_at', 'points_earned_in_circle', 'was_active']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class CircleChallengeInline(admin.TabularInline):
    """Inline for viewing circle challenges."""

    model = CircleChallenge
    extra = 0
    readonly_fields = ['challenge_type', 'current_progress', 'target', 'is_completed']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Circle)
class CircleAdmin(admin.ModelAdmin):
    """Admin for Circle model."""

    list_display = ['name', 'tier', 'week_start', 'member_count', 'active_member_count', 'is_active']
    list_filter = ['tier', 'is_active', 'week_start']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at', 'member_count', 'active_member_count']
    date_hierarchy = 'week_start'
    ordering = ['-week_start', 'tier']
    inlines = [CircleMembershipInline, CircleChallengeInline]

    fieldsets = (
        ('Circle Identity', {'fields': ('name', 'tier')}),
        ('Time Window', {'fields': ('week_start', 'week_end')}),
        ('Stats', {'fields': ('member_count', 'active_member_count')}),
        ('Status', {'fields': ('is_active',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    actions = ['update_member_counts']

    @admin.action(description='Update member counts for selected circles')
    def update_member_counts(self, request, queryset):
        for circle in queryset:
            circle.update_member_counts()
        self.message_user(request, f'Updated member counts for {queryset.count()} circles.')


@admin.register(CircleMembership)
class CircleMembershipAdmin(admin.ModelAdmin):
    """Admin for CircleMembership model."""

    list_display = ['user', 'circle', 'is_active', 'points_earned_in_circle', 'was_active', 'joined_at']
    list_filter = ['is_active', 'was_active', 'circle__tier', 'circle__week_start']
    search_fields = ['user__username', 'circle__name']
    readonly_fields = ['joined_at']
    raw_id_fields = ['user', 'circle']
    ordering = ['-joined_at']


@admin.register(CircleChallenge)
class CircleChallengeAdmin(admin.ModelAdmin):
    """Admin for CircleChallenge model."""

    list_display = [
        'title',
        'circle',
        'challenge_type',
        'progress_display',
        'is_completed',
        'rewards_distributed',
    ]
    list_filter = ['challenge_type', 'is_completed', 'rewards_distributed', 'circle__tier']
    search_fields = ['title', 'circle__name']
    readonly_fields = ['created_at', 'updated_at', 'completed_at']
    raw_id_fields = ['circle']
    ordering = ['-created_at']

    fieldsets = (
        ('Challenge Details', {'fields': ('circle', 'challenge_type', 'title', 'description')}),
        ('Progress', {'fields': ('target', 'current_progress', 'is_completed', 'completed_at')}),
        ('Rewards', {'fields': ('bonus_points', 'rewards_distributed')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )

    @admin.display(description='Progress')
    def progress_display(self, obj):
        return f'{obj.current_progress}/{obj.target} ({obj.progress_percentage}%)'

    actions = ['distribute_rewards']

    @admin.action(description='Distribute rewards for completed challenges')
    def distribute_rewards(self, request, queryset):
        distributed = 0
        for challenge in queryset.filter(is_completed=True, rewards_distributed=False):
            challenge.distribute_rewards()
            distributed += 1
        self.message_user(request, f'Distributed rewards for {distributed} challenges.')


@admin.register(Kudos)
class KudosAdmin(admin.ModelAdmin):
    """Admin for Kudos model."""

    list_display = ['from_user', 'to_user', 'kudos_type', 'circle', 'created_at']
    list_filter = ['kudos_type', 'circle__tier', 'created_at']
    search_fields = ['from_user__username', 'to_user__username', 'message']
    readonly_fields = ['created_at']
    raw_id_fields = ['from_user', 'to_user', 'circle', 'project']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    fieldsets = (
        ('Users', {'fields': ('from_user', 'to_user')}),
        ('Context', {'fields': ('circle', 'project')}),
        ('Kudos Details', {'fields': ('kudos_type', 'message')}),
        ('Timestamp', {'fields': ('created_at',)}),
    )


# =============================================================================
# Side Quests Admin
# =============================================================================


@admin.register(QuestCategory)
class QuestCategoryAdmin(admin.ModelAdmin):
    """Admin for Quest Categories."""

    list_display = ['name', 'slug', 'category_type', 'color_badge', 'icon', 'order', 'is_active']
    list_filter = ['category_type', 'is_active']
    search_fields = ['name', 'slug', 'description']
    prepopulated_fields = {'slug': ('name',)}
    ordering = ['order', 'name']

    fieldsets = (
        (
            '📂 Category Info',
            {'fields': ('name', 'slug', 'description', 'category_type'), 'description': 'Basic category information'},
        ),
        ('🎨 Visual', {'fields': ('icon', 'color_from', 'color_to'), 'description': 'Visual styling for the category'}),
        ('⚙️ Settings', {'fields': ('order', 'is_active'), 'description': 'Display order and activation status'}),
    )

    @admin.display(description='Color')
    def color_badge(self, obj):
        """Display color gradient badge."""
        return format_html(
            '<div style="background: linear-gradient(135deg, {}, {}); width: 100px; height: 20px; border-radius: 3px;"></div>',
            obj.color_from,
            obj.color_to,
        )


class SideQuestForm(forms.ModelForm):
    """Custom form for Side Quests with better widgets."""

    class Meta:
        model = SideQuest
        fields = '__all__'
        widgets = {
            'description': forms.Textarea(
                attrs={'rows': 3, 'placeholder': 'Detailed description of what the user needs to do'}
            ),
            'requirements': forms.Textarea(
                attrs={'rows': 4, 'placeholder': '{"target": 5, "action": "comment_created", "criteria": "any"}'}
            ),
            'steps': forms.Textarea(
                attrs={
                    'rows': 6,
                    'placeholder': '[{"id": "step_1", "title": "...", "description": "...", "destination_url": "/learn"}]',
                }
            ),
            'narrative_intro': forms.Textarea(
                attrs={'rows': 2, 'placeholder': 'Welcome message when quest starts (encouraging tone)'}
            ),
            'narrative_complete': forms.Textarea(
                attrs={'rows': 2, 'placeholder': 'Celebration message when quest completes'}
            ),
        }


@admin.register(SideQuest)
class SideQuestAdmin(admin.ModelAdmin):
    """Admin for Side Quests - allows creating quests without code deployment."""

    form = SideQuestForm

    list_display = [
        'title',
        'category',
        'difficulty_badge',
        'points_reward',
        'quest_type',
        'active_status',
        'completion_count',
    ]
    list_filter = [
        'is_active',
        'difficulty',
        'quest_type',
        'category',
        'topic',
        'is_daily',
        'is_repeatable',
    ]
    search_fields = ['title', 'description', 'quest_type']
    ordering = ['category__order', 'order', '-created_at']
    readonly_fields = ['created_at', 'updated_at', 'quest_preview']

    list_per_page = 50
    save_on_top = True

    fieldsets = (
        (
            '📝 Quest Basics',
            {
                'fields': ('title', 'description', 'quest_type', 'difficulty', 'category'),
                'description': 'Core quest information',
            },
        ),
        (
            '🎯 Requirements & Rewards',
            {
                'fields': ('requirements', 'points_reward'),
                'description': 'What users need to do and what they get. Use JSON format for requirements.',
            },
        ),
        (
            '🗂️ Topic & Level (Optional)',
            {
                'fields': ('topic', 'skill_level'),
                'description': 'Optional topic-based filtering for personalized quest recommendations',
                'classes': ('collapse',),
            },
        ),
        (
            '📖 Guided Quest (Multi-Step)',
            {
                'fields': ('is_guided', 'steps', 'narrative_intro', 'narrative_complete', 'estimated_minutes'),
                'description': 'For multi-step guided quests with narrative',
                'classes': ('collapse',),
            },
        ),
        (
            '⏰ Scheduling & Repeats',
            {
                'fields': (
                    'is_active',
                    'starts_at',
                    'expires_at',
                    'is_daily',
                    'daily_reset_hour',
                    'is_repeatable',
                    'repeat_cooldown_hours',
                ),
                'description': 'Quest availability and repeatability settings',
            },
        ),
        ('⚙️ Organization', {'fields': ('order',), 'description': 'Display order within category'}),
        (
            '📊 Preview & Meta',
            {
                'fields': ('quest_preview', 'created_at', 'updated_at'),
                'classes': ('collapse',),
            },
        ),
    )

    actions = ['activate_quests', 'deactivate_quests', 'duplicate_quest']

    @admin.display(description='Difficulty')
    def difficulty_badge(self, obj):
        """Display difficulty with color."""
        colors = {
            'easy': '#10b981',  # green
            'medium': '#f59e0b',  # orange
            'hard': '#ef4444',  # red
            'epic': '#8b5cf6',  # purple
        }
        color = colors.get(obj.difficulty, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 11px;">{}</span>',
            color,
            obj.get_difficulty_display().upper(),
        )

    @admin.display(description='Status')
    def active_status(self, obj):
        """Display active status with icon."""
        if obj.is_active:
            return format_html('<span style="color: green; font-size: 18px;">●</span> Active')
        return format_html('<span style="color: gray; font-size: 18px;">●</span> Inactive')

    @admin.display(description='Completions')
    def completion_count(self, obj):
        """Display number of completions."""
        count = UserSideQuest.objects.filter(side_quest=obj, status='completed').count()
        return format_html('<strong>{}</strong> completions', count)

    @admin.display(description='Quest Preview')
    def quest_preview(self, obj):
        """Display quest preview."""
        return format_html(
            '<div style="font-family: monospace; background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">'
            '<h3 style="margin-top: 0; color: #1f2937;">{}</h3>'
            '<p style="color: #6b7280; margin: 8px 0;"><strong>Type:</strong> {}</p>'
            '<p style="color: #6b7280; margin: 8px 0;"><strong>Description:</strong> {}</p>'
            '<p style="color: #6b7280; margin: 8px 0;"><strong>Rewards:</strong> {} points</p>'
            '<p style="color: #6b7280; margin: 8px 0;"><strong>Difficulty:</strong> {}</p>'
            '{}'
            '</div>',
            obj.title,
            obj.get_quest_type_display(),
            obj.description[:200] + ('...' if len(obj.description) > 200 else ''),
            obj.points_reward,
            obj.get_difficulty_display(),
            format_html(
                '<p style="color: #10b981; margin: 8px 0;"><strong>✓ Guided Quest</strong> ({} steps)</p>',
                len(obj.steps),
            )
            if obj.is_guided
            else '',
        )

    @admin.action(description='✓ Activate selected quests')
    def activate_quests(self, request, queryset):
        """Activate selected quests."""
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} quest(s) activated.')

    @admin.action(description='✗ Deactivate selected quests')
    def deactivate_quests(self, request, queryset):
        """Deactivate selected quests."""
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} quest(s) deactivated.')

    @admin.action(description='📋 Duplicate selected quest')
    def duplicate_quest(self, request, queryset):
        """Duplicate a quest for easy creation of similar quests."""
        for quest in queryset[:1]:  # Only duplicate first selected
            quest.pk = None
            quest.title = f'{quest.title} (Copy)'
            quest.is_active = False
            quest.save()
            self.message_user(request, f'Duplicated quest: {quest.title}')


@admin.register(UserSideQuest)
class UserSideQuestAdmin(admin.ModelAdmin):
    """Admin for User Side Quest Progress."""

    list_display = ['user', 'side_quest', 'status', 'current_step_index', 'progress_display', 'started_at']
    list_filter = ['status', 'side_quest__category', 'side_quest__difficulty', 'started_at']
    search_fields = ['user__username', 'side_quest__title']
    raw_id_fields = ['user', 'side_quest']
    readonly_fields = ['started_at', 'completed_at', 'updated_at']
    ordering = ['-started_at']

    fieldsets = (
        ('User & Quest', {'fields': ('user', 'side_quest')}),
        ('Progress', {'fields': ('status', 'current_step_index', 'progress_data')}),
        ('Timestamps', {'fields': ('started_at', 'updated_at', 'completed_at')}),
    )

    @admin.display(description='Progress')
    def progress_display(self, obj):
        """Display progress percentage."""
        if obj.status == 'completed':
            return format_html('<span style="color: green;">✓ 100%</span>')
        elif obj.status == 'in_progress':
            return format_html('<span style="color: orange;">⏳ In Progress</span>')
        return format_html('<span style="color: gray;">Abandoned</span>')
