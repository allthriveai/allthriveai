"""
Celery tasks for Asana background sync.

Tasks:
- sync_asana_for_user: Sync tasks for a single user
- sync_all_asana_users: Periodic task to sync all users with enabled Asana integration
"""

import logging

from celery import shared_task
from django.db import transaction

from .asana_models import AsanaIntegration
from .asana_service import (
    AsanaRateLimitError,
    AsanaService,
    AsanaTokenExpiredError,
)

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute base delay
    autoretry_for=(AsanaRateLimitError,),
    retry_backoff=True,  # Exponential backoff
    retry_backoff_max=600,  # Max 10 minutes between retries
    retry_jitter=True,  # Add randomness to prevent thundering herd
)
def sync_asana_for_user(self, user_id: int) -> dict:
    """
    Sync Asana tasks for a single user.

    Args:
        user_id: The user's ID

    Returns:
        Dict with sync result (tasks_synced count or error)
    """
    from core.users.models import User

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.warning(f"sync_asana_for_user: User {user_id} not found")
        return {'status': 'error', 'error': 'user_not_found'}

    # Check if user has Asana integration enabled
    try:
        integration = user.asana_integration
    except AsanaIntegration.DoesNotExist:
        logger.debug(f"sync_asana_for_user: User {user_id} has no Asana integration")
        return {'status': 'skipped', 'reason': 'no_integration'}

    if not integration.sync_enabled:
        logger.debug(f"sync_asana_for_user: Sync disabled for user {user_id}")
        return {'status': 'skipped', 'reason': 'sync_disabled'}

    try:
        service = AsanaService(user)
        tasks = service.sync_tasks()

        logger.info(f"sync_asana_for_user: Synced {len(tasks)} tasks for user {user_id}")
        return {'status': 'success', 'tasks_synced': len(tasks)}

    except AsanaTokenExpiredError as e:
        # Token refresh failed - disable sync and log warning
        logger.warning(f"sync_asana_for_user: Token expired for user {user_id}, disabling sync")
        with transaction.atomic():
            integration.sync_enabled = False
            integration.last_sync_error = str(e)
            integration.save(update_fields=['sync_enabled', 'last_sync_error', 'updated_at'])
        return {'status': 'error', 'error': 'token_expired', 'sync_disabled': True}

    except AsanaRateLimitError:
        # Let Celery handle retry with exponential backoff (via autoretry_for)
        logger.warning(f"sync_asana_for_user: Rate limited for user {user_id}, will retry")
        raise  # Re-raise to trigger Celery retry

    except Exception as e:
        # Log error but don't crash worker
        logger.error(f"sync_asana_for_user: Error syncing for user {user_id}: {e}")
        integration.mark_sync_error(str(e))
        return {'status': 'error', 'error': str(e)}


@shared_task
def sync_all_asana_users() -> dict:
    """
    Periodic task: Sync Asana tasks for all users with enabled integration.

    Runs every 5 minutes via Celery beat.
    Dispatches individual sync tasks for each user to distribute load.

    Returns:
        Dict with count of users queued for sync
    """
    # Get all users with sync_enabled=True
    integrations = AsanaIntegration.objects.filter(sync_enabled=True).select_related('user')

    queued_count = 0
    for integration in integrations:
        # Dispatch individual sync task for each user
        # This distributes load and allows independent retries
        sync_asana_for_user.delay(integration.user_id)
        queued_count += 1

    logger.info(f"sync_all_asana_users: Queued {queued_count} users for Asana sync")
    return {'status': 'success', 'users_queued': queued_count}
