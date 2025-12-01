"""
Django signals for Weaviate synchronization.

Connects model save/delete signals to Weaviate sync tasks.
"""

import logging

from django.conf import settings
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _should_sync_to_weaviate() -> bool:
    """Check if Weaviate sync should be performed."""
    # Skip during tests unless explicitly enabled
    import sys

    if 'test' in sys.argv or 'pytest' in sys.modules:
        return getattr(settings, 'WEAVIATE_SYNC_IN_TESTS', False)

    # Check if Weaviate URL is configured
    weaviate_url = getattr(settings, 'WEAVIATE_URL', '')
    return bool(weaviate_url)


@receiver(post_save, sender='projects.Project')
def sync_project_on_save(sender, instance, created, **kwargs):
    """
    Sync project to Weaviate when saved.

    Queues a Celery task to avoid blocking the save operation.
    """
    if not _should_sync_to_weaviate():
        return

    try:
        from .tasks import sync_project_to_weaviate

        # Delay the task to run async
        sync_project_to_weaviate.delay(instance.id)
        logger.debug(f'Queued Weaviate sync for project {instance.id}')

    except Exception as e:
        # Log but don't fail the save
        logger.error(f'Failed to queue Weaviate sync for project {instance.id}: {e}')


@receiver(post_delete, sender='projects.Project')
def remove_project_on_delete(sender, instance, **kwargs):
    """
    Remove project from Weaviate when deleted.
    """
    if not _should_sync_to_weaviate():
        return

    try:
        from .client import WeaviateClient
        from .schema import WeaviateSchema

        client = WeaviateClient()
        if client.is_available():
            existing = client.get_by_property(WeaviateSchema.PROJECT_COLLECTION, 'project_id', instance.id)
            if existing:
                client.delete_object(WeaviateSchema.PROJECT_COLLECTION, existing['_additional']['id'])
                logger.info(f'Removed project {instance.id} from Weaviate')

    except Exception as e:
        logger.error(f'Failed to remove project {instance.id} from Weaviate: {e}')


@receiver(post_save, sender='taxonomy.UserTag')
def sync_user_profile_on_tag_change(sender, instance, created, **kwargs):
    """
    Sync user profile to Weaviate when UserTag changes.
    """
    if not _should_sync_to_weaviate():
        return

    try:
        from .tasks import sync_user_profile_to_weaviate

        sync_user_profile_to_weaviate.delay(instance.user_id)
        logger.debug(f'Queued Weaviate sync for user {instance.user_id}')

    except Exception as e:
        logger.error(f'Failed to queue Weaviate sync for user {instance.user_id}: {e}')


@receiver(post_save, sender='projects.ProjectLike')
def sync_on_like(sender, instance, created, **kwargs):
    """
    Update engagement metrics when a project is liked.

    Also syncs the user's profile since their preferences changed.
    """
    if not _should_sync_to_weaviate():
        return

    if not created:
        return  # Only sync on new likes

    try:
        from .tasks import sync_project_to_weaviate, sync_user_profile_to_weaviate

        # Update project (for like count)
        sync_project_to_weaviate.delay(instance.project_id)

        # Update user profile (for preference learning)
        sync_user_profile_to_weaviate.delay(instance.user_id)

    except Exception as e:
        logger.error(f'Failed to queue Weaviate sync on like: {e}')


def connect_signals():
    """
    Connect all Weaviate sync signals.

    Call this from AppConfig.ready() to enable signal handlers.
    """
    # Signals are connected via decorators, this function exists
    # for explicit initialization if needed
    logger.info('Weaviate sync signals connected')
