"""Celery tasks for Reddit community agent syncing."""

import logging

from celery import shared_task

from core.integrations.reddit_models import RedditCommunityAgent
from core.logging_utils import StructuredLogger
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

        # Auto-recover agents in error status by resetting them to active
        # This allows transient errors (like rate limits) to auto-heal on the next sync
        # IMPORTANT: Log original errors BEFORE clearing them for debugging
        error_agents = RedditCommunityAgent.objects.filter(status=RedditCommunityAgent.Status.ERROR)
        if error_agents.exists():
            for agent in error_agents:
                # Log the original error before clearing it (preserves root cause for debugging)
                StructuredLogger.log_service_operation(
                    service_name='RedditSync',
                    operation='auto_recovery',
                    success=True,
                    metadata={
                        'agent_id': agent.id,
                        'agent_name': agent.name,
                        'subreddit': agent.subreddit,
                        'original_error': agent.last_sync_error or 'unknown',
                        'last_synced_at': agent.last_synced_at.isoformat() if agent.last_synced_at else None,
                    },
                    logger_instance=logger,
                )
            count = error_agents.count()
            error_agents.update(status=RedditCommunityAgent.Status.ACTIVE, last_sync_error='')
            logger.info(f'Auto-recovered {count} Reddit agents from error status')

        # Get all active agents (including just-recovered ones)
        active_agents = RedditCommunityAgent.objects.filter(status=RedditCommunityAgent.Status.ACTIVE).select_related(
            'agent_user'
        )

        if not active_agents.exists():
            logger.info('No active Reddit agents found')
            return {'success': True, 'agents_synced': 0, 'message': 'No active agents to sync'}

        logger.info(f'Syncing {active_agents.count()} Reddit agents')

        # Sync all active agents
        results = RedditSyncService.sync_all_active_agents()

        # Log sync results with structured logging
        StructuredLogger.log_service_operation(
            service_name='RedditSync',
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
                message=f'Reddit sync completed with {results["total_errors"]} errors',
                metadata={
                    'service': 'reddit',
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
        logger.error(f'Reddit sync task failed: {e}', exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=300, max_retries=3) from e  # 5 min, 10 min, 20 min
