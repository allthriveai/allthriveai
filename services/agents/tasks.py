"""
Celery tasks for async hallucination tracking.

These run in background workers - zero impact on user-facing latency.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 60},
    retry_backoff=True,
)
def save_hallucination_metrics(
    self,
    response_text: str,
    confidence_level: str,
    confidence_score: float,
    flags: list[str],
    tool_outputs: list[dict],
    session_id: str,
    user_id: int,
    feature: str,
    metadata: dict,
):
    """
    Save hallucination metrics to database (async).

    Runs in background worker - no user latency impact.
    Retries on failure with exponential backoff.
    """
    try:
        from core.agents.models import HallucinationMetrics

        HallucinationMetrics.objects.create(
            session_id=session_id,
            user_id=user_id,
            feature=feature,
            response_text=response_text,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            flags=flags,
            tool_outputs=tool_outputs,
            metadata=metadata,
        )

        logger.info(
            f'[HALLUCINATION_TRACKING] Saved metrics for session {session_id} - '
            f'{confidence_level} ({confidence_score:.2f})'
        )

    except Exception as e:
        logger.error(f'[HALLUCINATION_TRACKING] Failed to save metrics: {e}', exc_info=True)
        raise  # Trigger retry


@shared_task
def cleanup_old_metrics(days: int = 90):
    """
    Cleanup hallucination metrics older than X days.

    Run daily via cron: 0 2 * * * (2 AM)
    """
    from datetime import timedelta

    from django.utils import timezone

    from core.agents.models import HallucinationMetrics

    cutoff_date = timezone.now() - timedelta(days=days)
    deleted_count, _ = HallucinationMetrics.objects.filter(created_at__lt=cutoff_date).delete()

    logger.info(f'[HALLUCINATION_CLEANUP] Deleted {deleted_count} old metrics (older than {days} days)')
    return deleted_count
