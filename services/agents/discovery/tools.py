"""
LangChain tools for discovery agent.

Provides challenge and community connection capabilities.

NOTE: Discovery tools have been consolidated into find_content.py.
This file only contains challenge and connection tools.
"""

import logging

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================================
# Challenge & Connect Tools (for Feelings Not Features)
# ============================================================================


class GetCurrentChallengeInput(BaseModel):
    """Input for get_current_challenge tool."""

    model_config = {'extra': 'allow'}
    state: dict | None = Field(default=None, description='Internal - injected by agent')


class FindPeopleToConnectInput(BaseModel):
    """Input for find_people_to_connect tool."""

    model_config = {'extra': 'allow'}
    limit: int = Field(default=5, description='Number of suggestions to return (1-10)')
    state: dict | None = Field(default=None, description='Internal - injected by agent')


@tool(args_schema=GetCurrentChallengeInput)
def get_current_challenge(
    state: dict | None = None,
) -> dict:
    """
    Get the current weekly challenge to display inline in chat.

    Use this when the user asks about challenges or wants to participate.

    Examples:
    - "Show me this week's challenge"
    - "What challenges are active?"
    - "I want to join a challenge"

    Returns challenge details with user's participation status.
    """
    import time

    from django.core.cache import cache
    from django.db import models

    from core.challenges.models import WeeklyChallenge
    from core.logging_utils import StructuredLogger

    start = time.perf_counter()
    user_id = state.get('user_id') if state else None

    try:
        # Check cache first (2 min TTL for challenge data)
        cache_key = 'challenge:current'
        cached = cache.get(cache_key)

        if cached is not None:
            # Add user-specific status if user is logged in
            result = dict(cached)
            if user_id:
                result = _add_user_challenge_status(result, user_id)

            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.info(f'get_current_challenge: cache_hit=True, duration={elapsed_ms:.2f}ms')
            return result

        # Fetch from DB with optimized query
        challenge = (
            WeeklyChallenge.objects.filter(status__in=['active', 'voting', 'upcoming'])
            .select_related('theme')
            .prefetch_related('suggested_tools')
            .order_by(
                models.Case(
                    models.When(status='active', then=0),
                    models.When(status='voting', then=1),
                    models.When(status='upcoming', then=2),
                )
            )
            .first()
        )

        if not challenge:
            return {
                'has_challenge': False,
                'message': 'No active challenges right now. Check back soon!',
                'cta': {
                    'url': '/challenges',
                    'label': 'View Past Challenges',
                },
            }

        result = _serialize_challenge(challenge)
        cache.set(cache_key, result, 120)  # 2 min TTL

        # Add user-specific status if logged in
        if user_id:
            result = _add_user_challenge_status(result, user_id)

        elapsed_ms = (time.perf_counter() - start) * 1000
        StructuredLogger.log_service_operation(
            service_name='ChallengeTools',
            operation='get_current_challenge',
            success=True,
            duration_ms=elapsed_ms,
            metadata={'challenge_id': str(challenge.id), 'status': challenge.status},
            logger_instance=logger,
        )

        return result

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to get current challenge',
            error=e,
            extra={'user_id': user_id},
            level='error',
            logger_instance=logger,
        )
        return {
            'has_challenge': False,
            'error': True,
            'message': 'Unable to load challenge data. Please try again.',
        }


