"""
Proactive Triggers for Learning System.

When Ava should proactively engage about learning.
Triggers are evaluated by Celery tasks and push messages via WebSocket
to the frontend, where Ava can display contextual nudges.
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)


class ProactiveTriggers:
    """
    System for proactively engaging users about learning opportunities.

    Triggers are evaluated based on user activity and push messages
    via WebSocket to show contextual nudges in the UI.
    """

    TRIGGER_TYPES = {
        'skill_learned': {'cooldown': 0, 'priority': 10},  # Immediate celebration
        'quiz_completed': {'cooldown': 0, 'priority': 9},  # Immediate next step
        'tool_viewed': {'cooldown': 600, 'priority': 5},  # 10 min cooldown
        'project_viewed': {'cooldown': 600, 'priority': 5},  # 10 min cooldown
        'streak_milestone': {'cooldown': 86400, 'priority': 8},  # 24hr cooldown
        'review_due': {'cooldown': 3600, 'priority': 4},  # 1hr cooldown
    }

    @classmethod
    async def should_send_nudge(cls, user_id: int, trigger_type: str) -> bool:
        """
        Check if we should send a nudge based on cooldowns and user preferences.

        Args:
            user_id: The user to check
            trigger_type: Type of trigger (from TRIGGER_TYPES)

        Returns:
            True if nudge should be sent, False otherwise
        """

        try:
            # Get user's learner profile
            profile = await cls._get_profile(user_id)
            if not profile:
                return False

            # Check if proactive suggestions are enabled
            if not profile.allow_proactive_suggestions:
                return False

            # Check cooldown
            trigger_config = cls.TRIGGER_TYPES.get(trigger_type)
            if not trigger_config:
                return False

            cooldown_seconds = trigger_config.get('cooldown', 0)
            if cooldown_seconds > 0:
                # Check last nudge time (not learning activity time)
                proactive_cooldown_minutes = profile.proactive_cooldown_minutes or 30
                min_time_between = max(cooldown_seconds, proactive_cooldown_minutes * 60)

                if profile.last_proactive_nudge:
                    time_since_last = (timezone.now() - profile.last_proactive_nudge).total_seconds()
                    if time_since_last < min_time_between:
                        logger.debug(
                            f'Skipping nudge for user {user_id}: cooldown not elapsed '
                            f'({time_since_last}s < {min_time_between}s)'
                        )
                        return False

            return True

        except Exception as e:
            logger.error(f'Error checking nudge eligibility: {e}', exc_info=True)
            return False

    @classmethod
    async def _get_profile(cls, user_id: int):
        """Get learner profile asynchronously."""
        from asgiref.sync import sync_to_async

        from core.learning_paths.models import LearnerProfile

        @sync_to_async
        def get_profile():
            try:
                return LearnerProfile.objects.get(user_id=user_id)
            except LearnerProfile.DoesNotExist:
                return None

        return await get_profile()

    @classmethod
    async def generate_nudge(cls, user_id: int, trigger_type: str, context: dict = None) -> dict | None:
        """
        Generate a nudge message based on trigger type and context.

        Args:
            user_id: The user to generate nudge for
            trigger_type: Type of trigger
            context: Additional context (e.g., project viewed, quiz completed)

        Returns:
            Nudge dict with message, action_url, etc. or None if no nudge needed
        """
        context = context or {}

        if not await cls.should_send_nudge(user_id, trigger_type):
            return None

        nudge = None

        if trigger_type == 'skill_learned':
            concept_name = context.get('concept_name', 'a new skill')
            nudge = {
                'type': 'celebration',
                'message': f"🎉 You just learned about {concept_name}! That's awesome!",
                'action_label': 'See Your Progress',
                'action_url': '/learn',
            }

        elif trigger_type == 'quiz_completed':
            score = context.get('score', 0)
            topic = context.get('topic', 'AI')
            if score >= 80:
                nudge = {
                    'type': 'celebration',
                    'message': f"Great job on the quiz! {score}% - you're crushing it!",
                    'action_label': 'Try Another Quiz',
                    'action_url': '/quizzes',
                }
            else:
                nudge = {
                    'type': 'encouragement',
                    'message': f'Nice effort! Want to review some {topic} concepts?',
                    'action_label': 'Review Concepts',
                    'action_url': '/learn',
                }

        elif trigger_type == 'tool_viewed':
            tool_name = context.get('tool_name', 'this tool')
            nudge = {
                'type': 'nudge',
                'message': f"I noticed you're checking out {tool_name}. Want to learn how people are using it?",
                'action_label': 'See Projects',
                'action_url': f'/tools/{context.get("tool_slug", "")}',
            }

        elif trigger_type == 'project_viewed':
            concept = context.get('primary_concept', 'AI concepts')
            nudge = {
                'type': 'nudge',
                'message': f'This project uses {concept}. Want me to explain how it works?',
                'action_label': 'Learn More',
                'action_url': None,  # Opens chat
            }

        elif trigger_type == 'streak_milestone':
            streak_days = context.get('streak_days', 1)
            nudge = {
                'type': 'celebration',
                'message': f"🔥 {streak_days}-day learning streak! You're building an amazing habit!",
                'action_label': 'Keep Going',
                'action_url': '/learn',
            }

        elif trigger_type == 'review_due':
            concept_count = context.get('concept_count', 1)
            nudge = {
                'type': 'nudge',
                'message': (
                    f'You have {concept_count} concept(s) ready for a quick review. '
                    '5 minutes to reinforce your knowledge!'
                ),
                'action_label': 'Start Review',
                'action_url': '/learn',
            }

        if nudge:
            nudge['trigger_type'] = trigger_type
            nudge['user_id'] = user_id
            nudge['generated_at'] = timezone.now().isoformat()

        return nudge

    @classmethod
    async def send_nudge_via_websocket(cls, user_id: int, nudge: dict) -> bool:
        """
        Push nudge to user's active WebSocket connection.

        Args:
            user_id: The user to send to
            nudge: The nudge dict to send

        Returns:
            True if sent successfully, False otherwise
        """
        from channels.layers import get_channel_layer

        try:
            channel_layer = get_channel_layer()
            if not channel_layer:
                logger.warning('No channel layer available for WebSocket push')
                return False

            # Send to user's personal channel group
            await channel_layer.group_send(
                f'learning_nudges_{user_id}',
                {
                    'type': 'learning.nudge',
                    'nudge': nudge,
                },
            )

            logger.info(f'Sent learning nudge to user {user_id}: {nudge.get("type")}')
            return True

        except Exception as e:
            logger.error(f'Error sending nudge via WebSocket: {e}', exc_info=True)
            return False


# Celery task helpers (to be called from tasks.py)


async def trigger_skill_learned_celebration(user_id: int, concept_name: str):
    """Trigger a celebration when user learns a new skill."""
    nudge = await ProactiveTriggers.generate_nudge(
        user_id=user_id,
        trigger_type='skill_learned',
        context={'concept_name': concept_name},
    )
    if nudge:
        await ProactiveTriggers.send_nudge_via_websocket(user_id, nudge)


async def trigger_quiz_completion_nudge(user_id: int, score: int, topic: str):
    """Trigger a nudge after quiz completion."""
    nudge = await ProactiveTriggers.generate_nudge(
        user_id=user_id,
        trigger_type='quiz_completed',
        context={'score': score, 'topic': topic},
    )
    if nudge:
        await ProactiveTriggers.send_nudge_via_websocket(user_id, nudge)


async def trigger_review_reminder(user_id: int, concept_count: int):
    """Trigger a reminder about concepts due for review."""
    nudge = await ProactiveTriggers.generate_nudge(
        user_id=user_id,
        trigger_type='review_due',
        context={'concept_count': concept_count},
    )
    if nudge:
        await ProactiveTriggers.send_nudge_via_websocket(user_id, nudge)


async def check_and_celebrate_streak(user_id: int, streak_days: int):
    """Celebrate streak milestones (7 days, 30 days, etc.)."""
    milestone_days = [7, 14, 30, 60, 100, 365]
    if streak_days in milestone_days:
        nudge = await ProactiveTriggers.generate_nudge(
            user_id=user_id,
            trigger_type='streak_milestone',
            context={'streak_days': streak_days},
        )
        if nudge:
            await ProactiveTriggers.send_nudge_via_websocket(user_id, nudge)
