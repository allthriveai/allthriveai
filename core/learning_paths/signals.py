"""Signals for Learning Paths.

Update learning paths when quizzes or side quests are completed.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.quizzes.models import QuizAttempt
from core.thrive_circle.models import UserSideQuest

logger = logging.getLogger(__name__)


@receiver(post_save, sender=QuizAttempt)
def update_learning_path_on_quiz_completion(sender, instance, created, **kwargs):
    """Update learning path when a quiz is completed."""
    # Only process completed quizzes
    if not instance.completed_at:
        return

    # Import here to avoid circular imports
    from services.learning_path_service import LearningPathService

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
    from services.learning_path_service import LearningPathService

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
