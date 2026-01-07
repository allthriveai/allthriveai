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
):
    """
    Generate a clip using the ClipAgent.

    This task runs the LangGraph agent and broadcasts results
    back to the WebSocket consumer via Redis channel layer.
    """
    channel_layer = get_channel_layer()
    group_name = f'clip.session.{session_id}'

    try:
        # Import agent here to avoid circular imports
        from services.agents.clip.agent import ClipAgent

        # Create agent and generate clip
        agent = ClipAgent()
        result = _run_async(
            agent.generate(
                prompt=prompt,
                user_id=user_id,
                username=username,
                session_id=session_id,
                current_clip=current_clip,
            )
        )

        clip_content = result.get('clip')
        message = result.get('message', '')

        # Broadcast success to WebSocket
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'clip.message',
                'event': 'clip_generated',
                'clip': clip_content,
                'message': message,
                'timestamp': datetime.utcnow().isoformat(),
            },
        )

        logger.info(f'Clip generated successfully: session={session_id}, user={user_id}')

        return {
            'success': True,
            'session_id': session_id,
            'clip': clip_content,
        }

    except Exception as e:
        logger.error(f'Clip generation failed: {e}', exc_info=True)

        # Determine user-friendly error message (don't leak internal details)
        user_message = 'Clip generation failed. Please try again.'
        if 'timeout' in str(e).lower() or 'time limit' in str(e).lower():
            user_message = 'Clip generation timed out. Please try a simpler request.'
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
