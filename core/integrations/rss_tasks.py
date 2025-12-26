"""Celery tasks for RSS feed agent syncing."""

import logging

from celery import shared_task

from core.integrations.rss_models import RSSFeedAgent
from core.logging_utils import StructuredLogger
from services.integrations.rss.sync import RSSFeedSyncService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def sync_all_rss_agents_task(self):
    """
    Periodic background task to sync all active RSS feed agents.

    This task:
    1. Fetches RSS feeds for all active RSS agents
    2. Creates new projects for new RSS feed items
    3. Updates existing projects with fresh content
    4. Applies AI-based topic extraction and difficulty detection

    Returns:
        dict with sync results
    """
    try:
        logger.info('Starting periodic RSS agents sync')

        # Auto-recover agents in error status by resetting them to active
        # This allows transient errors (like network issues) to auto-heal on the next sync
        # IMPORTANT: Log original errors BEFORE clearing them for debugging
        error_agents = RSSFeedAgent.objects.filter(status=RSSFeedAgent.Status.ERROR)
        if error_agents.exists():
            for agent in error_agents:
                # Log the original error before clearing it (preserves root cause for debugging)
                StructuredLogger.log_service_operation(
                    service_name='RSSSync',
                    operation='auto_recovery',
                    success=True,
                    metadata={
                        'agent_id': agent.id,
                        'agent_name': agent.name,
                        'feed_url': agent.feed_url,
                        'original_error': agent.last_sync_error or 'unknown',
                        'last_synced_at': agent.last_synced_at.isoformat() if agent.last_synced_at else None,
                    },
                    logger_instance=logger,
                )
            count = error_agents.count()
            error_agents.update(status=RSSFeedAgent.Status.ACTIVE, last_sync_error='')
            logger.info(f'Auto-recovered {count} RSS agents from error status')

        # Get all active agents (including just-recovered ones)
        active_agents = RSSFeedAgent.objects.filter(status=RSSFeedAgent.Status.ACTIVE).select_related('agent_user')

        if not active_agents.exists():
            logger.info('No active RSS agents found')
            return {'success': True, 'agents_synced': 0, 'message': 'No active agents to sync'}

        logger.info(f'Syncing {active_agents.count()} RSS agents')

        # Sync all active agents
        results = RSSFeedSyncService.sync_all_active_agents()

        # Log sync results with structured logging
        StructuredLogger.log_service_operation(
            service_name='RSSSync',
            operation='sync_all_complete',
            success=results['total_errors'] == 0,
            metadata={
                'agents_synced': results['agents_synced'],
                'total_created': results['total_created'],
                'total_updated': results['total_updated'],
                'total_errors': results['total_errors'],
            },
            logger_instance=logger,
        )

        # Alert if there were errors
        if results['total_errors'] > 0:
            StructuredLogger.log_critical_failure(
                alert_type='sync_error',
                message=f'RSS sync completed with {results["total_errors"]} errors',
                metadata={
                    'service': 'rss',
                    'agents_synced': results['agents_synced'],
                    'error_count': results['total_errors'],
                },
                logger_instance=logger,
            )

        return {
            'success': True,
            'agents_synced': results['agents_synced'],
            'total_created': results['total_created'],
            'total_updated': results['total_updated'],
            'total_errors': results['total_errors'],
        }

    except Exception as e:
        logger.error(f'RSS sync task failed: {e}', exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=300, max_retries=3) from e  # 5 min, 10 min, 20 min
