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

from django.db.models import Count, Q
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
    ) -> dict:
        """
        Get trending projects feed.

        Args:
            user: Optional user for personalized filtering
            page: Page number (1-indexed)
            page_size: Number of projects per page
            time_window_hours: Consider projects updated within this window

        Returns:
            Dict with 'projects' list and 'metadata'
        """

        try:
            # Try Weaviate first for pre-computed velocities
            if self.weaviate_client.is_available():
                return self._get_trending_from_weaviate(user, page, page_size)

            # Fallback to real-time calculation
            return self._calculate_trending_realtime(user, page, page_size, time_window_hours)

        except Exception as e:
            logger.error(f'Trending engine error: {e}', exc_info=True)
            return self._get_fallback_trending(page, page_size)

    def _get_trending_from_weaviate(
        self,
        user: 'User | None',
        page: int,
        page_size: int,
    ) -> dict:
        """Get trending projects from Weaviate pre-computed velocities."""
        from core.projects.models import Project

        trending = self.weaviate_client.get_trending_projects(
            limit=page * page_size + page_size,  # Get enough for pagination
            min_velocity=0.0,
        )

        if not trending:
            return self._get_fallback_trending(page, page_size)

        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = trending[start_idx:end_idx]

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

        return {
            'projects': ordered_projects,
            'metadata': {
                'page': page,
                'page_size': page_size,
                'total_trending': len(trending),
                'algorithm': 'weaviate_velocity',
                'scores': [
                    {
                        'project_id': t.get('project_id'),
                        'engagement_velocity': t.get('engagement_velocity', 0),
                        'like_count': t.get('like_count', 0),
                    }
                    for t in page_results
                ],
            },
        }

    def _calculate_trending_realtime(
        self,
        user: 'User | None',
        page: int,
        page_size: int,
        time_window_hours: int,
    ) -> dict:
        """Calculate trending scores in real-time from database."""
        from django.db.models import Case, IntegerField, Sum, When

        from core.projects.models import Project

        now = timezone.now()
        recent_cutoff = now - timedelta(hours=self.RECENT_WINDOW_HOURS)
        prev_cutoff = now - timedelta(hours=self.PREVIOUS_WINDOW_HOURS)
        window_cutoff = now - timedelta(hours=time_window_hours)

        # Get projects with recent activity, annotated with like counts in ONE query
        # This replaces the N+1 pattern that was doing 3 queries per project
        projects_with_activity = (
            Project.objects.filter(
                is_published=True,
                is_private=False,
                is_archived=False,
            )
            .filter(Q(updated_at__gte=window_cutoff) | Q(likes__created_at__gte=window_cutoff))
            .distinct()
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
            )
        )

        trending_projects = []

        for project in projects_with_activity:
            # Use annotated values instead of per-project queries
            recent_likes = project.recent_likes_count or 0
            prev_likes = project.prev_likes_count or 0

            like_velocity = (recent_likes - prev_likes) / max(prev_likes, 1)

            # View velocity would go here if view tracking existed
            view_velocity = 0.0

            # Combined velocity
            velocity = (like_velocity * self.LIKE_WEIGHT) + (view_velocity * self.VIEW_WEIGHT)

            # Apply recency factor
            days_old = (now - project.created_at).days
            recency_factor = 1.0 / (1 + days_old * self.RECENCY_DECAY)

            trending_score = velocity * recency_factor

            # Only include projects with positive trending
            if trending_score > 0 or recent_likes > 0:
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

        # Sort by trending score
        trending_projects.sort(key=lambda x: x.trending_score, reverse=True)

        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_results = trending_projects[start_idx:end_idx]

        # Get project objects in order
        project_ids = [tp.project_id for tp in page_results]
        project_map = {p.id: p for p in projects_with_activity if p.id in project_ids}
        ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

        return {
            'projects': ordered_projects,
            'metadata': {
                'page': page,
                'page_size': page_size,
                'total_trending': len(trending_projects),
                'algorithm': 'realtime_velocity',
                'scores': [tp.to_dict() for tp in page_results],
            },
        }

    def _get_fallback_trending(self, page: int, page_size: int) -> dict:
        """Fallback to recent popular projects."""
        from core.projects.models import Project

        # Get recently published projects with most likes
        cutoff = timezone.now() - timedelta(days=7)

        projects = (
            Project.objects.filter(
                is_published=True,
                is_private=False,
                is_archived=False,
                published_at__gte=cutoff,
            )
            .annotate(like_count=Count('likes'))
            .order_by('-like_count', '-published_at')
            .select_related('user')
            .prefetch_related('tools', 'categories', 'likes')
        )

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        return {
            'projects': list(projects[start_idx:end_idx]),
            'metadata': {
                'page': page,
                'page_size': page_size,
                'algorithm': 'recent_popular_fallback',
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
