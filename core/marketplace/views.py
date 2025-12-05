"""API views for the Creator Marketplace.

SECURITY NOTES:
- All views use IsAuthenticated permission
- User isolation is enforced at queryset level (filter by request.user)
- Object-level permissions verify ownership before any mutation
- Public endpoints only expose published products
- YouTube import is rate limited to prevent abuse (5 imports/hour)
"""

import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import CreatorAccount, Order, Product, ProductAccess
from .serializers import (
    CreatorAccountSerializer,
    CreatorDashboardSerializer,
    OrderSerializer,
    ProductAccessSerializer,
    ProductCreateSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductUpdateSerializer,
    YouTubeImportSerializer,
)
from .services import (
    CourseGenerationError,
    YouTubeTranscriptError,
    get_creator_dashboard_stats,
    import_youtube_as_product,
)


class YouTubeImportThrottle(UserRateThrottle):
    """
    Rate limit for YouTube imports to prevent abuse.

    SECURITY: Limits imports to 5 per hour per user to:
    - Prevent API abuse and excessive AI costs
    - Protect against automated scraping attempts
    - Ensure fair usage across users
    """

    rate = '5/hour'
    scope = 'youtube_import'


logger = logging.getLogger(__name__)


class IsProductOwner:
    """Mixin to verify user owns the product being accessed."""

    def check_product_ownership(self, product, user):
        """Raise PermissionDenied if user doesn't own the product."""
        if product.creator != user:
            logger.warning(f'User {user.id} attempted to access product {product.id} owned by {product.creator_id}')
            raise PermissionDenied('You do not have permission to access this product.')


