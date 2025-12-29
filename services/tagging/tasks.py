"""
Celery tasks for asynchronous AI tagging.

Tasks:
- tag_content_task: Tag a single content item
- batch_tag_content: Tag multiple items efficiently
- backfill_tags: Tag untagged content in batches
"""

import logging
from typing import Literal

from celery import shared_task
from django.db import close_old_connections
from django.db.models import Q
from django.utils import timezone

from .metrics import metrics_collector
from .service import AITaggingService

logger = logging.getLogger(__name__)


def _get_content_model(content_type: str):
    """Get the model class for a content type."""
    if content_type == 'project':
        from core.projects.models import Project

        return Project
    elif content_type == 'quiz':
        from core.quizzes.models import Quiz

        return Quiz
    elif content_type == 'tool':
        from core.tools.models import Tool

        return Tool
    elif content_type == 'micro_lesson':
        from core.learning_paths.models import MicroLesson

        return MicroLesson
    else:
        raise ValueError(f'Unknown content type: {content_type}')


@shared_task(bind=True, max_retries=3, default_retry_delay=60, rate_limit='30/m')
def tag_content_task(
    self,
    content_type: str,
    content_id: int | str,
    tier: Literal['bulk', 'premium'] = 'bulk',
    force: bool = False,
) -> dict:
    """
    Tag a single content item with AI-extracted taxonomy.

    Args:
        content_type: One of 'project', 'quiz', 'tool', 'micro_lesson'
        content_id: Primary key of the content
        tier: 'bulk' for cheap model, 'premium' for better quality
        force: Force retagging even if already tagged

    Returns:
        Dict with status and details
    """
    with metrics_collector.track_tagging(content_type, content_id, tier) as tracker:
        try:
            Model = _get_content_model(content_type)
        except ValueError as e:
            logger.error(f'Invalid content type: {content_type}')
            tracker.mark_error(str(e))
            return {'status': 'error', 'error': str(e)}

        try:
            content = Model.objects.get(pk=content_id)
        except Model.DoesNotExist:
            logger.warning(f'{content_type} {content_id} not found')
            tracker.mark_skipped('not_found')
            return {'status': 'skipped', 'reason': 'not_found'}

        service = AITaggingService()

        # Check if retagging needed
        if not service.should_retag(content, force=force):
            logger.debug(f'{content_type} {content_id} already tagged, skipping')
            tracker.mark_skipped('already_tagged')
            return {'status': 'skipped', 'reason': 'already_tagged'}

        # Release DB connection before AI API call (tagging makes OpenAI/Gemini calls)
        close_old_connections()

        # Tag content
        result = service.tag_content(content, tier=tier)
        tracker.set_result(result)

        if not result.success:
            error_msg = result.error or 'Unknown error'
            logger.error(f'Failed to tag {content_type} {content_id}: {error_msg}')

            # Retry on transient errors (rate limits, timeouts, API errors)
            transient_indicators = ['rate limit', 'timeout', 'connection', '429', '503', '502']
            if any(indicator in error_msg.lower() for indicator in transient_indicators):
                raise self.retry(
                    exc=Exception(error_msg),
                    countdown=120,  # 2 minutes backoff
                    max_retries=3,
                )

            return {'status': 'error', 'error': error_msg}

        # Apply tags
        applied = service.apply_tags(content, result, source='ai')

        if not applied:
            tracker.mark_error('Failed to apply tags')
            return {'status': 'error', 'error': 'Failed to apply tags'}

        # Trigger Weaviate sync if model supports it
        if hasattr(content, 'last_indexed_at'):
            _trigger_weaviate_sync(content_type, content_id)

        return {
            'status': 'success',
            'content_type': content_type,
            'content_id': str(content_id),
            'confidence': round(result.average_confidence, 3),
            'model': result.model_used,
            'tokens': result.tokens_used,
        }


