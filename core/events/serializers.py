"""Serializers for Event models."""

from rest_framework import serializers

from core.events.models import Event


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""

    is_past = serializers.ReadOnlyField()
    is_upcoming = serializers.ReadOnlyField()
    is_ongoing = serializers.ReadOnlyField()
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

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
            'created_by',
            'created_by_username',
            'created_at',
            'updated_at',
            'is_published',
            'is_past',
            'is_upcoming',
            'is_ongoing',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def validate(self, data):
        """Validate that end_date is after start_date."""
        if 'start_date' in data and 'end_date' in data:
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError('End date must be after start date.')
        return data
