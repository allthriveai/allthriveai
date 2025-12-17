"""
Cold start handling for new users with insufficient data.

Provides:
- Detection of cold-start users
- Onboarding quiz integration
- Popular content fallback
- Promotion boost for admin-spotlighted projects
"""

import logging
from typing import TYPE_CHECKING

from django.db.models import Count
from django.utils import timezone

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()

logger = logging.getLogger(__name__)

# Promotion boost settings (consistent with PersonalizationEngine)
PROMOTION_DURATION_DAYS = 7
PROMOTION_WEIGHT = 0.08  # 8% weight for promotion boost


class ColdStartService:
    """
    Service for handling new users with insufficient personalization data.

    Cold start detection thresholds:
    - Minimum 3 UserTags OR
    - Minimum 10 interactions OR
    - Minimum 5 likes
    """

    # Thresholds for sufficient data
    MIN_USER_TAGS = 3
    MIN_INTERACTIONS = 10
    MIN_LIKES = 5

    def has_sufficient_data(self, user: 'User') -> bool:
        """
        Check if user has enough data for personalization.

        Args:
            user: User to check

        Returns:
            True if user has sufficient data for personalization
        """
        from core.projects.models import ProjectLike
        from core.taxonomy.models import UserInteraction, UserTag

        # Check UserTags
        tag_count = UserTag.objects.filter(user=user).count()
        if tag_count >= self.MIN_USER_TAGS:
            return True

        # Check interactions
        interaction_count = UserInteraction.objects.filter(user=user).count()
        if interaction_count >= self.MIN_INTERACTIONS:
            return True

        # Check likes
        like_count = ProjectLike.objects.filter(user=user).count()
        if like_count >= self.MIN_LIKES:
            return True

        return False

    def has_onboarding_responses(self, user: 'User') -> bool:
        """
        Check if user has completed onboarding quiz.

        Args:
            user: User to check

        Returns:
            True if user has onboarding responses
        """
        # Check for onboarding responses model if it exists
        try:
            from core.onboarding.models import OnboardingResponse

            return OnboardingResponse.objects.filter(user=user).exists()
        except ImportError:
            # Onboarding models not yet created
            return False

    def get_cold_start_feed(
        self,
        user: 'User | None',
        page: int = 1,
        page_size: int = 20,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
    ) -> dict:
        """
        Get feed for cold-start user.

        Strategy:
        1. If user has onboarding responses, use those preferences
        2. Otherwise, return popular projects

        Args:
            user: User (can be None for anonymous)
            page: Page number
            page_size: Number of projects per page
            tool_ids: Filter to projects with ANY of these tools (OR logic)
            category_ids: Filter to projects with ANY of these categories (OR logic)
            topic_names: Filter to projects with ANY of these topics (OR logic)

        Returns:
            Dict with 'projects' list and 'metadata'
        """
        if user and self.has_onboarding_responses(user):
            return self._get_onboarding_based_feed(user, page, page_size, tool_ids, category_ids, topic_names)

        return self._get_popular_feed(page, page_size, tool_ids, category_ids, topic_names)

    def _get_onboarding_based_feed(
        self,
        user: 'User',
        page: int,
        page_size: int,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
    ) -> dict:
        """Get feed based on onboarding quiz responses."""
        from core.projects.models import Project

        try:
            from core.onboarding.models import OnboardingResponse

            # Get user's onboarding responses
            responses = OnboardingResponse.objects.filter(user=user).select_related('question')

            # Extract preferences
            tool_preferences = []
            category_preferences = []

            for response in responses:
                if response.question.question_type == 'tool_select':
                    tool_preferences.extend(response.selected_options)
                elif response.question.question_type == 'category_select':
                    category_preferences.extend(response.selected_options)

            # Build query based on preferences
            # Note: Don't filter by is_published to include playground projects in explore
            query = Project.objects.filter(
                is_private=False,
                is_archived=False,
            )

            if tool_preferences:
                query = query.filter(tools__name__in=tool_preferences)
            if category_preferences:
                query = query.filter(categories__name__in=category_preferences)

            # Apply explicit filters if provided (override onboarding preferences)
            if tool_ids:
                query = query.filter(tools__id__in=tool_ids)
            if category_ids:
                query = query.filter(categories__id__in=category_ids)
            if topic_names:
                query = query.filter(topics__overlap=topic_names)

            # Order by newest first, then popularity
            projects = (
                query.annotate(like_count=Count('likes'))
                .order_by('-created_at', '-like_count')
                .distinct()
                .select_related('user')
                .prefetch_related('tools', 'categories', 'likes')
            )

            # Get total count for pagination
            total_count = projects.count()

            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size

            return {
                'projects': list(projects[start_idx:end_idx]),
                'metadata': {
                    'page': page,
                    'page_size': page_size,
                    'total_candidates': total_count,
                    'algorithm': 'onboarding_preferences',
                    'tool_preferences': tool_preferences,
                    'category_preferences': category_preferences,
                    'filters_applied': {
                        'tool_ids': tool_ids,
                        'category_ids': category_ids,
                        'topic_names': topic_names,
                    },
                },
            }

        except ImportError:
            return self._get_popular_feed(page, page_size, tool_ids, category_ids, topic_names)

    def _calculate_promotion_score(self, project) -> float:
        """Calculate promotion score for a project with time decay.

        Promoted projects get a boost that decays from 1.0 to 0.3 over 7 days.
        After 7 days, maintains a 0.3 baseline for historically promoted content.

        Args:
            project: Project instance with is_promoted and promoted_at fields

        Returns:
            Promotion score between 0.0 and 1.0
        """
        if not project.is_promoted or not project.promoted_at:
            return 0.0

        now = timezone.now()
        hours_since_promotion = (now - project.promoted_at).total_seconds() / 3600
        max_hours = PROMOTION_DURATION_DAYS * 24  # 168 hours

        if hours_since_promotion <= max_hours:
            # Linear decay from 1.0 to 0.3 over promotion duration
            return 1.0 - (0.7 * hours_since_promotion / max_hours)
        else:
            # Baseline for historically promoted content
            return 0.3

    def _get_popular_feed(
        self,
        page: int,
        page_size: int,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
    ) -> dict:
        """Get feed for cold-start users.

        Shows newest projects first with user diversity applied to prevent
        content from a single creator dominating the feed. Projects are
        fetched in chronological order, then reordered to spread out
        content from the same user. Admin-promoted projects get an 8% boost
        to appear more frequently near the top.
        """
        from core.projects.models import Project

        # Sort by newest first, then by like count for projects of similar age
        # This ensures fresh, new projects appear at the top
        queryset = Project.objects.filter(
            is_private=False,
            is_archived=False,
        )

        # Apply filters if provided (OR logic)
        if tool_ids:
            queryset = queryset.filter(tools__id__in=tool_ids)
        if category_ids:
            queryset = queryset.filter(categories__id__in=category_ids)
        if topic_names:
            queryset = queryset.filter(topics__overlap=topic_names)

        queryset = (
            queryset.annotate(like_count=Count('likes'))
            .order_by('-created_at', '-like_count')
            .distinct()
            .select_related('user')
            .prefetch_related('tools', 'categories', 'likes')
        )

        # Get total count for pagination
        total_count = queryset.count()

        # Fetch more projects than needed to allow for diversity reordering
        # and promotion boost. We fetch 3x the page size to have enough variety.
        fetch_size = page_size * 3
        start_idx = (page - 1) * page_size

        # For first page, fetch extra and apply diversity + promotion boost
        # For later pages, use simple offset to avoid complexity
        if page == 1:
            candidates = list(queryset[:fetch_size])
            # Apply promotion boost before diversity
            candidates = self._apply_promotion_boost(candidates)
            diverse_projects = self._apply_user_diversity(candidates, page_size)
        else:
            # For pagination, apply diversity to the window we're showing
            candidates = list(queryset[start_idx : start_idx + fetch_size])
            # Apply promotion boost before diversity
            candidates = self._apply_promotion_boost(candidates)
            diverse_projects = self._apply_user_diversity(candidates, page_size)

        return {
            'projects': diverse_projects,
            'metadata': {
                'page': page,
                'page_size': page_size,
                'total_candidates': total_count,
                'algorithm': 'newest_first_diverse_with_promotion',
                'filters_applied': {
                    'tool_ids': tool_ids,
                    'category_ids': category_ids,
                    'topic_names': topic_names,
                },
            },
        }

    def _apply_promotion_boost(self, projects: list) -> list:
        """Apply promotion boost to reorder projects.

        Promoted projects get moved up in the list based on their promotion score.
        This doesn't pin them to the top, but increases their likelihood of
        appearing near the top of the feed.

        Args:
            projects: List of projects sorted by recency

        Returns:
            Reordered list with promotion boost applied
        """
        if not projects:
            return []

        # Calculate combined score for each project
        # Base score is position (earlier = higher), promotion adds boost
        scored = []
        for idx, project in enumerate(projects):
            # Base score: 1.0 for first, decays for later positions
            base_score = 1.0 - (idx / len(projects)) if len(projects) > 1 else 1.0

            # Promotion score with time decay
            promotion_score = self._calculate_promotion_score(project)

            # Combined score: 92% base + 8% promotion (consistent with PersonalizationEngine)
            combined_score = (base_score * (1 - PROMOTION_WEIGHT)) + (promotion_score * PROMOTION_WEIGHT)

            scored.append((project, combined_score, idx))

        # Sort by combined score (descending), then by original position for ties
        scored.sort(key=lambda x: (-x[1], x[2]))

        return [item[0] for item in scored]

    def _apply_user_diversity(
        self,
        projects: list,
        target_size: int,
        max_consecutive: int = 2,
    ) -> list:
        """Apply user diversity to spread out content from the same creator.

        This prevents feeds from being dominated by a single user's content
        (e.g., when a YouTube agent syncs many videos at once).

        Args:
            projects: List of projects sorted by recency
            target_size: Number of projects to return
            max_consecutive: Maximum projects from same user in a row

        Returns:
            Reordered list with user diversity applied
        """
        if not projects:
            return []

        result = []
        remaining = list(projects)
        user_last_added: dict[int, int] = {}  # user_id -> position last added

        while remaining and len(result) < target_size:
            best_idx = None
            best_score = -1

            for idx, project in enumerate(remaining):
                user_id = project.user_id

                # Calculate diversity score
                # Higher score = better candidate (more diverse)
                score = 100 - idx  # Prefer earlier items (more recent)

                # Check how recently this user appeared
                if user_id in user_last_added:
                    distance = len(result) - user_last_added[user_id]
                    if distance < max_consecutive:
                        # Too recent, heavily penalize
                        score -= 200
                    else:
                        # Reward diversity
                        score += min(distance * 10, 50)

                if score > best_score:
                    best_score = score
                    best_idx = idx

            if best_idx is not None:
                project = remaining.pop(best_idx)
                user_last_added[project.user_id] = len(result)
                result.append(project)
            else:
                # Shouldn't happen, but safety fallback
                break

        return result

    def get_onboarding_status(self, user: 'User') -> dict:
        """
        Get user's onboarding/cold-start status.

        Args:
            user: User to check

        Returns:
            Dict with status information
        """
        from core.projects.models import ProjectLike
        from core.taxonomy.models import UserInteraction, UserTag

        tag_count = UserTag.objects.filter(user=user).count()
        interaction_count = UserInteraction.objects.filter(user=user).count()
        like_count = ProjectLike.objects.filter(user=user).count()

        has_sufficient = self.has_sufficient_data(user)
        has_onboarding = self.has_onboarding_responses(user)

        # Calculate completion percentage
        data_score = min(
            (tag_count / self.MIN_USER_TAGS) * 0.4
            + (interaction_count / self.MIN_INTERACTIONS) * 0.3
            + (like_count / self.MIN_LIKES) * 0.3,
            1.0,
        )

        return {
            'is_cold_start': not has_sufficient and not has_onboarding,
            'has_sufficient_data': has_sufficient,
            'has_onboarding': has_onboarding,
            'data_score': round(data_score, 2),
            'stats': {
                'tag_count': tag_count,
                'interaction_count': interaction_count,
                'like_count': like_count,
            },
            'thresholds': {
                'min_tags': self.MIN_USER_TAGS,
                'min_interactions': self.MIN_INTERACTIONS,
                'min_likes': self.MIN_LIKES,
            },
        }

    def should_show_onboarding(self, user: 'User') -> bool:
        """
        Determine if onboarding quiz should be shown to user.

        Args:
            user: User to check

        Returns:
            True if onboarding should be shown
        """
        # Don't show if already has sufficient data
        if self.has_sufficient_data(user):
            return False

        # Don't show if already completed onboarding
        if self.has_onboarding_responses(user):
            return False

        # Check if user has dismissed onboarding (stored in user preferences)
        if hasattr(user, 'preferences') and user.preferences:
            if user.preferences.get('onboarding_dismissed'):
                return False

        return True
