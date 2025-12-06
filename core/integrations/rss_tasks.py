"""Celery tasks for RSS feed agent syncing."""

import logging

from celery import shared_task

from core.integrations.rss_models import RSSFeedAgent
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
        error_agents = RSSFeedAgent.objects.filter(status=RSSFeedAgent.Status.ERROR)
        if error_agents.exists():
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

        logger.info(
            f'RSS sync complete: {results["agents_synced"]} agents, '
            f'{results["total_created"]} created, {results["total_updated"]} updated, '
            f'{results["total_errors"]} errors'
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
