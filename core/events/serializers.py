"""Serializers for Event models."""

from rest_framework import serializers

from core.events.models import Event, EventRSVP


class EventRSVPSerializer(serializers.ModelSerializer):
    """Serializer for EventRSVP model."""

    user_username = serializers.SerializerMethodField()

    def get_user_username(self, obj):
        """Get username of user who RSVP'd."""
        return obj.user.username if obj.user else None

    class Meta:
        model = EventRSVP
        fields = ['id', 'event', 'user', 'user_username', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""

    is_past = serializers.ReadOnlyField()
    is_upcoming = serializers.ReadOnlyField()
    is_ongoing = serializers.ReadOnlyField()
    rsvp_count = serializers.ReadOnlyField()
    going_count = serializers.ReadOnlyField()
    maybe_count = serializers.ReadOnlyField()
    created_by_username = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()
    user_rsvp_status = serializers.SerializerMethodField()
    attendees = serializers.SerializerMethodField()

    def get_created_by_username(self, obj):
        """Safely get created_by username."""
        return obj.created_by.username if obj.created_by else None

    def get_updated_by_username(self, obj):
        """Safely get updated_by username."""
        return obj.updated_by.username if obj.updated_by else None

    def get_user_rsvp_status(self, obj):
        """Get current user's RSVP status for this event."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            rsvp = obj.rsvps.filter(user=request.user).first()
            return rsvp.status if rsvp else None
        return None

    def get_attendees(self, obj):
        """Get list of users who RSVP'd 'going' to this event."""
        going_rsvps = obj.rsvps.filter(status='going').select_related('user')[:10]
        return [
            {
                'id': rsvp.user.id,
                'username': rsvp.user.username,
                'avatarUrl': rsvp.user.avatar_url,
            }
            for rsvp in going_rsvps
        ]

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
            'rsvp_count',
            'going_count',
            'maybe_count',
            'user_rsvp_status',
            'attendees',
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
