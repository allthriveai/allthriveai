from rest_framework import serializers

from core.social.models import SocialConnection
from core.users.models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model with field-level permissions.

    Hides sensitive fields (email) unless viewing own profile or staff.
    Prevents role field modification unless superuser.
    """

    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    social_connections = serializers.SerializerMethodField()
    current_streak = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'role_display',
            'avatar_url',
            'bio',
            'tagline',
            'location',
            'pronouns',
            'website_url',
            'calendar_url',
            'linkedin_url',
            'twitter_url',
            'github_url',
            'youtube_url',
            'instagram_url',
            'playground_is_public',
            'date_joined',
            'last_login',
            'social_connections',
            'total_points',
            'level',
            'current_streak',
        ]
        read_only_fields = [
            'id',
            'date_joined',
            'last_login',
            'role',
            'social_connections',
            'total_points',
            'level',
            'current_streak',
        ]  # Prevent role escalation and point manipulation

    def get_fields(self):
        """Dynamically adjust fields based on request context."""
        fields = super().get_fields()
        request = self.context.get('request')

        # Hide sensitive fields unless viewing own profile or staff
        if request and hasattr(request, 'user'):
            if not (request.user.is_authenticated and (self.instance == request.user or request.user.is_staff)):
                # Remove email from public profiles
                fields.pop('email', None)
                fields.pop('last_login', None)

        return fields

    def get_full_name(self, obj):
        """Return user's full name."""
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username

    def get_current_streak(self, obj):
        """Expose the user's current streak (in days) as a read-only field.

        Maps the model's ``current_streak_days`` to the API field ``current_streak``
        expected by the frontend.
        """
        return getattr(obj, 'current_streak_days', 0)

    def get_social_connections(self, obj):
        """Return connected social accounts (only for own profile)."""
        request = self.context.get('request')

        # Only include social connections for own profile or staff
        if not request or not hasattr(request, 'user'):
            return None

        if not (request.user.is_authenticated and (obj == request.user or request.user.is_staff)):
            return None

        # Return list of connected providers (without sensitive token data)
        connections = SocialConnection.objects.filter(user=obj, is_active=True)
        return [
            {
                'provider': conn.provider,
                'providerDisplay': conn.get_provider_display(),
                'providerUsername': conn.provider_username,
                'profileUrl': conn.profile_url,
                'avatarUrl': conn.avatar_url,
                'connectedAt': conn.created_at.isoformat(),
            }
            for conn in connections
        ]

    def validate_role(self, value):
        """Prevent role escalation - only superusers can change roles."""
        request = self.context.get('request')
        if request and not request.user.is_superuser:
            if self.instance and self.instance.role != value:
                raise serializers.ValidationError('You do not have permission to change user roles.')
        return value


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""

    class Meta:
        model = User
        fields = [
            'email',
            'username',
            'first_name',
            'last_name',
            'password',
            'role',
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'role': {'default': UserRole.EXPLORER},
            'username': {'required': True},
        }

    def validate_username(self, value):
        """Validate username is unique and meets requirements."""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        if len(value) < 3:
            raise serializers.ValidationError('Username must be at least 3 characters long.')
        return value

    def validate_email(self, value):
        """Validate email is unique."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        """Create a new user with encrypted password."""
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile.

    Only allows updates to safe, non-sensitive fields.
    The User model's clean() method handles input validation.
    """

    class Meta:
        model = User
        fields = [
            'username',
            'first_name',
            'last_name',
            'avatar_url',
            'bio',
            'tagline',
            'location',
            'pronouns',
            'website_url',
            'calendar_url',
            'linkedin_url',
            'twitter_url',
            'github_url',
            'youtube_url',
            'instagram_url',
            'playground_is_public',
        ]

    def validate_username(self, value):
        """Validate username is unique (excluding current user) and meets requirements."""
        # Normalize username to lowercase
        value = value.lower().strip()

        # Check if username is changing
        if self.instance and self.instance.username == value:
            return value

        # Check uniqueness
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('This username is already taken.')

        # Check length
        if len(value) < 3:
            raise serializers.ValidationError('Username must be at least 3 characters long.')
        if len(value) > 30:
            raise serializers.ValidationError('Username must be less than 30 characters.')

        # Check format (alphanumeric, underscores, hyphens only)
        import re

        if not re.match(r'^[a-z0-9_-]+$', value):
            raise serializers.ValidationError(
                'Username can only contain lowercase letters, numbers, underscores, and hyphens.'
            )

        return value

    def validate(self, attrs):
        """Ensure the user instance will pass model-level validation."""
        # Create a copy of the instance with new values for validation
        if self.instance:
            instance_copy = self.instance
            for attr, value in attrs.items():
                setattr(instance_copy, attr, value)
            # This will trigger the User.clean() method for XSS prevention
            try:
                instance_copy.clean()
            except Exception as e:
                raise serializers.ValidationError(str(e)) from e
        return attrs
