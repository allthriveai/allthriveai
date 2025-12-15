"""
Celery tasks for engagement event processing.

These tasks process engagement events in batches and update
user profiles in Weaviate for personalization learning.
"""

import logging
from collections import defaultdict

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def process_engagement_batch(self):
    """
    Process unprocessed engagement events in batches.

    Groups events by user and aggregates signals for efficient
    Weaviate profile updates.

    Runs every 5 minutes via Celery Beat.
    """
    from core.engagement.models import EngagementEvent

    try:
        # Get unprocessed events (limit for memory)
        events = list(
            EngagementEvent.objects.filter(processed=False)
            .select_related('user', 'project')
            .order_by('created_at')[:5000]
        )

        if not events:
            logger.debug('No unprocessed engagement events found')
            return {'status': 'no_events', 'processed': 0}

        # Group by user for batch processing
        user_events = defaultdict(list)
        for event in events:
            user_events[event.user_id].append(event)

        # Queue user profile updates
        queued_users = 0
        for user_id, user_event_list in user_events.items():
            event_ids = [e.id for e in user_event_list]
            update_user_profile_from_events.delay(user_id, event_ids)
            queued_users += 1

        logger.info(f'Queued engagement processing for {queued_users} users ' f'({len(events)} events total)')

        return {
            'status': 'queued',
            'users': queued_users,
            'events': len(events),
        }

    except Exception as e:
        logger.error(f'Error processing engagement batch: {e}', exc_info=True)
        raise self.retry(exc=e) from e


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def update_user_profile_from_events(self, user_id: int, event_ids: list[int]):
    """
    Update user's Weaviate profile based on engagement events.

    Respects PersonalizationSettings toggles.
    """
    from core.engagement.models import EngagementEvent
    from core.users.models import User
    from services.personalization.settings_aware_scorer import SettingsAwareScorer
    from services.weaviate.tasks import sync_user_profile_to_weaviate

    try:
        user = User.objects.get(id=user_id)
        events = list(EngagementEvent.objects.filter(id__in=event_ids, processed=False).select_related('project'))

        if not events:
            logger.debug(f'No unprocessed events for user_id={user_id}')
            return {'status': 'no_events', 'user_id': user_id}

        # Check user's settings
        scorer = SettingsAwareScorer(user)

        # Filter events based on settings
        valid_events = []
        filtered_count = 0
        for event in events:
            # Filter based on user preferences
            if event.event_type == EngagementEvent.EventType.TIME_SPENT:
                if not scorer.should_track_time():
                    filtered_count += 1
                    continue
            elif event.event_type == EngagementEvent.EventType.SCROLL_DEPTH:
                if not scorer.should_track_scroll():
                    filtered_count += 1
                    continue
            elif event.event_type in (
                EngagementEvent.EventType.VIEW,
                EngagementEvent.EventType.VIEW_MILESTONE,
            ):
                if not scorer.should_penalize_views():
                    filtered_count += 1
                    continue
            valid_events.append(event)

        # Mark all events as processed (even filtered ones)
        now = timezone.now()
        EngagementEvent.objects.filter(id__in=event_ids).update(
            processed=True,
            processed_at=now,
        )

        if not valid_events:
            logger.debug(f'All {filtered_count} events filtered by settings for user_id={user_id}')
            return {'status': 'filtered_by_settings', 'user_id': user_id, 'filtered': filtered_count}

        # Aggregate engagement signals
        aggregated = _aggregate_engagement_signals(valid_events)

        # Update user profile if significant engagement
        if _should_update_profile(aggregated):
            sync_user_profile_to_weaviate.delay(user_id)
            logger.info(
                f'Triggered profile sync for user_id={user_id} '
                f'(milestones={aggregated["view_milestones"]}, '
                f'time={aggregated["total_time_spent"]}s, '
                f'scroll={aggregated["max_scroll_depth"]}%)'
            )
            return {
                'status': 'profile_sync_triggered',
                'user_id': user_id,
                'processed': len(valid_events),
                'aggregated': aggregated,
            }

        return {
            'status': 'processed_no_sync',
            'user_id': user_id,
            'processed': len(valid_events),
            'reason': 'engagement_below_threshold',
        }

    except User.DoesNotExist:
        logger.warning(f'User {user_id} not found for engagement processing')
        # Still mark events as processed
        EngagementEvent.objects.filter(id__in=event_ids).update(
            processed=True,
            processed_at=timezone.now(),
        )
        return {'status': 'user_not_found', 'user_id': user_id}
    except Exception as e:
        logger.error(
            f'Error updating profile from events for user_id={user_id}: {e}',
            exc_info=True,
        )
        raise self.retry(exc=e) from e


