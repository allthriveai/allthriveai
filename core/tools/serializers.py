from rest_framework import serializers

from .models import Company, Tool, ToolBookmark, ToolComparison, ToolReview


class ToolIconSerializer(serializers.ModelSerializer):
    """Minimal serializer for displaying tool icons on project cards.

    Only includes fields needed for icon display to minimize payload size.
    """

    class Meta:
        model = Tool
        fields = ['id', 'name', 'slug', 'logo_url']


class CompanyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for company in tool listings."""

    tool_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'slug',
            'logo_url',
            'website_url',
            'tool_count',
        ]


class CompanyDetailSerializer(serializers.ModelSerializer):
    """Full serializer for company detail page."""

    tool_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'tagline',
            'logo_url',
            'banner_url',
            'website_url',
            'careers_url',
            'github_url',
            'twitter_handle',
            'linkedin_url',
            'founded_year',
            'headquarters',
            'company_size',
            'is_featured',
            'tool_count',
            'created_at',
            'updated_at',
        ]


class ToolListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for tool list/directory view."""

    tool_type_display = serializers.CharField(source='get_tool_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    pricing_model_display = serializers.CharField(source='get_pricing_model_display', read_only=True)
    rarity_display = serializers.CharField(source='get_rarity_display', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True, allow_null=True)
    company_slug = serializers.CharField(source='company.slug', read_only=True, allow_null=True)
    element = serializers.CharField(read_only=True)

    class Meta:
        model = Tool
        fields = [
            'id',
            'name',
            'slug',
            'tagline',
            'description',
            'tool_type',
            'tool_type_display',
            'category',
            'category_display',
            'company',
            'company_name',
            'company_slug',
            'tags',
            'logo_url',
            'website_url',
            'pricing_model',
            'pricing_model_display',
            'starting_price',
            'has_free_tier',
            'is_featured',
            'is_verified',
            'view_count',
            'popularity_score',
            'taxonomy',
            # Game/Trading Card Attributes (game_stats hidden - internal only)
            'superpowers',
            'rarity',
            'rarity_display',
            'element',
            'created_at',
            'updated_at',
        ]


class ToolDetailSerializer(serializers.ModelSerializer):
    """Full serializer for tool detail page with all content."""

    tool_type_display = serializers.CharField(source='get_tool_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    pricing_model_display = serializers.CharField(source='get_pricing_model_display', read_only=True)
    rarity_display = serializers.CharField(source='get_rarity_display', read_only=True)
    company_details = CompanyListSerializer(source='company', read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    bookmark_count = serializers.SerializerMethodField()
    element = serializers.CharField(read_only=True)

    class Meta:
        model = Tool
        fields = [
            # Basic Info
            'id',
            'name',
            'slug',
            'tagline',
            'description',
            # Type & Categorization
            'tool_type',
            'tool_type_display',
            'category',
            'category_display',
            'company',
            'company_details',
            'tags',
            # Media
            'logo_url',
            'banner_url',
            'screenshot_urls',
            'demo_video_url',
            # Links
            'website_url',
            'documentation_url',
            'pricing_url',
            'github_url',
            'twitter_handle',
            'discord_url',
            # Pricing
            'pricing_model',
            'pricing_model_display',
            'starting_price',
            'has_free_tier',
            'requires_api_key',
            'requires_waitlist',
            # Content Sections
            'overview',
            'key_features',
            'use_cases',
            'usage_tips',
            'best_practices',
            'limitations',
            'alternatives',
            'whats_new',
            # Game/Trading Card Attributes (game_stats hidden - internal only)
            'superpowers',
            'rarity',
            'rarity_display',
            'element',
            'synergy_tools',
            # Technical
            'model_info',
            'integrations',
            'api_available',
            'languages_supported',
            # SEO
            'meta_description',
            'keywords',
            # Status & Metrics
            'is_active',
            'is_featured',
            'is_verified',
            'view_count',
            'popularity_score',
            'average_rating',
            'review_count',
            'bookmark_count',
            # Taxonomy Link
            'taxonomy',
            # Timestamps
            'created_at',
            'updated_at',
            'last_verified_at',
        ]

    def get_average_rating(self, obj):
        """Calculate average rating from reviews."""
        from django.db.models import Avg

        result = obj.reviews.filter(is_approved=True).aggregate(Avg('rating'))
        avg = result.get('rating__avg')
        return round(avg, 1) if avg else None

    def get_review_count(self, obj):
        """Get count of approved reviews."""
        return obj.reviews.filter(is_approved=True).count()

    def get_bookmark_count(self, obj):
        """Get count of user bookmarks."""
        return obj.bookmarks.count()


class ToolReviewSerializer(serializers.ModelSerializer):
    """Serializer for tool reviews."""

    user_username = serializers.CharField(source='user.username', read_only=True)
    user_avatar_url = serializers.CharField(source='user.avatar_url', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = ToolReview
        fields = [
            'id',
            'tool',
            'rating',
            'title',
            'content',
            'pros',
            'cons',
            'use_case',
            'user_username',
            'user_avatar_url',
            'user_role',
            'is_verified_user',
            'helpful_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['user_username', 'user_avatar_url', 'user_role', 'is_verified_user', 'helpful_count']

    def create(self, validated_data):
        # Set user from request context
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ToolComparisonSerializer(serializers.ModelSerializer):
    """Serializer for tool comparisons."""

    tools_details = ToolListSerializer(source='tools', many=True, read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    tool_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Tool.objects.filter(is_active=True), write_only=True, source='tools'
    )

    class Meta:
        model = ToolComparison
        fields = [
            'id',
            'title',
            'description',
            'slug',
            'tools_details',
            'tool_ids',
            'user_username',
            'is_public',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['user_username', 'slug']

    def create(self, validated_data):
        # Set user from request context
        validated_data['user'] = self.context['request'].user

        # Generate slug from title
        import uuid

        from django.utils.text import slugify

        base_slug = slugify(validated_data['title'])
        validated_data['slug'] = f'{base_slug}-{uuid.uuid4().hex[:8]}'

        return super().create(validated_data)


class ToolBookmarkSerializer(serializers.ModelSerializer):
    """Serializer for user tool bookmarks."""

    tool_details = ToolListSerializer(source='tool', read_only=True)

    class Meta:
        model = ToolBookmark
        fields = ['id', 'tool', 'tool_details', 'notes', 'created_at']
        read_only_fields = ['tool_details']

    def create(self, validated_data):
        # Set user from request context
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
