"""
Personalization engine with hybrid scoring algorithm.

Combines multiple signals for "For You" feed:
- Vector similarity (30%): Content-based from Weaviate
- Explicit preferences (25%): UserTag matches
- Behavioral signals (25%): Interaction history
- Collaborative filtering (15%): Similar users' likes
- Popularity (5%): Baseline popularity score
"""

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING

from django.db.models import Count

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()

logger = logging.getLogger(__name__)


@dataclass
class ScoredProject:
    """Project with personalization score breakdown."""

    project_id: int
    total_score: float
    vector_score: float = 0.0
    explicit_score: float = 0.0
    behavioral_score: float = 0.0
    collaborative_score: float = 0.0
    popularity_score: float = 0.0
    diversity_boost: float = 0.0

    def to_dict(self) -> dict:
        return {
            'project_id': self.project_id,
            'total_score': round(self.total_score, 4),
            'scores': {
                'vector': round(self.vector_score, 4),
                'explicit': round(self.explicit_score, 4),
                'behavioral': round(self.behavioral_score, 4),
                'collaborative': round(self.collaborative_score, 4),
                'popularity': round(self.popularity_score, 4),
                'diversity_boost': round(self.diversity_boost, 4),
            },
        }


class PersonalizationEngine:
    """
    Hybrid personalization engine for "For You" feed.

    Algorithm:
    1. Get user's preference vector from Weaviate UserProfile
    2. nearVector search against Project collection (200 candidates)
    3. Score each candidate with explicit preference matching
    4. Score with behavioral signals (penalize seen, boost similar-to-liked)
    5. Add collaborative filtering score (what similar users liked)
    6. Combine scores with weights
    7. Apply diversity boost (avoid category homogeneity)

    Uses connection pooling for high-concurrency Weaviate operations.
    """

    # Configurable weights for hybrid scoring
    WEIGHTS = {
        'vector_similarity': 0.30,
        'explicit_preferences': 0.25,
        'behavioral_signals': 0.25,
        'collaborative': 0.15,
        'popularity': 0.05,
    }

    # Number of candidate projects to fetch from Weaviate
    CANDIDATE_LIMIT = 200

    # Number of similar users to consider for collaborative filtering
    SIMILAR_USERS_LIMIT = 10

    def __init__(self, use_connection_pool: bool = True):
        """
        Initialize the personalization engine.

        Args:
            use_connection_pool: If True, use connection pooling for Weaviate.
                                 Set to False for backwards compatibility.
        """
        self._use_pool = use_connection_pool
        self._weaviate_client = None
        self._connection_pool = None
        self._embedding_service = None

    @property
    def connection_pool(self):
        """Get the Weaviate connection pool."""
        if self._connection_pool is None:
            from services.weaviate import get_connection_pool

            self._connection_pool = get_connection_pool()
        return self._connection_pool

    @property
    def weaviate_client(self):
        """Lazy initialization of Weaviate client (for non-pooled use)."""
        if self._weaviate_client is None:
            from services.weaviate import get_weaviate_client

            self._weaviate_client = get_weaviate_client()
        return self._weaviate_client

    def _get_client(self):
        """
        Get a Weaviate client.

        If using connection pool, returns a context manager.
        Otherwise returns the singleton client.
        """
        if self._use_pool:
            return self.connection_pool.get_client()
        else:
            # Return a dummy context manager for backwards compatibility
            from contextlib import contextmanager

            @contextmanager
            def _client_context():
                yield self.weaviate_client

            return _client_context()

    @property
    def embedding_service(self):
        """Lazy initialization of embedding service."""
        if self._embedding_service is None:
            from services.weaviate import get_embedding_service

            self._embedding_service = get_embedding_service()
        return self._embedding_service

    def get_for_you_feed(
        self,
        user: 'User',
        page: int = 1,
        page_size: int = 20,
        exclude_project_ids: list[int] | None = None,
    ) -> dict:
        """
        Get personalized "For You" feed for a user.

        Args:
            user: User to get feed for
            page: Page number (1-indexed)
            page_size: Number of projects per page
            exclude_project_ids: Project IDs to exclude (e.g., already shown)

        Returns:
            Dict with 'projects' list and 'metadata'
        """
        from core.projects.models import Project

        exclude_project_ids = exclude_project_ids or []

        try:
            # Step 1: Get user's preference vector
            user_vector = self._get_user_vector(user)

            if not user_vector:
                logger.info(f'No user vector for {user.id}, falling back to popular')
                return self._get_popular_fallback(page, page_size, exclude_project_ids)

            # Step 2: Get candidate projects from Weaviate
            candidates = self._get_vector_candidates(user_vector, exclude_project_ids)

            if not candidates:
                logger.info(f'No Weaviate candidates for {user.id}, falling back to popular')
                return self._get_popular_fallback(page, page_size, exclude_project_ids)

            # Step 3: Score all candidates
            # Pass user_vector to avoid redundant computation in collaborative filtering
            scored_projects = self._score_candidates(user, candidates, user_vector=user_vector)

            # Step 4: Apply diversity boost
            scored_projects = self._apply_diversity_boost(scored_projects)

            # Step 5: Sort by total score and paginate
            scored_projects.sort(key=lambda x: x.total_score, reverse=True)

            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            page_results = scored_projects[start_idx:end_idx]

            # Step 6: Get Django Project objects
            project_ids = [sp.project_id for sp in page_results]
            projects = (
                Project.objects.filter(id__in=project_ids)
                .select_related('user')
                .prefetch_related('tools', 'categories', 'likes')
            )

            # Maintain score order
            project_map = {p.id: p for p in projects}
            ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

            return {
                'projects': ordered_projects,
                'metadata': {
                    'page': page,
                    'page_size': page_size,
                    'total_candidates': len(scored_projects),
                    'algorithm': 'hybrid_personalization',
                    'scores': [sp.to_dict() for sp in page_results],
                },
            }

        except Exception as e:
            logger.error(f'Personalization error for user {user.id}: {e}', exc_info=True)
            return self._get_popular_fallback(page, page_size, exclude_project_ids)

    def _get_user_vector(self, user: 'User') -> list[float] | None:
        """Get user's preference vector from Weaviate or generate it."""
        from services.weaviate.schema import WeaviateSchema

        try:
            # Try to get from Weaviate using connection pool
            with self._get_client() as client:
                if not client.is_available():
                    logger.warning(
                        f'Weaviate unavailable for user vector lookup user_id={user.id}, ' 'will generate on-the-fly'
                    )
                else:
                    # Note: client.client accesses the underlying weaviate.Client
                    # First 'client' is our WeaviateClient wrapper, second is weaviate lib
                    result = (
                        client.client.query.get(
                            WeaviateSchema.USER_PROFILE_COLLECTION,
                            ['user_id'],
                        )
                        .with_where(
                            {
                                'path': ['user_id'],
                                'operator': 'Equal',
                                'valueInt': user.id,
                            }
                        )
                        .with_additional(['vector'])
                        .with_limit(1)
                        .do()
                    )

                    profiles = result.get('data', {}).get('Get', {}).get(WeaviateSchema.USER_PROFILE_COLLECTION, [])

                    if profiles:
                        vector = profiles[0].get('_additional', {}).get('vector')
                        if vector:
                            logger.debug(f'Retrieved user vector from Weaviate user_id={user.id}')
                            return vector
                        else:
                            logger.warning(f'User profile in Weaviate has no vector user_id={user.id}')

            # Generate on-the-fly if not in Weaviate
            logger.info(f'Generating user vector on-the-fly user_id={user.id}')
            embedding_text = self.embedding_service.generate_user_profile_embedding_text(user)
            if not embedding_text:
                logger.warning(f'No profile data to generate embedding user_id={user.id}')
                return None

            vector = self.embedding_service.generate_embedding(embedding_text)
            if not vector:
                logger.error(f'Failed to generate user embedding user_id={user.id}')
            return vector if vector else None

        except Exception as e:
            logger.error(
                f'Error getting user vector: {e}',
                extra={'user_id': user.id},
                exc_info=True,
            )
            return None

    def _get_vector_candidates(
        self,
        user_vector: list[float],
        exclude_ids: list[int],
    ) -> list[dict]:
        """Get candidate projects using vector similarity search."""
        from services.weaviate.client import WeaviateClientError
        from services.weaviate.schema import WeaviateSchema

        try:
            # Build exclusion filters if any
            additional_filters = None
            if exclude_ids:
                # Build exclusion operands
                exclusion_operands = []
                for pid in exclude_ids[:50]:  # Limit exclusions to avoid query issues
                    exclusion_operands.append(
                        {
                            'path': ['project_id'],
                            'operator': 'NotEqual',
                            'valueInt': pid,
                        }
                    )
                if exclusion_operands:
                    additional_filters = {
                        'operator': 'And',
                        'operands': exclusion_operands,
                    }

            # Use connection pool for the search
            # Note: near_vector_search now auto-applies visibility filter for projects
            with self._get_client() as client:
                candidates = client.near_vector_search(
                    collection=WeaviateSchema.PROJECT_COLLECTION,
                    vector=user_vector,
                    limit=self.CANDIDATE_LIMIT,
                    filters=additional_filters,  # Visibility filter applied automatically
                    return_properties=[
                        'project_id',
                        'title',
                        'tool_names',
                        'category_names',
                        'topics',
                        'engagement_velocity',
                        'like_count',
                        'owner_id',
                    ],
                    enforce_visibility=True,  # Explicit for clarity
                )

            logger.info(
                f'Retrieved {len(candidates)} vector candidates from Weaviate '
                f'(limit={self.CANDIDATE_LIMIT}, excluded={len(exclude_ids)})'
            )
            return candidates

        except WeaviateClientError as e:
            logger.error(
                f'Weaviate search failed, cannot get candidates: {e}',
                extra={
                    'vector_dim': len(user_vector) if user_vector else 0,
                    'exclude_count': len(exclude_ids),
                },
                exc_info=True,
            )
            return []
        except Exception as e:
            logger.error(
                f'Unexpected error getting vector candidates: {e}',
                exc_info=True,
            )
            return []

    def _score_candidates(
        self,
        user: 'User',
        candidates: list[dict],
        user_vector: list[float] | None = None,
    ) -> list[ScoredProject]:
        """
        Score all candidate projects using hybrid algorithm.

        Args:
            user: User to score for
            candidates: List of candidate projects from Weaviate
            user_vector: Pre-computed user preference vector (avoids redundant computation)
        """
        from core.projects.models import ProjectLike
        from core.taxonomy.models import UserInteraction, UserTag

        # Get user's data for scoring
        user_tags = set(UserTag.objects.filter(user=user).values_list('name', flat=True))
        user_tool_tags = set(
            UserTag.objects.filter(user=user, taxonomy__taxonomy_type='tool').values_list('taxonomy__name', flat=True)
        )
        user_category_tags = set(
            UserTag.objects.filter(user=user, taxonomy__taxonomy_type='category').values_list(
                'taxonomy__name', flat=True
            )
        )

        # Get user's liked projects for behavioral scoring
        liked_project_ids = set(ProjectLike.objects.filter(user=user).values_list('project_id', flat=True))

        # Get viewed project IDs from interactions
        viewed_project_ids = set(
            UserInteraction.objects.filter(user=user, interaction_type='project_view').values_list(
                'metadata__project_id', flat=True
            )
        )

        # Get collaborative filtering data (what similar users liked)
        # Pass user_vector to avoid redundant _get_user_vector call
        collaborative_scores = self._get_collaborative_scores(user, user_vector=user_vector)

        # BATCH QUERY: Get like counts for all candidate owners in ONE query
        # This prevents N+1 queries in the scoring loop below
        owner_ids = [c.get('owner_id') for c in candidates if c.get('owner_id')]
        owner_like_counts = (
            ProjectLike.objects.filter(user=user, project__user_id__in=owner_ids)
            .values('project__user_id')
            .annotate(like_count=Count('id'))
        )
        # Convert to dict for O(1) lookup: {owner_id: like_count}
        owner_like_map = {item['project__user_id']: item['like_count'] for item in owner_like_counts}

        # Calculate max values for normalization
        max_like_count = max((c.get('like_count', 0) for c in candidates), default=1) or 1
        max_velocity = max((c.get('engagement_velocity', 0) for c in candidates), default=1) or 1

        scored_projects = []

        for candidate in candidates:
            project_id = candidate.get('project_id')
            if not project_id:
                continue

            # 1. Vector similarity score (from Weaviate distance)
            distance = candidate.get('_additional', {}).get('distance', 1.0)
            vector_score = max(0, 1 - distance)  # Convert distance to similarity

            # 2. Explicit preference score (tag matching)
            tool_names = set(candidate.get('tool_names', []))
            category_names = set(candidate.get('category_names', []))
            topics = set(candidate.get('topics', []))

            tool_match = len(tool_names & user_tool_tags) / max(len(tool_names), 1)
            category_match = len(category_names & user_category_tags) / max(len(category_names), 1)
            topic_match = len(topics & user_tags) / max(len(topics), 1)

            explicit_score = (tool_match * 0.5) + (category_match * 0.3) + (topic_match * 0.2)

            # 3. Behavioral score
            behavioral_score = 0.0

            # Penalize already seen/viewed projects
            if project_id in viewed_project_ids:
                behavioral_score -= 0.5
            if project_id in liked_project_ids:
                behavioral_score -= 0.8  # Don't show already liked

            # Boost projects similar to liked projects (by owner)
            # Uses pre-computed owner_like_map for O(1) lookup instead of N+1 queries
            owner_id = candidate.get('owner_id')
            if owner_id:
                owner_liked_count = owner_like_map.get(owner_id, 0)
                if owner_liked_count > 0:
                    behavioral_score += min(owner_liked_count * 0.1, 0.3)

            behavioral_score = max(-1, min(1, behavioral_score))  # Clamp to [-1, 1]

            # 4. Collaborative score
            collaborative_score = collaborative_scores.get(project_id, 0.0)

            # 5. Popularity score
            like_count = candidate.get('like_count', 0)
            velocity = candidate.get('engagement_velocity', 0)

            popularity_score = (like_count / max_like_count) * 0.5 + (velocity / max_velocity) * 0.5

            # Combine with weights
            total_score = (
                (vector_score * self.WEIGHTS['vector_similarity'])
                + (explicit_score * self.WEIGHTS['explicit_preferences'])
                + (behavioral_score * self.WEIGHTS['behavioral_signals'])
                + (collaborative_score * self.WEIGHTS['collaborative'])
                + (popularity_score * self.WEIGHTS['popularity'])
            )

            scored_projects.append(
                ScoredProject(
                    project_id=project_id,
                    total_score=total_score,
                    vector_score=vector_score,
                    explicit_score=explicit_score,
                    behavioral_score=behavioral_score,
                    collaborative_score=collaborative_score,
                    popularity_score=popularity_score,
                )
            )

        return scored_projects

    def _get_collaborative_scores(
        self,
        user: 'User',
        user_vector: list[float] | None = None,
    ) -> dict[int, float]:
        """
        Get collaborative filtering scores based on similar users.

        Args:
            user: User to get scores for
            user_vector: Pre-computed user vector (avoids redundant computation)

        Returns:
            Dict mapping project_id -> collaborative score
        """
        from core.projects.models import ProjectLike
        from services.weaviate.client import WeaviateClientError

        try:
            # Use provided vector or fetch if not provided
            if user_vector is None:
                user_vector = self._get_user_vector(user)

            if not user_vector:
                logger.debug(f'No user vector for collaborative filtering user_id={user.id}')
                return {}

            # Find similar users using connection pool
            with self._get_client() as client:
                similar_users = client.find_similar_users(
                    user_vector=user_vector,
                    exclude_user_id=user.id,
                    limit=self.SIMILAR_USERS_LIMIT,
                )

            if not similar_users:
                logger.debug(f'No similar users found for collaborative filtering user_id={user.id}')
                return {}

            # Get their liked projects
            similar_user_ids = [u.get('user_id') for u in similar_users if u.get('user_id')]
            logger.debug(f'Found {len(similar_user_ids)} similar users for user_id={user.id}')

            # Count how many similar users liked each project
            project_like_counts = (
                ProjectLike.objects.filter(user_id__in=similar_user_ids)
                .values('project_id')
                .annotate(count=Count('id'))
            )

            # Normalize scores
            max_count = max((p['count'] for p in project_like_counts), default=1)

            scores = {p['project_id']: p['count'] / max_count for p in project_like_counts}
            logger.debug(f'Generated {len(scores)} collaborative scores for user_id={user.id}')
            return scores

        except WeaviateClientError as e:
            logger.warning(
                f'Weaviate error in collaborative filtering, skipping: {e}',
                extra={'user_id': user.id},
            )
            return {}
        except Exception as e:
            logger.error(
                f'Error getting collaborative scores: {e}',
                extra={'user_id': user.id},
                exc_info=True,
            )
            return {}

    def _apply_diversity_boost(
        self,
        scored_projects: list[ScoredProject],
    ) -> list[ScoredProject]:
        """
        Apply diversity boost to avoid category homogeneity.

        Penalizes projects if too many similar projects rank higher.
        """
        from core.projects.models import Project

        if not scored_projects:
            return scored_projects

        # Get categories for all projects
        project_ids = [sp.project_id for sp in scored_projects]
        projects_with_categories = Project.objects.filter(id__in=project_ids).prefetch_related('categories')

        project_categories = {}
        for project in projects_with_categories:
            project_categories[project.id] = set(project.categories.values_list('name', flat=True))

        # Sort by current score
        scored_projects.sort(key=lambda x: x.total_score, reverse=True)

        # Track category frequencies in top results
        category_counts = defaultdict(int)
        diversity_penalty = 0.02  # Penalty per repeated category

        for sp in scored_projects:
            categories = project_categories.get(sp.project_id, set())

            # Calculate penalty based on categories already seen
            penalty = 0
            for cat in categories:
                penalty += category_counts[cat] * diversity_penalty

            # Apply diversity boost (negative if penalized)
            sp.diversity_boost = -penalty
            sp.total_score += sp.diversity_boost

            # Update category counts for next iteration
            for cat in categories:
                category_counts[cat] += 1

        return scored_projects

    def _get_popular_fallback(
        self,
        page: int,
        page_size: int,
        exclude_ids: list[int],
    ) -> dict:
        """Fallback to popular projects when personalization fails."""
        from core.projects.models import Project

        projects = (
            Project.objects.filter(is_published=True, is_private=False, is_archived=False)
            .exclude(id__in=exclude_ids)
            .annotate(like_count=Count('likes'))
            .order_by('-like_count', '-created_at')
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
                'algorithm': 'popular_fallback',
            },
        }
