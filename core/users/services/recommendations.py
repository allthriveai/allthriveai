"""User recommendation service for finding people to connect with.

Provides recommendations based on shared interests, roles, and goals.
Optimized for 100K+ users with proper caching and query optimization.
"""

import logging
import time
from typing import Any

from django.core.cache import cache
from django.db.models import Count, F, Q

from core.logging_utils import StructuredLogger

logger = logging.getLogger(__name__)


class UserRecommendationService:
    """Service for recommending users to follow based on shared taxonomy.

    Uses explicit preferences (goals, interests, industries, roles) set during
    onboarding to find similar users. Falls back gracefully when users have
    incomplete profiles.
    """

    CACHE_KEY_TEMPLATE = 'connect:suggestions:{user_id}'
    CACHE_TTL = 300  # 5 minutes

    def get_connection_suggestions(
        self,
        user: 'User',  # noqa: F821 - Forward reference
        limit: int = 5,
    ) -> dict[str, Any]:
        """
        Find users to follow based on shared interests, roles, and goals.

        Algorithm:
        1. Get user's taxonomy (interests, roles, goals)
        2. Find users with overlap (excluding already-followed)
        3. Score by overlap count + total_points (activity)
        4. Generate human-readable match reasons
        5. Include top tools for social proof

        Args:
            user: The user to find recommendations for
            limit: Maximum number of suggestions (1-10, clamped)

        Returns:
            snake_case dict - frontend transforms to camelCase automatically.
            {
                'has_suggestions': bool,
                'suggestions': [...],
                'cta': {'url': str, 'label': str},
            }
        """
        start = time.perf_counter()

        # Validate and clamp limit
        limit = max(1, min(limit, 10))

        # Check cache first
        cache_key = self.CACHE_KEY_TEMPLATE.format(user_id=user.id)
        cached = cache.get(cache_key)
        if cached is not None:
            StructuredLogger.log_service_operation(
                service_name='UserRecommendationService',
                operation='get_connection_suggestions',
                user=user,
                success=True,
                duration_ms=(time.perf_counter() - start) * 1000,
                metadata={'cache_hit': True, 'suggestions_count': len(cached.get('suggestions', []))},
                logger_instance=logger,
            )
            return cached

        try:
            result = self._compute_suggestions(user, limit)

            # Cache result
            cache.set(cache_key, result, self.CACHE_TTL)

            elapsed_ms = (time.perf_counter() - start) * 1000
            StructuredLogger.log_service_operation(
                service_name='UserRecommendationService',
                operation='get_connection_suggestions',
                user=user,
                success=True,
                duration_ms=elapsed_ms,
                metadata={
                    'cache_hit': False,
                    'suggestions_count': len(result.get('suggestions', [])),
                    'limit': limit,
                },
                logger_instance=logger,
            )

            return result

        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to get connection suggestions',
                error=e,
                user=user,
                extra={'limit': limit},
                level='error',
                logger_instance=logger,
            )
            # Re-raise to let caller handle - never silently fail
            raise

    def _compute_suggestions(
        self,
        user: 'User',  # noqa: F821
        limit: int,
    ) -> dict[str, Any]:
        """Compute user suggestions with optimized queries.

        Separated from main method for cleaner caching logic.
        """
        # Import here to avoid circular imports
        from core.users.models import User

        # Step 1: Get user's taxonomy IDs in single queries
        user_interests = set(user.interests.values_list('id', flat=True))
        user_roles = set(user.roles.values_list('id', flat=True))
        user_goals = set(user.goals.values_list('id', flat=True))

        # Early exit if user has no taxonomy data
        if not user_interests and not user_roles and not user_goals:
            return {
                'has_suggestions': False,
                'suggestions': [],
                'reason': 'no_user_preferences',
                'message': 'Complete your profile to get personalized recommendations!',
                'cta': {
                    'url': '/settings/profile',
                    'label': 'Complete Your Profile',
                },
            }

        # Step 2: Get already-following IDs efficiently
        following_ids = set(user.following_set.values_list('following_id', flat=True))
        exclude_ids = [user.id, *list(following_ids)]

        # Step 3: Build Q filter dynamically to avoid empty sets in OR
        q_filters = Q()
        if user_interests:
            q_filters |= Q(interests__id__in=user_interests)
        if user_roles:
            q_filters |= Q(roles__id__in=user_roles)
        if user_goals:
            q_filters |= Q(goals__id__in=user_goals)

        # Optimized query with annotations
        # Using distinct counts to handle M2M properly
        candidates = (
            User.objects.exclude(id__in=exclude_ids)
            .filter(is_active=True)
            .filter(q_filters)
            .annotate(
                interest_overlap=Count(
                    'interests',
                    filter=Q(interests__id__in=user_interests) if user_interests else Q(pk=None),
                    distinct=True,
                ),
                role_overlap=Count(
                    'roles',
                    filter=Q(roles__id__in=user_roles) if user_roles else Q(pk=None),
                    distinct=True,
                ),
                goal_overlap=Count(
                    'goals',
                    filter=Q(goals__id__in=user_goals) if user_goals else Q(pk=None),
                    distinct=True,
                ),
            )
            .annotate(overlap_count=F('interest_overlap') + F('role_overlap') + F('goal_overlap'))
            .filter(overlap_count__gte=1)
            .order_by('-overlap_count', '-total_points')
            .distinct()[: limit * 2]  # Fetch extra for filtering
        )

        # Step 4: Build response with match reasons
        suggestions = []
        user_interest_names = set(user.interests.values_list('name', flat=True))

        for candidate in candidates[:limit]:
            # Get shared interests for match reason
            candidate_interest_names = set(candidate.interests.values_list('name', flat=True))
            shared = list(user_interest_names & candidate_interest_names)[:3]

            # Get user's top tools
            top_tools = self._get_user_top_tools(candidate, limit=3)

            suggestions.append(
                {
                    'user_id': candidate.id,
                    'username': candidate.username,
                    'display_name': candidate.get_full_name() or candidate.username,
                    'avatar_url': candidate.avatar_url or '',
                    'tagline': self._get_tagline(candidate),
                    'tier': candidate.tier if candidate.tier else None,
                    'level': candidate.level,
                    'match_reason': self._build_match_reason(shared),
                    'shared_interests': shared,
                    'top_tools': top_tools,
                    'followers_count': candidate.followers_count,
                    'is_following': False,  # Current user is not following (filtered out)
                }
            )

        return {
            'has_suggestions': len(suggestions) > 0,
            'suggestions': suggestions,
            'cta': {
                'url': '/explore?tab=creators',
                'label': 'Discover More Creators',
            },
        }

    def _get_tagline(self, user: 'User') -> str | None:  # noqa: F821
        """Get user's tagline, falling back to truncated bio."""
        if user.tagline:
            return user.tagline
        if user.bio:
            # Truncate bio to 100 chars
            bio = user.bio[:100]
            if len(user.bio) > 100:
                bio = bio.rsplit(' ', 1)[0] + '...'
            return bio
        return None

    def _build_match_reason(self, shared_interests: list[str]) -> str:
        """Build human-readable match reason."""
        if not shared_interests:
            return 'Active creator in the community'
        if len(shared_interests) == 1:
            return f'You both love {shared_interests[0]}'
        if len(shared_interests) == 2:
            return f'You both love {shared_interests[0]} and {shared_interests[1]}'
        return f"You share interests in {', '.join(shared_interests[:2])}, and more"

    def _get_user_top_tools(
        self,
        user: 'User',  # noqa: F821
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Get user's most-used tools from their projects.

        Returns list of tools sorted by usage count.
        """
        from core.tools.models import Tool

        # Get tools from user's public projects, ordered by frequency
        tool_counts = (
            Tool.objects.filter(
                projects__user=user,
                projects__is_private=False,
                projects__is_archived=False,
            )
            .annotate(usage_count=Count('projects'))
            .order_by('-usage_count')
            .values('id', 'name', 'slug')[:limit]
        )

        return [{'id': t['id'], 'name': t['name'], 'slug': t['slug']} for t in tool_counts]

    def invalidate_cache(self, user_id: int) -> None:
        """Invalidate cached suggestions for a user.

        Call this when user updates their preferences or follows someone.
        """
        cache_key = self.CACHE_KEY_TEMPLATE.format(user_id=user_id)
        cache.delete(cache_key)
        logger.debug(f'Invalidated recommendation cache for user {user_id}')
