"""Serializers for avatar API endpoints."""

from rest_framework import serializers

from .models import AvatarGenerationIteration, AvatarGenerationSession, UserAvatar


class UserAvatarSerializer(serializers.ModelSerializer):
    """Serializer for UserAvatar model."""

    creation_mode_display = serializers.CharField(source='get_creation_mode_display', read_only=True)

    class Meta:
        model = UserAvatar
        fields = [
            'id',
            'image_url',
            'creation_mode',
            'creation_mode_display',
            'template_used',
            'original_prompt',
            'is_current',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AvatarGenerationIterationSerializer(serializers.ModelSerializer):
    """Serializer for AvatarGenerationIteration model."""

    class Meta:
        model = AvatarGenerationIteration
        fields = [
            'id',
            'prompt',
            'image_url',
            'order',
            'is_selected',
            'generation_time_ms',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AvatarGenerationSessionSerializer(serializers.ModelSerializer):
    """Serializer for AvatarGenerationSession model."""

    iterations = AvatarGenerationIterationSerializer(many=True, read_only=True)
    saved_avatar = UserAvatarSerializer(read_only=True)
    creation_mode_display = serializers.CharField(source='get_creation_mode_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AvatarGenerationSession
        fields = [
            'id',
            'conversation_id',
            'creation_mode',
            'creation_mode_display',
            'template_used',
            'reference_image_url',
            'status',
            'status_display',
            'error_message',
            'achievement_awarded',
            'created_at',
            'updated_at',
            'iterations',
            'saved_avatar',
        ]
        read_only_fields = ['id', 'conversation_id', 'created_at', 'updated_at']


class AvatarGenerationSessionCreateSerializer(serializers.Serializer):
    """Serializer for creating a new avatar generation session."""

    creation_mode = serializers.ChoiceField(choices=UserAvatar.CREATION_MODE_CHOICES)
    template_used = serializers.CharField(max_length=50, required=False, allow_blank=True)
    reference_image_url = serializers.URLField(max_length=500, required=False, allow_null=True)

    def validate(self, data):
        """Validate that template-based sessions have a template_used value."""
        if data.get('creation_mode') == 'template' and not data.get('template_used'):
            raise serializers.ValidationError(
                {'template_used': 'Template name is required when creation_mode is "template".'}
            )
        if data.get('creation_mode') == 'make_me' and not data.get('reference_image_url'):
            raise serializers.ValidationError(
                {'reference_image_url': 'Reference image URL is required when creation_mode is "make_me".'}
            )
        return data


class SetCurrentAvatarSerializer(serializers.Serializer):
    """Serializer for setting the current avatar."""

    avatar_id = serializers.IntegerField()

    def validate_avatar_id(self, value):
        """Validate that the avatar exists and belongs to the user."""
        user = self.context.get('request').user
        if not UserAvatar.objects.filter(id=value, user=user, deleted_at__isnull=True).exists():
            raise serializers.ValidationError('Avatar not found.')
        return value
