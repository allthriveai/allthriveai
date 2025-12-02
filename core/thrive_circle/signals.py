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


@receiver(post_save, sender=ProjectComment)
def track_comment_created(sender, instance, created, **kwargs):
    """Track when a user creates a comment on a project."""
    if not created:
        return

    user = instance.user
    if not user:
        return

    # Don't track comments on own projects
    if instance.project.user == user:
        return

    completed = track_quest_action(
        user,
        'comment_created',
        {
            'project_id': instance.project.id,
            'comment_id': instance.id,
        },
    )

    if completed:
        logger.info(f'Comment triggered quest completion for user {user.id}: {completed}')


@receiver(post_save, sender=Project)
def track_project_created(sender, instance, created, **kwargs):
    """Track when a user creates a project."""
    if not created:
        return

    user = instance.user
    if not user:
        return

    completed = track_quest_action(
        user,
        'project_created',
        {
            'project_id': instance.id,
            'project_type': instance.type,
        },
    )

    if completed:
        logger.info(f'Project creation triggered quest completion for user {user.id}: {completed}')


@receiver(post_save, sender=ProjectLike)
def track_project_liked(sender, instance, created, **kwargs):
    """Track when a user likes a project."""
    if not created:
        return

    user = instance.user
    if not user:
        return

    # Don't track liking own projects
    if instance.project.user == user:
        return

    completed = track_quest_action(
        user,
        'project_liked',
        {
            'project_id': instance.project.id,
        },
    )

    if completed:
        logger.info(f'Project like triggered quest completion for user {user.id}: {completed}')


@receiver(post_save, sender=QuizAttempt)
def track_quiz_completed(sender, instance, created, **kwargs):
    """Track when a user completes a quiz."""
    # Only track completed quizzes
    if not instance.completed_at:
        return

    user = instance.user
    if not user:
        return

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

    if completed:
        logger.info(f'Quiz completion triggered quest completion for user {user.id}: {completed}')


@receiver(post_save, sender=ImageGenerationSession)
def track_image_generated(sender, instance, created, **kwargs):
    """Track when a user generates an image with Nano Banana."""
    if not instance.final_image_url:
        return  # No image generated yet

    user = instance.user
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

    if completed:
        logger.info(f'Image generation triggered quest completion for user {user.id}: {completed}')


def track_user_login(user):
    """
    Track daily login for quest progress.

    Call this from your login view or authentication backend.

    Usage:
        from core.thrive_circle.signals import track_user_login
        track_user_login(request.user)
    """
    from .quest_tracker import QuestTracker

    # Track the login action
    completed = track_quest_action(user, 'daily_login', {})

    # Auto-start daily quests for the user
    QuestTracker.auto_start_daily_quests(user)

    if completed:
        logger.info(f'Login triggered quest completion for user {user.id}: {completed}')

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

    if completed:
        logger.info(f'Search triggered quest completion for user {user.id}: {completed}')

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

    if completed:
        logger.info(f'Profile view triggered quest completion for user {user.id}: {completed}')

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

    if completed:
        logger.info(f'GitHub import triggered quest completion for user {user.id}: {completed}')

    return completed
