"""Serializers for Asana integration API responses.

These serializers ensure tokens are never exposed to the frontend.
"""

from rest_framework import serializers


class AsanaStatusSerializer(serializers.Serializer):
    """Serializer for Asana connection status response.

    IMPORTANT: Never include access_token or refresh_token in any response.
    """

    connected = serializers.BooleanField()
    workspaceName = serializers.CharField(required=False, allow_blank=True)
    projectName = serializers.CharField(required=False, allow_blank=True)
    syncEnabled = serializers.BooleanField(required=False)
    lastSyncedAt = serializers.DateTimeField(required=False, allow_null=True)
    lastSyncError = serializers.CharField(required=False, allow_blank=True)
    connectedAt = serializers.DateTimeField(required=False, allow_null=True)


class AsanaAuthorizeSerializer(serializers.Serializer):
    """Serializer for the authorize endpoint response."""

    authUrl = serializers.URLField()
    state = serializers.CharField()


class AsanaCallbackSerializer(serializers.Serializer):
    """Serializer for validating callback parameters."""

    code = serializers.CharField(required=True)
    state = serializers.CharField(required=True)


class AsanaErrorSerializer(serializers.Serializer):
    """Serializer for error responses."""

    error = serializers.CharField()
    message = serializers.CharField()
