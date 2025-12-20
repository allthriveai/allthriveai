"""Serializers for Project model."""

from rest_framework import serializers

from core.taxonomy.serializers import TaxonomySerializer
from core.tools.serializers import ToolIconSerializer, ToolListSerializer

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
    is_promoted = serializers.SerializerMethodField()  # Computed based on expiration
    tools_details = serializers.SerializerMethodField()  # Custom ordering based on tools_order
    categories_details = serializers.SerializerMethodField()
    topics_details = serializers.SerializerMethodField()  # Taxonomy topic details

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
            'is_showcased',
            'is_highlighted',
            'is_private',
            'is_archived',
            'is_promoted',
            'promoted_at',
            'banner_url',
            'featured_image_url',
            'external_url',
            'tools',
            'tools_details',
            'categories',
            'categories_details',
            'hide_categories',
            'topics',
            'topics_details',
            'heart_count',
            'is_liked_by_user',
            'content',
            'published_date',
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
            'topics_details',
            'is_promoted',
            'promoted_at',
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
            # Legacy block-based content
            'blocks',
            'cover',
            'tags',
            'metadata',
            # Hero display settings
            'heroDisplayMode',
            'heroQuote',
            'heroVideoUrl',
            'heroSlideshowImages',
            'heroSlideUpElement1',
            'heroSlideUpElement2',
            'heroGradientFrom',
            'heroGradientTo',
            # Template v2 section-based content
            'templateVersion',
            'sections',
            # Video project metadata
            'video',
            # Integration data (GitHub, Figma, Reddit analysis)
            'github',
            'figma',
            'reddit',
            'redditPermalink',
            # TL;DR section styling
            'tldrBgColor',
            # Tech stack from GitHub analysis
            'techStack',
        }
        provided_keys = set(value.keys())

        if not provided_keys.issubset(allowed_keys):
            invalid_keys = provided_keys - allowed_keys
            invalid_keys_str = ', '.join(invalid_keys)
            allowed_keys_str = ', '.join(sorted(allowed_keys))
            raise serializers.ValidationError(
                f'Content contains invalid keys: {invalid_keys_str}. Allowed keys: {allowed_keys_str}'
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

        # Validate sections structure (template v2)
        if 'sections' in value:
            if not isinstance(value['sections'], list):
                raise serializers.ValidationError("'sections' must be a list.")

            for i, section in enumerate(value['sections']):
                if not isinstance(section, dict):
                    raise serializers.ValidationError(f'Section at index {i} must be a JSON object.')

                # Required section fields
                required_fields = ['id', 'type', 'enabled', 'order', 'content']
                for field in required_fields:
                    if field not in section:
                        raise serializers.ValidationError(f"Section at index {i} missing required field '{field}'.")

        # Validate templateVersion
        if 'templateVersion' in value:
            if value['templateVersion'] not in [1, 2]:
                raise serializers.ValidationError("'templateVersion' must be 1 or 2.")

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

    def get_tools_details(self, obj):
        """Get tools ordered by tools_order field (first tool appears in project teaser)."""
        tools = obj.tools.all()

        # If tools_order is defined, sort tools by that order
        if obj.tools_order:
            # Create a map of tool_id -> position
            order_map = {tool_id: idx for idx, tool_id in enumerate(obj.tools_order)}
            # Sort tools by their position in tools_order, unordered tools go to end
            tools = sorted(tools, key=lambda t: order_map.get(t.id, len(obj.tools_order)))

        return ToolListSerializer(tools, many=True).data

    def get_categories_details(self, obj):
        """Get categories ordered by name."""

        # Order by name for consistent display
        categories = obj.categories.order_by('name')
        return TaxonomySerializer(categories, many=True).data

    def get_topics_details(self, obj):
        """Get topic taxonomies ordered by name."""
        topics = obj.topics.order_by('name')
        return TaxonomySerializer(topics, many=True).data

    def get_is_promoted(self, obj):
        """Check if the project is currently promoted (not expired).

        Promotions expire after PROMOTION_DURATION_DAYS days.
        """
        from datetime import timedelta

        from django.utils import timezone

        from .constants import PROMOTION_DURATION_DAYS

        if not obj.is_promoted or not obj.promoted_at:
            return False

        # Check if promotion has expired
        promotion_cutoff = timezone.now() - timedelta(days=PROMOTION_DURATION_DAYS)
        return obj.promoted_at >= promotion_cutoff

    def to_representation(self, instance):
        """Convert snake_case field names to camelCase for frontend compatibility."""
        data = super().to_representation(instance)

        # Add Reddit-specific data to content if this is a Reddit thread
        if instance.type == 'reddit_thread':
            # Use try/except to handle missing OneToOne relation
            # hasattr returns True for defined fields even if relation doesn't exist
            try:
                reddit_thread = instance.reddit_thread
            except Exception:
                reddit_thread = None

            if reddit_thread is not None:
                if 'content' not in data or data['content'] is None:
                    data['content'] = {}
                elif not isinstance(data['content'], dict):
                    data['content'] = {}

                # Get enriched data from metadata
                metadata = reddit_thread.reddit_metadata or {}

                data['content']['reddit'] = {
                    'subreddit': reddit_thread.subreddit,
                    'author': reddit_thread.author,
                    'permalink': reddit_thread.permalink,
                    'score': reddit_thread.score,
                    'num_comments': reddit_thread.num_comments,
                    'thumbnail_url': reddit_thread.thumbnail_url,
                    'created_utc': reddit_thread.created_utc.isoformat() if reddit_thread.created_utc else None,
                    'reddit_post_id': reddit_thread.reddit_post_id,
                    # Enriched data from JSON API
                    'upvote_ratio': metadata.get('upvote_ratio', 0),
                    'selftext': metadata.get('selftext', ''),
                    'selftext_html': metadata.get('selftext_html', ''),
                    'post_hint': metadata.get('post_hint', ''),
                    'link_flair_text': metadata.get('link_flair_text', ''),
                    'link_flair_background_color': metadata.get('link_flair_background_color', ''),
                    'is_video': metadata.get('is_video', False),
                    'video_url': metadata.get('video_url', ''),
                    'video_duration': metadata.get('video_duration', 0),
                    'is_gallery': metadata.get('is_gallery', False),
                    'gallery_images': metadata.get('gallery_images', []),
                    'domain': metadata.get('domain', ''),
                    'url': metadata.get('url', ''),
                    'over_18': metadata.get('over_18', False),
                    'spoiler': metadata.get('spoiler', False),
                }

        # Map snake_case to camelCase for fields that need it
        field_mapping = {
            'user_avatar_url': 'userAvatarUrl',
            'is_showcased': 'isShowcased',
            'is_highlighted': 'isHighlighted',
            'is_private': 'isPrivate',
            'is_archived': 'isArchived',
            'is_promoted': 'isPromoted',
            'promoted_at': 'promotedAt',
            'banner_url': 'bannerUrl',
            'featured_image_url': 'featuredImageUrl',
            'external_url': 'externalUrl',
            'tools_details': 'toolsDetails',
            'categories_details': 'categoriesDetails',
            'topics_details': 'topicsDetails',
            'user_tags': 'userTags',
            'heart_count': 'heartCount',
            'is_liked_by_user': 'isLikedByUser',
            'published_date': 'publishedDate',
            'created_at': 'createdAt',
            'updated_at': 'updatedAt',
            'hide_categories': 'hideCategories',
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

    def update(self, instance, validated_data):
        """Update project and save tools_order if tools are included."""
        # Extract tools if present (ManyToMany needs special handling)
        tools = validated_data.pop('tools', None)

        # Update regular fields
        instance = super().update(instance, validated_data)

        # If tools were included, set them and save order
        if tools is not None:
            instance.tools.set(tools)
            # Save the order as a list of IDs (first tool appears in project teaser)
            instance.tools_order = [tool.id for tool in tools]
            instance.save(update_fields=['tools_order'])

        return instance


class ProjectCardSerializer(serializers.ModelSerializer):
    """Lightweight serializer for explore/feed cards.

    Optimized for mobile performance by:
    - Excluding heavy 'content' field (can be up to 100KB per project)
    - Using annotated is_liked_by_user from view (no N+1 queries)
    - Minimal fields needed for card rendering

    Use this for explore page, feeds, and any list views where full content isn't needed.
    """

    username = serializers.ReadOnlyField(source='user.username')
    user_avatar_url = serializers.ReadOnlyField(source='user.avatar_url')
    heart_count = serializers.ReadOnlyField()
    # Use annotated value from queryset if available, otherwise compute
    is_liked_by_user = serializers.SerializerMethodField()
    # Lightweight content field - populated for battle and rss_article projects
    content = serializers.SerializerMethodField()
    # Minimal tool details needed for displaying tool icons on cards (custom ordering)
    tools_details = serializers.SerializerMethodField()
    # Categories details for displaying category badges (needed for rss_article cards)
    categories_details = serializers.SerializerMethodField()
    # Topic taxonomy details for displaying topic badges
    topics_details = serializers.SerializerMethodField()
    # Learning eligibility - whether project appears in learning content
    is_learning_eligible = serializers.SerializerMethodField()

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
            'is_promoted',
            'banner_url',
            'featured_image_url',
            'external_url',
            'tools',  # IDs for filtering
            'tools_details',  # Full tool objects for displaying icons
            'categories',  # IDs for filtering
            'categories_details',  # Full category objects for displaying badges
            'topics',  # IDs for filtering
            'topics_details',  # Full topic taxonomy objects for displaying badges
            'heart_count',
            'is_liked_by_user',
            'is_learning_eligible',
            'published_date',
            'created_at',
            'content',  # Populated for battle and rss_article projects
        ]

    def get_is_liked_by_user(self, obj):
        """Use annotated value if available, otherwise check manually.

        When the view uses .annotate(is_liked_by_user=Exists(...)), this uses
        the pre-computed value. Falls back to manual check for compatibility.
        """
        # Check for annotated value first (avoids N+1)
        if hasattr(obj, '_is_liked_by_user_annotation'):
            return obj._is_liked_by_user_annotation

        # Fallback for non-annotated querysets
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Check if likes are prefetched
            if hasattr(obj, '_prefetched_objects_cache') and 'likes' in obj._prefetched_objects_cache:
                return any(like.user_id == request.user.id for like in obj.likes.all())
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_tools_details(self, obj):
        """Get tools ordered by tools_order field (first tool appears in project teaser)."""
        tools = obj.tools.all()

        # If tools_order is defined, sort tools by that order
        if obj.tools_order:
            # Create a map of tool_id -> position
            order_map = {tool_id: idx for idx, tool_id in enumerate(obj.tools_order)}
            # Sort tools by their position in tools_order, unordered tools go to end
            tools = sorted(tools, key=lambda t: order_map.get(t.id, len(obj.tools_order)))

        return ToolIconSerializer(tools, many=True).data

    def get_categories_details(self, obj):
        """Get categories ordered by name for displaying category badges."""
        categories = obj.categories.order_by('name')
        return TaxonomySerializer(categories, many=True).data

    def get_topics_details(self, obj):
        """Get topic taxonomies ordered by name for displaying topic badges."""
        topics = obj.topics.order_by('name')
        return TaxonomySerializer(topics, many=True).data

    def get_is_learning_eligible(self, obj):
        """Get learning eligibility from ProjectLearningMetadata.

        Returns True if the project appears in learning content.
        Defaults to True if no metadata record exists.
        """
        from django.core.exceptions import ObjectDoesNotExist

        try:
            return obj.learning_metadata.is_learning_eligible
        except ObjectDoesNotExist:
            # No metadata exists - default to True (all projects are learning-eligible by default)
            return True

    def get_content(self, obj):
        """Return minimal content for card rendering.

        Only returns data needed for specific card types:
        - Battle projects: battleResult with image URLs for VS layout
        - RSS Article projects: sections with overview description for card preview
        - Reddit thread projects: video URL for autoplay
        - Other projects: None (full content available on detail page)
        """
        # Reddit thread projects - return video URL for autoplay in explore feed
        # Check this BEFORE the content check since reddit data comes from related model
        if obj.type == 'reddit_thread':
            # Use getattr to safely access related object (may not exist)
            reddit_thread = getattr(obj, 'reddit_thread', None)
            if reddit_thread and reddit_thread.reddit_metadata:
                metadata = reddit_thread.reddit_metadata
                is_video = metadata.get('is_video', False)
                video_url = metadata.get('video_url', '')
                if is_video and video_url:
                    return {
                        'reddit': {
                            'isVideo': True,
                            'videoUrl': video_url,
                        }
                    }
            return None

        if not obj.content:
            return None

        # Battle projects - return battle result for VS layout and preview tray
        if obj.type == 'battle':
            battle_result = obj.content.get('battleResult')
            if not battle_result:
                return None

            my_sub = battle_result.get('my_submission', {})
            opp_sub = battle_result.get('opponent_submission', {})
            opponent = battle_result.get('opponent', {})

            # Return fields needed for card rendering AND preview tray
            # Camel case keys to match frontend expectations
            return {
                'battleResult': {
                    'won': battle_result.get('won'),
                    'isTie': battle_result.get('is_tie'),
                    'challengeText': battle_result.get('challenge_text'),
                    'challengeType': battle_result.get('challenge_type'),
                    'opponent': {
                        'username': opponent.get('username'),
                        'isAi': opponent.get('is_ai', False),
                    }
                    if opponent
                    else None,
                    'mySubmission': {
                        'imageUrl': my_sub.get('image_url'),
                        'prompt': my_sub.get('prompt'),
                        'score': my_sub.get('score'),
                        'criteriaScores': my_sub.get('criteria_scores'),
                        'feedback': my_sub.get('feedback'),
                    }
                    if my_sub
                    else None,
                    'opponentSubmission': {
                        'imageUrl': opp_sub.get('image_url'),
                        'prompt': opp_sub.get('prompt'),
                        'score': opp_sub.get('score'),
                        'criteriaScores': opp_sub.get('criteria_scores'),
                        'feedback': opp_sub.get('feedback'),
                    }
                    if opp_sub
                    else None,
                }
            }

        # RSS Article projects - return sections for card preview (category/title/description overlay)
        if obj.type == 'rss_article':
            sections = obj.content.get('sections', [])
            if not sections:
                return None

            # Return minimal sections data needed for card overlay
            return {
                'sections': sections,
            }

        # Video projects with YouTube content - return video metadata for vertical/shorts display
        if obj.type == 'video':
            video = obj.content.get('video', {})
            hero_video_url = obj.content.get('heroVideoUrl', '')

            # Check if this is a YouTube video (has video metadata or YouTube URL)
            is_youtube = (
                video.get('platform') == 'youtube'
                or video.get('videoId')
                or (hero_video_url and 'youtube.com' in hero_video_url)
            )

            if is_youtube:
                return {
                    'video': {
                        'isShort': video.get('isShort', False),
                        'isVertical': video.get('isVertical', False),
                        'videoId': video.get('videoId'),
                    },
                    'heroVideoUrl': hero_video_url,
                }

        return None

    def to_representation(self, instance):
        """Convert snake_case to camelCase for frontend compatibility."""
        data = super().to_representation(instance)

        field_mapping = {
            'user_avatar_url': 'userAvatarUrl',
            'is_promoted': 'isPromoted',
            'banner_url': 'bannerUrl',
            'featured_image_url': 'featuredImageUrl',
            'external_url': 'externalUrl',
            'tools_details': 'toolsDetails',
            'categories_details': 'categoriesDetails',
            'topics_details': 'topicsDetails',
            'heart_count': 'heartCount',
            'is_liked_by_user': 'isLikedByUser',
            'is_learning_eligible': 'isLearningEligible',
            'published_date': 'publishedDate',
            'created_at': 'createdAt',
        }

        camel_case_data = {}
        for key, value in data.items():
            new_key = field_mapping.get(key, key)
            camel_case_data[new_key] = value

        return camel_case_data
