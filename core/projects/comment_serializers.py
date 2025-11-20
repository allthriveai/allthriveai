"""
Serializers for project comments and votes.
"""

from django.utils import timezone
from rest_framework import serializers

from core.projects.models import CommentVote, ProjectComment
from services.moderation import ContentModerator


class CommentVoteSerializer(serializers.ModelSerializer):
    """Serializer for comment votes."""

    class Meta:
        model = CommentVote
        fields = ['id', 'vote_type', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProjectCommentSerializer(serializers.ModelSerializer):
    """Serializer for project comments with moderation."""

    username = serializers.CharField(source='user.username', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    upvotes = serializers.IntegerField(source='upvote_count', read_only=True)
    downvotes = serializers.IntegerField(source='downvote_count', read_only=True)
    score = serializers.IntegerField(read_only=True)
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = [
            'id',
            'username',
            'avatar_url',
            'content',
            'upvotes',
            'downvotes',
            'score',
            'user_vote',
            'moderation_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'username',
            'avatar_url',
            'upvotes',
            'downvotes',
            'score',
            'user_vote',
            'moderation_status',
            'created_at',
            'updated_at',
        ]

    def get_avatar_url(self, obj):
        """Get user's avatar URL."""
        return getattr(obj.user, 'avatar_url', None)

    def get_user_vote(self, obj):
        """Get the current user's vote on this comment."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        try:
            vote = obj.votes.get(user=request.user)
            return vote.vote_type
        except CommentVote.DoesNotExist:
            return None

    def create(self, validated_data):
        """Create comment with AI moderation."""
        content = validated_data.get('content', '')

        # Moderate content
        moderator = ContentModerator()
        moderation_result = moderator.moderate(content, context='project comment')

        # Set moderation fields
        if moderation_result['approved']:
            validated_data['moderation_status'] = ProjectComment.ModerationStatus.APPROVED
        elif moderation_result['flagged']:
            validated_data['moderation_status'] = ProjectComment.ModerationStatus.FLAGGED
        else:
            validated_data['moderation_status'] = ProjectComment.ModerationStatus.REJECTED

        validated_data['moderation_reason'] = moderation_result.get('reason', '')
        validated_data['moderation_data'] = moderation_result.get('moderation_data', {})
        validated_data['moderated_at'] = timezone.now()

        # If content is rejected, raise validation error
        if not moderation_result['approved']:
            raise serializers.ValidationError(
                {'content': moderation_result.get('reason', 'Content did not pass moderation')}
            )

        return super().create(validated_data)


class CommentCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating comments."""

    class Meta:
        model = ProjectComment
        fields = ['content']

    def validate_content(self, value):
        """Validate comment content."""
        if not value or not value.strip():
            raise serializers.ValidationError('Comment cannot be empty')

        if len(value) > 5000:
            raise serializers.ValidationError('Comment is too long (max 5000 characters)')

        return value.strip()
