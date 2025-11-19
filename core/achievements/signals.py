"""Signals for tracking achievement progress."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.projects.models import Project
from services.achievements import AchievementTracker

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Project)
def track_project_created(sender, instance, created, **kwargs):
    """
    Track when a user creates a project.

    Awards progress toward project count achievements.
    """
    if created:
        try:
            # Track project creation
            unlocked = AchievementTracker.track_event(user=instance.user, tracking_field="project_count", value=1)

            if unlocked:
                logger.info(
                    f"User {instance.user.username} unlocked {len(unlocked)} achievement(s) "
                    f"for creating project: {instance.title}"
                )
        except Exception as e:
            logger.error(f"Error tracking project creation achievement: {e}")


@receiver(post_save, sender=Project)
def track_project_published(sender, instance, created, **kwargs):
    """
    Track when a user publishes a project.

    Awards progress toward published project achievements.
    """
    # Only track if project is published and wasn't just created
    # (to avoid double-counting on initial publish)
    if not created and instance.is_published:
        try:
            # Check if this is the first time being published
            # by looking at the previous state (would need field tracking for this)
            # For now, we'll increment on any save where is_published=True

            unlocked = AchievementTracker.track_event(
                user=instance.user, tracking_field="published_project_count", value=1
            )

            if unlocked:
                logger.info(
                    f"User {instance.user.username} unlocked {len(unlocked)} achievement(s) "
                    f"for publishing project: {instance.title}"
                )
        except Exception as e:
            logger.error(f"Error tracking project publish achievement: {e}")


# TODO: Add more signals for other trackable events:
# - Battle participation/wins
# - Quiz completion
# - Community interactions (likes, comments)
# - Login streaks