def _aggregate_engagement_signals(events) -> dict:
    """Aggregate engagement events into meaningful signals."""
    from core.engagement.models import EngagementEvent

    aggregated = {
        'view_milestones': 0,
        'total_time_spent': 0,
        'total_active_time': 0,
        'max_scroll_depth': 0,
        'projects_viewed': set(),
    }

    for event in events:
        payload = event.payload or {}

        if event.event_type == EngagementEvent.EventType.VIEW_MILESTONE:
            aggregated['view_milestones'] += 1
            if event.project_id:
                aggregated['projects_viewed'].add(event.project_id)

        elif event.event_type == EngagementEvent.EventType.TIME_SPENT:
            aggregated['total_time_spent'] += payload.get('seconds', 0)
            aggregated['total_active_time'] += payload.get('active_seconds', 0)
            if event.project_id:
                aggregated['projects_viewed'].add(event.project_id)

        elif event.event_type == EngagementEvent.EventType.SCROLL_DEPTH:
            depth = payload.get('depth_percent', 0)
            if depth > aggregated['max_scroll_depth']:
                aggregated['max_scroll_depth'] = depth

        elif event.event_type == EngagementEvent.EventType.VIEW:
            if event.project_id:
                aggregated['projects_viewed'].add(event.project_id)

    # Convert set to list for JSON serialization
    aggregated['projects_viewed'] = list(aggregated['projects_viewed'])
    return aggregated


def _should_update_profile(aggregated: dict) -> bool:
    """
    Determine if engagement is significant enough to update profile.

    Triggers update if:
    - 3+ view milestones (30+ second views), OR
    - 5+ minutes total time spent, OR
    - 75%+ scroll depth reached
    """
    return (
        aggregated['view_milestones'] >= 3
        or aggregated['total_time_spent'] >= 300
        or aggregated['max_scroll_depth'] >= 75
    )


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def apply_recency_decay(self):
    """
    Apply recency decay to UserTags daily.

    Tags that haven't been reinforced decay over time,
    allowing user preferences to evolve naturally.

    Runs daily at 4:30 AM via Celery Beat.
    """
    from datetime import timedelta

    from django.db.models import F

    from core.taxonomy.models import UserTag
    from services.weaviate.tasks import sync_user_profile_to_weaviate

    try:
        now = timezone.now()
        decay_rate = 0.95  # 5% decay per week

        # Decay tags not updated in last 7 days
        stale_cutoff = now - timedelta(days=7)

        # Check if UserTag has decay_factor field (migration might not be applied yet)
        if not hasattr(UserTag, 'decay_factor'):
            logger.info('UserTag.decay_factor field not found, skipping recency decay')
            return {'status': 'skipped', 'reason': 'decay_factor_field_missing'}

        # Apply decay in batches
        batch_size = 1000
        total_decayed = 0

        while True:
            # Get batch of stale auto-generated tags
            stale_tag_ids = list(
                UserTag.objects.filter(
                    updated_at__lt=stale_cutoff,
                    decay_factor__gt=0.1,  # Don't decay below 0.1
                    source__in=['auto_project', 'auto_conversation', 'auto_activity'],
                ).values_list('id', flat=True)[:batch_size]
            )

            if not stale_tag_ids:
                break

            # Apply decay and update timestamp to prevent re-fetching
            UserTag.objects.filter(id__in=stale_tag_ids).update(
                decay_factor=F('decay_factor') * decay_rate,
                updated_at=now,
            )
            total_decayed += len(stale_tag_ids)

        # Delete tags that have decayed below threshold
        deleted_count, _ = UserTag.objects.filter(
            decay_factor__lt=0.1,
            source__in=['auto_project', 'auto_conversation', 'auto_activity'],
        ).delete()

        # Queue profile syncs for affected users (limit to avoid flooding)
        affected_user_ids = list(
            UserTag.objects.filter(updated_at__lt=stale_cutoff).values_list('user_id', flat=True).distinct()[:100]
        )

        for user_id in affected_user_ids:
            sync_user_profile_to_weaviate.delay(user_id)

        logger.info(
            f'Recency decay complete: decayed={total_decayed}, '
            f'deleted={deleted_count}, profiles_queued={len(affected_user_ids)}'
        )

        return {
            'status': 'success',
            'decayed': total_decayed,
            'deleted': deleted_count,
            'profiles_queued': len(affected_user_ids),
        }

    except Exception as e:
        logger.error(f'Error applying recency decay: {e}', exc_info=True)
        raise self.retry(exc=e) from e
