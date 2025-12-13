"""
Django signals for auto-tracking quest progress.

These signals listen for model events and automatically update
quest progress for users who have relevant active quests.
"""

import logging

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.agents.models import ImageGenerationSession
from core.projects.models import Project, ProjectComment, ProjectLike
from core.quizzes.models import QuizAttempt

from .models import Circle, CircleMembership
from .quest_tracker import track_quest_action
from .utils import get_week_start

logger = logging.getLogger(__name__)

# Maximum circle size before we don't add more members
CIRCLE_SIZE_MAX = 35


def _validate_signal_preconditions(instance, created, check_created=True):
    """Helper to validate common signal preconditions."""
    if check_created and not created:
        return None

    user = instance.user
    if not user:
        return None

    return user


def _log_completion(action_type, user_id, completed):
    """Helper to log quest completion."""
    if completed:
        logger.info(f'{action_type} triggered quest completion for user {user_id}: {completed}')


@receiver(post_save, sender=ProjectComment)
def track_comment_created(sender, instance, created, **kwargs):
    """Track when a user creates a comment on a project."""
    user = _validate_signal_preconditions(instance, created)
    if not user:
        return

    # Don't track comments on own projects
    if instance.project.user == user:
        return

    # Award points for commenting on others' projects
    user.add_points(
        amount=5,
        activity_type='comment',
        description=f'Commented on: {instance.project.title[:50]}',
    )

    completed = track_quest_action(
        user,
        'comment_created',
        {
            'project_id': instance.project.id,
            'comment_id': instance.id,
        },
    )

    _log_completion('Comment', user.id, completed)


@receiver(post_save, sender=Project)
def track_project_created(sender, instance, created, **kwargs):
    """Track when a user creates a project."""
    user = _validate_signal_preconditions(instance, created)
    if not user:
        return

    # Award points for creating a project
    user.add_points(
        amount=15,
        activity_type='project_create',
        description=f'Created project: {instance.title[:50]}',
    )

    completed = track_quest_action(
        user,
        'project_created',
        {
            'project_id': instance.id,
            'project_type': instance.type,
        },
    )

    _log_completion('Project creation', user.id, completed)


@receiver(post_save, sender=ProjectLike)
def track_project_liked(sender, instance, created, **kwargs):
    """Track when a user likes a project."""
    user = _validate_signal_preconditions(instance, created)
    if not user:
        return

    # Don't track liking own projects
    if instance.project.user == user:
        return

    # Award points for liking others' projects
    user.add_points(
        amount=2,
        activity_type='reaction',
        description=f'Liked: {instance.project.title[:50]}',
    )

    completed = track_quest_action(
        user,
        'project_liked',
        {
            'project_id': instance.project.id,
        },
    )

    _log_completion('Project like', user.id, completed)


@receiver(post_save, sender=QuizAttempt)
def track_quiz_completed(sender, instance, created, **kwargs):
    """Track when a user completes a quiz."""
    # Only track completed quizzes
    if not instance.completed_at:
        return

    user = _validate_signal_preconditions(instance, created, check_created=False)
    if not user:
        return

    # IDEMPOTENCY: Only track on first completion (when completed_at is newly set)
    # Check if this is an update where completed_at was just set
    if not created:
        # Use a cache key to prevent duplicate processing
        from django.core.cache import cache

        cache_key = f'quiz_tracked_{instance.pk}'
        if cache.get(cache_key):
            return  # Already tracked
        cache.set(cache_key, True, timeout=60)  # Prevent duplicate tracking for 60 seconds

    # Calculate score
    score = instance.percentage_score if hasattr(instance, 'percentage_score') else 0

    # Track basic completion
    completed = track_quest_action(
        user,
        'quiz_completed',
        {
            'quiz_id': instance.quiz.id,
            'score': score,
            'topic': instance.quiz.topic if hasattr(instance.quiz, 'topic') else None,
        },
    )

    # Track perfect score separately
    if score >= 100:
        perfect_completed = track_quest_action(
            user,
            'quiz_perfect',
            {
                'quiz_id': instance.quiz.id,
                'score': score,
            },
        )
        completed.extend(perfect_completed)

    _log_completion('Quiz completion', user.id, completed)


@receiver(post_save, sender=ImageGenerationSession)
def track_image_generated(sender, instance, created, **kwargs):
    """Track when a user generates an image with Nano Banana."""
    if not instance.final_image_url:
        return  # No image generated yet

    user = _validate_signal_preconditions(instance, created, check_created=False)
    if not user:
        return

    completed = track_quest_action(
        user,
        'image_generated',
        {
            'session_id': instance.id,
            'iteration_count': instance.iteration_count if hasattr(instance, 'iteration_count') else 1,
        },
    )

    _log_completion('Image generation', user.id, completed)


def track_user_login(user):
    """
    Track daily login for quest progress and award daily login bonus.

    Call this from your login view or authentication backend.

    Usage:
        from core.thrive_circle.signals import track_user_login
        track_user_login(request.user)
    """
    from django.core.cache import cache
    from django.utils import timezone

    from .quest_tracker import QuestTracker

    # Only award daily login points once per day
    today = timezone.now().date()
    cache_key = f'daily_login_points_{user.id}_{today}'

    if not cache.get(cache_key):
        # Award daily login bonus
        user.add_points(
            amount=5,
            activity_type='daily_login',
            description='Daily login bonus',
        )
        # Set cache for 24 hours to prevent duplicate awards
        cache.set(cache_key, True, timeout=86400)
        logger.info(f'Daily login bonus awarded to user {user.id}')

    # Track the login action for quests
    completed = track_quest_action(user, 'daily_login', {})

    # Auto-start daily quests for the user
    QuestTracker.auto_start_daily_quests(user)

    _log_completion('Login', user.id, completed)

    return completed


