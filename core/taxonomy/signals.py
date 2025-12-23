"""
Django signals for taxonomy-related auto-tagging.

These signals listen for user interactions and automatically create/update
UserTags to improve personalization recommendations.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.taxonomy.models import UserInteraction

logger = logging.getLogger(__name__)


@receiver(post_save, sender=UserInteraction)
def auto_tag_from_search(sender, instance, created, **kwargs):
    """
    Automatically create/update UserTags when a user performs a search.

    When a UserInteraction with type 'SEARCH' is created, we extract any
    tool names from the search query and create/update UserTags with
    AUTO_ACTIVITY source. This feeds back into the personalization engine.
    """
    # Only process newly created search interactions
    if not created:
        return

    if instance.interaction_type != UserInteraction.InteractionType.SEARCH:
        return

    # Get the search query from metadata
    query = instance.metadata.get('query', '') if instance.metadata else ''
    if not query:
        return

    # Import here to avoid circular imports
    from core.taxonomy.services import auto_tag_from_search as tag_from_search

    try:
        tags_created = tag_from_search(instance.user, query)
        if tags_created:
            logger.info(
                f"Auto-tagged user {instance.user.username} from search '{query}': " f'{[t.name for t in tags_created]}'
            )
    except Exception as e:
        logger.error(f'Error auto-tagging from search: {e}', exc_info=True)


@receiver(post_save, sender=UserInteraction)
def auto_tag_from_conversation(sender, instance, created, **kwargs):
    """
    Automatically create/update UserTags when a user has a conversation with Ember.

    When a UserInteraction with type 'CONVERSATION' is created, we extract any
    tool names from the message content and create/update UserTags with
    AUTO_CONVERSATION source. This helps personalization learn from chat.
    """
    # Only process newly created conversation interactions
    if not created:
        return

    if instance.interaction_type != UserInteraction.InteractionType.CONVERSATION:
        return

    # Get the message content from metadata
    message = instance.metadata.get('message', '') if instance.metadata else ''
    if not message:
        return

    # Import here to avoid circular imports
    from core.taxonomy.services import auto_tag_from_conversation as tag_from_conversation

    try:
        tags_created = tag_from_conversation(instance.user, message)
        if tags_created:
            logger.info(
                f'Auto-tagged user {instance.user.username} from conversation: ' f'{[t.name for t in tags_created]}'
            )
    except Exception as e:
        logger.error(f'Error auto-tagging from conversation: {e}', exc_info=True)
