"""Achievement models for tracking user accomplishments."""

from django.conf import settings
from django.db import models


class AchievementCategory(models.TextChoices):
    """Categories for grouping achievements."""

    PROJECTS = "projects", "Projects"
    BATTLES = "battles", "Battles"
    COMMUNITY = "community", "Community"
    ENGAGEMENT = "engagement", "Engagement"
    STREAKS = "streaks", "Streaks"


class CriteriaType(models.TextChoices):
    """Types of criteria for unlocking achievements."""

    COUNT = "count", "Count"  # e.g., "Create 10 projects"
    THRESHOLD = "threshold", "Threshold"  # e.g., "Get 100 stars"
    STREAK = "streak", "Streak"  # e.g., "7 day streak"
    FIRST_TIME = "first_time", "First Time"  # e.g., "First project"
    CUMULATIVE = "cumulative", "Cumulative"  # e.g., "1000 total points"


class AchievementRarity(models.TextChoices):
    """Rarity levels for achievements."""

    COMMON = "common", "Common"
    RARE = "rare", "Rare"
    EPIC = "epic", "Epic"
    LEGENDARY = "legendary", "Legendary"


class Achievement(models.Model):
    """Achievement definition (master data)."""

    # Unique identifier
    key = models.CharField(
        max_length=100, unique=True, help_text="Unique key for this achievement (e.g., 'first_project')"
    )

    # Display information
    name = models.CharField(max_length=200, help_text="Display name of the achievement")
    description = models.TextField(help_text="Description of what this achievement represents")

    # Visual representation
    icon = models.CharField(max_length=50, help_text="FontAwesome icon name (e.g., 'faRocket')", default="faTrophy")
    color_from = models.CharField(
        max_length=20, help_text="Gradient start color (e.g., 'blue-500')", default="blue-500"
    )
    color_to = models.CharField(max_length=20, help_text="Gradient end color (e.g., 'blue-600')", default="blue-600")

    # Categorization
    category = models.CharField(
        max_length=20, choices=AchievementCategory.choices, help_text="Category this achievement belongs to"
    )
    points = models.IntegerField(default=10, help_text="Points awarded for earning this achievement")

    # Unlock criteria
    criteria_type = models.CharField(
        max_length=20, choices=CriteriaType.choices, help_text="Type of criteria for unlocking"
    )
    criteria_value = models.IntegerField(help_text="Target value to reach (e.g., 10 for '10 projects')")
    tracking_field = models.CharField(
        max_length=100, help_text="Field name to track for progress (e.g., 'project_count')"
    )

    # Dependencies
    requires_achievements = models.ManyToManyField(
        "self", blank=True, symmetrical=False, related_name="unlocks", help_text="Achievements required before this one"
    )

    # Metadata
    is_secret = models.BooleanField(default=False, help_text="Hide this achievement until earned (secret achievement)")
    rarity = models.CharField(
        max_length=20,
        choices=AchievementRarity.choices,
        default=AchievementRarity.COMMON,
        help_text="Rarity level of this achievement",
    )
    order = models.IntegerField(default=0, help_text="Display order within category (lower numbers first)")
    is_active = models.BooleanField(default=True, help_text="Whether this achievement is currently active")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "order", "criteria_value"]
        verbose_name = "Achievement"
        verbose_name_plural = "Achievements"

    def __str__(self):
        return f"{self.name} ({self.key})"

    @property
    def full_icon_name(self):
        """Return the icon name with 'fa' prefix if not already present."""
        if not self.icon.startswith("fa"):
            return f"fa{self.icon.capitalize()}"
        return self.icon


class UserAchievement(models.Model):
    """Tracks which achievements a user has earned."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="earned_achievements")
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="earned_by")

    # Tracking
    earned_at = models.DateTimeField(auto_now_add=True, help_text="When the achievement was earned")
    progress_at_unlock = models.IntegerField(
        null=True, blank=True, help_text="The progress value when this achievement was unlocked"
    )

    class Meta:
        unique_together = ("user", "achievement")
        ordering = ["-earned_at"]
        verbose_name = "User Achievement"
        verbose_name_plural = "User Achievements"
        indexes = [
            models.Index(fields=["user", "earned_at"]),
            models.Index(fields=["achievement", "earned_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"


class AchievementProgress(models.Model):
    """Tracks current progress toward achievements."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievement_progress")
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="user_progress")

    # Progress tracking
    current_value = models.IntegerField(default=0, help_text="Current progress value")
    last_updated = models.DateTimeField(auto_now=True, help_text="Last time progress was updated")

    class Meta:
        unique_together = ("user", "achievement")
        verbose_name = "Achievement Progress"
        verbose_name_plural = "Achievement Progress"
        indexes = [
            models.Index(fields=["user", "last_updated"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}: {self.current_value}/{self.achievement.criteria_value}"

    @property
    def percentage(self):
        """Calculate progress percentage."""
        if self.achievement.criteria_value == 0:
            return 0
        return min(100, int((self.current_value / self.achievement.criteria_value) * 100))

    @property
    def is_complete(self):
        """Check if progress meets or exceeds criteria."""
        return self.current_value >= self.achievement.criteria_value
