"""Admin interface for achievements."""

from django.contrib import admin

from core.achievements.models import Achievement, AchievementProgress, UserAchievement


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    """Admin interface for Achievement model."""

    list_display = ("name", "key", "category", "criteria_type", "criteria_value", "points", "rarity", "is_active")
    list_filter = ("category", "criteria_type", "rarity", "is_active", "is_secret")
    search_fields = ("name", "key", "description")
    ordering = ("category", "order", "criteria_value")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": ("key", "name", "description"),
            },
        ),
        (
            "Visual",
            {
                "fields": ("icon", "color_from", "color_to"),
            },
        ),
        (
            "Categorization",
            {
                "fields": ("category", "points", "rarity", "order"),
            },
        ),
        (
            "Unlock Criteria",
            {
                "fields": ("criteria_type", "criteria_value", "tracking_field", "requires_achievements"),
            },
        ),
        (
            "Settings",
            {
                "fields": ("is_secret", "is_active"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    """Admin interface for UserAchievement model."""

    list_display = ("user", "achievement", "earned_at", "progress_at_unlock")
    list_filter = ("earned_at", "achievement__category", "achievement__rarity")
    search_fields = ("user__username", "achievement__name", "achievement__key")
    ordering = ("-earned_at",)
    readonly_fields = ("earned_at",)
    raw_id_fields = ("user", "achievement")

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related("user", "achievement")


@admin.register(AchievementProgress)
class AchievementProgressAdmin(admin.ModelAdmin):
    """Admin interface for AchievementProgress model."""

    list_display = ("user", "achievement", "current_value", "target_value", "percentage", "last_updated")
    list_filter = ("last_updated", "achievement__category")
    search_fields = ("user__username", "achievement__name", "achievement__key")
    ordering = ("-last_updated",)
    readonly_fields = ("last_updated", "percentage")
    raw_id_fields = ("user", "achievement")

    @admin.display(description="Target")
    def target_value(self, obj):
        """Display target value from achievement."""
        return obj.achievement.criteria_value

    @admin.display(description="Progress")
    def percentage(self, obj):
        """Display progress percentage."""
        return f"{obj.percentage}%"

    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        qs = super().get_queryset(request)
        return qs.select_related("user", "achievement")
