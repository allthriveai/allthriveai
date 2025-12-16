"""
Freshness service for tracking and deprioritizing recently-served content.

Uses Django's cache framework (Redis-backed) to track which projects were served
to each user, enabling deprioritization on return visits for a fresh feed experience.

Features:
- Track served projects per user with timestamps
- Graduated deprioritization based on recency
- Deterministic exploration scoring using hash of project_id + freshness_token
- Soft shuffle of similarly-scored projects for variety
"""

import hashlib
import logging
import random
import time
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)


class FreshnessService:
    """
    Track and manage content freshness per user.

    Provides:
    - Served content tracking via Redis
    - Deprioritization scoring for recently-served projects
    - Exploration scoring for variety
    - Soft shuffle for similar-scored projects
    """

    # Configuration
    TTL_SECONDS = 4 * 3600  # 4 hours - how long to track served content
    MAX_TRACKED = 200  # Max projects to track per user
    DEPRIORITIZATION_PENALTY = 0.25  # Max score reduction for recently served
    EXPLORATION_WEIGHT = 0.05  # Weight for random exploration factor

    @classmethod
    def _get_key(cls, user_id: int) -> str:
        """Get Redis key for user's served content."""
        return f'freshness:served:{user_id}'

    @classmethod
    def record_served_projects(cls, user_id: int, project_ids: list[int]) -> None:
        """
        Record projects as served to user.

        Args:
            user_id: User who was served the projects
            project_ids: List of project IDs that were served
        """
        if not user_id or not project_ids:
            return

        key = cls._get_key(user_id)
        now = time.time()

        try:
            # Get existing data
            existing = cache.get(key) or {}

            # Add new projects with timestamp
            for pid in project_ids:
                existing[str(pid)] = now

            # Trim to MAX_TRACKED (keep most recent)
            if len(existing) > cls.MAX_TRACKED:
                sorted_items = sorted(existing.items(), key=lambda x: x[1], reverse=True)
                existing = dict(sorted_items[: cls.MAX_TRACKED])

            cache.set(key, existing, cls.TTL_SECONDS)
            logger.debug(f'Recorded {len(project_ids)} served projects for user {user_id}')

        except Exception as e:
            logger.warning(f'Failed to record served projects for user {user_id}: {e}')

    @classmethod
    def get_recently_served(cls, user_id: int, max_age_seconds: int = 1800) -> set[int]:
        """
        Get projects served in the last N seconds (default 30 min).

        Args:
            user_id: User to get served projects for
            max_age_seconds: Maximum age of served projects to include

        Returns:
            Set of project IDs served within the time window
        """
        if not user_id:
            return set()

        key = cls._get_key(user_id)

        try:
            data = cache.get(key) or {}
            cutoff = time.time() - max_age_seconds

            return {int(pid) for pid, ts in data.items() if ts > cutoff}

        except Exception as e:
            logger.warning(f'Failed to get recently served for user {user_id}: {e}')
            return set()

    @classmethod
    def calculate_deprioritization(cls, user_id: int, project_id: int) -> float:
        """
        Get deprioritization factor for a project (0 to DEPRIORITIZATION_PENALTY).

        Uses graduated penalty: stronger for more recently served.

        Args:
            user_id: User to check for
            project_id: Project to check

        Returns:
            Float penalty to subtract from score (0 if not recently served)
        """
        if not user_id:
            return 0.0

        key = cls._get_key(user_id)

        try:
            data = cache.get(key) or {}
            served_at = data.get(str(project_id))

            if not served_at:
                return 0.0

            hours_ago = (time.time() - served_at) / 3600

            # Graduated penalty: stronger for more recent
            if hours_ago < 0.5:
                return cls.DEPRIORITIZATION_PENALTY  # Full penalty
            elif hours_ago < 2:
                return cls.DEPRIORITIZATION_PENALTY * 0.6
            elif hours_ago < 4:
                return cls.DEPRIORITIZATION_PENALTY * 0.3
            return 0.0

        except Exception as e:
            logger.warning(f'Failed to calculate deprioritization for user {user_id}: {e}')
            return 0.0

    @classmethod
    def calculate_exploration_score(cls, project_id: int, freshness_token: str) -> float:
        """
        Calculate deterministic exploration score for variety.

        Same token + project = same score (for pagination consistency).
        Different token = different scores (for fresh ordering on new visits).

        Args:
            project_id: Project to score
            freshness_token: Token for deterministic randomization

        Returns:
            Float between 0.0 and 1.0
        """
        if not freshness_token:
            return 0.5  # Neutral if no token

        seed = hashlib.md5(f'{project_id}:{freshness_token}'.encode()).hexdigest()  # noqa: S324
        return int(seed[:8], 16) / (16**8)  # 0.0 to 1.0

    @classmethod
    def apply_soft_shuffle(
        cls,
        projects: list[Any],
        freshness_token: str,
        score_attr: str = 'total_score',
        tolerance: float = 0.10,
    ) -> list[Any]:
        """
        Shuffle projects with similar scores for variety.

        Groups projects by score proximity and shuffles within groups.
        Maintains quality ranking while adding variety.

        Args:
            projects: List of scored project objects
            freshness_token: Token for deterministic shuffling
            score_attr: Attribute name containing the score
            tolerance: Score difference threshold for grouping (0.10 = 10%)

        Returns:
            Reordered list of projects
        """
        if not projects or not freshness_token:
            return projects

        result = []
        i = 0

        while i < len(projects):
            base_score = getattr(projects[i], score_attr, 0)
            window = [projects[i]]

            # Collect similar-scored projects
            for j in range(i + 1, len(projects)):
                proj_score = getattr(projects[j], score_attr, 0)
                if base_score > 0 and abs(proj_score - base_score) / base_score < tolerance:
                    window.append(projects[j])
                else:
                    break

            # Deterministic shuffle using token
            if len(window) > 1:
                rng = random.Random(f'{freshness_token}:{i}')  # noqa: S311
                rng.shuffle(window)

            result.extend(window)
            i += len(window)

        return result

    @classmethod
    def apply_freshness_to_scores(
        cls,
        scored_projects: list[Any],
        user_id: int | None,
        freshness_token: str | None,
        score_attr: str = 'total_score',
        exploration_weight: float | None = None,
    ) -> list[Any]:
        """
        Apply all freshness factors to a list of scored projects.

        This is a convenience method that combines:
        1. Deprioritization of recently-served projects
        2. Exploration scoring for variety

        Note: Call apply_soft_shuffle separately after sorting if desired.

        Args:
            scored_projects: List of scored project objects
            user_id: User ID for deprioritization (None for anonymous)
            freshness_token: Token for exploration scoring
            score_attr: Attribute name containing the score
            exploration_weight: Weight for exploration (default: EXPLORATION_WEIGHT)

        Returns:
            Same list with modified scores
        """
        if not scored_projects:
            return scored_projects

        if exploration_weight is None:
            exploration_weight = cls.EXPLORATION_WEIGHT

        # Get recently served for batch deprioritization
        recently_served = cls.get_recently_served(user_id) if user_id else set()

        for sp in scored_projects:
            project_id = getattr(sp, 'project_id', None)
            if not project_id:
                continue

            current_score = getattr(sp, score_attr, 0)

            # Apply exploration score
            if freshness_token:
                exploration_score = cls.calculate_exploration_score(project_id, freshness_token)
                # Center around 0 (-0.5 to +0.5) and scale by weight
                exploration_adjustment = (exploration_score - 0.5) * exploration_weight * 2
                current_score += exploration_adjustment

            # Apply deprioritization for recently served
            if user_id and project_id in recently_served:
                penalty = cls.calculate_deprioritization(user_id, project_id)
                current_score -= penalty

            setattr(sp, score_attr, current_score)

        return scored_projects
