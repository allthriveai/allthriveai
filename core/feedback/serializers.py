from rest_framework import serializers

from core.serializers.mixins import AnnotatedFieldMixin
from core.users.serializers import UserMinimalSerializer

from .models import FeedbackComment, FeedbackItem


class FeedbackItemSerializer(AnnotatedFieldMixin, serializers.ModelSerializer):
    """Serializer for reading feedback items."""

    user = UserMinimalSerializer(read_only=True)
    has_voted = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackItem
        fields = [
            'id',
            'feedback_type',
            'category',
            'title',
            'description',
            'status',
            'vote_count',
            'has_voted',
            'comment_count',
            'admin_response',
            'user',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'vote_count',
            'status',
            'admin_response',
            'created_at',
            'updated_at',
        ]

    def get_has_voted(self, obj):
        """Check if current user has voted on this item (N+1 safe)."""
        return self.get_annotated_or_query(
            obj=obj,
            annotation_attr='user_has_voted',
            fallback_query=lambda: obj.votes.filter(user=self.context['request'].user).exists(),
            requires_auth=True,
        )

    def get_comment_count(self, obj):
        """Get count of comments on this item (N+1 safe)."""
        return self.get_annotated_or_query(
            obj=obj,
            annotation_attr='annotated_comment_count',
            fallback_query=lambda: obj.comments.count(),
            requires_auth=False,
            default_unauthenticated=0,
        )


class FeedbackItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating feedback items (fewer fields)."""

    class Meta:
        model = FeedbackItem
        fields = ['feedback_type', 'category', 'title', 'description']


class FeedbackCommentSerializer(serializers.ModelSerializer):
    """Serializer for feedback comments."""

    user = UserMinimalSerializer(read_only=True)

    class Meta:
        model = FeedbackComment
        fields = ['id', 'user', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
