"""
Celery tasks for clip generation.
"""

import asyncio
import logging
from datetime import datetime

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run async coroutine from sync Celery task context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_brand_voice_context(user_id: int, brand_voice_id: int) -> dict | None:
    """Fetch brand voice from database and format as context dict."""
    from core.users.models import BrandVoice

    try:
        brand_voice = BrandVoice.objects.get(id=brand_voice_id, user_id=user_id)
        return {
            'name': brand_voice.name,
            'target_audience': brand_voice.target_audience or '',
            'tone': brand_voice.tone,
            'description': brand_voice.description or '',
            'catchphrases': brand_voice.catchphrases or [],
            'topics_to_avoid': brand_voice.topics_to_avoid or [],
            'example_hooks': brand_voice.example_hooks or [],
            'keywords': brand_voice.keywords or [],
        }
    except BrandVoice.DoesNotExist:
        logger.warning(f'Brand voice {brand_voice_id} not found for user {user_id}')
        return None


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=120,  # 2 minute timeout
    time_limit=150,  # Hard limit
)
def generate_clip_task(
    self,
    session_id: str,
    prompt: str,
    user_id: int,
    username: str,
    current_clip: dict | None = None,
    conversation_phase: str = 'discovery',
    story_transcript: list | None = None,
    user_preferences: dict | None = None,
    should_generate: bool = False,
    brand_voice_id: int | None = None,
):
    """
    Generate a clip or continue conversation using the ClipAgent.

    This task runs the LangGraph agent and broadcasts results
    back to the WebSocket consumer via Redis channel layer.

    Args:
        session_id: WebSocket session ID
        prompt: User's message
        user_id: User ID
        username: Username for personalization
        current_clip: Existing clip if editing
        conversation_phase: Current phase (discovery, hook, story, ready_to_generate)
        story_transcript: Story built so far
        user_preferences: User preferences gathered during discovery
        should_generate: If True, generate clip; otherwise continue conversation
        brand_voice_id: Optional brand voice ID for personalization
    """
    channel_layer = get_channel_layer()
    group_name = f'clip.session.{session_id}'

    try:
        # Import agent here to avoid circular imports
        from services.agents.clip.agent import ClipAgent

        # Fetch brand voice if specified
        brand_voice_context = None
        if brand_voice_id:
            brand_voice_context = _get_brand_voice_context(user_id, brand_voice_id)

        # Create agent and run
        agent = ClipAgent()
        result = _run_async(
            agent.generate(
                prompt=prompt,
                user_id=user_id,
                username=username,
                session_id=session_id,
                current_clip=current_clip,
                conversation_phase=conversation_phase,
                story_transcript=story_transcript or [],
                user_preferences=user_preferences or {},
                should_generate=should_generate,
                brand_voice=brand_voice_context,
            )
        )

        # Extract results
        clip_content = result.get('clip')
        message = result.get('message', '')
        new_phase = result.get('phase', conversation_phase)
        new_transcript = result.get('transcript', story_transcript or [])
        new_preferences = result.get('preferences', user_preferences or {})
        options = result.get('options')

        # Determine event type based on whether clip was generated
        if clip_content:
            event_type = 'clip_generated'
        else:
            event_type = 'conversation'  # Still in conversation mode

        # Build broadcast message
        broadcast_data = {
            'type': 'clip.message',
            'event': event_type,
            'message': message,
            'phase': new_phase,
            'transcript': new_transcript,
            'preferences': new_preferences,
            'timestamp': datetime.utcnow().isoformat(),
        }

        # Include clip if generated
        if clip_content:
            broadcast_data['clip'] = clip_content

        # Include options if present (for clickable responses)
        if options:
            broadcast_data['options'] = options

        # Broadcast to WebSocket
        async_to_sync(channel_layer.group_send)(group_name, broadcast_data)

        logger.info(
            f'Clip task completed: session={session_id}, user={user_id}, '
            f'phase={new_phase}, generated={bool(clip_content)}'
        )

        return {
            'success': True,
            'session_id': session_id,
            'phase': new_phase,
            'clip': clip_content,
        }

    except Exception as e:
        logger.error(f'Clip generation failed: {e}', exc_info=True)

        # Determine user-friendly error message (don't leak internal details)
        user_message = 'Something went wrong. Please try again.'
        if 'timeout' in str(e).lower() or 'time limit' in str(e).lower():
            user_message = 'Request timed out. Please try a simpler request.'
        elif 'rate limit' in str(e).lower():
            user_message = 'Rate limit reached. Please wait a moment and try again.'

        # Retry silently if retries remain (don't notify user of retry)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e) from e

        # Only broadcast error after all retries exhausted
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'clip.message',
                'event': 'error',
                'message': user_message,
                'timestamp': datetime.utcnow().isoformat(),
            },
        )

        return {
            'success': False,
            'session_id': session_id,
            'error': str(e),  # Internal logging only
        }