class CreatorAccountView(APIView):
    """
    Manage creator account and Stripe Connect onboarding.

    GET: Get current creator account status
    POST: Create creator account (if not exists)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get creator account status."""
        try:
            account = CreatorAccount.objects.get(user=request.user)
            serializer = CreatorAccountSerializer(account)
            return Response(serializer.data)
        except CreatorAccount.DoesNotExist:
            return Response(
                {'exists': False, 'message': 'No creator account found'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def post(self, request):
        """Create or get creator account."""
        account, created = CreatorAccount.objects.get_or_create(user=request.user)
        serializer = CreatorAccountSerializer(account)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CreatorDashboardView(APIView):
    """Get creator dashboard statistics."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get dashboard stats for the current creator."""
        stats = get_creator_dashboard_stats(request.user)
        serializer = CreatorDashboardSerializer(stats)
        return Response(serializer.data)


class ProductViewSet(IsProductOwner, viewsets.ModelViewSet):
    """
    ViewSet for managing creator products.

    Supports:
    - List all products for current user
    - Create new product
    - Retrieve product details
    - Update product
    - Delete product (archives, doesn't delete)
    - publish: Publish a draft product
    - archive: Archive a published product

    SECURITY: User isolation enforced at queryset and object level.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return products owned by the current user only.

        SECURITY: Filters to current user to prevent cross-user data access.
        """
        return (
            Product.objects.filter(creator=self.request.user)
            .select_related(
                'project',
                'creator',
            )
            .prefetch_related('assets')
            .order_by('-created_at')
        )

    def get_object(self):
        """Get object with explicit ownership verification.

        SECURITY: Double-checks ownership even though queryset is filtered.
        """
        obj = super().get_object()
        self.check_product_ownership(obj, self.request.user)
        return obj

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return ProductListSerializer
        elif self.action == 'create':
            return ProductCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProductUpdateSerializer
        return ProductDetailSerializer

    def perform_destroy(self, instance):
        """Archive instead of delete."""
        instance.archive()

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a draft product to the marketplace."""
        product = self.get_object()

        if product.status == Product.Status.PUBLISHED:
            return Response(
                {'error': 'Product is already published'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if creator has completed Stripe onboarding for paid products
        if product.price > 0:
            try:
                account = CreatorAccount.objects.get(user=request.user)
                if not account.is_onboarded:
                    return Response(
                        {'error': 'Please complete Stripe Connect onboarding to sell paid products'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except CreatorAccount.DoesNotExist:
                return Response(
                    {'error': 'Please set up your creator account first'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        product.publish()

        # Make the project public
        project = product.project
        project.is_private = False
        project.is_showcased = True
        project.save(update_fields=['is_private', 'is_showcased'])

        serializer = ProductDetailSerializer(product)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a product (hide from marketplace)."""
        product = self.get_object()
        product.archive()

        # Make the project private
        project = product.project
        project.is_private = True
        project.save(update_fields=['is_private'])

        serializer = ProductDetailSerializer(product)
        return Response(serializer.data)


class YouTubeImportView(APIView):
    """
    Import a YouTube video and generate a course product.

    POST: Import video and create product with AI-generated course structure

    SECURITY:
    - Rate limited to 5 imports per hour per user
    - YouTube URL strictly validated
    - Requires authentication
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [YouTubeImportThrottle]

    def post(self, request):
        """Import YouTube video as a product."""
        serializer = YouTubeImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        youtube_url = serializer.validated_data['youtube_url']
        product_type = serializer.validated_data['product_type']
        price = serializer.validated_data['price']

        logger.info(
            f'YouTube import request from user {request.user.id}: {youtube_url}',
            extra={
                'user_id': request.user.id,
                'youtube_url': youtube_url,
                'product_type': product_type,
            },
        )

        try:
            product, project = import_youtube_as_product(
                youtube_url=youtube_url,
                user=request.user,
                product_type=product_type,
                price=float(price),
            )

            return Response(
                {
                    'success': True,
                    'product_id': product.id,
                    'project_id': project.id,
                    'title': project.title,
                    'message': 'Video imported successfully! Your course is ready for review.',
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:
            logger.warning(f'YouTube import validation error: {e}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except YouTubeTranscriptError as e:
            logger.warning(f'YouTube transcript error: {e}')
            return Response(
                {
                    'error': ('Could not get video transcript. The video may not have captions available.'),
                    'detail': str(e),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        except CourseGenerationError as e:
            logger.error(f'Course generation error: {e}')
            return Response(
                {
                    'error': 'Failed to generate course structure from video content.',
                    'detail': str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        except Exception as e:
            logger.exception(f'Unexpected error during YouTube import: {e}')
            return Response(
                {'error': 'An unexpected error occurred. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UserLibraryView(APIView):
    """
    Get products the user has purchased (their library).

    GET: List all products the user has access to
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user's purchased products."""
        access_grants = (
            ProductAccess.objects.filter(
                user=request.user,
                is_active=True,
            )
            .select_related(
                'product',
                'product__project',
                'product__creator',
            )
            .order_by('-granted_at')
        )

        serializer = ProductAccessSerializer(access_grants, many=True)
        return Response(serializer.data)


class CreatorSalesView(APIView):
    """
    Get sales/orders for a creator.

    GET: List all orders for products by the current creator
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get creator's sales."""
        orders = (
            Order.objects.filter(
                creator=request.user,
            )
            .select_related(
                'product',
                'product__project',
                'buyer',
            )
            .order_by('-created_at')
        )

        # Filter by status if provided
        order_status = request.query_params.get('status')
        if order_status:
            orders = orders.filter(status=order_status)

        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([])  # Public endpoint
def marketplace_browse(request):
    """
    Browse published products in the marketplace.

    Query params:
    - type: Filter by product type (course, prompt_pack, template, ebook)
    - featured: Only featured products (true/false)
    - creator: Filter by creator username
    - limit: Number of results (default 20)
    - offset: Pagination offset
    """
    products = (
        Product.objects.filter(
            status=Product.Status.PUBLISHED,
        )
        .select_related(
            'project',
            'creator',
        )
        .order_by('-published_at')
    )

    # Filter by type
    product_type = request.query_params.get('type')
    if product_type:
        products = products.filter(product_type=product_type)

    # Filter by featured
    featured = request.query_params.get('featured')
    if featured and featured.lower() == 'true':
        products = products.filter(is_featured=True)

    # Filter by creator
    creator = request.query_params.get('creator')
    if creator:
        products = products.filter(creator__username=creator)

    # Pagination
    try:
        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
    except ValueError:
        limit = 20
        offset = 0

    limit = min(limit, 100)  # Cap at 100

    total_count = products.count()
    products = products[offset : offset + limit]

    serializer = ProductListSerializer(products, many=True)

    return Response(
        {
            'results': serializer.data,
            'total': total_count,
            'limit': limit,
            'offset': offset,
        }
    )


@api_view(['GET'])
@permission_classes([])  # Public endpoint
def product_public_detail(request, username, slug):
    """
    Get public product details by creator username and project slug.

    This is the public product page view.
    """
    try:
        product = (
            Product.objects.select_related(
                'project',
                'creator',
            )
            .prefetch_related(
                'assets',
            )
            .get(
                creator__username=username,
                project__slug=slug,
                status=Product.Status.PUBLISHED,
            )
        )
    except Product.DoesNotExist:
        return Response(
            {'error': 'Product not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Check if user has access (for content unlocking)
    has_access = False
    if request.user.is_authenticated:
        has_access = (
            ProductAccess.objects.filter(
                user=request.user,
                product=product,
                is_active=True,
            ).exists()
            or product.creator == request.user
        )

    serializer = ProductDetailSerializer(product)
    data = serializer.data
    data['has_access'] = has_access

    return Response(data)
