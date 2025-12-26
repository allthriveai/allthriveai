"""Celery tasks for YouTube feed agent syncing."""

import logging

from celery import shared_task

from core.integrations.youtube_feed_models import YouTubeFeedAgent
from core.logging_utils import StructuredLogger, log_celery_task
from services.integrations.youtube_feed import YouTubeFeedSyncService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def sync_all_youtube_feed_agents_task(self):
    """
    Periodic background task to sync all active YouTube feed agents.

    This task:
    1. Fetches new videos from YouTube channels for all active agents
    2. Creates new projects for new videos
    3. Updates existing projects with fresh metrics (views, likes)
    4. Applies AI-based topic extraction
    5. Adds attribution and links back to original creator

    Returns:
        dict with sync results
    """
    try:
        logger.info('Starting periodic YouTube feed agents sync')

        # Auto-recover agents in error status by resetting them to active
        # This allows transient errors (like quota limits) to auto-heal on the next sync
        # IMPORTANT: Log original errors BEFORE clearing them for debugging
        error_agents = YouTubeFeedAgent.objects.filter(status=YouTubeFeedAgent.Status.ERROR)
        if error_agents.exists():
            for agent in error_agents:
                # Log the original error before clearing it (preserves root cause for debugging)
                StructuredLogger.log_service_operation(
                    service_name='YouTubeFeedSync',
                    operation='auto_recovery',
                    success=True,
                    metadata={
                        'agent_id': agent.id,
                        'agent_name': agent.name,
                        'channel_id': agent.channel_id,
                        'original_error': agent.last_sync_error or 'unknown',
                        'last_synced_at': agent.last_synced_at.isoformat() if agent.last_synced_at else None,
                    },
                    logger_instance=logger,
                )
            count = error_agents.count()
            error_agents.update(status=YouTubeFeedAgent.Status.ACTIVE, last_sync_error='')
            logger.info(f'Auto-recovered {count} agents from error status')

        # Get all active agents (including just-recovered ones)
        active_agents = YouTubeFeedAgent.objects.filter(status=YouTubeFeedAgent.Status.ACTIVE).select_related(
            'agent_user'
        )

        if not active_agents.exists():
            logger.info('No active YouTube feed agents found')
            return {'success': True, 'agents_synced': 0, 'message': 'No active agents to sync'}

        logger.info(f'Syncing {active_agents.count()} YouTube feed agents')

        # Sync all active agents
        results = YouTubeFeedSyncService.sync_all_active_agents()

        # Log sync results with structured logging
        StructuredLogger.log_service_operation(
            service_name='YouTubeFeedSync',
            operation='sync_all_complete',
            success=results['total_errors'] == 0,
            metadata={
                'agents_synced': results['agents_synced'],
                'total_created': results['total_created'],
                'total_skipped': results['total_skipped'],
                'total_errors': results['total_errors'],
            },
            logger_instance=logger,
        )

        # Alert if there were errors
        if results['total_errors'] > 0:
            StructuredLogger.log_critical_failure(
                alert_type='sync_error',
                message=f'YouTube feed sync completed with {results["total_errors"]} errors',
                metadata={
                    'service': 'youtube',
                    'agents_synced': results['agents_synced'],
                    'error_count': results['total_errors'],
                },
                logger_instance=logger,
            )

        return {
            'success': True,
            'agents_synced': results['agents_synced'],
            'total_created': results['total_created'],
            'total_skipped': results['total_skipped'],
            'total_errors': results['total_errors'],
        }

    except Exception as e:
        logger.error(f'YouTube feed sync task failed: {e}', exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=300, max_retries=3) from e  # 5 min, 10 min, 20 min


@shared_task(bind=True, max_retries=2, time_limit=600, soft_time_limit=540)
@log_celery_task(service_name='YouTubeFeedSync')
def sync_youtube_feed_agent_task(self, agent_id: int):
    """
    Sync a single YouTube feed agent.

    Args:
        agent_id: ID of the YouTubeFeedAgent to sync

    Returns:
        dict with sync results
    """
    try:
        agent = YouTubeFeedAgent.objects.get(id=agent_id)
        logger.info(f'Syncing YouTube feed agent: {agent.name}')

        results = YouTubeFeedSyncService.sync_agent(agent)

        # Log sync results with structured logging
        StructuredLogger.log_service_operation(
            service_name='YouTubeFeedSync',
            operation='agent_sync_complete',
            success=results['errors'] == 0,
            metadata={
                'agent_id': agent_id,
                'agent_name': agent.name,
                'created': results['created'],
                'updated': results['updated'],
                'errors': results['errors'],
            },
            logger_instance=logger,
        )

        # Alert if there were errors
        if results['errors'] > 0:
            StructuredLogger.log_critical_failure(
                alert_type='sync_error',
                message=f'YouTube agent sync failed: {agent.name}',
                metadata={
                    'service': 'youtube',
                    'agent_id': agent_id,
                    'agent_name': agent.name,
                    'error_count': results['errors'],
                    'error_messages': results['error_messages'][:3],  # First 3 errors
                },
                logger_instance=logger,
            )

        return {
            'success': results['errors'] == 0,
            'agent_id': agent_id,
            'agent_name': agent.name,
            'created': results['created'],
            'updated': results['updated'],
            'errors': results['errors'],
            'error_messages': results['error_messages'],
        }

    except YouTubeFeedAgent.DoesNotExist:
        StructuredLogger.log_service_operation(
            service_name='YouTubeFeedSync',
            operation='agent_not_found',
            success=False,
            metadata={'agent_id': agent_id},
            logger_instance=logger,
        )
        return {'success': False, 'error': f'Agent {agent_id} not found'}

    except Exception as e:
        logger.error(f'YouTube feed agent sync failed for {agent_id}: {e}', exc_info=True)
        raise self.retry(exc=e, countdown=120, max_retries=2) from e
