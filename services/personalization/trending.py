"""
Trending engine for engagement velocity-based recommendations.

Calculates trending scores based on:
- Like velocity (rate of likes acceleration)
- View velocity (rate of views acceleration)
- Recency factor (newer projects get a boost)
"""

import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Count
from django.utils import timezone

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()

logger = logging.getLogger(__name__)


@dataclass
class TrendingProject:
    """Project with trending score breakdown."""

    project_id: int
    trending_score: float
    like_velocity: float = 0.0
    view_velocity: float = 0.0
    recency_factor: float = 1.0
    recent_likes: int = 0
    total_likes: int = 0

    def to_dict(self) -> dict:
        return {
            'project_id': self.project_id,
            'trending_score': round(self.trending_score, 4),
            'metrics': {
                'like_velocity': round(self.like_velocity, 4),
                'view_velocity': round(self.view_velocity, 4),
                'recency_factor': round(self.recency_factor, 4),
                'recent_likes': self.recent_likes,
                'total_likes': self.total_likes,
            },
        }


class TrendingEngine:
    """
    Engine for calculating trending scores based on engagement velocity.

    Formula:
    velocity = (recent_engagement - previous_engagement) / max(previous_engagement, 1)
    trending_score = velocity * recency_factor

    Where:
    - recent_engagement = likes in past 24 hours
    - previous_engagement = likes in 24-48 hours ago
    - recency_factor = 1.0 / (1 + days_old * 0.1)
    """

    # Time windows for velocity calculation
    RECENT_WINDOW_HOURS = 24
    PREVIOUS_WINDOW_HOURS = 48

    # Weights for different engagement types
    LIKE_WEIGHT = 0.7
    VIEW_WEIGHT = 0.3

    # Recency decay factor
    RECENCY_DECAY = 0.1

    def __init__(self):
        self._weaviate_client = None

    @property
    def weaviate_client(self):
        """Lazy initialization of Weaviate client."""
        if self._weaviate_client is None:
            from services.weaviate import get_weaviate_client

            self._weaviate_client = get_weaviate_client()
        return self._weaviate_client

    def get_trending_feed(
        self,
        user: 'User | None' = None,
        page: int = 1,
        page_size: int = 20,
        time_window_hours: int = 72,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
        freshness_token: str | None = None,
    ) -> dict:
        """
        Get trending projects feed.

        Args:
            user: Optional user for personalized filtering
            page: Page number (1-indexed)
            page_size: Number of projects per page
            time_window_hours: Consider projects updated within this window
            tool_ids: Filter to projects with ANY of these tools (OR logic)
            category_ids: Filter to projects with ANY of these categories (OR logic)
            topic_names: Filter to projects with ANY of these topics (OR logic)
            freshness_token: Token for exploration scoring and soft shuffling

        Returns:
            Dict with 'projects' list and 'metadata'
        """

        try:
            # Try Weaviate first for pre-computed velocities
            if self.weaviate_client.is_available():
                return self._get_trending_from_weaviate(
                    user, page, page_size, tool_ids, category_ids, topic_names, freshness_token
                )

            # Fallback to real-time calculation (includes ALL projects)
            return self._calculate_trending_realtime(
                user, page, page_size, time_window_hours, tool_ids, category_ids, topic_names, freshness_token
            )

        except Exception as e:
            logger.error(f'Trending engine error: {e}', exc_info=True)
            return self._get_fallback_trending(page, page_size, tool_ids, category_ids, topic_names)

    def _get_trending_from_weaviate(
        self,
        user: 'User | None',
        page: int,
        page_size: int,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
        freshness_token: str | None = None,
    ) -> dict:
        """Get trending projects from Weaviate pre-computed velocities."""
        from core.projects.models import Project
        from services.personalization.freshness import FreshnessService

        # Fetch more to support pagination
        trending = self.weaviate_client.get_trending_projects(
            limit=1000,  # Get many for endless scroll support
            min_velocity=0.0,
        )

        if not trending:
            return self._get_fallback_trending(page, page_size, tool_ids, category_ids, topic_names)

        # Apply filters if provided
        if tool_ids or category_ids or topic_names:
            project_ids = [t.get('project_id') for t in trending]
            query = Project.objects.filter(id__in=project_ids)
            if tool_ids:
                query = query.filter(tools__id__in=tool_ids)
            if category_ids:
                query = query.filter(categories__id__in=category_ids)
            if topic_names:
                query = query.filter(topics__overlap=topic_names)
            matching_ids = set(query.distinct().values_list('id', flat=True))
            trending = [t for t in trending if t.get('project_id') in matching_ids]

        # Apply freshness (exploration noise + deprioritization)
        if freshness_token:
            user_id = user.id if user and user.is_authenticated else None
            recently_served = FreshnessService.get_recently_served(user_id) if user_id else set()

            for t in trending:
                project_id = t.get('project_id')
                velocity = t.get('engagement_velocity', 0)

                # Add exploration noise
                exploration = FreshnessService.calculate_exploration_score(project_id, freshness_token)
                noise = (exploration - 0.5) * 0.1  # +/- 5% noise
                velocity += noise

                # Apply deprioritization for recently served
                if user_id and project_id in recently_served:
                    penalty = FreshnessService.calculate_deprioritization(user_id, project_id)
                    velocity -= penalty

                t['engagement_velocity'] = velocity

            # Re-sort after applying freshness
            trending.sort(key=lambda x: x.get('engagement_velocity', 0), reverse=True)

            # Apply soft shuffle for variety
            # Convert to TrendingProject-like objects for shuffle
            class TrendingDict:
                def __init__(self, d):
                    self._d = d
                    self.trending_score = d.get('engagement_velocity', 0)

            wrapped = [TrendingDict(t) for t in trending]
            wrapped = FreshnessService.apply_soft_shuffle(
                wrapped, freshness_token, score_attr='trending_score', tolerance=0.15
            )
            trending = [w._d for w in wrapped]

        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = trending[start_idx:end_idx]

        # Record served projects for future deprioritization
        if freshness_token and user and user.is_authenticated and page_results:
            FreshnessService.record_served_projects(
                user.id,
                [t.get('project_id') for t in page_results],
            )

        # Get Django objects
        project_ids = [t.get('project_id') for t in page_results]
        projects = (
            Project.objects.filter(id__in=project_ids)
            .select_related('user')
            .prefetch_related('tools', 'categories', 'likes')
        )

        # Maintain velocity order
        project_map = {p.id: p for p in projects}
        ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

        # Get true total count from database for pagination (with filters)
        total_query = Project.objects.filter(
            is_private=False,
            is_archived=False,
        )
        if tool_ids:
            total_query = total_query.filter(tools__id__in=tool_ids)
        if category_ids:
            total_query = total_query.filter(categories__id__in=category_ids)
        if topic_names:
            total_query = total_query.filter(topics__overlap=topic_names)
        total_available = total_query.distinct().count()

        return {
            'projects': ordered_projects,
            'metadata': {
                'page': page,
                'page_size': page_size,
                'total_trending': total_available,
                'weaviate_trending': len(trending),
                'algorithm': 'weaviate_velocity',
                'freshness_token': freshness_token,
                'freshness_applied': bool(freshness_token),
                'scores': [
                    {
                        'project_id': t.get('project_id'),
                        'engagement_velocity': t.get('engagement_velocity', 0),
                        'like_count': t.get('like_count', 0),
                    }
                    for t in page_results
                ],
                'filters_applied': {
                    'tool_ids': tool_ids,
                    'category_ids': category_ids,
                    'topic_names': topic_names,
                },
            },
        }

    def _calculate_trending_realtime(
        self,
        user: 'User | None',
        page: int,
        page_size: int,
        time_window_hours: int,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
        freshness_token: str | None = None,
    ) -> dict:
        """Calculate trending scores in real-time from database.

        Returns ALL projects with trending/engaged ones at the top, then the rest
        sorted by newest. Nothing is filtered out - all projects are included.
        """
        from django.db.models import Case, IntegerField, Sum, When

        from core.projects.models import Project

        now = timezone.now()
        recent_cutoff = now - timedelta(hours=self.RECENT_WINDOW_HOURS)
        prev_cutoff = now - timedelta(hours=self.PREVIOUS_WINDOW_HOURS)

        # Get ALL public projects with like and view count annotations
        base_query = Project.objects.filter(
            is_private=False,
            is_archived=False,
        )

        # Apply filters if provided (OR logic)
        if tool_ids:
            base_query = base_query.filter(tools__id__in=tool_ids)
        if category_ids:
            base_query = base_query.filter(categories__id__in=category_ids)
        if topic_names:
            base_query = base_query.filter(topics__overlap=topic_names)

        all_projects = (
            base_query.distinct()
            .select_related('user')
            .prefetch_related('tools', 'categories')
            .annotate(
                # Count likes in recent window (last 24 hours)
                recent_likes_count=Sum(
                    Case(
                        When(
                            likes__created_at__gte=recent_cutoff,
                            likes__created_at__lt=now,
                            then=1,
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                # Count likes in previous window (24-48 hours ago)
                prev_likes_count=Sum(
                    Case(
                        When(
                            likes__created_at__gte=prev_cutoff,
                            likes__created_at__lt=recent_cutoff,
                            then=1,
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                # Total likes count
                total_likes_count=Count('likes'),
                # Count views in recent window (last 24 hours)
                recent_views_count=Sum(
                    Case(
                        When(
                            views__created_at__gte=recent_cutoff,
                            views__created_at__lt=now,
                            then=1,
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                # Count views in previous window (24-48 hours ago)
                prev_views_count=Sum(
                    Case(
                        When(
                            views__created_at__gte=prev_cutoff,
                            views__created_at__lt=recent_cutoff,
                            then=1,
                        ),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
            )
        )

        trending_projects = []

        for project in all_projects:
            recent_likes = project.recent_likes_count or 0
            prev_likes = project.prev_likes_count or 0
            recent_views = project.recent_views_count or 0
            prev_views = project.prev_views_count or 0

            like_velocity = (recent_likes - prev_likes) / max(prev_likes, 1)
            view_velocity = (recent_views - prev_views) / max(prev_views, 1)
            velocity = (like_velocity * self.LIKE_WEIGHT) + (view_velocity * self.VIEW_WEIGHT)

            days_old = (now - project.created_at).days
            recency_factor = 1.0 / (1 + days_old * self.RECENCY_DECAY)

            trending_score = velocity * recency_factor

            # Include ALL projects - those with engagement get their score,
            # those without get score of 0 and will be sorted by recency
            trending_projects.append(
                TrendingProject(
                    project_id=project.id,
                    trending_score=trending_score,
                    like_velocity=like_velocity,
                    view_velocity=view_velocity,
                    recency_factor=recency_factor,
                    recent_likes=recent_likes,
                    total_likes=project.total_likes_count or 0,
                )
            )

        # Sort by trending score first, then by recency for tie-breaking
        # This puts engaged projects at top, then newest projects below
        trending_projects.sort(key=lambda x: (x.trending_score, x.recency_factor), reverse=True)

        # Apply freshness (exploration noise + deprioritization)
        if freshness_token:
            from services.personalization.freshness import FreshnessService

            user_id = user.id if user and user.is_authenticated else None
            recently_served = FreshnessService.get_recently_served(user_id) if user_id else set()

            for tp in trending_projects:
                # Add exploration noise
                exploration = FreshnessService.calculate_exploration_score(tp.project_id, freshness_token)
                noise = (exploration - 0.5) * 0.1  # +/- 5% noise
                tp.trending_score += noise

                # Apply deprioritization for recently served
                if user_id and tp.project_id in recently_served:
                    penalty = FreshnessService.calculate_deprioritization(user_id, tp.project_id)
                    tp.trending_score -= penalty

            # Re-sort after applying freshness
            trending_projects.sort(key=lambda x: x.trending_score, reverse=True)

            # Apply soft shuffle for variety
            trending_projects = FreshnessService.apply_soft_shuffle(
                trending_projects, freshness_token, score_attr='trending_score', tolerance=0.15
            )

        # Paginate
        total_count = len(trending_projects)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = trending_projects[start_idx:end_idx]

        # Record served projects for future deprioritization
        if freshness_token and user and user.is_authenticated and page_results:
            from services.personalization.freshness import FreshnessService

            FreshnessService.record_served_projects(
                user.id,
                [tp.project_id for tp in page_results],
            )

        # Get project objects in order
        project_ids = [tp.project_id for tp in page_results]
        project_map = {p.id: p for p in all_projects if p.id in project_ids}
        ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

        return {
            'projects': ordered_projects,
            'metadata': {
                'page': page,
                'page_size': page_size,
                'total_trending': total_count,
                'algorithm': 'realtime_velocity',
                'freshness_token': freshness_token,
                'freshness_applied': bool(freshness_token),
                'scores': [tp.to_dict() for tp in page_results],
                'filters_applied': {
                    'tool_ids': tool_ids,
                    'category_ids': category_ids,
                    'topic_names': topic_names,
                },
            },
        }

    def _get_fallback_trending(
        self,
        page: int,
        page_size: int,
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
    ) -> dict:
        """Fallback when realtime trending calculation fails.

        Shows liked projects first (by like count), then all remaining projects
        by newest. Nothing is filtered out - all projects are included.
        """
        from core.projects.models import Project

        projects = Project.objects.filter(
            is_private=False,
            is_archived=False,
        )

        # Apply filters if provided (OR logic)
        if tool_ids:
            projects = projects.filter(tools__id__in=tool_ids)
        if category_ids:
            projects = projects.filter(categories__id__in=category_ids)
        if topic_names:
            projects = projects.filter(topics__overlap=topic_names)

        projects = (
            projects.annotate(like_count=Count('likes'))
            .order_by('-like_count', '-created_at')
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
                'total_trending': total_count,
                'algorithm': 'popular_then_newest',
                'filters_applied': {
                    'tool_ids': tool_ids,
                    'category_ids': category_ids,
                    'topic_names': topic_names,
                },
            },
        }

    def calculate_velocity(
        self,
        project_id: int,
        recent_likes: int | None = None,
        prev_likes: int | None = None,
    ) -> float:
        """
        Calculate engagement velocity for a single project.

        Args:
            project_id: Project ID
            recent_likes: Likes in recent window (calculated if None)
            prev_likes: Likes in previous window (calculated if None)

        Returns:
            Engagement velocity score
        """
        from core.projects.models import Project, ProjectLike

        now = timezone.now()
        recent_cutoff = now - timedelta(hours=self.RECENT_WINDOW_HOURS)
        prev_cutoff = now - timedelta(hours=self.PREVIOUS_WINDOW_HOURS)

        # Calculate likes if not provided
        if recent_likes is None:
            recent_likes = ProjectLike.objects.filter(
                project_id=project_id,
                created_at__gte=recent_cutoff,
                created_at__lt=now,
            ).count()

        if prev_likes is None:
            prev_likes = ProjectLike.objects.filter(
                project_id=project_id,
                created_at__gte=prev_cutoff,
                created_at__lt=recent_cutoff,
            ).count()

        # Calculate velocity
        like_velocity = (recent_likes - prev_likes) / max(prev_likes, 1)

        # Get project age for recency factor
        try:
            project = Project.objects.get(id=project_id)
            days_old = (now - project.created_at).days
            recency_factor = 1.0 / (1 + days_old * self.RECENCY_DECAY)
        except Project.DoesNotExist:
            recency_factor = 1.0

        velocity = like_velocity * self.LIKE_WEIGHT * recency_factor

        return round(velocity, 4)
