"""Game models for tracking high scores and game sessions."""

from django.core.cache import cache
from django.db import models

from core.users.models import User

# Cache timeout for leaderboards (5 minutes)
LEADERBOARD_CACHE_TIMEOUT = 300


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
        constraints = [
            models.CheckConstraint(
                condition=models.Q(score__gte=0) & models.Q(score__lte=10000),
                name='games_gamescore_valid_score_range',
            ),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.game}: {self.score}'

    @classmethod
    def get_high_score(cls, user, game):
        """Get user's high score for a specific game."""
        return cls.objects.filter(user=user, game=game).order_by('-score').first()

    @classmethod
    def get_leaderboard(cls, game, limit=10):
        """
        Get top scores for a game with Redis caching.

        Caches the top 100 scores for 5 minutes to reduce database load
        at scale (100K+ users).

        Preserves cache order to ensure consistent leaderboard rankings.
        """
        cache_key = f'game_leaderboard:{game}'

        # Try to get from cache first
        cached_ids = cache.get(cache_key)

        if cached_ids is not None:
            # Fetch from cache while preserving the cached order
            cached_ids = cached_ids[:limit]
            scores_dict = {s.id: s for s in cls.objects.filter(id__in=cached_ids).select_related('user')}
            # Preserve original order from cache (important for rankings)
            scores = [scores_dict[sid] for sid in cached_ids if sid in scores_dict]
            return scores

        # Cache miss - fetch from database and cache the IDs
        scores = list(cls.objects.filter(game=game).select_related('user').order_by('-score', '-created_at')[:100])

        # Cache just the IDs (lightweight) - order is preserved in the list
        score_ids = [s.id for s in scores]
        cache.set(cache_key, score_ids, LEADERBOARD_CACHE_TIMEOUT)

        return scores[:limit]

    @classmethod
    def invalidate_leaderboard_cache(cls, game):
        """Invalidate the leaderboard cache for a game."""
        cache_key = f'game_leaderboard:{game}'
        cache.delete(cache_key)
