"""Celery tasks for Reddit community agent syncing."""

import logging

from celery import shared_task

from core.integrations.reddit_models import RedditCommunityAgent
from services.integrations.reddit.sync import RedditSyncService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def sync_all_reddit_agents_task(self):
    """
    Periodic background task to sync all active Reddit community agents.

    This task:
    1. Fetches RSS feeds for all active Reddit agents
    2. Creates new projects for new Reddit posts
    3. Updates existing projects with fresh metrics
    4. Applies content moderation and AI tagging

    Returns:
        dict with sync results
    """
    try:
        logger.info('Starting periodic Reddit agents sync')

        # Get all active agents
        active_agents = RedditCommunityAgent.objects.filter(status=RedditCommunityAgent.Status.ACTIVE).select_related(
            'agent_user'
        )

        if not active_agents.exists():
            logger.info('No active Reddit agents found')
            return {'success': True, 'agents_synced': 0, 'message': 'No active agents to sync'}

        logger.info(f'Syncing {active_agents.count()} Reddit agents')

        # Sync all active agents
        results = RedditSyncService.sync_all_active_agents()

        logger.info(
            f'Reddit sync complete: {results["agents_synced"]} agents, '
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
        logger.error(f'Reddit sync task failed: {e}', exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=300, max_retries=3) from e  # 5 min, 10 min, 20 min
