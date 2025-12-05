"""Serializers for the Creator Marketplace API."""

import re
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from rest_framework import serializers

from core.projects.models import Project

from .models import CreatorAccount, Order, Product, ProductAccess, ProductAsset

# SECURITY: Strict YouTube URL pattern validation
# Only allows legitimate YouTube domains and URL structures
YOUTUBE_URL_PATTERNS = [
    # Standard youtube.com/watch?v=VIDEO_ID format
    r'^https?://(www\.)?youtube\.com/watch\?.*v=[\w-]{11}',
    # youtube.com/v/VIDEO_ID format
    r'^https?://(www\.)?youtube\.com/v/[\w-]{11}',
    # youtube.com/embed/VIDEO_ID format
    r'^https?://(www\.)?youtube\.com/embed/[\w-]{11}',
    # youtu.be/VIDEO_ID short URL format
    r'^https?://youtu\.be/[\w-]{11}',
    # youtube.com/shorts/VIDEO_ID format
    r'^https?://(www\.)?youtube\.com/shorts/[\w-]{11}',
]


def validate_youtube_url_strict(url: str) -> str:
    """
    Strictly validate a YouTube URL to prevent URL manipulation attacks.

    SECURITY: This validation ensures:
    1. URL is from a legitimate YouTube domain (not just containing 'youtube.com')
    2. URL structure matches known YouTube video URL patterns
    3. Video ID is a valid 11-character YouTube ID

    Args:
        url: The URL to validate

    Returns:
        The validated URL

    Raises:
        serializers.ValidationError: If URL is not a valid YouTube video URL
    """
    if not url:
        raise serializers.ValidationError('YouTube URL is required')

    # Parse and validate the URL structure
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise serializers.ValidationError('Invalid URL format') from e

    # Verify scheme is http or https
    if parsed.scheme not in ('http', 'https'):
        raise serializers.ValidationError('URL must use http or https')

    # Verify the domain is YouTube (exact match, not substring)
    valid_domains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']
    if parsed.netloc.lower() not in valid_domains:
        raise serializers.ValidationError(f'URL must be from youtube.com or youtu.be, got: {parsed.netloc}')

    # Check URL matches one of our known patterns
    url_lower = url.lower()
    if not any(re.match(pattern, url_lower) for pattern in YOUTUBE_URL_PATTERNS):
        raise serializers.ValidationError('Invalid YouTube URL format. Please provide a valid video URL.')

    # Extract and validate video ID
    video_id = None
    if 'youtube.com' in parsed.netloc:
        # Check for v= parameter
        query_params = parse_qs(parsed.query)
        if 'v' in query_params:
            video_id = query_params['v'][0]
        # Check for /v/, /embed/, /shorts/ paths
        elif '/v/' in parsed.path or '/embed/' in parsed.path or '/shorts/' in parsed.path:
            path_parts = parsed.path.split('/')
            for i, part in enumerate(path_parts):
                if part in ('v', 'embed', 'shorts') and i + 1 < len(path_parts):
                    video_id = path_parts[i + 1]
                    break
    elif 'youtu.be' in parsed.netloc:
        video_id = parsed.path.strip('/')

    # Validate video ID format (11 alphanumeric chars, dashes, underscores)
    if not video_id or not re.match(r'^[\w-]{11}$', video_id):
        raise serializers.ValidationError(
            'Could not extract valid video ID from URL. YouTube video IDs are 11 characters.'
        )

    return url


class CreatorAccountSerializer(serializers.ModelSerializer):
    """Serializer for CreatorAccount model.

    SECURITY: Stripe Connect account ID is intentionally excluded to prevent
    exposure of sensitive third-party identifiers.
    """

    username = serializers.CharField(source='user.username', read_only=True)
    is_onboarded = serializers.BooleanField(read_only=True)
    # Expose only whether Stripe is connected, not the actual account ID
    has_stripe_connected = serializers.SerializerMethodField()

    class Meta:
        model = CreatorAccount
        fields = [
            'id',
            'username',
            'has_stripe_connected',
            'onboarding_status',
            'charges_enabled',
            'payouts_enabled',
            'total_earnings',
            'pending_balance',
            'default_currency',
            'is_active',
            'is_onboarded',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'charges_enabled',
            'payouts_enabled',
            'total_earnings',
            'pending_balance',
            'created_at',
            'updated_at',
        ]

    def get_has_stripe_connected(self, obj) -> bool:
        """Return whether Stripe is connected without exposing the account ID."""
        return bool(obj.stripe_connect_account_id)


