"""
Cold start handling for new users with insufficient data.

Provides:
- Detection of cold-start users
- Onboarding quiz integration
- Popular content fallback
"""

import logging
from typing import TYPE_CHECKING

from django.db.models import Count

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()

logger = logging.getLogger(__name__)


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

        Returns:
            Dict with 'projects' list and 'metadata'
        """
        if user and self.has_onboarding_responses(user):
            return self._get_onboarding_based_feed(user, page, page_size)

        return self._get_popular_feed(page, page_size)

    def _get_onboarding_based_feed(
        self,
        user: 'User',
        page: int,
        page_size: int,
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
                },
            }

        except ImportError:
            return self._get_popular_feed(page, page_size)

    def _get_popular_feed(self, page: int, page_size: int) -> dict:
        """Get feed for cold-start users.

        Shows newest projects first to ensure fresh content appears at the top,
        with like count as a secondary sort for projects of similar age.
        """
        from core.projects.models import Project

        # Sort by newest first, then by like count for projects of similar age
        # This ensures fresh, new projects appear at the top
        projects = (
            Project.objects.filter(
                is_private=False,
                is_archived=False,
            )
            .annotate(like_count=Count('likes'))
            .order_by('-created_at', '-like_count')
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
                'algorithm': 'newest_first',
            },
        }

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
