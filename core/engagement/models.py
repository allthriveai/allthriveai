"""
Models for engagement tracking.

EngagementEvent captures all user engagement signals in a unified format,
enabling batch processing and personalization learning.
"""

from django.conf import settings
from django.db import models


class EngagementEvent(models.Model):
    """
    Unified engagement event model for all learning signals.

    Designed for event-driven architecture:
    - High-volume writes (debounced from frontend)
    - Batch processing by Celery
    - Eventually consistent with Weaviate
    """

    class EventType(models.TextChoices):
        VIEW = 'view', 'Project View'
        VIEW_MILESTONE = 'view_milestone', 'View Milestone (>30s)'
        SCROLL_DEPTH = 'scroll_depth', 'Scroll Depth'
        TIME_SPENT = 'time_spent', 'Time Spent'
        LIKE = 'like', 'Like'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='engagement_events',
        help_text='User who triggered the event',
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        db_index=True,
        help_text='Type of engagement event',
    )
    project = models.ForeignKey(
        'core.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='engagement_events',
        help_text='Project the engagement is about (if applicable)',
    )

    # Flexible payload for different event types
    # Examples:
    #   VIEW: {"session_id": "abc123"}
    #   SCROLL_DEPTH: {"depth_percent": 75, "max_depth": 100}
    #   TIME_SPENT: {"seconds": 45, "active_seconds": 30}
    #   VIEW_MILESTONE: {"threshold_seconds": 30}
    payload = models.JSONField(
        default=dict,
        blank=True,
        help_text='Event-specific data payload',
    )

    # Processing state (for event bus)
    processed = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Whether this event has been processed for profile updates',
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When this event was processed',
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'event_type', '-created_at']),
            models.Index(fields=['processed', '-created_at']),  # For batch processing
            models.Index(fields=['project', '-created_at']),
        ]
        verbose_name = 'Engagement Event'
        verbose_name_plural = 'Engagement Events'

    def __str__(self):
        project_str = f' on project {self.project_id}' if self.project_id else ''
        return f'{self.user.username}: {self.event_type}{project_str}'

    @classmethod
    def create_view_milestone(cls, user, project, threshold_seconds=30):
        """Create a view milestone event (user viewed project for threshold+ seconds)."""
        return cls.objects.create(
            user=user,
            event_type=cls.EventType.VIEW_MILESTONE,
            project=project,
            payload={'threshold_seconds': threshold_seconds},
        )

    @classmethod
    def create_time_spent(cls, user, project, seconds, active_seconds=None):
        """Create a time spent event."""
        payload = {'seconds': seconds}
        if active_seconds is not None:
            payload['active_seconds'] = active_seconds
        return cls.objects.create(
            user=user,
            event_type=cls.EventType.TIME_SPENT,
            project=project,
            payload=payload,
        )

    @classmethod
    def create_scroll_depth(cls, user, project, depth_percent):
        """Create a scroll depth event."""
        return cls.objects.create(
            user=user,
            event_type=cls.EventType.SCROLL_DEPTH,
            project=project,
            payload={'depth_percent': depth_percent},
        )
