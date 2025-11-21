"""ViewSets for Event models."""

import logging
from datetime import datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.events.models import Event
from core.events.serializers import EventSerializer

logger = logging.getLogger(__name__)


class EventCreationThrottle(UserRateThrottle):
    """Throttle for event creation - 10 events per hour per user."""

    rate = '10/hour'


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for managing calendar events."""

    queryset = Event.objects.select_related('created_by', 'updated_by').all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_published', 'is_all_day']
    search_fields = ['title', 'description', 'location']
    ordering_fields = ['start_date', 'end_date', 'created_at']
    ordering = ['start_date']
    throttle_classes = [EventCreationThrottle]

    def get_permissions(self):
        """Only admins can create, update, or delete events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_throttles(self):
        """Apply throttling only to create action."""
        if self.action == 'create':
            return [EventCreationThrottle()]
        return []

    def get_queryset(self):
        """Filter to only show published events for non-admin users."""
        queryset = super().get_queryset()

        # Admin users can see all events
        if self.request.user.is_staff:
            return queryset

        # Regular users only see published events
        return queryset.filter(is_published=True)

    def perform_create(self, serializer):
        """Set created_by to current user when creating event."""
        event = serializer.save(created_by=self.request.user)
        logger.info(f'Event created: {event.id} "{event.title}" by user {self.request.user.username}')

    def perform_update(self, serializer):
        """Set updated_by to current user when updating event."""
        event = serializer.save(updated_by=self.request.user)
        logger.info(f'Event updated: {event.id} "{event.title}" by user {self.request.user.username}')

    def perform_destroy(self, instance):
        """Log event deletion."""
        logger.warning(f'Event deleted: {instance.id} "{instance.title}" by user {self.request.user.username}')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events (future events only)."""
        now = timezone.now()
        queryset = self.get_queryset().filter(start_date__gte=now)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        """Get past events."""
        now = timezone.now()
        queryset = self.get_queryset().filter(end_date__lt=now)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def ongoing(self, request):
        """Get currently ongoing events."""
        now = timezone.now()
        queryset = self.get_queryset().filter(start_date__lte=now, end_date__gte=now)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def date_range(self, request):
        """Get events within a date range."""
        start = request.query_params.get('start')
        end = request.query_params.get('end')

        if not start or not end:
            return Response(
                {'error': "Both 'start' and 'end' query parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Validate date formats
            start_date = datetime.fromisoformat(start.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))

            if end_date < start_date:
                return Response(
                    {'error': 'End date must be after start date'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            queryset = self.get_queryset().filter(start_date__gte=start_date, end_date__lte=end_date)
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except (ValueError, TypeError) as e:
            logger.warning(f'Invalid date format in date_range request: {e}')
            return Response(
                {'error': 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:MM:SS)'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DjangoValidationError as e:
            logger.error(f'Validation error in date_range: {e}')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f'Unexpected error in date_range: {e}')
            return Response(
                {'error': 'An unexpected error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
