"""Signals for Learning Paths.

Update learning paths when quizzes or side quests are completed.
Also emits LearningEvents for the unified learning system.
Auto-creates ProjectLearningMetadata when projects are created.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.projects.models import Project
from core.quizzes.models import QuizAttempt
from core.thrive_circle.models import UserSideQuest

from .models import Concept, LearnerProfile, LearningEvent, ProjectLearningMetadata, UserConceptMastery

logger = logging.getLogger(__name__)


# ============================================================================
# PROJECT LEARNING METADATA SIGNAL
# ============================================================================


@receiver(post_save, sender=Project)
def create_project_learning_metadata(sender, instance, created, **kwargs):
    """Auto-create ProjectLearningMetadata when a new Project is created.

    This ensures all projects are learning-eligible by default.
    """
    if created:
        ProjectLearningMetadata.objects.get_or_create(project=instance, defaults={'is_learning_eligible': True})
        logger.debug(f'Created learning metadata for project {instance.id}')


@receiver(post_save, sender=QuizAttempt)
def update_learning_path_on_quiz_completion(sender, instance, created, **kwargs):
    """Update learning path when a quiz is completed."""
    # Only process completed quizzes
    if not instance.completed_at:
        return

    # Import here to avoid circular imports
    from services.gamification import LearningPathService

    try:
        service = LearningPathService()
        quiz = instance.quiz

        # Get topic from quiz - use the topic field or first topic in topics array
        topic = quiz.topic if quiz.topic else None
        if not topic and quiz.topics:
            topic = quiz.topics[0]

        if topic:
            # Map quiz topic to learning path topic if needed
            mapped_topic = service.map_quiz_topic_to_path_topic(topic)
            if mapped_topic:
                service.update_path_on_quiz_completion(user=instance.user, topic=mapped_topic, quiz_attempt=instance)
                logger.info(
                    f'Updated learning path for user {instance.user.username} '
                    f'in topic {mapped_topic} after quiz completion'
                )
    except Exception as e:
        logger.error(f'Error updating learning path on quiz completion: {e}')


@receiver(post_save, sender=UserSideQuest)
def update_learning_path_on_sidequest_completion(sender, instance, **kwargs):
    """Update learning path when a side quest is completed."""
    # Only process completed side quests
    if not instance.is_completed:
        return

    # Import here to avoid circular imports
    from services.gamification import LearningPathService

    try:
        side_quest = instance.side_quest
        topic = side_quest.topic

        # Only update if side quest has a topic
        if topic:
            service = LearningPathService()
            service.update_path_on_sidequest_completion(user=instance.user, topic=topic, user_sidequest=instance)
            logger.info(
                f'Updated learning path for user {instance.user.username} in topic {topic} after side quest completion'
            )
    except Exception as e:
        logger.error(f'Error updating learning path on side quest completion: {e}')


# ============================================================================
# NEW LEARNING EVENT SIGNALS
# ============================================================================


@receiver(post_save, sender=QuizAttempt)
def emit_learning_event_on_quiz_completion(sender, instance, created, **kwargs):
    """
    Emit a LearningEvent when a quiz is completed.
    This feeds into the unified learning system for Ember.
    """
    # Only process completed quizzes
    if not instance.completed_at:
        return

    try:
        quiz = instance.quiz
        user = instance.user

        # Calculate XP based on score
        percentage = instance.percentage_score
        if percentage >= 90:
            xp = 50
        elif percentage >= 70:
            xp = 30
        elif percentage >= 50:
            xp = 15
        else:
            xp = 5

        # Find related concept based on quiz topic
        concept = None
        topic = quiz.topic if quiz.topic else None
        if not topic and quiz.topics:
            topic = quiz.topics[0]

        if topic:
            # Try to find a concept that matches this topic
            concept = Concept.objects.filter(topic=topic, is_active=True).first()

        # Create the learning event (use 'quiz_completed' to match EVENT_TYPE_CHOICES)
        LearningEvent.objects.create(
            user=user,
            event_type='quiz_completed',
            concept=concept,
            was_successful=percentage >= 70,  # Consider 70%+ as successful
            xp_earned=xp,
            payload={
                'quiz_id': str(quiz.id),
                'quiz_title': quiz.title,
                'quiz_slug': quiz.slug,
                'score': instance.score,
                'total_questions': instance.total_questions,
                'percentage_score': percentage,
                'topic': topic,
            },
        )

        logger.info(
            f'Created learning event for quiz completion: user={user.username}, '
            f'quiz={quiz.slug}, score={percentage}%, xp={xp}'
        )

        # Update concept mastery if concept found
        if concept:
            _update_concept_mastery_from_quiz(user, concept, percentage)

        # Update learner profile stats
        _update_learner_profile_quiz_stats(user)

    except Exception as e:
        logger.error(f'Error emitting learning event on quiz completion: {e}', exc_info=True)


def _update_concept_mastery_from_quiz(user, concept, percentage):
    """Update user's concept mastery based on quiz performance."""
    try:
        mastery, created = UserConceptMastery.objects.get_or_create(
            user=user,
            concept=concept,
        )

        # Record the practice
        mastery.times_practiced += 1

        if percentage >= 70:
            mastery.times_correct += 1
            mastery.consecutive_correct += 1
            mastery.consecutive_incorrect = 0
        else:
            mastery.times_incorrect += 1
            mastery.consecutive_incorrect += 1
            mastery.consecutive_correct = 0

        # Update mastery score (simple weighted average with recency bias)
        weight = 0.3  # Weight for new result
        new_score = percentage / 100.0
        mastery.mastery_score = (1 - weight) * mastery.mastery_score + weight * new_score

        # Update mastery level based on score
        if mastery.mastery_score >= 0.9:
            mastery.mastery_level = 'expert'
        elif mastery.mastery_score >= 0.7:
            mastery.mastery_level = 'proficient'
        elif mastery.mastery_score >= 0.5:
            mastery.mastery_level = 'learning'
        elif mastery.mastery_score >= 0.2:
            mastery.mastery_level = 'aware'
        else:
            mastery.mastery_level = 'unknown'

        # Calculate next review using spaced repetition
        from datetime import timedelta

        from django.utils import timezone

        if mastery.consecutive_correct >= 5:
            days_until_review = 30
        elif mastery.consecutive_correct >= 3:
            days_until_review = 14
        elif mastery.consecutive_correct >= 1:
            days_until_review = 7
        else:
            days_until_review = 1  # Review soon if struggling

        mastery.next_review_at = timezone.now() + timedelta(days=days_until_review)
        mastery.last_practiced = timezone.now()
        mastery.save()

        logger.debug(
            f'Updated concept mastery: user={user.username}, concept={concept.slug}, '
            f'level={mastery.mastery_level}, score={mastery.mastery_score:.2f}'
        )

    except Exception as e:
        logger.error(f'Error updating concept mastery: {e}', exc_info=True)


def _update_learner_profile_quiz_stats(user):
    """Update learner profile quiz statistics."""
    try:
        from django.utils import timezone

        profile, created = LearnerProfile.objects.get_or_create(user=user)
        today = timezone.now().date()

        # Update streak BEFORE changing last_learning_activity
        if not created and profile.last_learning_activity:
            last_activity_date = profile.last_learning_activity.date()
            days_diff = (today - last_activity_date).days

            if days_diff == 1:
                # Consecutive day - extend streak
                profile.learning_streak_days += 1
                profile.longest_streak_days = max(profile.longest_streak_days, profile.learning_streak_days)
            elif days_diff > 1:
                # Streak broken
                profile.learning_streak_days = 1
            # If same day (days_diff == 0), don't change streak
        elif created or not profile.last_learning_activity:
            # First activity
            profile.learning_streak_days = 1

        # Now update the activity timestamp and quiz count
        profile.total_quizzes_completed += 1
        profile.last_learning_activity = timezone.now()
        profile.save()

    except Exception as e:
        logger.error(f'Error updating learner profile quiz stats: {e}', exc_info=True)