def track_search_used(user, query: str = ''):
    """
    Track when a user uses semantic search.

    Call this from your search view.

    Usage:
        from core.thrive_circle.signals import track_search_used
        track_search_used(request.user, query='AI project ideas')
    """
    completed = track_quest_action(
        user,
        'search_used',
        {
            'query': query,
        },
    )

    _log_completion('Search', user.id, completed)

    return completed


def track_profile_viewed(user, viewed_user):
    """
    Track when a user views another user's profile.

    Call this from your profile view.

    Usage:
        from core.thrive_circle.signals import track_profile_viewed
        track_profile_viewed(request.user, viewed_user=profile_user)
    """
    if user == viewed_user:
        return []  # Don't track viewing own profile

    completed = track_quest_action(
        user,
        'profile_viewed',
        {
            'viewed_user_id': viewed_user.id,
        },
    )

    _log_completion('Profile view', user.id, completed)

    return completed


def track_github_imported(user, repo_url: str = ''):
    """
    Track when a user imports a GitHub repository.

    Call this from your GitHub import handler.

    Usage:
        from core.thrive_circle.signals import track_github_imported
        track_github_imported(request.user, repo_url='https://github.com/user/repo')
    """
    completed = track_quest_action(
        user,
        'github_imported',
        {
            'repo_url': repo_url,
        },
    )

    _log_completion('GitHub import', user.id, completed)

    return completed


def track_page_visited(user, page_path: str = '', page_name: str = ''):
    """
    Track when a user visits a specific page (for guided quests).

    Call this from your page views or frontend tracking.

    Usage:
        from core.thrive_circle.signals import track_page_visited
        track_page_visited(request.user, page_path='/explore', page_name='Explore')
    """
    completed = track_quest_action(
        user,
        'page_visited',
        {
            'page_path': page_path,
            'page_name': page_name,
        },
    )

    _log_completion('Page visit', user.id, completed)

    return completed


def track_description_added(user, project):
    """
    Track when a user adds a description to their project.

    Call this from your project update handler.

    Usage:
        from core.thrive_circle.signals import track_description_added
        track_description_added(request.user, project)
    """
    # Only track if description was actually added (non-empty)
    if not project.description or len(project.description.strip()) < 20:
        return []

    completed = track_quest_action(
        user,
        'description_added',
        {
            'project_id': project.id,
            'description_length': len(project.description),
        },
    )

    _log_completion('Description added', user.id, completed)

    return completed


def track_feedback_given(user, project, feedback_type: str = 'constructive'):
    """
    Track when a user provides feedback on a project.

    Call this when detecting feedback-style comments.

    Usage:
        from core.thrive_circle.signals import track_feedback_given
        track_feedback_given(request.user, project, feedback_type='constructive')
    """
    # Don't track feedback on own projects
    if project.user == user:
        return []

    completed = track_quest_action(
        user,
        'feedback_given',
        {
            'project_id': project.id,
            'feedback_type': feedback_type,
        },
    )

    _log_completion('Feedback given', user.id, completed)

    return completed


def add_user_to_circle(user):
    """
    Add a user to an existing circle for the current week.

    Called when a new user signs up to immediately include them in a circle,
    rather than waiting until the next weekly circle formation on Monday.

    Returns the circle the user was added to, or None if no suitable circle found.
    """
    from django.db.models import Count

    # Skip curation tier (AI agents)
    if user.tier == 'curation':
        logger.debug(f'Skipping circle assignment for curation tier user {user.id}')
        return None

    week_start = get_week_start()

    # Check if user already in a circle this week
    existing_membership = CircleMembership.objects.filter(
        user=user,
        circle__week_start=week_start,
        circle__is_active=True,
    ).first()

    if existing_membership:
        logger.debug(f'User {user.id} already in circle {existing_membership.circle.id}')
        return existing_membership.circle

    # Find an active circle in the user's tier with room (<CIRCLE_SIZE_MAX members)
    # Prefer circles with fewer members to balance sizes
    circles_with_counts = (
        Circle.objects.filter(
            week_start=week_start,
            is_active=True,
            tier=user.tier,
        )
        .annotate(current_member_count=Count('memberships'))
        .filter(current_member_count__lt=CIRCLE_SIZE_MAX)
        .order_by('current_member_count')
    )

    circle = circles_with_counts.first()

    if not circle:
        # No suitable circle found - this happens if:
        # 1. No circles exist for this week yet (before Monday formation)
        # 2. All circles in this tier are full
        logger.info(f'No suitable circle found for user {user.id} (tier: {user.tier})')
        return None

    # Add user to the circle
    CircleMembership.objects.create(
        user=user,
        circle=circle,
    )

    logger.info(f'Added user {user.id} to circle {circle.id} ({circle.name})')
    return circle


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def assign_new_user_to_circle(sender, instance, created, **kwargs):
    """
    Automatically add newly created users to an existing circle.

    This ensures new users are immediately part of the community rather than
    waiting until the next weekly circle formation on Monday.
    """
    if not created:
        return

    if not instance.is_active:
        return

    try:
        circle = add_user_to_circle(instance)
        if circle:
            logger.info(f'New user {instance.id} assigned to circle {circle.id}')
    except Exception as e:
        # Don't let circle assignment failure prevent user creation
        logger.error(f'Failed to assign new user {instance.id} to circle: {e}')
