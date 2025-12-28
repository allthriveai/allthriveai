"""Views for Topic admin management.

Topics are stored as Taxonomy entries with taxonomy_type='topic'.
"""

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAdminRole
from core.taxonomy.models import Taxonomy

from .serializers import TopicCreateUpdateSerializer, TopicSerializer


class AdminTopicViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing topics.
    Admin-only access with full CRUD operations.

    Topics are stored as Taxonomy entries with taxonomy_type='topic'.
    """

    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None  # Return all topics without pagination

    def get_queryset(self):
        """Get only topics (Taxonomy with taxonomy_type='topic')."""
        queryset = Taxonomy.objects.filter(taxonomy_type='topic')

        # Filter by is_active if provided
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        # Search by name or slug
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(slug__icontains=search))

        # Sorting
        sort_by = self.request.query_params.get('sort_by', 'name')
        sort_dir = self.request.query_params.get('sort_dir', 'asc')

        # Map frontend field names to model fields
        sort_field_map = {
            'title': 'name',
            'name': 'name',
            'slug': 'slug',
            'projectCount': 'project_count',
            'createdAt': 'created_at',
            'isActive': 'is_active',
        }
        sort_field = sort_field_map.get(sort_by, 'name')

        # Handle project_count sorting - not supported via queryset sorting
        # The actual project count is computed in the serializer
        if sort_field == 'project_count':
            # Fall back to name sorting since project_count requires a subquery
            sort_field = 'name'

        if sort_dir == 'desc':
            sort_field = f'-{sort_field}'
        queryset = queryset.order_by(sort_field)

        return queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TopicCreateUpdateSerializer
        return TopicSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get topic statistics."""
        topics = Taxonomy.objects.filter(taxonomy_type='topic')
        total = topics.count()
        active = topics.filter(is_active=True).count()
        inactive = topics.filter(is_active=False).count()

        # Get top topics with most usage (for display)
        top_topics_list = list(topics.filter(is_active=True).order_by('name')[:5])

        return Response(
            {
                'total': total,
                'active': active,
                'inactive': inactive,
                'topTopics': [
                    {
                        'id': t.id,
                        'title': t.name,
                        'slug': t.slug,
                        'projectCount': 0,  # Can be computed if needed
                    }
                    for t in top_topics_list
                ],
            }
        )

    @action(detail=False, methods=['post'])
    def bulk_toggle_active(self, request):
        """Bulk toggle is_active status for multiple topics."""
        topic_ids = request.data.get('topic_ids', [])
        is_active = request.data.get('is_active')

        if not topic_ids:
            return Response({'error': 'topic_ids is required'}, status=status.HTTP_400_BAD_REQUEST)
        if is_active is None:
            return Response({'error': 'is_active is required'}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = Taxonomy.objects.filter(id__in=topic_ids, taxonomy_type='topic').update(is_active=is_active)

        return Response(
            {
                'status': 'updated',
                'count': updated_count,
            }
        )
