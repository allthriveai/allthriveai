"""Serializers for Listing model."""

from rest_framework import serializers

from core.serializers.mixins import CamelCaseFieldsMixin
from core.taxonomy.models import Taxonomy
from core.taxonomy.serializers import TaxonomySerializer
from core.tools.serializers import ToolIconSerializer, ToolListSerializer
from core.users.serializers import UserMinimalSerializer

from .models import (
    Listing,
    ListingComment,
    ListingHeart,
    ListingIntent,
    ListingSave,
    ListingVersion,
)


class ListingSerializer(CamelCaseFieldsMixin, serializers.ModelSerializer):
    """Full serializer for Listing with all fields for editing.

    Used for create, update, and detail views where full inline editing is needed.
    """

    # Read-only user info
    username = serializers.ReadOnlyField(source='user.username')
    user_avatar_url = serializers.ReadOnlyField(source='user.avatar_url')
    user_display_name = serializers.SerializerMethodField()

    # Slug auto-generated if not provided
    slug = serializers.SlugField(required=False, allow_blank=True)

    # Engagement counts (read-only, updated by signals)
    heart_count = serializers.ReadOnlyField()
    comment_count = serializers.ReadOnlyField()
    share_count = serializers.ReadOnlyField()
    save_count = serializers.ReadOnlyField()
    view_count = serializers.ReadOnlyField()
    connection_count = serializers.ReadOnlyField()
    conversion_rate = serializers.ReadOnlyField()

    # User interaction state
    is_hearted_by_user = serializers.SerializerMethodField()
    is_saved_by_user = serializers.SerializerMethodField()

    # Taxonomy FK fields - accept IDs, return nested on read
    listing_type = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='listing_type', is_active=True),
    )
    listing_type_details = serializers.SerializerMethodField()

    category = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='category', is_active=True),
        required=False,
        allow_null=True,
    )
    category_details = serializers.SerializerMethodField()

    # M2M fields - IDs for write, nested for read
    topics_details = serializers.SerializerMethodField()
    tags_details = serializers.SerializerMethodField()
    tools_details = serializers.SerializerMethodField()

    # Owner details (for agents)
    owner_details = serializers.SerializerMethodField()

    # Parent listing details
    parent_details = serializers.SerializerMethodField()

    # CamelCase field mapping
    CAMEL_CASE_FIELDS = {
        'user_avatar_url': 'userAvatarUrl',
        'user_display_name': 'userDisplayName',
        'listing_type': 'listingType',
        'listing_type_details': 'listingTypeDetails',
        'category_details': 'categoryDetails',
        'topics_details': 'topicsDetails',
        'tags_details': 'tagsDetails',
        'tools_details': 'toolsDetails',
        'owner_details': 'ownerDetails',
        'parent_details': 'parentDetails',
        'body_html': 'bodyHtml',
        'featured_image_url': 'featuredImageUrl',
        'banner_url': 'bannerUrl',
        'logo_url': 'logoUrl',
        'is_paid': 'isPaid',
        'pricing_type': 'pricingType',
        'stripe_product_id': 'stripeProductId',
        'stripe_price_id': 'stripePriceId',
        'accepts_credits': 'acceptsCredits',
        'credit_price': 'creditPrice',
        'budget_min': 'budgetMin',
        'budget_max': 'budgetMax',
        'is_negotiable': 'isNegotiable',
        'is_available': 'isAvailable',
        'response_time': 'responseTime',
        'ideal_match': 'idealMatch',
        'is_recurring': 'isRecurring',
        'recurrence_type': 'recurrenceType',
        'external_url': 'externalUrl',
        'source_url': 'sourceUrl',
        'scheduled_publish_at': 'scheduledPublishAt',
        'is_featured': 'isFeatured',
        'is_archived': 'isArchived',
        'heart_count': 'heartCount',
        'comment_count': 'commentCount',
        'share_count': 'shareCount',
        'save_count': 'saveCount',
        'view_count': 'viewCount',
        'connection_count': 'connectionCount',
        'conversion_rate': 'conversionRate',
        'is_hearted_by_user': 'isHeartedByUser',
        'is_saved_by_user': 'isSavedByUser',
        'created_at': 'createdAt',
        'updated_at': 'updatedAt',
        'published_at': 'publishedAt',
    }

    class Meta:
        model = Listing
        fields = [
            # Identity
            'id',
            'username',
            'user_avatar_url',
            'user_display_name',
            'slug',
            # Core content
            'title',
            'description',
            'body',
            'body_html',
            # Intent & Type
            'intent',
            'listing_type',
            'listing_type_details',
            # Categorization
            'category',
            'category_details',
            'topics',
            'topics_details',
            'tags',
            'tags_details',
            'tools',
            'tools_details',
            # Ownership
            'owner',
            'owner_details',
            # Media
            'featured_image_url',
            'banner_url',
            'logo_url',
            'media',
            # Pricing
            'is_paid',
            'price',
            'pricing_type',
            'currency',
            'stripe_product_id',
            'stripe_price_id',
            'accepts_credits',
            'credit_price',
            # Budget
            'budget_min',
            'budget_max',
            'is_negotiable',
            # Availability
            'is_available',
            'capacity',
            'response_time',
            # Timeline
            'deadline',
            # Location
            'location',
            'timezone',
            # Requirements
            'requirements',
            'ideal_match',
            # Recurring
            'is_recurring',
            'recurrence_type',
            # Links
            'external_url',
            'source_url',
            # Publishing
            'status',
            'visibility',
            'scheduled_publish_at',
            'is_featured',
            'is_archived',
            'version',
            # Relationships
            'parent',
            'parent_details',
            # Engagement (read-only)
            'heart_count',
            'comment_count',
            'share_count',
            'save_count',
            'view_count',
            'connection_count',
            'conversion_rate',
            'is_hearted_by_user',
            'is_saved_by_user',
            # Timestamps
            'created_at',
            'updated_at',
            'published_at',
        ]
        read_only_fields = [
            'id',
            'username',
            'user_avatar_url',
            'user_display_name',
            'body_html',
            'stripe_product_id',
            'stripe_price_id',
            'version',
            'heart_count',
            'comment_count',
            'share_count',
            'save_count',
            'view_count',
            'connection_count',
            'conversion_rate',
            'is_hearted_by_user',
            'is_saved_by_user',
            'created_at',
            'updated_at',
            'published_at',
        ]

    def get_user_display_name(self, obj):
        """Get display name for listing creator."""
        return obj.user.get_full_name() or obj.user.username

    def get_is_hearted_by_user(self, obj):
        """Check if current user has hearted this listing."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check for annotated value first
            if hasattr(obj, '_is_hearted_annotation'):
                return obj._is_hearted_annotation
            return obj.hearts.filter(user=request.user).exists()
        return False

    def get_is_saved_by_user(self, obj):
        """Check if current user has saved this listing."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check for annotated value first
            if hasattr(obj, '_is_saved_annotation'):
                return obj._is_saved_annotation
            return obj.saves.filter(user=request.user).exists()
        return False

    def get_listing_type_details(self, obj):
        """Get listing type taxonomy details."""
        if obj.listing_type:
            return TaxonomySerializer(obj.listing_type).data
        return None

    def get_category_details(self, obj):
        """Get category taxonomy details."""
        if obj.category:
            return TaxonomySerializer(obj.category).data
        return None

    def get_topics_details(self, obj):
        """Get topic taxonomies."""
        topics = obj.topics.order_by('name')
        return TaxonomySerializer(topics, many=True).data

    def get_tags_details(self, obj):
        """Get tag taxonomies."""
        tags = obj.tags.order_by('name')
        return TaxonomySerializer(tags, many=True).data

    def get_tools_details(self, obj):
        """Get tools with icons."""
        tools = obj.tools.all()
        return ToolListSerializer(tools, many=True).data

    def get_owner_details(self, obj):
        """Get owner details (for agent listings)."""
        if obj.owner:
            return UserMinimalSerializer(obj.owner).data
        return None

    def get_parent_details(self, obj):
        """Get parent listing minimal details."""
        if obj.parent:
            return {
                'id': obj.parent.id,
                'title': obj.parent.title,
                'slug': obj.parent.slug,
                'username': obj.parent.user.username,
            }
        return None

    def validate_body(self, value):
        """Render markdown to HTML."""
        import bleach
        import markdown

        if value:
            # Convert markdown to HTML
            html = markdown.markdown(
                value,
                extensions=['fenced_code', 'tables', 'nl2br'],
            )
            # Sanitize HTML
            self._body_html = bleach.clean(
                html,
                tags=[
                    'p',
                    'br',
                    'strong',
                    'em',
                    'a',
                    'ul',
                    'ol',
                    'li',
                    'code',
                    'pre',
                    'h1',
                    'h2',
                    'h3',
                    'h4',
                    'blockquote',
                    'table',
                    'thead',
                    'tbody',
                    'tr',
                    'th',
                    'td',
                ],
                attributes={'a': ['href', 'title']},
                strip=True,
            )
        else:
            self._body_html = ''
        return value

    def validate(self, data):
        """Cross-field validation."""
        intent = data.get('intent', getattr(self.instance, 'intent', None))
        listing_type = data.get('listing_type', getattr(self.instance, 'listing_type', None))

        # Agent listings require owner
        if listing_type and listing_type.slug == 'agent':
            if not data.get('owner') and not getattr(self.instance, 'owner', None):
                raise serializers.ValidationError({'owner': 'Owner is required for agent listings.'})

        # Validate pricing fields for offers
        if intent == ListingIntent.OFFER:
            is_paid = data.get('is_paid', getattr(self.instance, 'is_paid', False))
            if is_paid:
                price = data.get('price', getattr(self.instance, 'price', None))
                if price is None or price <= 0:
                    raise serializers.ValidationError({'price': 'Price is required for paid listings.'})

        return data

    def create(self, validated_data):
        """Create listing with rendered body HTML."""
        # Set body_html from validation
        if hasattr(self, '_body_html'):
            validated_data['body_html'] = self._body_html

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Update listing with rendered body HTML."""
        # Set body_html from validation
        if hasattr(self, '_body_html'):
            validated_data['body_html'] = self._body_html

        return super().update(instance, validated_data)


class ListingCardSerializer(CamelCaseFieldsMixin, serializers.ModelSerializer):
    """Lightweight serializer for listing cards in feeds.

    Optimized for performance - excludes heavy fields like body.
    """

    username = serializers.ReadOnlyField(source='user.username')
    user_avatar_url = serializers.ReadOnlyField(source='user.avatar_url')
    heart_count = serializers.ReadOnlyField()
    is_hearted_by_user = serializers.SerializerMethodField()

    listing_type_details = serializers.SerializerMethodField()
    category_details = serializers.SerializerMethodField()
    tools_details = serializers.SerializerMethodField()

    CAMEL_CASE_FIELDS = {
        'user_avatar_url': 'userAvatarUrl',
        'listing_type': 'listingType',
        'listing_type_details': 'listingTypeDetails',
        'category_details': 'categoryDetails',
        'tools_details': 'toolsDetails',
        'featured_image_url': 'featuredImageUrl',
        'banner_url': 'bannerUrl',
        'is_paid': 'isPaid',
        'pricing_type': 'pricingType',
        'is_available': 'isAvailable',
        'heart_count': 'heartCount',
        'is_hearted_by_user': 'isHeartedByUser',
        'created_at': 'createdAt',
    }

    class Meta:
        model = Listing
        fields = [
            'id',
            'username',
            'user_avatar_url',
            'slug',
            'title',
            'description',
            'intent',
            'listing_type',
            'listing_type_details',
            'category',
            'category_details',
            'tools',
            'tools_details',
            'featured_image_url',
            'banner_url',
            'is_paid',
            'price',
            'pricing_type',
            'is_available',
            'status',
            'heart_count',
            'is_hearted_by_user',
            'created_at',
        ]

    def get_is_hearted_by_user(self, obj):
        """Check if current user has hearted this listing."""
        if hasattr(obj, '_is_hearted_annotation'):
            return obj._is_hearted_annotation
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.hearts.filter(user=request.user).exists()
        return False

    def get_listing_type_details(self, obj):
        """Get listing type taxonomy details."""
        if obj.listing_type:
            return TaxonomySerializer(obj.listing_type).data
        return None

    def get_category_details(self, obj):
        """Get category taxonomy details."""
        if obj.category:
            return TaxonomySerializer(obj.category).data
        return None

    def get_tools_details(self, obj):
        """Get tools with icons."""
        tools = obj.tools.all()
        return ToolIconSerializer(tools, many=True).data


class ListingHeartSerializer(serializers.ModelSerializer):
    """Serializer for listing hearts."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ListingHeart
        fields = ['id', 'user', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class ListingSaveSerializer(serializers.ModelSerializer):
    """Serializer for listing saves."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ListingSave
        fields = ['id', 'user', 'note', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class ListingCommentSerializer(CamelCaseFieldsMixin, serializers.ModelSerializer):
    """Serializer for listing comments."""

    user = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    CAMEL_CASE_FIELDS = {
        'is_edited': 'isEdited',
        'is_deleted': 'isDeleted',
        'moderation_status': 'moderationStatus',
        'created_at': 'createdAt',
        'updated_at': 'updatedAt',
    }

    class Meta:
        model = ListingComment
        fields = [
            'id',
            'user',
            'body',
            'parent',
            'replies',
            'is_edited',
            'is_deleted',
            'moderation_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'replies',
            'is_edited',
            'is_deleted',
            'moderation_status',
            'created_at',
            'updated_at',
        ]

    def get_replies(self, obj):
        """Get nested replies (one level deep)."""
        if obj.parent is None:  # Only get replies for top-level comments
            replies = obj.replies.filter(
                is_deleted=False,
                moderation_status='approved',
            ).order_by('created_at')
            return ListingCommentSerializer(replies, many=True, context=self.context).data
        return []


class ListingVersionSerializer(CamelCaseFieldsMixin, serializers.ModelSerializer):
    """Serializer for listing version history."""

    created_by = UserMinimalSerializer(read_only=True)

    CAMEL_CASE_FIELDS = {
        'change_summary': 'changeSummary',
        'created_by': 'createdBy',
        'created_at': 'createdAt',
    }

    class Meta:
        model = ListingVersion
        fields = [
            'id',
            'version',
            'title',
            'description',
            'body',
            'data',
            'change_summary',
            'created_by',
            'created_at',
        ]
        read_only_fields = fields
