"""
Django signals for auto-tracking quest progress.

These signals listen for model events and automatically update
quest progress for users who have relevant active quests.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.agents.models import ImageGenerationSession
from core.projects.models import Project, ProjectComment, ProjectLike
from core.quizzes.models import QuizAttempt

from .quest_tracker import track_quest_action

logger = logging.getLogger(__name__)


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
