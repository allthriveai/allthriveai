"""Game models for tracking high scores and game sessions."""

from django.db import models

from core.users.models import User


class GameScore(models.Model):
    """Track high scores for games."""

    GAME_CHOICES = [
        ('context_snake', 'Context Snake'),
        ('ethics_defender', 'Ethics Defender'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='game_scores',
    )
    game = models.CharField(max_length=50, choices=GAME_CHOICES)
    score = models.PositiveIntegerField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score', '-created_at']
        indexes = [
            models.Index(fields=['game', '-score']),
            models.Index(fields=['user', 'game']),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.game}: {self.score}'

    @classmethod
    def get_high_score(cls, user, game):
        """Get user's high score for a specific game."""
        return cls.objects.filter(user=user, game=game).order_by('-score').first()

    @classmethod
    def get_leaderboard(cls, game, limit=10):
        """Get top scores for a game."""
        return cls.objects.filter(game=game).select_related('user').order_by('-score')[:limit]
