"""Serializers for messaging models."""

from rest_framework import serializers

from .models import (
    ConnectionRequest,
    DirectMessage,
    DirectMessageThread,
    MessageReport,
    UserBlock,
)


class UserMiniSerializer(serializers.Serializer):
    """Minimal user serializer for messaging contexts."""

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    avatar_url = serializers.CharField(read_only=True, allow_null=True, allow_blank=True)


class ConnectionRequestSerializer(serializers.ModelSerializer):
    """Serializer for connection requests."""

    requester = UserMiniSerializer(read_only=True)
    recipient = UserMiniSerializer(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_slug = serializers.CharField(source='project.slug', read_only=True)
    project_owner_username = serializers.CharField(source='project.user.username', read_only=True)

    class Meta:
        model = ConnectionRequest
        fields = [
            'id',
            'requester',
            'recipient',
            'project',
            'project_title',
            'project_slug',
            'project_owner_username',
            'intro_message',
            'status',
            'responded_at',
            'expires_at',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'requester',
            'recipient',
            'status',
            'responded_at',
            'expires_at',
            'created_at',
        ]


class ConnectionRequestCreateSerializer(serializers.Serializer):
    """Serializer for creating a connection request."""

    intro_message = serializers.CharField(max_length=500)

    def validate_intro_message(self, value):
        """Validate intro message content."""
        import bleach

        # Sanitize HTML
        cleaned = bleach.clean(value, tags=[], strip=True)
        if len(cleaned) < 10:
            raise serializers.ValidationError('Intro message must be at least 10 characters.')
        return cleaned


class DirectMessageSerializer(serializers.ModelSerializer):
    """Serializer for direct messages."""

    sender = UserMiniSerializer(read_only=True)
    is_own_message = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = [
            'id',
            'thread',
            'sender',
            'content',
            'read_at',
            'moderation_status',
            'created_at',
            'is_own_message',
        ]
        read_only_fields = [
            'id',
            'thread',
            'sender',
            'read_at',
            'moderation_status',
            'created_at',
        ]

    def get_is_own_message(self, obj):
        """Check if message was sent by current user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False


class DirectMessageCreateSerializer(serializers.Serializer):
    """Serializer for creating a direct message."""

    content = serializers.CharField(max_length=5000)

    def validate_content(self, value):
        """Validate message content."""
        import bleach

        # Allow some basic formatting
        allowed_tags = ['p', 'br', 'strong', 'em', 'a']
        allowed_attrs = {'a': ['href']}
        cleaned = bleach.clean(value, tags=allowed_tags, attributes=allowed_attrs, strip=True)

        if len(cleaned.strip()) < 1:
            raise serializers.ValidationError('Message cannot be empty.')
        return cleaned


class DirectMessageThreadSerializer(serializers.ModelSerializer):
    """Serializer for message threads."""

    participants = UserMiniSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    originating_project_title = serializers.CharField(source='originating_project.title', read_only=True)
    originating_project_slug = serializers.CharField(source='originating_project.slug', read_only=True)
    unread_count = serializers.SerializerMethodField()
    last_message_sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = DirectMessageThread
        fields = [
            'id',
            'participants',
            'other_participant',
            'originating_project',
            'originating_project_title',
            'originating_project_slug',
            'last_message_at',
            'last_message_preview',
            'last_message_sender',
            'unread_count',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'participants',
            'originating_project',
            'last_message_at',
            'last_message_preview',
            'last_message_sender',
            'created_at',
        ]

    def get_other_participant(self, obj):
        """Get the other participant in the thread."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            other = obj.get_other_participant(request.user)
            if other:
                return UserMiniSerializer(other).data
        return None

    def get_unread_count(self, obj):
        """Get unread message count for current user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.get_unread_count(request.user)
        return 0


class MessageReportSerializer(serializers.ModelSerializer):
    """Serializer for message reports."""

    reporter = UserMiniSerializer(read_only=True)

    class Meta:
        model = MessageReport
        fields = [
            'id',
            'message',
            'reporter',
            'reason',
            'description',
            'status',
            'created_at',
        ]
        read_only_fields = ['id', 'reporter', 'status', 'created_at']


class MessageReportCreateSerializer(serializers.Serializer):
    """Serializer for creating a message report."""

    reason = serializers.ChoiceField(choices=MessageReport.ReportReason.choices)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)


class UserBlockSerializer(serializers.ModelSerializer):
    """Serializer for user blocks."""

    blocker = UserMiniSerializer(read_only=True)
    blocked = UserMiniSerializer(read_only=True)

    class Meta:
        model = UserBlock
        fields = ['id', 'blocker', 'blocked', 'reason', 'created_at']
        read_only_fields = ['id', 'blocker', 'blocked', 'created_at']


class UserBlockCreateSerializer(serializers.Serializer):
    """Serializer for blocking a user."""

    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)
