"""
Django signals for Weaviate synchronization.

Connects model save/delete signals to Weaviate sync tasks.

GDPR Compliance:
- User deletion removes all user data from Weaviate
- Project visibility changes trigger immediate Weaviate sync
- All deletions are logged for audit trail
"""

import logging

from django.conf import settings
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Track visibility changes for projects
_project_visibility_cache: dict[int, dict] = {}

# Track promotion changes for projects
_project_promotion_cache: dict[int, dict] = {}


def _should_sync_to_weaviate() -> bool:
    """Check if Weaviate sync should be performed."""
    # Skip during tests unless explicitly enabled
    import sys

    if 'test' in sys.argv or 'pytest' in sys.modules:
        return getattr(settings, 'WEAVIATE_SYNC_IN_TESTS', False)

    # Check if Weaviate URL is configured
    weaviate_url = getattr(settings, 'WEAVIATE_URL', '')
    return bool(weaviate_url)


@receiver(pre_save, sender='core.Project')
def track_project_visibility_change(sender, instance, **kwargs):
    """
    Track project visibility and promotion status before save to detect changes.

    This is needed to detect when:
    - A project goes from public to private (requires immediate removal from Weaviate search index)
    - A project's promotion status changes (requires Weaviate sync for quality training)
    """
    if instance.pk:
        try:
            from core.projects.models import Project

            old_instance = (
                Project.objects.filter(pk=instance.pk)
                .values('is_private', 'is_archived', 'is_promoted', 'promoted_at')
                .first()
            )
            if old_instance:
                _project_visibility_cache[instance.pk] = old_instance
                _project_promotion_cache[instance.pk] = {
                    'is_promoted': old_instance.get('is_promoted'),
                    'promoted_at': old_instance.get('promoted_at'),
                }
        except Exception as e:
            logger.debug(f'Error tracking project visibility/promotion: {e}')


@receiver(post_save, sender='core.Project')
def sync_project_on_save(sender, instance, created, **kwargs):
    """
    Sync project to Weaviate when saved.

    Handles visibility changes:
    - Public → Private: Remove from Weaviate immediately
    - Private → Public: Add to Weaviate
    - Promotion status change: Update in Weaviate for quality training
    - Any other change: Update in Weaviate

    Queues a Celery task to avoid blocking the save operation.
    """
    # Always clean up caches to prevent memory leaks
    old_visibility = _project_visibility_cache.pop(instance.pk, None)
    old_promotion = _project_promotion_cache.pop(instance.pk, None)

    if not _should_sync_to_weaviate():
        return

    try:
        from .tasks import remove_project_from_weaviate, sync_project_to_weaviate

        # Log promotion change (for quality training observability)
        if old_promotion:
            was_promoted = old_promotion.get('is_promoted', False)
            if was_promoted != instance.is_promoted:
                logger.info(
                    f'Project {instance.id} promotion changed: {was_promoted} → {instance.is_promoted} '
                    f'(quality signal for Weaviate)'
                )

        # Determine if project should be in Weaviate (public + not archived)
        should_be_searchable = not instance.is_private and not instance.is_archived

        was_searchable = False
        if old_visibility:
            was_searchable = not old_visibility.get('is_private', True) and not old_visibility.get('is_archived', True)

        if was_searchable and not should_be_searchable:
            # Project became non-searchable - REMOVE from Weaviate immediately
            # This is critical for privacy - private projects must not be searchable
            logger.info(f'Project {instance.id} visibility changed to non-searchable, removing from Weaviate')
            remove_project_from_weaviate.delay(instance.id)
        elif should_be_searchable:
            # Project is searchable - sync to Weaviate
            sync_project_to_weaviate.delay(instance.id)
            logger.debug(f'Queued Weaviate sync for project {instance.id}')
        # else: project is not searchable and wasn't before - nothing to do

    except Exception as e:
        # Log but don't fail the save
        logger.error(f'Failed to queue Weaviate sync for project {instance.id}: {e}')


@receiver(post_delete, sender='core.Project')
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


@receiver(post_save, sender='core.UserTag')
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


@receiver(post_save, sender='core.ProjectLike')
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


@receiver(post_delete, sender='users.User')
def remove_user_on_delete(sender, instance, **kwargs):
    """
    GDPR Compliance: Remove user profile from Weaviate when user is deleted.

    This ensures all user data is removed from the vector database when
    a user deletes their account or requests data deletion.
    """
    if not _should_sync_to_weaviate():
        return

    try:
        from .tasks import remove_user_profile_from_weaviate

        # Queue async deletion
        remove_user_profile_from_weaviate.delay(instance.id)
        logger.info(
            f'GDPR: Queued Weaviate deletion for user {instance.id}',
            extra={'user_id': instance.id, 'gdpr_action': 'delete_user_profile'},
        )

    except Exception as e:
        # This is critical - log as error for monitoring
        logger.error(
            f'GDPR CRITICAL: Failed to queue Weaviate deletion for user {instance.id}: {e}',
            extra={'user_id': instance.id, 'gdpr_action': 'delete_user_profile'},
            exc_info=True,
        )


@receiver(post_save, sender='users.User')
def sync_user_similarity_preference(sender, instance, **kwargs):
    """
    Sync user profile when similarity matching preference changes.

    This ensures users who opt out of collaborative filtering are
    immediately removed from similarity searches.
    """
    if not _should_sync_to_weaviate():
        return

    # Only trigger on update, not create
    if kwargs.get('created', False):
        return

    # Check if allow_similarity_matching field was updated
    update_fields = kwargs.get('update_fields')
    if update_fields is not None and 'allow_similarity_matching' not in update_fields:
        return

    try:
        from .tasks import sync_user_profile_to_weaviate

        sync_user_profile_to_weaviate.delay(instance.id)
        logger.debug(f'Queued Weaviate sync for user {instance.id} similarity preference change')

    except Exception as e:
        logger.error(f'Failed to queue Weaviate sync for user {instance.id}: {e}')


def connect_signals():
    """
    Connect all Weaviate sync signals.

    Call this from AppConfig.ready() to enable signal handlers.
    """
    # Signals are connected via decorators, this function exists
    # for explicit initialization if needed
    logger.info('Weaviate sync signals connected')
