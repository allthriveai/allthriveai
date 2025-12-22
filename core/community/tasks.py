"""
Celery tasks for community messaging.

Handles async operations like:
- Agent DM responses (AI-powered replies from Core Team agents)
"""

import logging

from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def process_agent_dm_task(self, message_id: str, thread_id: str, agent_user_id: int):
    """
    Async task to generate and send an AI response from a Core Team agent.

    This task is triggered when a user sends a DM to a team-tier agent.
    It generates a personalized response using the agent's personality_prompt.

    Args:
        message_id: UUID of the incoming message
        thread_id: UUID of the DM thread
        agent_user_id: ID of the Core Team agent

    Returns:
        Dict with task status
    """
    from core.community.agent_dm_service import process_agent_dm
    from core.community.models import DirectMessageThread, Message

    try:
        # Fetch message
        try:
            message = Message.objects.select_related('author', 'room').get(id=message_id)
        except Message.DoesNotExist:
            logger.error(f'Message not found: {message_id}')
            return {'status': 'error', 'reason': 'message_not_found'}

        # Fetch thread
        try:
            thread = DirectMessageThread.objects.get(id=thread_id)
        except DirectMessageThread.DoesNotExist:
            logger.error(f'DM thread not found: {thread_id}')
            return {'status': 'error', 'reason': 'thread_not_found'}

        # Fetch agent
        try:
            agent_user = User.objects.get(id=agent_user_id)
        except User.DoesNotExist:
            logger.error(f'Agent user not found: {agent_user_id}')
            return {'status': 'error', 'reason': 'agent_not_found'}

        # Process the DM
        process_agent_dm(
            message=message,
            thread=thread,
            recipient_agent=agent_user,
        )

        return {'status': 'success', 'message_id': message_id}

    except Exception as e:
        logger.error(f'Failed to process agent DM task: {e}', exc_info=True)

        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {'status': 'error', 'reason': str(e)}