def _serialize_challenge(challenge) -> dict:
    """Serialize challenge for tool response."""
    from django.utils import timezone

    # Calculate time remaining
    time_remaining = ''
    if challenge.submission_deadline:
        delta = challenge.submission_deadline - timezone.now()
        if delta.total_seconds() > 0:
            days = delta.days
            hours = delta.seconds // 3600
            if days > 0:
                time_remaining = f'{days} day{"s" if days != 1 else ""}, {hours} hour{"s" if hours != 1 else ""}'
            else:
                time_remaining = f'{hours} hour{"s" if hours != 1 else ""}'
        else:
            time_remaining = 'Ended'

    return {
        'has_challenge': True,
        'challenge': {
            'id': str(challenge.id),
            'title': challenge.title,
            'slug': challenge.slug,
            'description': challenge.description[:300] if challenge.description else '',
            'prompt': challenge.prompt[:200] if challenge.prompt else '',
            'status': challenge.status,
            'hero_image_url': challenge.hero_image_url or '',
            'theme_color': challenge.theme.color if challenge.theme else 'purple',
            'submission_deadline': challenge.submission_deadline.isoformat() if challenge.submission_deadline else None,
            'time_remaining': time_remaining,
            'participant_count': challenge.participant_count,
            'submission_count': challenge.submission_count,
            'points_config': {
                'submit': 50,
                'early_bird': 25,
                'vote_cast': 5,
            },
            'suggested_tools': [{'name': tool.name, 'slug': tool.slug} for tool in challenge.suggested_tools.all()[:5]],
        },
        'cta': {
            'url': f'/challenge/{challenge.slug}',
            'label': (
                'Join Challenge'
                if challenge.status == 'active'
                else 'Vote Now'
                if challenge.status == 'voting'
                else 'Learn More'
            ),
        },
    }


def _add_user_challenge_status(result: dict, user_id: int) -> dict:
    """Add user-specific status to challenge response."""
    from core.challenges.models import ChallengeSubmission

    if not result.get('has_challenge') or not result.get('challenge'):
        return result

    challenge_id = result['challenge']['id']

    try:
        submissions = ChallengeSubmission.objects.filter(
            challenge_id=challenge_id,
            user_id=user_id,
        )
        submission_count = submissions.count()

        result['user_status'] = {
            'has_submitted': submission_count > 0,
            'submission_count': submission_count,
            'can_submit_more': submission_count < 3,  # Assuming max 3 submissions
        }

        # Update CTA based on user status
        if submission_count > 0:
            if result['challenge']['status'] == 'voting':
                result['cta']['label'] = 'Vote Now'
            else:
                result['cta']['label'] = 'View My Submission'

    except Exception as e:
        logger.warning(f'Failed to get user challenge status: {e}')
        result['user_status'] = None

    return result


@tool(args_schema=FindPeopleToConnectInput)
def find_people_to_connect(
    limit: int = 5,
    state: dict | None = None,
) -> dict:
    """
    Find people to follow based on shared interests, roles, and goals.

    Use this when the user wants to discover new people or expand their network.

    Examples:
    - "Help me connect with others"
    - "Find people to follow"
    - "Who should I connect with?"
    - "Suggest people with similar interests"

    Returns suggested creators with match reasons.
    """
    import time

    from core.logging_utils import StructuredLogger
    from core.users.services.recommendations import UserRecommendationService

    start = time.perf_counter()

    # Get user from state
    user_id = state.get('user_id') if state else None

    if not user_id:
        return {
            'has_suggestions': False,
            'suggestions': [],
            'message': 'Sign in to get personalized recommendations!',
            'cta': {
                'url': '/login',
                'label': 'Sign In',
            },
        }

    # Validate limit parameter
    limit = max(1, min(limit, 10))

    try:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(id=user_id)

        service = UserRecommendationService()
        result = service.get_connection_suggestions(user, limit=limit)

        elapsed_ms = (time.perf_counter() - start) * 1000
        StructuredLogger.log_service_operation(
            service_name='ConnectTools',
            operation='find_people_to_connect',
            user=user,
            success=True,
            duration_ms=elapsed_ms,
            metadata={
                'suggestions_count': len(result.get('suggestions', [])),
                'limit': limit,
            },
            logger_instance=logger,
        )

        return result

    except Exception as e:
        StructuredLogger.log_error(
            message='Failed to find people to connect',
            error=e,
            extra={'user_id': user_id, 'limit': limit},
            level='error',
            logger_instance=logger,
        )
        return {
            'has_suggestions': False,
            'suggestions': [],
            'error': True,
            'message': 'Unable to find suggestions right now. Please try again.',
        }


# Tools that need state injection (for user context)
TOOLS_NEEDING_STATE = {
    'get_current_challenge',
    'find_people_to_connect',
}

# Remaining discovery tools (find_content is in find_content.py)
DISCOVERY_TOOLS = [
    get_current_challenge,
    find_people_to_connect,
]

# Tool lookup by name
TOOLS_BY_NAME = {tool.name: tool for tool in DISCOVERY_TOOLS}
