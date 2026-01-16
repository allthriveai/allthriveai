"""Views for Listing API."""

from django.db.models import Exists, OuterRef
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from core.permissions import IsOwnerOrReadOnly

from .models import (
    Listing,
    ListingComment,
    ListingHeart,
    ListingIntent,
    ListingSave,
    ListingStatus,
    ListingVersion,
    ListingView,
)
from .serializers import (
    ListingCardSerializer,
    ListingCommentSerializer,
    ListingSerializer,
    ListingVersionSerializer,
)


class ListingViewSet(viewsets.ModelViewSet):
    """ViewSet for Listing CRUD operations.

    Supports:
    - List all public listings (GET /api/v1/listings/)
    - Create new listing (POST /api/v1/listings/)
    - Retrieve listing (GET /api/v1/listings/{id}/)
    - Update listing (PATCH /api/v1/listings/{id}/)
    - Delete listing (DELETE /api/v1/listings/{id}/)
    - Heart/unheart (POST /api/v1/listings/{id}/heart/)
    - Save/unsave (POST /api/v1/listings/{id}/save/)
    - Comments (GET/POST /api/v1/listings/{id}/comments/)
    - Versions (GET /api/v1/listings/{id}/versions/)
    """

    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'heart_count', 'view_count']
    ordering = ['-created_at']

    def get_queryset(self):
        """Return listings based on user permissions and filters."""
        user = self.request.user

        # Base queryset with optimizations
        queryset = Listing.objects.select_related(
            'user',
            'listing_type',
            'category',
            'owner',
            'parent',
        ).prefetch_related(
            'topics',
            'tags',
            'tools',
        )

        # Filter by visibility
        if user.is_authenticated:
            # Annotate with user interaction state
            queryset = queryset.annotate(
                _is_hearted_annotation=Exists(ListingHeart.objects.filter(listing=OuterRef('pk'), user=user)),
                _is_saved_annotation=Exists(ListingSave.objects.filter(listing=OuterRef('pk'), user=user)),
            )
            queryset = queryset.for_user(user)
        else:
            queryset = queryset.public()

        # Filter by intent (ask/offer)
        intent = self.request.query_params.get('intent')
        if intent in [ListingIntent.ASK, ListingIntent.OFFER]:
            queryset = queryset.filter(intent=intent)

        # Filter by listing_type slug
        listing_type = self.request.query_params.get('listing_type')
        if listing_type:
            queryset = queryset.filter(listing_type__slug=listing_type)

        # Filter by category slug
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__slug=category)

        # Filter by username
        username = self.request.query_params.get('username')
        if username:
            queryset = queryset.filter(user__username=username)

        # Filter by slug
        slug = self.request.query_params.get('slug')
        if slug:
            queryset = queryset.filter(slug=slug)

        # Filter by availability
        available = self.request.query_params.get('available')
        if available == 'true':
            queryset = queryset.filter(is_available=True)
        elif available == 'false':
            queryset = queryset.filter(is_available=False)

        # Filter by paid/free
        paid = self.request.query_params.get('paid')
        if paid == 'true':
            queryset = queryset.filter(is_paid=True)
        elif paid == 'false':
            queryset = queryset.filter(is_paid=False)

        return queryset

    def get_serializer_class(self):
        """Use card serializer for list, full serializer for detail."""
        if self.action == 'list':
            return ListingCardSerializer
        return ListingSerializer

    def perform_create(self, serializer):
        """Set user on create."""
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """Get listing and optionally record view."""
        instance = self.get_object()

        # Record view (with basic deduplication)
        if request.user.is_authenticated:
            # Check if user viewed in last 5 minutes
            from datetime import timedelta

            from django.utils import timezone

            recent_cutoff = timezone.now() - timedelta(minutes=5)
            recent_view = ListingView.objects.filter(
                listing=instance,
                user=request.user,
                created_at__gte=recent_cutoff,
            ).exists()

            if not recent_view:
                source = request.query_params.get('source', 'direct')
                ListingView.objects.create(
                    listing=instance,
                    user=request.user,
                    source=source,
                )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def heart(self, request, pk=None):
        """Toggle heart on listing."""
        listing = self.get_object()

        heart, created = ListingHeart.objects.get_or_create(
            user=request.user,
            listing=listing,
        )

        if not created:
            # Already hearted, remove it
            heart.delete()
            return Response({'hearted': False, 'heartCount': listing.heart_count})

        return Response({'hearted': True, 'heartCount': listing.heart_count})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def save(self, request, pk=None):
        """Toggle save on listing."""
        listing = self.get_object()
        note = request.data.get('note', '')

        save_obj, created = ListingSave.objects.get_or_create(
            user=request.user,
            listing=listing,
            defaults={'note': note},
        )

        if not created:
            # Already saved, remove it
            save_obj.delete()
            return Response({'saved': False, 'saveCount': listing.save_count})

        return Response({'saved': True, 'saveCount': listing.save_count})

    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        """Get or create comments on listing."""
        listing = self.get_object()

        if request.method == 'GET':
            # Get top-level approved comments
            comments = (
                ListingComment.objects.filter(
                    listing=listing,
                    parent__isnull=True,
                    is_deleted=False,
                    moderation_status='approved',
                )
                .select_related('user')
                .prefetch_related('replies__user')
                .order_by('-created_at')
            )

            serializer = ListingCommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)

        # POST - create comment
        if not request.user.is_authenticated:
            return Response(
                {'detail': 'Authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ListingCommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Auto-approve for now (can add moderation later)
        comment = ListingComment.objects.create(
            user=request.user,
            listing=listing,
            body=serializer.validated_data['body'],
            parent=serializer.validated_data.get('parent'),
            moderation_status='approved',
        )

        return Response(
            ListingCommentSerializer(comment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get version history for listing."""
        listing = self.get_object()

        # Only owner can view versions
        if listing.user != request.user and not request.user.is_staff:
            return Response(
                {'detail': 'You do not have permission to view versions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        versions = ListingVersion.objects.filter(listing=listing).select_related('created_by')
        serializer = ListingVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def publish(self, request, pk=None):
        """Publish a draft listing."""
        listing = self.get_object()

        if listing.user != request.user:
            return Response(
                {'detail': 'You do not have permission to publish this listing.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Set appropriate status based on intent
        if listing.intent == ListingIntent.ASK:
            listing.status = ListingStatus.OPEN
        else:
            listing.status = ListingStatus.PUBLISHED

        listing.save()

        # Create version snapshot
        ListingVersion.objects.create(
            listing=listing,
            version=listing.version,
            title=listing.title,
            description=listing.description,
            body=listing.body,
            data={
                'intent': listing.intent,
                'listing_type_id': listing.listing_type_id,
                'category_id': listing.category_id,
                'price': str(listing.price) if listing.price else None,
                'is_paid': listing.is_paid,
            },
            change_summary='Published',
            created_by=request.user,
        )

        # Increment version
        listing.version += 1
        listing.save(update_fields=['version'])

        serializer = self.get_serializer(listing)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def archive(self, request, pk=None):
        """Archive a listing (soft delete)."""
        listing = self.get_object()

        if listing.user != request.user:
            return Response(
                {'detail': 'You do not have permission to archive this listing.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        listing.is_archived = True
        listing.status = ListingStatus.ARCHIVED
        listing.save(update_fields=['is_archived', 'status'])

        return Response({'archived': True})


class UserListingsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing a user's listings by username.

    GET /api/v1/users/{username}/listings/
    GET /api/v1/users/{username}/listings/asks/
    GET /api/v1/users/{username}/listings/offers/
    """

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = ListingCardSerializer

    def get_queryset(self):
        """Get listings for the specified user."""
        username = self.kwargs.get('username')

        queryset = (
            Listing.objects.filter(
                user__username=username,
            )
            .select_related(
                'user',
                'listing_type',
                'category',
            )
            .prefetch_related('tools')
        )

        # Show all listings to owner, only public to others
        if self.request.user.is_authenticated and self.request.user.username == username:
            queryset = queryset.filter(is_archived=False)
        else:
            queryset = queryset.public()

        # Annotate with heart status
        if self.request.user.is_authenticated:
            queryset = queryset.annotate(
                _is_hearted_annotation=Exists(
                    ListingHeart.objects.filter(listing=OuterRef('pk'), user=self.request.user)
                ),
            )

        return queryset.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def asks(self, request, username=None):
        """Get only asks for this user."""
        queryset = self.get_queryset().filter(intent=ListingIntent.ASK)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def offers(self, request, username=None):
        """Get only offers for this user."""
        queryset = self.get_queryset().filter(intent=ListingIntent.OFFER)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