class ProductAssetSerializer(serializers.ModelSerializer):
    """Serializer for ProductAsset model."""

    class Meta:
        model = ProductAsset
        fields = [
            'id',
            'title',
            'description',
            'asset_type',
            'file_size',
            'content_type',
            'order',
            'is_preview',
            'created_at',
        ]
        read_only_fields = ['file_size', 'content_type', 'created_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product lists."""

    title = serializers.CharField(source='project.title', read_only=True)
    description = serializers.CharField(source='project.description', read_only=True)
    featured_image_url = serializers.CharField(source='project.featured_image_url', read_only=True)
    slug = serializers.CharField(source='project.slug', read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    product_type_display = serializers.CharField(source='get_product_type_display', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'description',
            'featured_image_url',
            'slug',
            'product_type',
            'product_type_display',
            'price',
            'currency',
            'status',
            'total_sales',
            'is_featured',
            'creator_username',
            'created_at',
            'published_at',
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full serializer for product details."""

    title = serializers.CharField(source='project.title', read_only=True)
    description = serializers.CharField(source='project.description', read_only=True)
    featured_image_url = serializers.CharField(source='project.featured_image_url', read_only=True)
    banner_url = serializers.CharField(source='project.banner_url', read_only=True)
    slug = serializers.CharField(source='project.slug', read_only=True)
    content = serializers.JSONField(source='project.content', read_only=True)
    difficulty_level = serializers.CharField(source='project.difficulty_level', read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    product_type_display = serializers.CharField(source='get_product_type_display', read_only=True)
    assets = ProductAssetSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'description',
            'featured_image_url',
            'banner_url',
            'slug',
            'content',
            'difficulty_level',
            'product_type',
            'product_type_display',
            'price',
            'currency',
            'status',
            'total_sales',
            'total_revenue',
            'is_featured',
            'source_type',
            'source_url',
            'creator_username',
            'assets',
            'created_at',
            'updated_at',
            'published_at',
        ]


class ProductCreateSerializer(serializers.Serializer):
    """Serializer for creating a product from scratch."""

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    product_type = serializers.ChoiceField(choices=Product.ProductType.choices)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    content = serializers.JSONField(required=False, default=dict)

    def create(self, validated_data):
        user = self.context['request'].user

        # Create the project
        project = Project.objects.create(
            user=user,
            title=validated_data['title'],
            description=validated_data.get('description', ''),
            type=Project.ProjectType.PRODUCT,
            is_product=True,
            is_private=True,  # Start as draft
            content=validated_data.get('content', {}),
        )

        # Ensure creator account exists
        CreatorAccount.objects.get_or_create(user=user)

        # Create the product
        product = Product.objects.create(
            project=project,
            creator=user,
            product_type=validated_data['product_type'],
            price=validated_data['price'],
            status=Product.Status.DRAFT,
        )

        return product


class ProductUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating product fields."""

    title = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    content = serializers.JSONField(required=False)

    class Meta:
        model = Product
        fields = ['product_type', 'price', 'title', 'description', 'content']

    def update(self, instance, validated_data):
        # Handle project fields
        project = instance.project
        if 'title' in validated_data:
            project.title = validated_data.pop('title')
        if 'description' in validated_data:
            project.description = validated_data.pop('description')
        if 'content' in validated_data:
            project.content = validated_data.pop('content')
        project.save()

        # Handle product fields
        return super().update(instance, validated_data)


class YouTubeImportSerializer(serializers.Serializer):
    """Serializer for YouTube import request.

    SECURITY: Uses strict YouTube URL validation to prevent:
    - URL manipulation attacks (e.g., evil.com?youtube.com)
    - Invalid video ID injection
    - Non-YouTube URL processing
    """

    youtube_url = serializers.URLField()
    product_type = serializers.ChoiceField(
        choices=Product.ProductType.choices,
        default=Product.ProductType.COURSE,
    )
    price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
    )

    def validate_youtube_url(self, value):
        """Validate that the URL is a valid YouTube URL with strict checking."""
        return validate_youtube_url_strict(value)


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order model."""

    product_title = serializers.CharField(source='product.project.title', read_only=True)
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'product_title',
            'buyer_username',
            'amount_paid',
            'platform_fee',
            'stripe_fee',
            'creator_payout',
            'currency',
            'status',
            'access_granted_at',
            'created_at',
        ]
        read_only_fields = '__all__'


class ProductAccessSerializer(serializers.ModelSerializer):
    """Serializer for ProductAccess model."""

    product_title = serializers.CharField(source='product.project.title', read_only=True)
    product_type = serializers.CharField(source='product.product_type', read_only=True)
    creator_username = serializers.CharField(source='product.creator.username', read_only=True)

    class Meta:
        model = ProductAccess
        fields = [
            'id',
            'product_title',
            'product_type',
            'creator_username',
            'granted_at',
            'expires_at',
            'is_active',
        ]


class CreatorDashboardSerializer(serializers.Serializer):
    """Serializer for creator dashboard stats."""

    total_products = serializers.IntegerField()
    published_products = serializers.IntegerField()
    total_sales = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    is_onboarded = serializers.BooleanField()
