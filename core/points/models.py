"""Points tracking models."""

import uuid

from django.conf import settings
from django.db import models


class ActivityType(models.TextChoices):
    """Types of activities that award points."""

    # Quiz-related
    QUIZ_COMPLETED = 'quiz_completed', 'Quiz Completed'
    QUIZ_PERFECT_SCORE = 'quiz_perfect_score', 'Quiz Perfect Score'
    QUIZ_STREAK = 'quiz_streak', 'Quiz Streak'

    # Project-related
    PROJECT_CREATED = 'project_created', 'Project Created'
    PROJECT_PUBLISHED = 'project_published', 'Project Published'
    PROJECT_MILESTONE = 'project_milestone', 'Project Milestone'

    # Engagement
    DAILY_LOGIN = 'daily_login', 'Daily Login'
    WEEK_STREAK = 'week_streak', 'Week Streak'
    MONTH_STREAK = 'month_streak', 'Month Streak'

    # Battle-related
    BATTLE_PARTICIPATED = 'battle_participated', 'Battle Participated'
    BATTLE_WON = 'battle_won', 'Battle Won'
    BATTLE_COMPLETED = 'battle_completed', 'Battle Completed'

    # Profile & Community
    PROFILE_COMPLETED = 'profile_completed', 'Profile Completed'
    REFERRAL = 'referral', 'Referral'

    # Achievement
    ACHIEVEMENT_EARNED = 'achievement_earned', 'Achievement Earned'

    # Manual adjustments
    MANUAL_AWARD = 'manual_award', 'Manual Award'
    MANUAL_DEDUCTION = 'manual_deduction', 'Manual Deduction'


class PointsHistory(models.Model):
    """Tracks all point awards and deductions for users."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='points_history')

    # Activity details
    activity_type = models.CharField(max_length=50, choices=ActivityType.choices, help_text='Type of activity')
    points_awarded = models.IntegerField(help_text='Points awarded (can be negative for deductions)')
    description = models.TextField(help_text='Human-readable description of why points were awarded')

    # Additional context (optional JSON data)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional data about the activity (e.g., quiz_id, score, etc.)',
    )

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Points History'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['activity_type', '-created_at']),
        ]

    def __str__(self):
        sign = '+' if self.points_awarded >= 0 else ''
        return f'{self.user.username}: {sign}{self.points_awarded} pts - {self.get_activity_type_display()}'
