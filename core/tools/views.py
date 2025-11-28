from django.db.models import F, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Tool, ToolBookmark, ToolComparison, ToolReview
from .serializers import (
    ToolBookmarkSerializer,
    ToolComparisonSerializer,
    ToolDetailSerializer,
    ToolListSerializer,
    ToolReviewSerializer,
)


class ToolViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for browsing and retrieving AI tools.

    list: Get all active tools (directory view)
    retrieve: Get detailed information about a specific tool
    """

    queryset = Tool.objects.filter(is_active=True)
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'pricing_model', 'has_free_tier', 'is_featured', 'is_verified']
    search_fields = ['name', 'tagline', 'description', 'tags']
    ordering_fields = ['name', 'popularity_score', 'view_count', 'created_at']
    ordering = ['-is_featured', '-popularity_score']
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ToolDetailSerializer
        return ToolListSerializer

    def retrieve(self, request, *args, **kwargs):
        """Get tool detail and increment view count."""
        instance = self.get_object()

        # Atomic increment at database level to prevent race conditions
        Tool.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)

        # Refresh instance to get updated view_count for serializer
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured tools."""
        queryset = self.queryset.filter(is_featured=True)
        serializer = ToolListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get available tool categories with counts."""
        from django.db.models import Count

        categories = self.queryset.values('category').annotate(count=Count('id')).order_by('category')

        # Add display names
        result = []
        for cat in categories:
            tool = Tool.objects.filter(category=cat['category']).first()
            if tool:
                result.append({'value': cat['category'], 'label': tool.get_category_display(), 'count': cat['count']})

        return Response(result)

    @action(detail=True, methods=['get'])
    def reviews(self, request, slug=None):
        """Get reviews for a specific tool."""
        tool = self.get_object()
        reviews = tool.reviews.filter(is_approved=True).order_by('-created_at')

        # Pagination
        page = self.paginate_queryset(reviews)
        if page is not None:
            serializer = ToolReviewSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ToolReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def similar(self, request, slug=None):
        """Get similar tools based on category and tags."""
        tool = self.get_object()

        # Find tools in same category or with overlapping tags
        # Optimize query: only fetch needed fields, prefetch related data
        similar_tools = (
            Tool.objects.filter(is_active=True)
            .exclude(pk=tool.pk)
            .filter(Q(category=tool.category) | Q(tags__overlap=tool.tags))
            .only(
                'id',
                'name',
                'slug',
                'tagline',
                'logo_url',
                'category',
                'tags',
                'pricing_model',
                'has_free_tier',
                'is_featured',
                'is_verified',
                'view_count',
                'popularity_score',
                'created_at',
                'updated_at',
            )
            .distinct()[:5]
        )

        serializer = ToolListSerializer(similar_tools, many=True)
        return Response(serializer.data)


class ToolReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creating and managing tool reviews.

    Requires authentication to create reviews.
    """

    queryset = ToolReview.objects.filter(is_approved=True)
    serializer_class = ToolReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['tool', 'rating']
    ordering_fields = ['created_at', 'helpful_count', 'rating']
    ordering = ['-created_at']

    def get_queryset(self):
        """Users can see all approved reviews, and their own unapproved ones."""
        queryset = super().get_queryset()

        if self.request.user.is_authenticated:
            # Include user's own reviews even if not approved
            queryset = ToolReview.objects.filter(Q(is_approved=True) | Q(user=self.request.user))

        return queryset

    def perform_create(self, serializer):
        """Create review for authenticated user."""
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """Update review - only allow users to edit their own reviews."""
        if serializer.instance.user != self.request.user:
            raise PermissionDenied('You can only edit your own reviews')
        serializer.save()

    def perform_destroy(self, instance):
        """Delete review - only allow users to delete their own reviews."""
        if instance.user != self.request.user:
            raise PermissionDenied('You can only delete your own reviews')
        instance.delete()

    @action(detail=True, methods=['post'])
    def mark_helpful(self, request, pk=None):
        """Mark a review as helpful."""
        review = self.get_object()
        # Atomic increment to prevent race conditions
        ToolReview.objects.filter(pk=review.pk).update(helpful_count=F('helpful_count') + 1)
        review.refresh_from_db()
        return Response({'helpful_count': review.helpful_count})


class ToolComparisonViewSet(viewsets.ModelViewSet):
    """
    ViewSet for creating and managing tool comparisons.

    Requires authentication to create comparisons.
    """

    serializer_class = ToolComparisonSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'

    def get_queryset(self):
        """Users can see public comparisons and their own private ones."""
        if self.request.user.is_authenticated:
            return ToolComparison.objects.filter(Q(is_public=True) | Q(user=self.request.user))
        return ToolComparison.objects.filter(is_public=True)

    def perform_create(self, serializer):
        """Create comparison for authenticated user."""
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """Update comparison - only allow users to edit their own comparisons."""
        if serializer.instance.user != self.request.user:
            raise PermissionDenied('You can only edit your own comparisons')
        serializer.save()

    def perform_destroy(self, instance):
        """Delete comparison - only allow users to delete their own comparisons."""
        if instance.user != self.request.user:
            raise PermissionDenied('You can only delete your own comparisons')
        instance.delete()


class ToolBookmarkViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user tool bookmarks.

    Requires authentication.
    """

    serializer_class = ToolBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Users can only see their own bookmarks."""
        return ToolBookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Create bookmark for authenticated user."""
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """Update bookmark - only allow users to edit their own bookmarks."""
        if serializer.instance.user != self.request.user:
            raise PermissionDenied('You can only edit your own bookmarks')
        serializer.save()

    def perform_destroy(self, instance):
        """Delete bookmark - only allow users to delete their own bookmarks."""
        if instance.user != self.request.user:
            raise PermissionDenied('You can only delete your own bookmarks')
        instance.delete()

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """Toggle bookmark for a tool."""
        tool_id = request.data.get('tool_id')
        if not tool_id:
            return Response({'error': 'tool_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tool = Tool.objects.get(pk=tool_id, is_active=True)
        except Tool.DoesNotExist:
            return Response({'error': 'Tool not found'}, status=status.HTTP_404_NOT_FOUND)

        bookmark, created = ToolBookmark.objects.get_or_create(user=request.user, tool=tool)

        if not created:
            # Bookmark exists, delete it
            bookmark.delete()
            return Response({'bookmarked': False})

        # Bookmark was created
        serializer = self.get_serializer(bookmark)
        return Response({'bookmarked': True, 'bookmark': serializer.data}, status=status.HTTP_201_CREATED)
