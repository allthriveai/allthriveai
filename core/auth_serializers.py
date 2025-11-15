from rest_framework import serializers
from .models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    
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
            'date_joined',
            'last_login',
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def get_full_name(self, obj):
        """Return user's full name."""
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


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
    """Serializer for updating user profile."""
    
    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'avatar_url',
            'bio',
        ]
