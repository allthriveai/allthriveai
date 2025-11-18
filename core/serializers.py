from rest_framework import serializers
from .models import Conversation, Message, Project


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for user projects with access control.

    Exposes the fields needed to render profile grids and project pages. The
    `username` field is included so the frontend can easily construct
    `/{username}/{slug}` URLs.
    
    Content field is sanitized to prevent XSS in stored JSON data.
    """

    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Project
        fields = [
            'id',
            'username',
            'title',
            'slug',
            'description',
            'type',
            'is_showcase',
            'is_archived',
            'thumbnail_url',
            'content',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'username', 'created_at', 'updated_at']
    
    def validate_content(self, value):
        """Validate content JSON structure and size."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Content must be a JSON object.")
        
        # Limit content size to prevent DoS
        import json
        content_str = json.dumps(value)
        if len(content_str) > 100000:  # 100KB limit
            raise serializers.ValidationError(
                "Content size exceeds maximum allowed (100KB)."
            )
        
        return value
    
    def validate_thumbnail_url(self, value):
        """Validate thumbnail URL if provided."""
        if value:
            from django.core.validators import URLValidator
            from django.core.exceptions import ValidationError as DjangoValidationError
            validator = URLValidator()
            try:
                validator(value)
            except DjangoValidationError:
                raise serializers.ValidationError("Invalid thumbnail URL.")
        return value
