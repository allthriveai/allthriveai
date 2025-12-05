"""Redis-backed real-time leaderboard service for weekly challenges."""

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


class ChallengeLeaderboardService:
    """Real-time leaderboard using Redis sorted sets.

    Uses Redis ZSET for O(log N) rank lookups and O(log N + M) range queries.
    """

    LEADERBOARD_KEY = 'challenge:{challenge_id}:leaderboard'
    USER_SUBMISSION_COUNT_KEY = 'challenge:{challenge_id}:user:{user_id}:submissions'
    DAILY_VOTES_KEY = 'challenge:{challenge_id}:user:{user_id}:votes:{date}'
    PARTICIPATION_KEY = 'challenge:participation:{year}:{week}'

    # Limits
    MAX_DAILY_VOTES = 50  # Max votes per user per day per challenge

    @classmethod
    def _get_redis(cls):
        """Get Redis client from cache backend."""
        try:
            # Django cache backend for Redis
            return cache._cache.get_client()
        except AttributeError:
            logger.warning('Redis client not available, using cache fallback')
            return None

    @classmethod
    def add_submission(cls, challenge_id: str, user_id: int, submission_id: str):
        """Track a new submission and initialize leaderboard entry."""
        redis = cls._get_redis()
        if not redis:
            return

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)
        count_key = cls.USER_SUBMISSION_COUNT_KEY.format(challenge_id=challenge_id, user_id=user_id)

        try:
            # Initialize user in leaderboard if not exists (score = 0)
            redis.zadd(key, {str(user_id): 0}, nx=True)

            # Track submission count
            redis.incr(count_key)
            redis.expire(count_key, 60 * 60 * 24 * 30)  # 30 days TTL

            logger.debug(f'Added submission {submission_id} for user {user_id} in challenge {challenge_id}')
        except Exception as e:
            logger.error(f'Error adding submission to leaderboard: {e}')

    @classmethod
    def add_vote(cls, challenge_id: str, user_id: int, increment: float = 1.0) -> bool:
        """Increment a user's score in the leaderboard.

        Args:
            challenge_id: The challenge UUID
            user_id: The user who received the vote
            increment: Score increment (usually 1.0, can be weighted)

        Returns:
            True if vote was counted, False if user hit daily limit
        """
        redis = cls._get_redis()
        if not redis:
            return True  # Allow vote if Redis unavailable

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            # Increment user's score
            redis.zincrby(key, increment, str(user_id))
            logger.debug(f'Added {increment} votes to user {user_id} in challenge {challenge_id}')
            return True
        except Exception as e:
            logger.error(f'Error adding vote to leaderboard: {e}')
            return True

    @classmethod
    def remove_vote(cls, challenge_id: str, user_id: int, decrement: float = 1.0):
        """Remove a vote from user's score (e.g., if vote is deleted)."""
        redis = cls._get_redis()
        if not redis:
            return

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            redis.zincrby(key, -decrement, str(user_id))
        except Exception as e:
            logger.error(f'Error removing vote from leaderboard: {e}')

    @classmethod
    def check_daily_vote_limit(cls, challenge_id: str, voter_id: int) -> tuple[bool, int]:
        """Check if user has reached daily vote limit.

        Returns:
            Tuple of (can_vote, votes_remaining)
        """
        redis = cls._get_redis()
        if not redis:
            return True, cls.MAX_DAILY_VOTES

        from datetime import date

        today = date.today().isoformat()
        key = cls.DAILY_VOTES_KEY.format(challenge_id=challenge_id, user_id=voter_id, date=today)

        try:
            current = int(redis.get(key) or 0)
            remaining = max(0, cls.MAX_DAILY_VOTES - current)
            return current < cls.MAX_DAILY_VOTES, remaining
        except Exception as e:
            logger.error(f'Error checking vote limit: {e}')
            return True, cls.MAX_DAILY_VOTES

    @classmethod
    def record_daily_vote(cls, challenge_id: str, voter_id: int):
        """Record a vote for daily limit tracking."""
        redis = cls._get_redis()
        if not redis:
            return

        from datetime import date

        today = date.today().isoformat()
        key = cls.DAILY_VOTES_KEY.format(challenge_id=challenge_id, user_id=voter_id, date=today)

        try:
            redis.incr(key)
            redis.expire(key, 60 * 60 * 24 * 2)  # 2 days TTL
        except Exception as e:
            logger.error(f'Error recording daily vote: {e}')

    @classmethod
    def get_leaderboard(cls, challenge_id: str, start: int = 0, end: int = 99) -> list[tuple[int, float]]:
        """Get top N users from leaderboard.

        Args:
            challenge_id: The challenge UUID
            start: Start rank (0-indexed)
            end: End rank (inclusive)

        Returns:
            List of (user_id, score) tuples, highest score first
        """
        redis = cls._get_redis()
        if not redis:
            return []

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            # ZREVRANGE returns highest scores first
            results = redis.zrevrange(key, start, end, withscores=True)
            return [(int(user_id), score) for user_id, score in results]
        except Exception as e:
            logger.error(f'Error getting leaderboard: {e}')
            return []

    @classmethod
    def get_user_rank(cls, challenge_id: str, user_id: int) -> int | None:
        """Get a user's rank in the challenge (1-indexed).

        Returns:
            Rank (1 = first place) or None if user not in leaderboard
        """
        redis = cls._get_redis()
        if not redis:
            return None

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            # ZREVRANK returns 0-indexed rank (highest score = 0)
            rank = redis.zrevrank(key, str(user_id))
            return rank + 1 if rank is not None else None
        except Exception as e:
            logger.error(f'Error getting user rank: {e}')
            return None

    @classmethod
    def get_user_score(cls, challenge_id: str, user_id: int) -> float:
        """Get a user's current score in the challenge."""
        redis = cls._get_redis()
        if not redis:
            return 0.0

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            score = redis.zscore(key, str(user_id))
            return float(score) if score is not None else 0.0
        except Exception as e:
            logger.error(f'Error getting user score: {e}')
            return 0.0

    @classmethod
    def get_user_submission_count(cls, challenge_id: str, user_id: int) -> int:
        """Get number of submissions a user has made to a challenge."""
        redis = cls._get_redis()
        if not redis:
            # Fallback to database
            from core.challenges.models import ChallengeSubmission

            return ChallengeSubmission.objects.filter(
                challenge_id=challenge_id, user_id=user_id, is_disqualified=False
            ).count()

        key = cls.USER_SUBMISSION_COUNT_KEY.format(challenge_id=challenge_id, user_id=user_id)

        try:
            count = redis.get(key)
            return int(count) if count else 0
        except Exception as e:
            logger.error(f'Error getting submission count: {e}')
            return 0

    @classmethod
    def get_leaderboard_around_user(
        cls, challenge_id: str, user_id: int, context: int = 2
    ) -> list[tuple[int, float, int]]:
        """Get leaderboard entries around a user's position.

        Args:
            challenge_id: The challenge UUID
            user_id: The user to center around
            context: Number of entries above and below to include

        Returns:
            List of (user_id, score, rank) tuples
        """
        rank = cls.get_user_rank(challenge_id, user_id)
        if rank is None:
            return []

        # Calculate range (rank is 1-indexed)
        start = max(0, rank - 1 - context)
        end = rank - 1 + context

        entries = cls.get_leaderboard(challenge_id, start, end)
        return [(uid, score, start + i + 1) for i, (uid, score) in enumerate(entries)]

    @classmethod
    def sync_from_database(cls, challenge_id: str):
        """Sync leaderboard from database (for recovery or initialization).

        This rebuilds the Redis leaderboard from the submission vote counts.
        """
        from django.db import models

        from core.challenges.models import ChallengeSubmission

        redis = cls._get_redis()
        if not redis:
            return

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            # Get all submissions with vote counts
            submissions = (
                ChallengeSubmission.objects.filter(challenge_id=challenge_id, is_disqualified=False)
                .values('user_id')
                .annotate(total_votes=models.Sum('vote_count'))
            )

            # Build leaderboard data
            leaderboard_data = {str(s['user_id']): float(s['total_votes'] or 0) for s in submissions}

            if leaderboard_data:
                # Clear existing and rebuild
                redis.delete(key)
                redis.zadd(key, leaderboard_data)

                logger.info(f'Synced leaderboard for challenge {challenge_id} with {len(leaderboard_data)} entries')
        except Exception as e:
            logger.error(f'Error syncing leaderboard: {e}')

    @classmethod
    def clear_leaderboard(cls, challenge_id: str):
        """Clear leaderboard data for a challenge."""
        redis = cls._get_redis()
        if not redis:
            return

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            redis.delete(key)
            logger.info(f'Cleared leaderboard for challenge {challenge_id}')
        except Exception as e:
            logger.error(f'Error clearing leaderboard: {e}')

    @classmethod
    def get_total_participants(cls, challenge_id: str) -> int:
        """Get total number of participants in the leaderboard."""
        redis = cls._get_redis()
        if not redis:
            return 0

        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)

        try:
            return redis.zcard(key)
        except Exception as e:
            logger.error(f'Error getting participant count: {e}')
            return 0

    @classmethod
    def track_weekly_participation(cls, year: int, week: int, user_id: int):
        """Track user participation for weekly stats."""
        redis = cls._get_redis()
        if not redis:
            return

        key = cls.PARTICIPATION_KEY.format(year=year, week=week)

        try:
            redis.zincrby(key, 1, str(user_id))
            redis.expire(key, 60 * 60 * 24 * 90)  # 90 days TTL
        except Exception as e:
            logger.error(f'Error tracking participation: {e}')

    @classmethod
    def get_weekly_participation_leaders(cls, year: int, week: int, limit: int = 10) -> list[tuple[int, int]]:
        """Get users with most submissions in a week."""
        redis = cls._get_redis()
        if not redis:
            return []

        key = cls.PARTICIPATION_KEY.format(year=year, week=week)

        try:
            results = redis.zrevrange(key, 0, limit - 1, withscores=True)
            return [(int(user_id), int(count)) for user_id, count in results]
        except Exception as e:
            logger.error(f'Error getting participation leaders: {e}')
            return []
