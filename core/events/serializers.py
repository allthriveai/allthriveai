"""Serializers for Event models."""

from rest_framework import serializers

from core.events.models import Event


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""

    is_past = serializers.ReadOnlyField()
    is_upcoming = serializers.ReadOnlyField()
    is_ongoing = serializers.ReadOnlyField()
    created_by_username = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()

    def get_created_by_username(self, obj):
        """Safely get created_by username."""
        return obj.created_by.username if obj.created_by else None

    def get_updated_by_username(self, obj):
        """Safely get updated_by username."""
        return obj.updated_by.username if obj.updated_by else None

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'description',
            'start_date',
            'end_date',
            'location',
            'event_url',
            'is_all_day',
            'color',
            'thumbnail',
            'timezone_name',
            'created_by',
            'created_by_username',
            'updated_by',
            'updated_by_username',
            'created_at',
            'updated_at',
            'is_published',
            'is_past',
            'is_upcoming',
            'is_ongoing',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def validate_color(self, value):
        """Validate color is a valid hex code."""
        import re

        if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError('Color must be a valid hex code (e.g., #3b82f6)')
        return value

    def validate_event_url(self, value):
        """Validate event URL uses HTTPS."""
        if value and not value.startswith('https://'):
            raise serializers.ValidationError('Event URL must use HTTPS protocol')
        return value

    def validate_thumbnail(self, value):
        """Validate thumbnail URL uses HTTPS."""
        if value and not value.startswith('https://'):
            raise serializers.ValidationError('Thumbnail URL must use HTTPS protocol')
        return value

    def validate(self, data):
        """Validate event data."""
        if 'start_date' in data and 'end_date' in data:
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return data
