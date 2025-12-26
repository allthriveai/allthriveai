"""Serializers for User models."""

from rest_framework import serializers

from core.taxonomy.models import Taxonomy
from core.users.models import PersonalizationSettings, User, UserFollow


class TaxonomyMinimalSerializer(serializers.ModelSerializer):
    """Minimal taxonomy serializer for nested use in user profiles."""

    class Meta:
        model = Taxonomy
        fields = ['id', 'name', 'slug', 'taxonomy_type']
        read_only_fields = fields


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

    # Taxonomy fields (read-only nested representation)
    personality = TaxonomyMinimalSerializer(read_only=True)
    learning_styles = TaxonomyMinimalSerializer(many=True, read_only=True)
    roles = TaxonomyMinimalSerializer(many=True, read_only=True)
    goals = TaxonomyMinimalSerializer(many=True, read_only=True)
    interests = TaxonomyMinimalSerializer(many=True, read_only=True)
    industries = TaxonomyMinimalSerializer(many=True, read_only=True)

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
            # Taxonomy preferences
            'personality',
            'learning_styles',
            'roles',
            'goals',
            'interests',
            'industries',
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
            'excited_features',
            'desired_integrations',
            'desired_integrations_other',
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

        valid_types = {
            'about',
            'links',
            'skills',
            'learning_goals',
            'featured_projects',
            'all_projects',
            'storefront',
            'featured_content',
            'battle_stats',
            'recent_battles',
            'custom',
            # Legacy types (kept for backwards compatibility)
            'hero',
            'stats',
        }

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


class UserTaxonomyPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for updating user taxonomy preferences.

    Used during onboarding and profile settings to set explicit user preferences.
    These are the user's stated preferences, distinct from inferred preferences
    in UserTag which are generated from behavior.
    """

    # Accept IDs for write, return nested objects for read
    personality_id = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='personality', is_active=True),
        source='personality',
        write_only=True,
        required=False,
        allow_null=True,
    )
    learning_style_ids = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='learning_style', is_active=True),
        source='learning_styles',
        many=True,
        write_only=True,
        required=False,
    )
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='role', is_active=True),
        source='roles',
        many=True,
        write_only=True,
        required=False,
    )
    goal_ids = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='goal', is_active=True),
        source='goals',
        many=True,
        write_only=True,
        required=False,
    )
    interest_ids = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='interest', is_active=True),
        source='interests',
        many=True,
        write_only=True,
        required=False,
    )
    industry_ids = serializers.PrimaryKeyRelatedField(
        queryset=Taxonomy.objects.filter(taxonomy_type='industry', is_active=True),
        source='industries',
        many=True,
        write_only=True,
        required=False,
    )

    # Read-only nested representation
    personality = TaxonomyMinimalSerializer(read_only=True)
    learning_styles = TaxonomyMinimalSerializer(many=True, read_only=True)
    roles = TaxonomyMinimalSerializer(many=True, read_only=True)
    goals = TaxonomyMinimalSerializer(many=True, read_only=True)
    interests = TaxonomyMinimalSerializer(many=True, read_only=True)
    industries = TaxonomyMinimalSerializer(many=True, read_only=True)

    # Skill level from LearnerProfile (for learning plan personalization)
    skill_level = serializers.ChoiceField(
        choices=['beginner', 'intermediate', 'advanced'],
        required=False,
        allow_null=True,
        help_text='Overall skill level for learning content personalization',
    )

    class Meta:
        model = User
        fields = [
            # Write fields (accept IDs)
            'personality_id',
            'learning_style_ids',
            'role_ids',
            'goal_ids',
            'interest_ids',
            'industry_ids',
            # Read fields (return nested objects)
            'personality',
            'learning_styles',
            'roles',
            'goals',
            'interests',
            'industries',
            # Skill level (from LearnerProfile)
            'skill_level',
        ]

    def to_representation(self, instance):
        """Add skill_level from LearnerProfile to the response."""
        data = super().to_representation(instance)

        # Get skill level from LearnerProfile if it exists
        try:
            learner_profile = instance.learner_profile
            data['skill_level'] = learner_profile.current_difficulty_level
        except Exception:
            data['skill_level'] = None

        return data

    def update(self, instance, validated_data):
        """Update user taxonomy preferences."""
        # Handle skill level separately (stored in LearnerProfile)
        skill_level = validated_data.pop('skill_level', None)
        if skill_level is not None:
            from core.learning_paths.models import LearnerProfile

            learner_profile, _ = LearnerProfile.objects.get_or_create(user=instance)
            learner_profile.current_difficulty_level = skill_level
            learner_profile.save(update_fields=['current_difficulty_level'])
            # Invalidate member context cache so Ava sees the update
            from services.agents.context.member_context import MemberContextService

            MemberContextService.invalidate_cache(instance.id)

        # Handle M2M fields separately
        learning_styles = validated_data.pop('learning_styles', None)
        roles = validated_data.pop('roles', None)
        goals = validated_data.pop('goals', None)
        interests = validated_data.pop('interests', None)
        industries = validated_data.pop('industries', None)

        # Update FK field
        if 'personality' in validated_data:
            instance.personality = validated_data.pop('personality')
            instance.save(update_fields=['personality'])

        # Update M2M fields
        if learning_styles is not None:
            instance.learning_styles.set(learning_styles)
        if roles is not None:
            instance.roles.set(roles)
        if goals is not None:
            instance.goals.set(goals)
        if interests is not None:
            instance.interests.set(interests)
        if industries is not None:
            instance.industries.set(industries)

        return instance


class TeamMemberSerializer(serializers.ModelSerializer):
    """Serializer for team member profiles (AI agents).

    Used for the public Team page to display All Thrive AI team members
    with their personalities and roles.
    """

    full_name = serializers.SerializerMethodField()
    team_type = serializers.SerializerMethodField()

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
            'youtube_url',
            'instagram_url',
            # Agent personality fields
            'signature_phrases',
            'agent_interests',
            # Computed fields
            'team_type',
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        """Return agent's full name."""
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username

    def get_team_type(self, obj):
        """Determine if this is a core team member or expert contributor.

        Core team: ava, pip, sage, haven (AI personas)
        Expert contributors: RSS feed curators, YouTube curators, etc.
        """
        core_team_usernames = {'ava', 'pip', 'sage', 'haven'}
        if obj.username.lower() in core_team_usernames:
            return 'core'
        return 'contributor'
