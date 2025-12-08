"""Serializers for User models."""

from rest_framework import serializers

from core.users.models import PersonalizationSettings, User, UserFollow


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for user data in nested relationships.

    Use this when you only need basic user info (id, username, avatar)
    for displaying in lists, comments, etc.
    """

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'avatar_url',
        ]
        read_only_fields = fields


class UserPublicSerializer(serializers.ModelSerializer):
    """Public user profile serializer.

    Includes public profile information that can be displayed
    on profile pages and public-facing views.
    """

    is_following = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'avatar_url',
            'bio',
            'tagline',
            'location',
            'pronouns',
            'current_status',
            'website_url',
            'linkedin_url',
            'twitter_url',
            'github_url',
            'youtube_url',
            'instagram_url',
            'role',
            'tier',
            'total_points',
            'followers_count',
            'following_count',
            'is_following',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        """Return user's full name."""
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username

    def get_is_following(self, obj):
        """Check if the current user is following this user.

        Uses annotated _is_following if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if request.user.id == obj.id:
            return None  # Can't follow yourself
        # Use pre-annotated value if available (avoids N+1 in list views)
        if hasattr(obj, '_is_following'):
            return obj._is_following
        # Fallback to query (for single-object serialization)
        return UserFollow.objects.filter(follower=request.user, following=obj).exists()


class UserFollowSerializer(serializers.ModelSerializer):
    """Serializer for follow relationships."""

    user = UserMinimalSerializer(source='following', read_only=True)

    class Meta:
        model = UserFollow
        fields = ['id', 'user', 'created_at']
        read_only_fields = fields


class FollowerSerializer(serializers.ModelSerializer):
    """Serializer for listing followers."""

    user = UserMinimalSerializer(source='follower', read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = UserFollow
        fields = ['id', 'user', 'is_following', 'created_at']
        read_only_fields = fields

    def get_is_following(self, obj):
        """Check if current user is following this follower back.

        Uses annotated _is_following_back if available (set by view for N+1 prevention),
        otherwise falls back to database query.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        # Use pre-annotated value if available (avoids N+1)
        if hasattr(obj, '_is_following_back'):
            return obj._is_following_back
        # Fallback to query (for single-object serialization)
        return UserFollow.objects.filter(follower=request.user, following=obj.follower).exists()


class PersonalizationSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user personalization settings.

    Allows users to control which signals influence their recommendations
    and manage privacy preferences for tracking.
    """

    class Meta:
        model = PersonalizationSettings
        fields = [
            'use_topic_selections',
            'learn_from_views',
            'learn_from_likes',
            'consider_skill_level',
            'factor_content_difficulty',
            'use_social_signals',
            'discovery_balance',
            'allow_time_tracking',
            'allow_scroll_tracking',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_discovery_balance(self, value):
        """Ensure discovery_balance is between 0 and 100."""
        if value < 0 or value > 100:
            raise serializers.ValidationError('Discovery balance must be between 0 and 100.')
        return value


class ProfileSectionsSerializer(serializers.ModelSerializer):
    """Serializer for user profile sections.

    Handles the customizable showcase sections that make up a user's
    personal homepage/profile showcase tab.
    """

    class Meta:
        model = User
        fields = ['profile_sections']

    def validate_profile_sections(self, value):
        """Validate the profile sections structure."""
        if not isinstance(value, list):
            raise serializers.ValidationError('Profile sections must be a list.')

        valid_types = {'hero', 'about', 'featured_projects', 'skills', 'stats', 'links', 'custom'}

        for section in value:
            if not isinstance(section, dict):
                raise serializers.ValidationError('Each section must be an object.')

            required_fields = {'id', 'type', 'visible', 'order', 'content'}
            missing_fields = required_fields - set(section.keys())
            if missing_fields:
                raise serializers.ValidationError(f'Section missing required fields: {missing_fields}')

            if section.get('type') not in valid_types:
                raise serializers.ValidationError(
                    f'Invalid section type: {section.get("type")}. Must be one of: {valid_types}'
                )

            if not isinstance(section.get('visible'), bool):
                raise serializers.ValidationError('Section "visible" must be a boolean.')

            if not isinstance(section.get('order'), int):
                raise serializers.ValidationError('Section "order" must be an integer.')

            if not isinstance(section.get('content'), dict):
                raise serializers.ValidationError('Section "content" must be an object.')

        return value


class UserProfileWithSectionsSerializer(UserPublicSerializer):
    """Extended user profile serializer including profile sections.

    Used for the profile page showcase tab to include both public
    profile information and the customizable sections.
    """

    profile_sections = serializers.JSONField(read_only=True)

    class Meta(UserPublicSerializer.Meta):
        fields = UserPublicSerializer.Meta.fields + ['profile_sections']
