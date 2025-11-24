"""Celery tasks for the Thrive Circle gamification system."""

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import UserTier, WeeklyGoal
from .utils import get_week_start

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task
def create_weekly_goals():
    """
    Create weekly goals for all active users at start of week.

    This task should run every Monday at 00:00 to create goals for the week.
    Uses bulk_create for performance with large user bases.
    """
    from django.db import transaction

    week_start = get_week_start()
    week_end = week_start + timedelta(days=6)

    # Get all active users with tier status - convert to list to cache
    active_users = list(User.objects.filter(is_active=True, tier_status__isnull=False))
    user_count = len(active_users)

    if user_count == 0:
        logger.info('No active users with tier status found')
        return {'users': 0, 'goals_created': 0}

    # Check existing goals for this week to avoid duplicates
    existing_goals = set(WeeklyGoal.objects.filter(week_start=week_start).values_list('user_id', 'goal_type'))

    # Goal configurations: (goal_type, target_progress, xp_reward)
    goal_configs = [
        ('activities_3', 3, 30),
        ('streak_7', 7, 50),
        ('help_5', 5, 40),
        ('topics_2', 2, 25),
    ]

    # Prepare goals for bulk creation
    goals_to_create = []
    for user in active_users:
        for goal_type, target, xp_reward in goal_configs:
            # Skip if goal already exists
            if (user.id, goal_type) not in existing_goals:
                goals_to_create.append(
                    WeeklyGoal(
                        user=user,
                        goal_type=goal_type,
                        week_start=week_start,
                        week_end=week_end,
                        target_progress=target,
                        xp_reward=xp_reward,
                    )
                )

    # Bulk create all goals in a single transaction
    # ignore_conflicts handles race conditions if multiple workers run this
    with transaction.atomic():
        created_goals = WeeklyGoal.objects.bulk_create(goals_to_create, ignore_conflicts=True)

    goals_created = len(created_goals)
    logger.info(f'Created {goals_created} weekly goals for {user_count} active users')
    return {'users': user_count, 'goals_created': goals_created}


@shared_task
def check_streak_bonuses():
    """
    Award streak bonuses for users who maintained their streak today.

    This task should run daily (end of day) to award streak bonus XP.
    Note: Streak tracking happens in add_xp(), this just awards the bonus.

    Includes error handling to continue processing all users even if some fail.
    """
    today = timezone.now().date()

    # Get users who have activity today - convert to list for caching
    active_today = list(UserTier.objects.filter(last_activity_date=today).select_related('user'))
    active_count = len(active_today)

    bonuses_awarded = 0
    total_xp_awarded = 0
    failed_awards = []

    for tier_status in active_today:
        try:
            # Award streak bonus XP based on current streak length
            if tier_status.current_streak_days > 0:
                # Cap streak bonus at 100 days to prevent abuse
                capped_streak = min(tier_status.current_streak_days, 100)
                bonus_xp = 5 * capped_streak

                # Use _skip_goal_check to prevent weekly goal checking for bonus awards
                tier_status.add_xp(
                    bonus_xp,
                    'streak_bonus',
                    f'{tier_status.current_streak_days}-day streak maintained!',
                    _skip_goal_check=True,  # Prevent recursion and unnecessary goal checks
                )
                bonuses_awarded += 1
                total_xp_awarded += bonus_xp
        except Exception as e:
            logger.error(
                f'Failed to award streak bonus for user {tier_status.user.username} (ID: {tier_status.user.id})',
                exc_info=True,
                extra={
                    'user_id': tier_status.user.id,
                    'current_streak': tier_status.current_streak_days,
                    'error': str(e),
                },
            )
            failed_awards.append(tier_status.user.id)
            continue  # Continue processing other users

    # Log results
    logger.info(
        f'Awarded streak bonuses: {bonuses_awarded} users received {total_xp_awarded} total XP',
        extra={
            'active_users': active_count,
            'bonuses_awarded': bonuses_awarded,
            'total_xp': total_xp_awarded,
            'failed': len(failed_awards),
        },
    )

    if failed_awards:
        logger.warning(f'Failed to award bonuses to {len(failed_awards)} users: {failed_awards}')

    return {
        'active_users': active_count,
        'bonuses_awarded': bonuses_awarded,
        'total_xp': total_xp_awarded,
        'failed': len(failed_awards),
        'failed_user_ids': failed_awards,
    }
