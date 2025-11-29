"""Serializers for content source integrations."""

from rest_framework import serializers

from core.integrations.models import ContentSource


class ContentSourceSerializer(serializers.ModelSerializer):
    """Serializer for ContentSource model."""

    class Meta:
        model = ContentSource
        fields = [
            'id',
            'platform',
            'source_identifier',
            'source_url',
            'display_name',
            'sync_enabled',
            'sync_frequency',
            'last_synced_at',
            'last_sync_status',
            'last_sync_error',
            'metadata',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'source_identifier',
            'last_synced_at',
            'last_sync_status',
            'last_sync_error',
            'metadata',
            'created_at',
            'updated_at',
        ]


class YouTubeImportSerializer(serializers.Serializer):
    """Serializer for YouTube import requests."""

    video_url = serializers.URLField(required=False, help_text='YouTube video URL (for single video import)')
    channel_url = serializers.URLField(required=False, help_text='YouTube channel URL (for channel import)')
    is_showcase = serializers.BooleanField(default=True, help_text='Display in showcase section')
    is_private = serializers.BooleanField(default=False, help_text='Make project private')
    max_videos = serializers.IntegerField(
        default=50, min_value=1, max_value=100, help_text='Max videos to import from channel'
    )

    def validate(self, data):
        """Ensure either video_url or channel_url is provided."""
        if not data.get('video_url') and not data.get('channel_url'):
            raise serializers.ValidationError('Either video_url or channel_url must be provided')
        if data.get('video_url') and data.get('channel_url'):
            raise serializers.ValidationError('Provide either video_url or channel_url, not both')
        return data
