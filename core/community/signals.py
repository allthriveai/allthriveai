"""
Signal handlers for community messaging.

Handles:
- Triggering AI responses when users DM Core Team agents
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.community.models import Message

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Message)
def trigger_agent_dm_response(sender, instance: Message, created: bool, **kwargs):
    """
    Trigger an AI response when a user sends a DM to a Core Team agent.

    This signal fires on Message creation and checks:
    1. Is this a new message (not an edit)?
    2. Is this in a DM room?
    3. Is the recipient a 'team' tier agent?
    4. Is the sender NOT a 'team' tier agent (avoid self-responses)?

    If all conditions are met, dispatch a Celery task to generate the response.

    Args:
        sender: The Message model class
        instance: The Message instance that was saved
        created: True if this is a new message (not an update)
        **kwargs: Additional signal arguments
    """
    # Only process newly created messages
    if not created:
        return

    # Skip if no room (shouldn't happen, but safety check)
    if not instance.room:
        return

    # Only process DM messages
    if instance.room.room_type != 'dm':
        return

    # Skip if no author (system messages)
    if not instance.author:
        return

    # Skip if the author is a team agent (prevent infinite loops)
    if instance.author.tier == 'team':
        return

    # Get the DM thread for this room
    try:
        dm_thread = instance.room.dm_thread
    except Exception:
        logger.debug(f'No DM thread found for room {instance.room.id}')
        return

    if not dm_thread:
        return

    # Find the other participant(s) who are Core Team agents
    team_agents = dm_thread.participants.filter(tier='team')

    if not team_agents.exists():
        # No team agents in this DM - it's a normal user-to-user DM
        return

    # Trigger response for each team agent in the conversation
    # (Usually there's only one, but support group DMs with agents)
    from core.community.tasks import process_agent_dm_task

    for agent in team_agents:
        logger.info(
            f'Triggering agent DM response: message={instance.id}, '
            f'agent={agent.username}, sender={instance.author.username}'
        )

        # Dispatch async task
        process_agent_dm_task.delay(
            message_id=str(instance.id),
            thread_id=str(dm_thread.id),
            agent_user_id=agent.id,
        )
