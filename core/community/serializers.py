"""
DRF Serializers for Community Messaging

Serializers handle conversion between Django models and JSON API responses.
Note: All field names use snake_case in serializers; the axios interceptors
handle automatic conversion to camelCase for frontend consumption.
"""

from rest_framework import serializers

from core.users.serializers import UserMinimalSerializer

from .models import (
    DirectMessageThread,
    Message,
    MessageReaction,
    ModerationQueue,
    Room,
    RoomMembership,
    Thread,
)


class RoomSerializer(serializers.ModelSerializer):
    """Serializer for Room model."""

    creator = UserMinimalSerializer(read_only=True)
    is_member = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'room_type',
            'visibility',
            'creator',
            'auto_thread',
            'position',
            'is_default',
            'slow_mode_seconds',
            'min_trust_to_join',
            'member_count',
            'message_count',
            'online_count',
            'last_message_at',
            'is_archived',
            'is_member',
            'user_role',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'slug',
            'creator',
            'member_count',
            'message_count',
            'online_count',
            'last_message_at',
            'created_at',
        ]

    def get_is_member(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return (
            RoomMembership.objects.filter(
                room=obj,
                user=request.user,
                is_active=True,
            )
            .exclude(role='banned')
            .exists()
        )

    def get_user_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        try:
            membership = RoomMembership.objects.get(room=obj, user=request.user)
            return membership.role
        except RoomMembership.DoesNotExist:
            return None


class RoomListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for room listings."""

    class Meta:
        model = Room
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'icon',
            'room_type',
            'visibility',
            'member_count',
            'online_count',
            'last_message_at',
            'is_default',
        ]


class RoomCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating rooms."""

    class Meta:
        model = Room
        fields = [
            'name',
            'description',
            'icon',
            'visibility',
        ]

    def validate_name(self, value):
        if Room.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError('A room with this name already exists.')
        return value


class ThreadSerializer(serializers.ModelSerializer):
    """Serializer for Thread model."""

    creator = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Thread
        fields = [
            'id',
            'room',
            'parent_message',
            'title',
            'creator',
            'is_locked',
            'is_pinned',
            'is_resolved',
            'message_count',
            'last_message_at',
            'created_at',
        ]
        read_only_fields = ['id', 'creator', 'message_count', 'last_message_at', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model."""

    author = UserMinimalSerializer(read_only=True)
    reply_to = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'room',
            'thread',
            'author',
            'content',
            'message_type',
            'attachments',
            'embeds',
            'mentions',
            'reply_to',
            'reaction_counts',
            'is_edited',
            'is_pinned',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'author',
            'message_type',
            'embeds',
            'reaction_counts',
            'is_edited',
            'created_at',
        ]

    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                'id': str(obj.reply_to.id),
                'content': obj.reply_to.content[:100],
                'author': {
                    'id': str(obj.reply_to.author.id) if obj.reply_to.author else None,
                    'username': obj.reply_to.author.username if obj.reply_to.author else 'Unknown',
                },
            }
        return None


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating messages."""

    reply_to_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Message
        fields = ['content', 'attachments', 'mentions', 'reply_to_id']

    def validate_content(self, value):
        if len(value) > 4000:
            raise serializers.ValidationError('Message content cannot exceed 4000 characters.')
        return value


class MessageReactionSerializer(serializers.ModelSerializer):
    """Serializer for MessageReaction model."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = MessageReaction
        fields = ['id', 'message', 'user', 'emoji', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class RoomMembershipSerializer(serializers.ModelSerializer):
    """Serializer for RoomMembership model."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = RoomMembership
        fields = [
            'id',
            'room',
            'user',
            'role',
            'trust_score',
            'messages_sent',
            'notifications_enabled',
            'notification_level',
            'last_read_at',
            'joined_at',
        ]
        read_only_fields = ['id', 'user', 'trust_score', 'messages_sent', 'joined_at']


class DirectMessageThreadSerializer(serializers.ModelSerializer):
    """Serializer for DirectMessageThread model."""

    participants = UserMinimalSerializer(many=True, read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessageThread
        fields = [
            'id',
            'participants',
            'is_group',
            'name',
            'created_by',
            'last_message_at',
            'last_message',
            'unread_count',
            'created_at',
        ]
        read_only_fields = ['id', 'participants', 'created_by', 'last_message_at', 'created_at']

    def get_last_message(self, obj):
        if obj.room:
            last_msg = obj.room.messages.order_by('-created_at').first()
            if last_msg:
                return {
                    'content': last_msg.content[:100],
                    'author': {
                        'id': str(last_msg.author.id) if last_msg.author else None,
                        'username': last_msg.author.username if last_msg.author else 'Unknown',
                    },
                    'created_at': last_msg.created_at.isoformat(),
                }
        return None

    def get_unread_count(self, obj):
        """Count messages created after user's last_read_at."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        if not obj.room:
            return 0

        # Get the user's membership in this room
        try:
            membership = RoomMembership.objects.get(room=obj.room, user=request.user)
        except RoomMembership.DoesNotExist:
            return 0

        if not membership.last_read_at:
            # User has never read - count all messages (excluding own)
            return obj.room.messages.exclude(author=request.user).count()

        # Count messages created after last read (excluding own)
        return obj.room.messages.filter(created_at__gt=membership.last_read_at).exclude(author=request.user).count()


class DirectMessageCreateSerializer(serializers.Serializer):
    """Serializer for creating a DM thread."""

    participant_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        max_length=10,
    )
    initial_message = serializers.CharField(max_length=4000, required=False)

    def validate_participant_ids(self, value):
        from core.users.models import User

        # Ensure all participants exist
        existing_users = User.objects.filter(id__in=value, is_active=True)
        if existing_users.count() != len(value):
            raise serializers.ValidationError('One or more participants not found.')
        return value


class ModerationQueueSerializer(serializers.ModelSerializer):
    """Serializer for ModerationQueue model."""

    message = MessageSerializer(read_only=True)
    reviewed_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model = ModerationQueue
        fields = [
            'id',
            'message',
            'status',
            'ai_flagged',
            'ai_scores',
            'ai_reason',
            'report_count',
            'report_reasons',
            'reviewed_by',
            'reviewed_at',
            'review_notes',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'message',
            'ai_flagged',
            'ai_scores',
            'ai_reason',
            'report_count',
            'report_reasons',
            'created_at',
        ]
