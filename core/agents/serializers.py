from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    # Use annotated field from ViewSet queryset (avoids N+1)
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id',
            'conversation_id',
            'conversation_type',
            'title',
            'created_at',
            'updated_at',
            'messages',
            'message_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
