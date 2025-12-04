"""Celery tasks for YouTube feed agent syncing."""

import logging

from celery import shared_task

from core.integrations.youtube_feed_models import YouTubeFeedAgent
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

        # Get all active agents
        active_agents = YouTubeFeedAgent.objects.filter(status=YouTubeFeedAgent.Status.ACTIVE).select_related(
            'agent_user'
        )

        if not active_agents.exists():
            logger.info('No active YouTube feed agents found')
            return {'success': True, 'agents_synced': 0, 'message': 'No active agents to sync'}

        logger.info(f'Syncing {active_agents.count()} YouTube feed agents')

        # Sync all active agents
        results = YouTubeFeedSyncService.sync_all_active_agents()

        logger.info(
            f'YouTube feed sync complete: {results["agents_synced"]} agents, '
            f'{results["total_created"]} created, {results["total_skipped"]} skipped, '
            f'{results["total_errors"]} errors'
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

        logger.info(
            f'YouTube feed agent sync complete: {agent.name} - '
            f'{results["created"]} created, {results["updated"]} updated, '
            f'{results["errors"]} errors'
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
        logger.error(f'YouTube feed agent {agent_id} not found')
        return {'success': False, 'error': f'Agent {agent_id} not found'}

    except Exception as e:
        logger.error(f'YouTube feed agent sync failed for {agent_id}: {e}', exc_info=True)
        raise self.retry(exc=e, countdown=120, max_retries=2) from e
