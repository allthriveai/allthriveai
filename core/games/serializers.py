"""Serializers for the games app."""

from rest_framework import serializers

from core.games.models import GameScore


class GameScoreSerializer(serializers.ModelSerializer):
    """Serializer for game scores."""

    username = serializers.CharField(source='user.username', read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = GameScore
        fields = ['id', 'game', 'score', 'metadata', 'created_at', 'username', 'avatar_url']
        read_only_fields = ['id', 'created_at', 'username', 'avatar_url']

    def get_avatar_url(self, obj):
        """Get the user's avatar URL."""
        return obj.user.avatar_url


class SubmitScoreSerializer(serializers.Serializer):
    """Serializer for submitting a game score."""

    game = serializers.ChoiceField(choices=GameScore.GAME_CHOICES)
    score = serializers.IntegerField(min_value=0)
    metadata = serializers.JSONField(required=False, default=dict)
