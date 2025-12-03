"""Admin interface for Thrive Circle."""

from django.contrib import admin

from .models import (
    Circle,
    CircleChallenge,
    CircleMembership,
    Kudos,
    PointActivity,
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
