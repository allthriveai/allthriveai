"""
API views for engagement tracking.

Provides endpoints for frontend to submit batched engagement events.
"""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.engagement.models import EngagementEvent

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_engagement_events(request):
    """
    Submit a batch of engagement events.

    Expected payload:
    {
        "events": [
            {
                "event_type": "view_milestone",
                "project_id": 123,
                "payload": {"threshold_seconds": 30}
            },
            {
                "event_type": "scroll_depth",
                "project_id": 123,
                "payload": {"depth_percent": 75}
            },
            {
                "event_type": "time_spent",
                "project_id": 123,
                "payload": {"seconds": 45, "active_seconds": 30}
            }
        ]
    }

    Returns:
        201: Events created successfully
        400: Invalid payload
    """
    events_data = request.data.get('events', [])

    if not events_data:
        return Response(
            {'error': 'No events provided'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(events_data, list):
        return Response(
            {'error': 'Events must be a list'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Limit batch size to prevent abuse
    max_batch_size = 50
    if len(events_data) > max_batch_size:
        return Response(
            {'error': f'Maximum batch size is {max_batch_size} events'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    valid_event_types = {choice[0] for choice in EngagementEvent.EventType.choices}
    created_events = []
    errors = []

    for idx, event_data in enumerate(events_data):
        event_type = event_data.get('event_type')
        project_id = event_data.get('project_id')
        payload = event_data.get('payload', {})

        # Validate event type
        if not event_type:
            errors.append({'index': idx, 'error': 'Missing event_type'})
            continue

        if event_type not in valid_event_types:
            errors.append(
                {
                    'index': idx,
                    'error': f'Invalid event_type: {event_type}',
                }
            )
            continue

        # Create event
        try:
            event = EngagementEvent.objects.create(
                user=request.user,
                event_type=event_type,
                project_id=project_id,
                payload=payload,
            )
            created_events.append(event.id)
        except Exception as e:
            logger.warning(
                f'Failed to create engagement event: {e}',
                extra={'event_data': event_data, 'user_id': request.user.id},
            )
            errors.append({'index': idx, 'error': str(e)})

    response_data = {
        'created': len(created_events),
        'event_ids': created_events,
    }

    if errors:
        response_data['errors'] = errors
        # Partial success
        if created_events:
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

    return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_view_milestone(request):
    """
    Track a view milestone (user viewed content for 30+ seconds).

    Expected payload:
    {
        "project_id": 123,
        "threshold_seconds": 30
    }
    """
    project_id = request.data.get('project_id')
    threshold_seconds = request.data.get('threshold_seconds', 30)

    if not project_id:
        return Response(
            {'error': 'project_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    event = EngagementEvent.objects.create(
        user=request.user,
        event_type=EngagementEvent.EventType.VIEW_MILESTONE,
        project_id=project_id,
        payload={'threshold_seconds': threshold_seconds},
    )

    return Response(
        {'id': event.id, 'event_type': event.event_type},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_time_spent(request):
    """
    Track time spent on content.

    Expected payload:
    {
        "project_id": 123,
        "seconds": 45,
        "active_seconds": 30  // optional
    }
    """
    project_id = request.data.get('project_id')
    seconds = request.data.get('seconds')
    active_seconds = request.data.get('active_seconds')

    if not project_id:
        return Response(
            {'error': 'project_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if seconds is None:
        return Response(
            {'error': 'seconds is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = {'seconds': seconds}
    if active_seconds is not None:
        payload['active_seconds'] = active_seconds

    event = EngagementEvent.objects.create(
        user=request.user,
        event_type=EngagementEvent.EventType.TIME_SPENT,
        project_id=project_id,
        payload=payload,
    )

    return Response(
        {'id': event.id, 'event_type': event.event_type},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_scroll_depth(request):
    """
    Track scroll depth on content.

    Expected payload:
    {
        "project_id": 123,
        "depth_percent": 75
    }
    """
    project_id = request.data.get('project_id')
    depth_percent = request.data.get('depth_percent')

    if not project_id:
        return Response(
            {'error': 'project_id is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if depth_percent is None:
        return Response(
            {'error': 'depth_percent is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    event = EngagementEvent.objects.create(
        user=request.user,
        event_type=EngagementEvent.EventType.SCROLL_DEPTH,
        project_id=project_id,
        payload={'depth_percent': depth_percent},
    )

    return Response(
        {'id': event.id, 'event_type': event.event_type},
        status=status.HTTP_201_CREATED,
    )
