"""Celery tasks for the Thrive Circle gamification system."""

import logging
import random
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Circle, CircleChallenge, CircleMembership, WeeklyGoal
from .utils import get_week_start

User = get_user_model()
logger = logging.getLogger(__name__)

# Configuration for circle formation
CIRCLE_SIZE_TARGET = 25  # Ideal number of members per circle
CIRCLE_SIZE_MIN = 10  # Minimum members before merging with another circle
CIRCLE_SIZE_MAX = 35  # Maximum members per circle


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

    # Get all active users - convert to list to cache (exclude guests)
    active_users = list(User.objects.filter(is_active=True, is_guest=False))
    user_count = len(active_users)

    if user_count == 0:
        logger.info('No active users found')
        return {'users': 0, 'goals_created': 0}

    # Check existing goals for this week to avoid duplicates
    existing_goals = set(WeeklyGoal.objects.filter(week_start=week_start).values_list('user_id', 'goal_type'))

    # Goal configurations: (goal_type, target_progress, points_reward)
    goal_configs = [
        ('activities_3', 3, 30),
        ('streak_7', 7, 50),
        ('help_5', 5, 40),
        ('topics_2', 2, 25),
    ]

    # Prepare goals for bulk creation
    goals_to_create = []
    for user in active_users:
        for goal_type, target, points_reward in goal_configs:
            # Skip if goal already exists
            if (user.id, goal_type) not in existing_goals:
                goals_to_create.append(
                    WeeklyGoal(
                        user=user,
                        goal_type=goal_type,
                        week_start=week_start,
                        week_end=week_end,
                        target_progress=target,
                        points_reward=points_reward,
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

    This task should run daily (end of day) to award streak bonus points.
    Note: Streak tracking happens in add_points(), this just awards the bonus.

    Includes error handling to continue processing all users even if some fail.
    """
    today = timezone.now().date()

    # Get users who have activity today - convert to list for caching (exclude guests)
    active_today = list(User.objects.filter(last_activity_date=today, is_guest=False))
    active_count = len(active_today)

    bonuses_awarded = 0
    total_points_awarded = 0
    failed_awards = []

    for user in active_today:
        try:
            # Award streak bonus points based on current streak length
            if user.current_streak_days > 0:
                # Cap streak bonus at 100 days to prevent abuse
                capped_streak = min(user.current_streak_days, 100)
                bonus_points = 5 * capped_streak

                # Award points directly on user
                user.add_points(
                    bonus_points,
                    'streak_bonus',
                    f'{user.current_streak_days}-day streak maintained!',
                )
                bonuses_awarded += 1
                total_points_awarded += bonus_points
        except Exception as e:
            logger.error(
                f'Failed to award streak bonus for user {user.username} (ID: {user.id})',
                exc_info=True,
                extra={
                    'user_id': user.id,
                    'current_streak': user.current_streak_days,
                    'error': str(e),
                },
            )
            failed_awards.append(user.id)
            continue  # Continue processing other users

    # Log results
    logger.info(
        f'Awarded streak bonuses: {bonuses_awarded} users received {total_points_awarded} total points',
        extra={
            'active_users': active_count,
            'bonuses_awarded': bonuses_awarded,
            'total_points': total_points_awarded,
            'failed': len(failed_awards),
        },
    )

    if failed_awards:
        logger.warning(f'Failed to award bonuses to {len(failed_awards)} users: {failed_awards}')

    return {
        'active_users': active_count,
        'bonuses_awarded': bonuses_awarded,
        'total_points': total_points_awarded,
        'failed': len(failed_awards),
        'failed_user_ids': failed_awards,
    }


# =============================================================================
# Circle Formation Tasks
# =============================================================================

# Challenge configurations based on tier
# Format: (challenge_type, title, target, bonus_points, description)
# Higher tiers get slightly more ambitious challenges
CHALLENGE_CONFIGS = {
    'seedling': [
        ('create_projects', 'Create 10 projects', 10, 50, 'Every project you add moves your circle closer to the goal.'),
        ('give_feedback', 'Give feedback on 15 projects', 15, 40, 'Each comment or like you leave counts toward the goal.'),
    ],
    'sprout': [
        ('create_projects', 'Create 12 projects', 12, 60, 'Every project you add moves your circle closer to the goal.'),
        ('give_feedback', 'Give feedback on 20 projects', 20, 50, 'Each comment or like you leave counts toward the goal.'),
    ],
    'blossom': [
        ('create_projects', 'Create 15 projects', 15, 70, 'Every project you add moves your circle closer to the goal.'),
        ('complete_quests', 'Complete 20 side quests', 20, 60, 'Each quest you complete counts toward the goal.'),
    ],
    'bloom': [
        ('create_projects', 'Create 18 projects', 18, 80, 'Every project you add moves your circle closer to the goal.'),
        ('complete_quests', 'Complete 25 side quests', 25, 70, 'Each quest you complete counts toward the goal.'),
    ],
    'evergreen': [
        ('create_projects', 'Create 20 projects', 20, 100, 'Every project you add moves your circle closer to the goal.'),
        ('earn_points', 'Earn 5000 points', 5000, 100, 'Every point you earn counts toward the goal.'),
    ],
}


def _generate_circle_name(tier: str, circle_number: int) -> str:
    """Generate a fun name for a circle."""
    # Tier-themed adjectives
    tier_adjectives = {
        'seedling': ['Curious', 'Fresh', 'Eager', 'Bright', 'New'],
        'sprout': ['Growing', 'Reaching', 'Rising', 'Aspiring', 'Budding'],
        'blossom': ['Blooming', 'Flourishing', 'Vibrant', 'Thriving', 'Radiant'],
        'bloom': ['Brilliant', 'Luminous', 'Magnificent', 'Stellar', 'Dazzling'],
        'evergreen': ['Legendary', 'Timeless', 'Enduring', 'Wise', 'Eternal'],
    }

    # AI/Tech themed nouns
    nouns = [
        'Explorers',
        'Pioneers',
        'Creators',
        'Innovators',
        'Builders',
        'Dreamers',
        'Makers',
        'Thinkers',
        'Visionaries',
        'Catalysts',
    ]

    adjectives = tier_adjectives.get(tier, ['Amazing'])
    adj = random.choice(adjectives)  # noqa: S311
    noun = random.choice(nouns)  # noqa: S311

    return f'{adj} {noun} #{circle_number}'


@shared_task
def form_weekly_circles():
    """
    Form new circles for all users at the start of each week.

    This task should run every Monday at 00:00 (after create_weekly_goals).

    Algorithm:
    1. Deactivate previous week's circles
    2. Group all active users by tier
    3. Shuffle users within each tier (randomize groupings)
    4. Create circles of ~25 users within each tier
    5. Create a CircleChallenge for each new circle

    Uses bulk operations for performance at scale.
    """
    week_start = get_week_start()
    week_end = week_start + timedelta(days=6)

    logger.info(f'Starting circle formation for week {week_start} to {week_end}')

    # Deactivate previous circles
    previous_circles = Circle.objects.filter(is_active=True, week_end__lt=week_start)
    deactivated_count = previous_circles.update(is_active=False)
    logger.info(f'Deactivated {deactivated_count} previous circles')

    # Check if circles already exist for this week
    existing_circles = Circle.objects.filter(week_start=week_start).exists()
    if existing_circles:
        logger.warning(f'Circles already exist for week starting {week_start}, skipping formation')
        return {'status': 'skipped', 'reason': 'circles_exist'}

    # Get all active users grouped by tier (exclude 'curation' tier - AI agents)
    tiers = ['seedling', 'sprout', 'blossom', 'bloom', 'evergreen']
    users_by_tier = {}

    for tier in tiers:
        # Exclude guest users from circle formation
        users = list(User.objects.filter(is_active=True, is_guest=False, tier=tier).values_list('id', flat=True))
        random.shuffle(users)  # Randomize for fair distribution
        users_by_tier[tier] = users

    # Statistics tracking
    stats = {
        'circles_created': 0,
        'memberships_created': 0,
        'challenges_created': 0,
        'by_tier': {},
    }

    with transaction.atomic():
        circle_number = 1

        for tier in tiers:
            user_ids = users_by_tier[tier]
            tier_user_count = len(user_ids)

            if tier_user_count == 0:
                stats['by_tier'][tier] = {'users': 0, 'circles': 0}
                continue

            # Calculate optimal circle sizes
            # If we have 100 users and target is 25, we make 4 circles of 25
            # If we have 27 users, we make 1 circle of 27 (below max)
            # If we have 60 users, we make 2 circles of 30
            if tier_user_count <= CIRCLE_SIZE_MAX:
                # Small enough for one circle
                chunk_sizes = [tier_user_count]
            else:
                # Calculate number of circles needed
                num_circles = max(1, round(tier_user_count / CIRCLE_SIZE_TARGET))
                base_size = tier_user_count // num_circles
                remainder = tier_user_count % num_circles

                # Distribute users as evenly as possible
                chunk_sizes = []
                for i in range(num_circles):
                    size = base_size + (1 if i < remainder else 0)
                    chunk_sizes.append(size)

            # Create circles and memberships
            tier_circles = 0
            user_index = 0

            for chunk_size in chunk_sizes:
                # Get user IDs for this circle
                circle_user_ids = user_ids[user_index : user_index + chunk_size]
                user_index += chunk_size

                if not circle_user_ids:
                    continue

                # Create the circle
                circle = Circle.objects.create(
                    name=_generate_circle_name(tier, circle_number),
                    tier=tier,
                    week_start=week_start,
                    week_end=week_end,
                    member_count=len(circle_user_ids),
                    is_active=True,
                )

                # Create memberships in bulk
                memberships = [CircleMembership(user_id=user_id, circle=circle) for user_id in circle_user_ids]
                CircleMembership.objects.bulk_create(memberships)

                # Create circle challenge
                challenge_config = CHALLENGE_CONFIGS.get(tier, CHALLENGE_CONFIGS['seedling'])
                # Pick one challenge type for the week (could randomize or rotate)
                challenge_type, title, target, bonus_points, description = random.choice(challenge_config)  # noqa: S311

                CircleChallenge.objects.create(
                    circle=circle,
                    challenge_type=challenge_type,
                    title=title,
                    description=description,
                    target=target,
                    bonus_points=bonus_points,
                )

                tier_circles += 1
                circle_number += 1
                stats['circles_created'] += 1
                stats['memberships_created'] += len(circle_user_ids)
                stats['challenges_created'] += 1

            stats['by_tier'][tier] = {
                'users': tier_user_count,
                'circles': tier_circles,
            }

    logger.info(
        f'Circle formation complete: {stats["circles_created"]} circles, '
        f'{stats["memberships_created"]} memberships, '
        f'{stats["challenges_created"]} challenges'
    )

    return stats


@shared_task
def update_circle_activity_stats():
    """
    Update activity statistics for all active circles.

    This task should run daily to keep circle stats fresh.
    Updates member counts and active member counts.
    """
    active_circles = Circle.objects.filter(is_active=True)
    updated = 0

    for circle in active_circles:
        try:
            circle.update_member_counts()
            updated += 1
        except Exception as e:
            logger.error(f'Failed to update stats for circle {circle.id}: {e}')

    logger.info(f'Updated activity stats for {updated} circles')
    return {'circles_updated': updated}


@shared_task
def check_circle_challenge_completion():
    """
    Check and process completed circle challenges.

    This task should run periodically (e.g., every hour) to:
    1. Check if any challenges have reached their target
    2. Distribute rewards for completed challenges

    Note: Challenge progress is typically updated via signals when
    relevant actions occur (project creation, etc.), but this task
    serves as a backup to ensure no completions are missed.
    """
    # Find challenges that are complete but rewards not distributed
    completed_challenges = CircleChallenge.objects.filter(
        is_completed=True,
        rewards_distributed=False,
        circle__is_active=True,
    )

    distributed = 0
    for challenge in completed_challenges:
        try:
            challenge.distribute_rewards()
            distributed += 1
        except Exception as e:
            logger.error(f'Failed to distribute rewards for challenge {challenge.id}: {e}')

    if distributed > 0:
        logger.info(f'Distributed rewards for {distributed} completed circle challenges')

    return {'rewards_distributed': distributed}
