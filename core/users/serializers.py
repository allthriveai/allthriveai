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

    class Meta:
        model = User
        fields = [
            'id',
            'username',
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
            'followers_count',
            'following_count',
            'is_following',
        ]
        read_only_fields = fields

    def get_is_following(self, obj):
        """Check if the current user is following this user."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if request.user.id == obj.id:
            return None  # Can't follow yourself
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
        """Check if current user is following this follower back."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
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