def _trigger_weaviate_sync(content_type: str, content_id: int | str):
    """Trigger Weaviate sync for tagged content."""
    try:
        if content_type == 'project':
            from services.weaviate.tasks import sync_project_to_weaviate

            sync_project_to_weaviate.delay(int(content_id))
        elif content_type == 'quiz':
            from services.weaviate.tasks import sync_quiz_to_weaviate

            sync_quiz_to_weaviate.delay(str(content_id))
        elif content_type == 'tool':
            from services.weaviate.tasks import sync_tool_to_weaviate

            sync_tool_to_weaviate.delay(int(content_id))
        elif content_type == 'micro_lesson':
            from services.weaviate.tasks import sync_micro_lesson_to_weaviate

            sync_micro_lesson_to_weaviate.delay(int(content_id))
    except Exception as e:
        logger.warning(f'Failed to trigger Weaviate sync for {content_type} {content_id}: {e}')


@shared_task
def batch_tag_content(
    content_type: str,
    content_ids: list[int | str],
    tier: Literal['bulk', 'premium'] = 'bulk',
    force: bool = False,
) -> dict:
    """
    Tag multiple content items.

    Queues individual tag_content_task for each item with staggering
    to avoid rate limits.

    Args:
        content_type: Content type to tag
        content_ids: List of content IDs
        tier: Model tier to use
        force: Force retagging

    Returns:
        Dict with queued count
    """
    queued = 0
    stagger_seconds = 2  # 30/minute rate limit = 2 seconds between tasks

    for idx, content_id in enumerate(content_ids):
        tag_content_task.apply_async(
            args=[content_type, content_id, tier, force],
            countdown=idx * stagger_seconds,
        )
        queued += 1

    logger.info(f'Queued {queued} {content_type} tagging tasks')
    return {
        'status': 'queued',
        'content_type': content_type,
        'count': queued,
        'tier': tier,
    }


@shared_task
def backfill_tags(
    content_type: str | None = None,
    tier: Literal['bulk', 'premium'] = 'bulk',
    limit: int = 100,
) -> dict:
    """
    Backfill tags for untagged content.

    Finds content without ai_tag_metadata and queues tagging tasks.

    Args:
        content_type: Specific type to backfill, or None for all
        tier: Model tier to use
        limit: Max items per content type

    Returns:
        Dict with counts per type
    """
    results = {}
    types_to_process = [content_type] if content_type else ['project', 'quiz', 'tool', 'micro_lesson']

    for ctype in types_to_process:
        try:
            Model = _get_content_model(ctype)

            # Find untagged content
            untagged = Model.objects.filter(Q(ai_tag_metadata__isnull=True) | Q(ai_tag_metadata={}))

            # Apply type-specific filters
            if ctype == 'project':
                untagged = untagged.filter(is_private=False, is_archived=False)
            elif ctype == 'quiz':
                untagged = untagged.filter(is_published=True)
            elif ctype == 'tool':
                untagged = untagged.filter(is_active=True)
            elif ctype == 'micro_lesson':
                untagged = untagged.filter(is_active=True)

            content_ids = list(untagged.values_list('pk', flat=True)[:limit])

            if content_ids:
                batch_tag_content.delay(
                    content_type=ctype,
                    content_ids=content_ids,
                    tier=tier,
                    force=False,
                )

            results[ctype] = len(content_ids)
            logger.info(f'Queued {len(content_ids)} untagged {ctype} items')

        except Exception as e:
            logger.error(f'Error backfilling {ctype}: {e}')
            results[ctype] = f'error: {e}'

    return {
        'status': 'queued',
        'tier': tier,
        'counts': results,
    }


