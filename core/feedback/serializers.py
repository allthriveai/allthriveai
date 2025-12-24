from rest_framework import serializers

from core.users.serializers import UserMinimalSerializer

from .models import FeedbackComment, FeedbackItem


class FeedbackItemSerializer(serializers.ModelSerializer):
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
        """Check if current user has voted on this item."""
        # Use annotated value from queryset (avoids N+1)
        if hasattr(obj, 'user_has_voted'):
            return obj.user_has_voted
        # Fallback for single object retrieval
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.votes.filter(user=request.user).exists()
        return False

    def get_comment_count(self, obj):
        """Get count of comments on this item."""
        # Use annotated value from queryset (avoids N+1)
        if hasattr(obj, 'annotated_comment_count'):
            return obj.annotated_comment_count
        # Fallback for single object retrieval
        return obj.comments.count()


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
