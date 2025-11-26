"""Serializers for Project model."""

from rest_framework import serializers

from core.taxonomy.serializers import TaxonomySerializer
from core.tools.serializers import ToolListSerializer

from .constants import DEFAULT_BANNER_IMAGE, MAX_CONTENT_SIZE, MAX_PROJECT_TAGS, MAX_TAG_LENGTH
from .models import Project
from .moderation import moderate_tags, sanitize_tag


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for user projects with access control.

    Exposes the fields needed to render profile grids and project pages. The
    `username` field is included so the frontend can easily construct
    `/{username}/{slug}` URLs.

    Content field is sanitized to prevent XSS in stored JSON data.
    Slug is auto-generated from title if not provided.
    """

    username = serializers.ReadOnlyField(source='user.username')
    user_avatar_url = serializers.ReadOnlyField(source='user.avatar_url')
    slug = serializers.SlugField(required=False, allow_blank=True)
    heart_count = serializers.ReadOnlyField()
    is_liked_by_user = serializers.SerializerMethodField()
    tools_details = ToolListSerializer(source='tools', many=True, read_only=True)
    categories_details = TaxonomySerializer(source='categories', many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'username',
            'user_avatar_url',
            'title',
            'slug',
            'description',
            'type',
            'is_showcase',
            'is_highlighted',
            'is_private',
            'is_archived',
            'is_published',
            'published_at',
            'banner_url',
            'featured_image_url',
            'external_url',
            'tools',
            'tools_details',
            'categories',
            'categories_details',
            'topics',
            'heart_count',
            'is_liked_by_user',
            'content',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'username',
            'user_avatar_url',
            'heart_count',
            'is_liked_by_user',
            'tools_details',
            'categories_details',
            'created_at',
            'updated_at',
        ]

    def validate_content(self, value):
        """Validate content JSON structure, sanitize HTML, and enforce size limits."""
        import json

        import bleach

        if not isinstance(value, dict):
            raise serializers.ValidationError('Content must be a JSON object.')

        # Define allowed structure - only accept known keys
        allowed_keys = {
            'blocks',
            'cover',
            'tags',
            'metadata',
            'heroDisplayMode',
            'heroQuote',
            'heroVideoUrl',
            'heroSlideshowImages',
            'heroSlideUpElement1',
            'heroSlideUpElement2',
        }
        provided_keys = set(value.keys())

        if not provided_keys.issubset(allowed_keys):
            invalid_keys = provided_keys - allowed_keys
            raise serializers.ValidationError(
                f'Content contains invalid keys: {", ".join(invalid_keys)}. Allowed keys: {", ".join(allowed_keys)}'
            )

        # Sanitize text content in blocks to prevent XSS
        if 'blocks' in value:
            if not isinstance(value['blocks'], list):
                raise serializers.ValidationError("'blocks' must be a list.")

            for i, block in enumerate(value.get('blocks', [])):
                if not isinstance(block, dict):
                    raise serializers.ValidationError(f'Block at index {i} must be a JSON object.')

                # Sanitize text fields in blocks
                if 'text' in block and isinstance(block['text'], str):
                    block['text'] = bleach.clean(
                        block['text'],
                        tags=['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3'],
                        attributes={'a': ['href', 'title']},
                        strip=True,
                    )

                # Sanitize title fields
                if 'title' in block and isinstance(block['title'], str):
                    block['title'] = bleach.clean(block['title'], tags=[], strip=True)

        # Validate tags structure
        if 'tags' in value:
            if not isinstance(value['tags'], list):
                raise serializers.ValidationError("'tags' must be a list.")

            # Limit number of tags
            if len(value['tags']) > MAX_PROJECT_TAGS:
                raise serializers.ValidationError(f'Maximum {MAX_PROJECT_TAGS} tags allowed.')

            # Sanitize each tag
            value['tags'] = [bleach.clean(str(tag), tags=[], strip=True)[:MAX_TAG_LENGTH] for tag in value['tags']]

        # Validate metadata structure
        if 'metadata' in value and not isinstance(value['metadata'], dict):
            raise serializers.ValidationError("'metadata' must be a JSON object.")

        # Check size limit AFTER sanitization
        content_str = json.dumps(value)
        if len(content_str) > MAX_CONTENT_SIZE:
            raise serializers.ValidationError(
                f'Content size exceeds maximum allowed ({MAX_CONTENT_SIZE / 1000:.0f}KB).'
            )

        return value

    def validate_topics(self, value):
        """Validate and moderate user-generated topics."""
        if not isinstance(value, list):
            raise serializers.ValidationError('topics must be a list.')

        # Sanitize tags
        sanitized = [sanitize_tag(tag) for tag in value if tag]

        # Moderate tags
        approved, rejected = moderate_tags(sanitized, max_length=50, max_count=20)

        if rejected:
            raise serializers.ValidationError(
                f'Some tags were rejected due to inappropriate content or formatting: {", ".join(rejected[:3])}'
            )

        return approved

    def validate_banner_url(self, value):
        """Validate banner URL if provided.

        Accepts both absolute URLs (https://...) and relative paths (/path/to/image).
        """
        if value:
            # Allow relative paths (starting with /)
            if value.startswith('/'):
                return value

            # Validate absolute URLs
            from django.core.exceptions import ValidationError as DjangoValidationError
            from django.core.validators import URLValidator

            validator = URLValidator()
            try:
                validator(value)
            except DjangoValidationError as e:
                raise serializers.ValidationError(
                    'Invalid banner URL. Must be a valid URL or relative path starting with /.'
                ) from e
        return value

    def get_is_liked_by_user(self, obj):
        """Check if the current user has liked this project."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def to_representation(self, instance):
        """Convert snake_case field names to camelCase for frontend compatibility."""
        data = super().to_representation(instance)

        # Map snake_case to camelCase for fields that need it
        field_mapping = {
            'user_avatar_url': 'userAvatarUrl',
            'is_showcase': 'isShowcase',
            'is_highlighted': 'isHighlighted',
            'is_private': 'isPrivate',
            'is_archived': 'isArchived',
            'is_published': 'isPublished',
            'published_at': 'publishedAt',
            'banner_url': 'bannerUrl',
            'featured_image_url': 'featuredImageUrl',
            'external_url': 'externalUrl',
            'tools_details': 'toolsDetails',
            'categories_details': 'categoriesDetails',
            'user_tags': 'userTags',
            'heart_count': 'heartCount',
            'is_liked_by_user': 'isLikedByUser',
            'created_at': 'createdAt',
            'updated_at': 'updatedAt',
        }

        # Create new dict with camelCase keys
        camel_case_data = {}
        for key, value in data.items():
            new_key = field_mapping.get(key, key)
            camel_case_data[new_key] = value

        return camel_case_data

    def create(self, validated_data):
        """Create a new project with default banner image if not provided."""
        # Set default banner image if banner_url is not provided or empty
        if not validated_data.get('banner_url'):
            validated_data['banner_url'] = DEFAULT_BANNER_IMAGE
        return super().create(validated_data)
