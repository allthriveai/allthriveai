"""Utility functions for the Thrive Circle gamification system."""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone


def safe_int_param(value, default: int, min_val: int = None, max_val: int = None) -> int:
    """
    Safely parse an integer from a query parameter.

    Args:
        value: The raw value from request.query_params.get()
        default: Default value if parsing fails or value is None
        min_val: Optional minimum value (inclusive)
        max_val: Optional maximum value (inclusive)

    Returns:
        Parsed and bounded integer value
    """
    if value is None:
        return default

    try:
        result = int(value)
    except (ValueError, TypeError):
        return default

    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)

    return result


def get_week_start(date=None):
    """
    Get the Monday of the current week (or specified date's week).

    Args:
        date: Optional date to get week start for. Defaults to today.

    Returns:
        Date object representing Monday of the week.
    """
    if date is None:
        date = timezone.now().date()
    return date - timedelta(days=date.weekday())


def get_week_end(date=None):
    """
    Get the Sunday of the current week (or specified date's week).

    Args:
        date: Optional date to get week end for. Defaults to today.

    Returns:
        Date object representing Sunday of the week.
    """
    week_start = get_week_start(date)
    return week_start + timedelta(days=6)


@transaction.atomic
def check_weekly_goals(user, activity_type):
    """
    Check and update weekly goals based on user activity.

    This function is called whenever a user earns XP to update progress
    on relevant weekly goals. If a goal is completed, bonus XP is awarded.

    Uses atomic transactions and F() expressions to prevent race conditions.

    Args:
        user: User instance who performed the activity
        activity_type: String representing the type of activity (e.g., 'quiz_complete')
    """
    from .models import WeeklyGoal  # Import here to avoid circular imports

    week_start = get_week_start()

    # Determine which goal type this activity counts towards
    goal_type = None
    if activity_type in ['quiz_complete', 'project_create', 'side_quest']:
        goal_type = 'activities_3'
    elif activity_type == 'comment':
        goal_type = 'help_5'

    # Early return if this activity type doesn't contribute to any goals
    if not goal_type:
        return

    # Atomic update of goal progress - prevents race conditions
    updated_count = WeeklyGoal.objects.filter(
        user=user, week_start=week_start, goal_type=goal_type, is_completed=False
    ).update(current_progress=F('current_progress') + 1)

    # If no goal was updated, it doesn't exist or is already completed
    if updated_count == 0:
        return

    # Refresh to check if goal is now complete
    goal = WeeklyGoal.objects.filter(user=user, week_start=week_start, goal_type=goal_type).first()

    if goal and goal.current_progress >= goal.target_progress and not goal.is_completed:
        # Mark as completed
        goal.is_completed = True
        goal.completed_at = timezone.now()
        goal.save()

        # Award bonus points with _skip_goal_check=True to prevent infinite recursion
        user.tier_status.add_xp(
            goal.points_reward,
            'weekly_goal',
            f'Completed: {goal.get_goal_type_display()}',
            _skip_goal_check=True,  # Prevent recursion!
        )

    # Note: streak_7 and topics_2 goals are checked by Celery tasks, not here


def get_next_tier_xp(current_tier):
    """
    Get XP needed for next tier.

    Args:
        current_tier: String representing current tier (e.g., 'seedling')

    Returns:
        Integer representing XP threshold for next tier, or None if already at max tier.
    """
    tier_thresholds = {
        'seedling': 1000,
        'sprout': 2500,
        'blossom': 5000,
        'bloom': 10000,
        'evergreen': None,  # Max tier
    }
    return tier_thresholds.get(current_tier)