@shared_task
def retag_stale_content(
    content_type: str | None = None,
    tier: Literal['bulk', 'premium'] = 'bulk',
    stale_days: int = 30,
    limit: int = 50,
) -> dict:
    """
    Retag content with stale tags.

    Finds content tagged more than stale_days ago and queues retagging.

    Args:
        content_type: Specific type to retag, or None for all
        tier: Model tier to use
        stale_days: Consider tags stale after this many days
        limit: Max items per content type

    Returns:
        Dict with counts per type
    """
    from datetime import timedelta

    cutoff = timezone.now() - timedelta(days=stale_days)
    results = {}

    types_to_process = [content_type] if content_type else ['project', 'quiz', 'tool', 'micro_lesson']

    for ctype in types_to_process:
        try:
            from datetime import datetime as dt

            Model = _get_content_model(ctype)

            # Find stale-tagged content using JSON field lookup
            # Note: This requires PostgreSQL and proper JSON field support
            # Only fetch pk and metadata to minimize memory usage
            stale = (
                Model.objects.filter(
                    ai_tag_metadata__isnull=False,
                )
                .exclude(
                    ai_tag_metadata={},
                )
                .values('pk', 'ai_tag_metadata')
            )

            # Filter by tagged_at in Python since JSON date comparison is complex
            stale_ids = []
            records_checked = 0
            max_records_to_check = limit * 3  # Hard limit to prevent unbounded iteration

            for row in stale.iterator(chunk_size=500):  # Use iterator for memory efficiency
                records_checked += 1
                if records_checked > max_records_to_check:
                    break

                metadata = row.get('ai_tag_metadata', {})
                tagged_at = metadata.get('tagged_at') if metadata else None
                if tagged_at:
                    try:
                        # Parse ISO format and ensure timezone-aware
                        tagged_time = dt.fromisoformat(tagged_at.replace('Z', '+00:00'))
                        # Make cutoff timezone-aware for comparison
                        if tagged_time.tzinfo is None:
                            tagged_time = timezone.make_aware(tagged_time)
                        if tagged_time < cutoff:
                            stale_ids.append(row['pk'])
                    except (ValueError, TypeError):
                        stale_ids.append(row['pk'])  # Invalid date = stale

                if len(stale_ids) >= limit:
                    break

            if stale_ids:
                batch_tag_content.delay(
                    content_type=ctype,
                    content_ids=stale_ids,
                    tier=tier,
                    force=True,  # Force retag for stale content
                )

            results[ctype] = len(stale_ids)
            logger.info(f'Queued {len(stale_ids)} stale {ctype} items for retagging')

        except Exception as e:
            logger.error(f'Error retagging stale {ctype}: {e}')
            results[ctype] = f'error: {e}'

    return {
        'status': 'queued',
        'tier': tier,
        'stale_days': stale_days,
        'counts': results,
    }


@shared_task
def tag_high_engagement_premium(
    lookback_hours: int = 24,
    engagement_threshold: int = 10,
    limit: int = 20,
) -> dict:
    """
    Tag high-engagement content with premium tier.

    Finds content that received significant engagement recently
    and retags with premium model for better quality.

    Args:
        lookback_hours: Look for engagement in last N hours
        engagement_threshold: Min likes/views to qualify
        limit: Max items to tag

    Returns:
        Dict with tagged count
    """
    from datetime import timedelta

    from django.db.models import Count, Q

    cutoff = timezone.now() - timedelta(hours=lookback_hours)
    tagged_count = 0

    # Find high-engagement projects
    try:
        from core.projects.models import Project

        high_engagement = (
            Project.objects.filter(
                is_private=False,
                is_archived=False,
            )
            .annotate(recent_likes=Count('likes', filter=Q(likes__created_at__gte=cutoff)))
            .filter(recent_likes__gte=engagement_threshold)
            .values_list('id', flat=True)[:limit]
        )

        project_ids = list(high_engagement)
        if project_ids:
            batch_tag_content.delay(
                content_type='project',
                content_ids=project_ids,
                tier='premium',
                force=True,
            )
            tagged_count += len(project_ids)

    except Exception as e:
        logger.error(f'Error finding high-engagement projects: {e}')

    return {
        'status': 'queued',
        'tier': 'premium',
        'count': tagged_count,
        'engagement_threshold': engagement_threshold,
    }
