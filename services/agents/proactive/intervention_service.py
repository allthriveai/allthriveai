"""
Proactive Intervention Service.

Determines when and how to gently offer help to users who are struggling.
Respects user preferences and implements cooldown periods to avoid
being annoying.

Interventions are "gentle offers" like:
- "Would you like me to explain this differently?"
- "It might help to understand X first. Want me to cover that?"
"""

import logging
from typing import TypedDict

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


# Cache settings for intervention cooldowns
INTERVENTION_COOLDOWN_CACHE_PREFIX = 'intervention_cooldown:'
INTERVENTION_COOLDOWN_SECONDS = 300  # 5 minutes between interventions


class ProactiveOffer(TypedDict):
    """A proactive intervention offer."""

    intervention_type: str  # simplify_explanation, suggest_prerequisite, offer_example, offer_break
    message_hint: str  # Suggested phrasing for the agent
    context_prefix: str  # Context to add to system prompt
    topic: str | None
    concept: str | None


class ProactiveInterventionService:
    """
    Determines when and how to proactively offer help.

    Checks:
    - User has allow_proactive_suggestions = True (LearnerProfile)
    - Cooldown period has passed since last intervention
    - Struggle confidence is high enough
    """

    # Minimum struggle confidence to trigger intervention
    MIN_STRUGGLE_CONFIDENCE = 0.6

    # Intervention templates
    INTERVENTIONS = {
        'simplify_explanation': {
            'message_hint': 'I notice this might be tricky. Would you like me to explain it differently?',
            'context_prefix': (
                'The user may be confused about the current topic. '
                'Consider acknowledging this gently and offering a simpler explanation. '
                'Use analogies or break down the concept into smaller steps.'
            ),
        },
        'suggest_prerequisite': {
            'message_hint': (
                'Before diving deeper, it might help to understand some foundational concepts first. '
                'Would you like me to cover those?'
            ),
            'context_prefix': (
                'The user may be missing prerequisite knowledge. '
                'Gently suggest foundational learning without making them feel bad. '
                'Offer to explain the prerequisites in a supportive way.'
            ),
        },
        'offer_example': {
            'message_hint': 'Would a practical example help clarify this?',
            'context_prefix': (
                'The user seems to be asking rapid questions. '
                'A concrete example might help solidify understanding. '
                'Offer to show a practical demonstration.'
            ),
        },
        'offer_break': {
            'message_hint': (
                'This is complex stuff! Would you like to take a short break '
                'and come back to it, or shall we try a different approach?'
            ),
            'context_prefix': (
                'The user may be frustrated. Acknowledge their effort and suggest either '
                'a break or a completely different approach. Be empathetic and supportive.'
            ),
        },
        'offer_help': {
            'message_hint': "I'm here to help! What part is giving you the most trouble?",
            'context_prefix': (
                "The user may need assistance. Ask what specifically they're stuck on "
                'so you can provide targeted help.'
            ),
        },
    }

    def __init__(self):
        pass

    def should_intervene(
        self,
        user_id: int,
        struggle_data: dict | None,
        member_context: dict | None = None,
    ) -> ProactiveOffer | None:
        """
        Determine if we should proactively intervene.

        Args:
            user_id: User ID
            struggle_data: StruggleSignal from StrugglePatternDetector
            member_context: Optional MemberContext

        Returns:
            ProactiveOffer if intervention is appropriate, else None
        """
        if not struggle_data:
            return None

        # Check struggle confidence threshold
        confidence = struggle_data.get('confidence', 0)
        if confidence < self.MIN_STRUGGLE_CONFIDENCE:
            logger.debug(
                f'Struggle confidence {confidence} below threshold {self.MIN_STRUGGLE_CONFIDENCE}, '
                f'skipping intervention'
            )
            return None

        # Check if user allows proactive suggestions
        if not self._user_allows_proactive(user_id, member_context):
            logger.debug(f'User {user_id} has disabled proactive suggestions')
            return None

        # Check cooldown
        if self._is_on_cooldown(user_id):
            logger.debug(f'User {user_id} is on intervention cooldown')
            return None

        # Get intervention type from struggle data
        intervention_type = struggle_data.get('suggested_intervention', 'offer_help')
        if intervention_type not in self.INTERVENTIONS:
            intervention_type = 'offer_help'

        intervention_template = self.INTERVENTIONS[intervention_type]

        # Set cooldown for this user
        self._set_cooldown(user_id)

        # Build the offer
        offer: ProactiveOffer = {
            'intervention_type': intervention_type,
            'message_hint': intervention_template['message_hint'],
            'context_prefix': intervention_template['context_prefix'],
            'topic': struggle_data.get('topic'),
            'concept': struggle_data.get('concept'),
        }

        logger.info(
            f'Triggering proactive intervention for user {user_id}: '
            f'type={intervention_type}, confidence={confidence}'
        )

        return offer

    async def should_intervene_async(
        self,
        user_id: int,
        struggle_data: dict | None,
        member_context: dict | None = None,
    ) -> ProactiveOffer | None:
        """Async version of should_intervene."""
        from asgiref.sync import sync_to_async

        return await sync_to_async(self.should_intervene)(user_id, struggle_data, member_context)

    def clear_cooldown(self, user_id: int) -> None:
        """Clear the intervention cooldown for a user (e.g., after they accept help)."""
        cache_key = f'{INTERVENTION_COOLDOWN_CACHE_PREFIX}{user_id}'
        cache.delete(cache_key)
        logger.debug(f'Cleared intervention cooldown for user {user_id}')

    def _user_allows_proactive(self, user_id: int, member_context: dict | None) -> bool:
        """Check if user allows proactive suggestions."""
        # First try to get from member context (faster)
        if member_context:
            learning = member_context.get('learning', {})
            # Default to True if not explicitly set
            if learning.get('allow_proactive_suggestions') is False:
                return False

        # Fall back to database check
        try:
            from core.learning_paths.models import LearnerProfile

            profile = LearnerProfile.objects.filter(user_id=user_id).only('allow_proactive_suggestions').first()
            if profile:
                return profile.allow_proactive_suggestions
        except Exception as e:
            logger.warning(f'Error checking proactive preference: {e}')

        # Default to True - most users appreciate gentle help
        return True

    def _is_on_cooldown(self, user_id: int) -> bool:
        """Check if user is on intervention cooldown."""
        cache_key = f'{INTERVENTION_COOLDOWN_CACHE_PREFIX}{user_id}'
        return cache.get(cache_key) is not None

    def _set_cooldown(self, user_id: int) -> None:
        """Set intervention cooldown for user."""
        cache_key = f'{INTERVENTION_COOLDOWN_CACHE_PREFIX}{user_id}'
        cache.set(cache_key, timezone.now().isoformat(), timeout=INTERVENTION_COOLDOWN_SECONDS)

    def get_intervention_template(self, intervention_type: str) -> dict:
        """Get the intervention template for a given type."""
        return self.INTERVENTIONS.get(intervention_type, self.INTERVENTIONS['offer_help'])


# Singleton instance
_intervention_service: ProactiveInterventionService | None = None


def get_intervention_service() -> ProactiveInterventionService:
    """Get singleton ProactiveInterventionService instance."""
    global _intervention_service
    if _intervention_service is None:
        _intervention_service = ProactiveInterventionService()
    return _intervention_service
