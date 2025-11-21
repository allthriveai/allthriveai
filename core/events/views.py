"""ViewSets for Event models."""

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from core.events.models import Event
from core.events.serializers import EventSerializer


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for managing calendar events."""

    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_published', 'is_all_day']
    search_fields = ['title', 'description', 'location']
    ordering_fields = ['start_date', 'end_date', 'created_at']
    ordering = ['start_date']

    def get_permissions(self):
        """Only admins can create, update, or delete events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

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
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events (future events only)."""
        now = timezone.now()
        events = self.get_queryset().filter(start_date__gte=now)
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        """Get past events."""
        now = timezone.now()
        events = self.get_queryset().filter(end_date__lt=now)
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def ongoing(self, request):
        """Get currently ongoing events."""
        now = timezone.now()
        events = self.get_queryset().filter(start_date__lte=now, end_date__gte=now)
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def date_range(self, request):
        """Get events within a date range."""
        start = request.query_params.get('start')
        end = request.query_params.get('end')

        if not start or not end:
            return Response({'error': "Both 'start' and 'end' query parameters are required"}, status=400)

        try:
            events = self.get_queryset().filter(start_date__gte=start, end_date__lte=end)
            serializer = self.get_serializer(events, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
