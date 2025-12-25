"""
Personalization engine with hybrid scoring algorithm.

Combines multiple signals for "For You" feed:
- Vector similarity (27%): Content-based from Weaviate
- Explicit preferences (23%): UserTag matches
- Behavioral signals (23%): Interaction history + follow boost
  - Penalize viewed/liked projects
  - Boost projects from liked owners
  - Boost projects from followed users (+0.4)
  - Boost based on time spent on similar topics
  - Boost content matching recent searches
  - Penalize dismissed projects and their topics
- Collaborative filtering (14%): Similar users' likes
- Popularity (5%): Baseline popularity score
- Promotion (8%): Admin-curated boost with 7-day decay
"""

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Count
from django.utils import timezone

from services.personalization.settings_aware_scorer import SettingsAwareScorer

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
    promotion_score: float = 0.0  # Quality signal from admin promotions
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
                'promotion': round(self.promotion_score, 4),
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
    # Total = 1.0 (vector + explicit + behavioral + collaborative + popularity + promotion)
    WEIGHTS = {
        'vector_similarity': 0.27,
        'explicit_preferences': 0.23,
        'behavioral_signals': 0.23,
        'collaborative': 0.14,
        'popularity': 0.05,
        'promotion': 0.08,  # Quality signal from admin-promoted content
    }

    # Number of candidate projects to fetch from Weaviate
    # Set high enough to support endless scrolling (will be supplemented by DB fallback if exhausted)
    CANDIDATE_LIMIT = 1000

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
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
        freshness_token: str | None = None,
    ) -> dict:
        """
        Get personalized "For You" feed for a user.

        Args:
            user: User to get feed for
            page: Page number (1-indexed)
            page_size: Number of projects per page
            exclude_project_ids: Project IDs to exclude (e.g., already shown)
            tool_ids: Filter to projects with ANY of these tools (OR logic)
            category_ids: Filter to projects with ANY of these categories (OR logic)
            topic_names: Filter to projects with ANY of these topics (OR logic)
            freshness_token: Token for exploration scoring and soft shuffling

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
                return self._get_popular_fallback(
                    page, page_size, exclude_project_ids, tool_ids, category_ids, topic_names
                )

            # Step 2: Get candidate projects from Weaviate
            candidates = self._get_vector_candidates(user_vector, exclude_project_ids)

            if not candidates:
                logger.info(f'No Weaviate candidates for {user.id}, falling back to popular')
                return self._get_popular_fallback(
                    page, page_size, exclude_project_ids, tool_ids, category_ids, topic_names
                )

            # Step 3: Score all candidates
            # Pass user_vector to avoid redundant computation in collaborative filtering
            scored_projects = self._score_candidates(user, candidates, user_vector=user_vector)

            # Step 4: Apply diversity boost
            scored_projects = self._apply_diversity_boost(scored_projects)

            # Step 5: Apply freshness scoring (exploration + deprioritization)
            if freshness_token:
                from services.personalization.freshness import FreshnessService

                scored_projects = FreshnessService.apply_freshness_to_scores(
                    scored_projects,
                    user_id=user.id,
                    freshness_token=freshness_token,
                    score_attr='total_score',
                )

            # Step 6: Sort by total score
            scored_projects.sort(key=lambda x: x.total_score, reverse=True)

            # Step 7: Apply soft shuffle for variety (if freshness enabled)
            if freshness_token:
                scored_projects = FreshnessService.apply_soft_shuffle(
                    scored_projects,
                    freshness_token,
                    score_attr='total_score',
                    tolerance=0.10,
                )

            # Step 8: Apply filters if provided (before pagination)
            if tool_ids or category_ids or topic_names:
                scored_projects = self._apply_filters(scored_projects, tool_ids, category_ids, topic_names)

            # Step 9: Paginate
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            page_results = scored_projects[start_idx:end_idx]

            # Step 10: Record served projects for future deprioritization
            if freshness_token and page_results:
                FreshnessService.record_served_projects(
                    user.id,
                    [sp.project_id for sp in page_results],
                )

            # Step 11: Get Django Project objects
            project_ids = [sp.project_id for sp in page_results]
            projects = (
                Project.objects.filter(id__in=project_ids)
                .select_related('user')
                .prefetch_related('tools', 'categories', 'likes')
            )

            # Maintain score order
            project_map = {p.id: p for p in projects}
            ordered_projects = [project_map[pid] for pid in project_ids if pid in project_map]

            # Get true total count from database for pagination
            # Account for filters in the count
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
                    'total_candidates': total_available,
                    'weaviate_candidates': len(scored_projects),
                    'algorithm': 'hybrid_personalization',
                    'freshness_token': freshness_token,
                    'freshness_applied': bool(freshness_token),
                    'scores': [sp.to_dict() for sp in page_results],
                    'filters_applied': {
                        'tool_ids': tool_ids,
                        'category_ids': category_ids,
                        'topic_names': topic_names,
                    },
                },
            }

        except Exception as e:
            logger.error(f'Personalization error for user {user.id}: {e}', exc_info=True)
            return self._get_popular_fallback(page, page_size, exclude_project_ids, tool_ids, category_ids, topic_names)

    def _get_user_vector(self, user: 'User') -> list[float] | None:
        """Get user's preference vector from Weaviate or generate it."""
        from services.weaviate.schema import WeaviateSchema

        try:
            # Try to get from Weaviate using connection pool
            with self._get_client() as client:
                if not client.is_available():
                    logger.warning(
                        f'Weaviate unavailable for user vector lookup user_id={user.id}, will generate on-the-fly'
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
                        'promotion_score',
                        'difficulty_taxonomy_name',
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

    def _get_time_spent_topic_boosts(self, user: 'User') -> dict[str, float]:
        """
        Get topic boosts based on time spent on projects in the last 30 days.

        Projects where user spent >60 seconds are analyzed. Their topics
        are boosted proportionally to time spent.

        Returns:
            Dict mapping topic name -> boost value (0.0-0.3)
        """
        from core.engagement.models import EngagementEvent
        from core.projects.models import Project

        try:
            # Get time_spent events from the last 30 days
            cutoff = timezone.now() - timedelta(days=30)
            time_events = EngagementEvent.objects.filter(
                user=user,
                event_type='time_spent',
                created_at__gte=cutoff,
            ).select_related('project')

            # Aggregate time per project
            project_times: dict[int, int] = {}
            for event in time_events:
                if event.project_id:
                    seconds = event.payload.get('seconds', 0)
                    project_times[event.project_id] = project_times.get(event.project_id, 0) + seconds

            # Filter to projects where user spent >60 seconds
            engaged_project_ids = [pid for pid, secs in project_times.items() if secs > 60]

            if not engaged_project_ids:
                return {}

            # Get topics from these engaged projects
            engaged_projects = Project.objects.filter(id__in=engaged_project_ids).only('topics')

            # Count topic occurrences weighted by time
            topic_scores: dict[str, float] = {}
            for project in engaged_projects:
                time_weight = min(project_times.get(project.id, 0) / 300, 1.0)  # Normalize by 5 min
                for topic in project.topics.all():
                    topic_scores[topic.name] = topic_scores.get(topic.name, 0) + time_weight

            # Normalize and cap at 0.3
            max_score = max(topic_scores.values(), default=1)
            return {topic: min(score / max_score * 0.3, 0.3) for topic, score in topic_scores.items()}

        except Exception as e:
            logger.warning(f'Error computing time-spent topic boosts: {e}')
            return {}

    def _get_search_query_boosts(self, user: 'User') -> list[str]:
        """
        Get recent search queries to boost matching content.

        Returns:
            List of search query strings from the last 7 days
        """
        from core.taxonomy.models import UserInteraction

        try:
            cutoff = timezone.now() - timedelta(days=7)
            recent_searches = UserInteraction.objects.filter(
                user=user,
                interaction_type='search',
                created_at__gte=cutoff,
            ).values_list('metadata', flat=True)

            queries = []
            for metadata in recent_searches:
                if isinstance(metadata, dict):
                    query = metadata.get('query', '')
                    if query and len(query) >= 3:
                        queries.append(query.lower())

            return queries

        except Exception as e:
            logger.warning(f'Error getting search query boosts: {e}')
            return []

    def _get_click_boost_project_ids(self, user: 'User') -> set[int]:
        """
        Get project IDs that user clicked in feeds (high-intent signal).

        Returns:
            Set of project IDs the user clicked from feeds
        """
        from core.projects.models import ProjectClick

        try:
            cutoff = timezone.now() - timedelta(days=14)
            clicked_ids = set(
                ProjectClick.objects.filter(
                    user=user,
                    created_at__gte=cutoff,
                ).values_list('project_id', flat=True)
            )
            return clicked_ids

        except Exception as e:
            logger.warning(f'Error getting click boost project IDs: {e}')
            return set()

    def _get_dismissed_data(self, user: 'User') -> tuple[set[int], dict[str, int]]:
        """
        Get dismissed project IDs and topic counts for penalty calculation.

        Returns:
            Tuple of:
            - Set of directly dismissed project IDs
            - Dict mapping topic name -> dismissal count (for topics dismissed 3+ times)
        """
        from core.projects.models import ProjectDismissal

        try:
            # Get all dismissals from the last 90 days
            cutoff = timezone.now() - timedelta(days=90)
            dismissals = (
                ProjectDismissal.objects.filter(
                    user=user,
                    created_at__gte=cutoff,
                )
                .select_related('project')
                .only('project_id', 'project__topics')
            )

            dismissed_ids = set()
            topic_counts: dict[str, int] = {}

            for dismissal in dismissals:
                dismissed_ids.add(dismissal.project_id)
                # Count topics from dismissed projects
                for topic in dismissal.project.topics.all():
                    topic_counts[topic.name] = topic_counts.get(topic.name, 0) + 1

            # Only return topics with 3+ dismissals
            penalized_topics = {t: c for t, c in topic_counts.items() if c >= 3}

            return dismissed_ids, penalized_topics

        except Exception as e:
            logger.warning(f'Error getting dismissed data: {e}')
            return set(), {}

    def _score_candidates(
        self,
        user: 'User',
        candidates: list[dict],
        user_vector: list[float] | None = None,
    ) -> list[ScoredProject]:
        """
        Score all candidate projects using hybrid algorithm.

        Now honors user's PersonalizationSettings via SettingsAwareScorer.

        Args:
            user: User to score for
            candidates: List of candidate projects from Weaviate
            user_vector: Pre-computed user preference vector (avoids redundant computation)
        """
        from core.projects.models import ProjectLike
        from core.taxonomy.models import UserInteraction, UserTag
        from core.users.models import UserFollow

        # Get settings-aware scorer for this user
        scorer = SettingsAwareScorer(user)
        weights = scorer.get_adjusted_weights()

        # Get user's data for scoring
        user_tags = set(UserTag.objects.filter(user=user).values_list('name', flat=True))

        # Get IDs of users the current user follows (for follow boost)
        # Only fetch if social signals are enabled
        if scorer.should_use_social_signals():
            followed_user_ids = set(UserFollow.objects.filter(follower=user).values_list('following_id', flat=True))
        else:
            followed_user_ids = set()

        user_tool_tags = set(
            UserTag.objects.filter(user=user, taxonomy__taxonomy_type='tool').values_list('taxonomy__name', flat=True)
        )
        user_category_tags = set(
            UserTag.objects.filter(user=user, taxonomy__taxonomy_type='category').values_list(
                'taxonomy__name', flat=True
            )
        )

        # Get user's liked projects for behavioral scoring
        # Only fetch if learn_from_likes is enabled
        if scorer.should_penalize_likes():
            liked_project_ids = set(ProjectLike.objects.filter(user=user).values_list('project_id', flat=True))
        else:
            liked_project_ids = set()

        # Get viewed project IDs from interactions
        # Only fetch if learn_from_views is enabled
        if scorer.should_penalize_views():
            viewed_project_ids = set(
                UserInteraction.objects.filter(user=user, interaction_type='project_view').values_list(
                    'metadata__project_id', flat=True
                )
            )
        else:
            viewed_project_ids = set()

        # Get collaborative filtering data (what similar users liked)
        # Only compute if social signals are enabled
        if scorer.should_use_social_signals():
            # Pass user_vector to avoid redundant _get_user_vector call
            collaborative_scores = self._get_collaborative_scores(user, user_vector=user_vector)
        else:
            collaborative_scores = {}

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

        # Get time-spent topic boosts (topics user spent time on)
        time_spent_topic_boosts = self._get_time_spent_topic_boosts(user)

        # Get recent search queries for content matching
        search_queries = self._get_search_query_boosts(user)

        # Get clicked project IDs (high-intent signal)
        clicked_project_ids = self._get_click_boost_project_ids(user)

        # Get dismissed projects and penalized topics (negative feedback)
        dismissed_project_ids, penalized_topics = self._get_dismissed_data(user)

        # Calculate max values for normalization (treat None as 0)
        max_like_count = max((c.get('like_count') or 0 for c in candidates), default=1) or 1
        max_velocity = max((c.get('engagement_velocity') or 0 for c in candidates), default=1) or 1

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

                # Boost projects from followed users (significant boost)
                if owner_id in followed_user_ids:
                    behavioral_score += 0.4  # Strong boost for followed users' content

            # Boost projects with topics user spent time on
            for topic in topics:
                if topic in time_spent_topic_boosts:
                    behavioral_score += time_spent_topic_boosts[topic]

            # Boost projects matching recent searches
            title = (candidate.get('title') or '').lower()
            for query in search_queries:
                if query in title:
                    behavioral_score += 0.2  # Match in title
                    break
                for topic in topics:
                    if query in topic.lower():
                        behavioral_score += 0.1  # Match in topics
                        break

            # Boost projects user clicked in feeds (high-intent signal)
            if project_id in clicked_project_ids:
                behavioral_score += 0.2

            # Penalize dismissed projects (skip entirely for direct dismissals)
            if project_id in dismissed_project_ids:
                behavioral_score -= 1.0  # Full penalty - effectively filters out

            # Penalize projects in topics user has dismissed 3+ times
            for topic in topics:
                if topic in penalized_topics:
                    behavioral_score -= 0.3  # Moderate penalty per topic
                    break  # Only apply once

            behavioral_score = max(-1, min(1, behavioral_score))  # Clamp to [-1, 1]

            # 4. Collaborative score
            collaborative_score = collaborative_scores.get(project_id, 0.0)

            # 5. Popularity score
            like_count = candidate.get('like_count')
            velocity = candidate.get('engagement_velocity')

            if like_count is None:
                logger.warning(f'Missing like_count for project {project_id}, defaulting to 0')
                like_count = 0
            if velocity is None:
                logger.warning(f'Missing engagement_velocity for project {project_id}, defaulting to 0')
                velocity = 0

            popularity_score = (like_count / max_like_count) * 0.5 + (velocity / max_velocity) * 0.5

            # 6. Promotion score (quality signal from admin-promoted content)
            # This helps train the algorithm on what good content looks like
            promotion_score = candidate.get('promotion_score')
            if promotion_score is None:
                logger.warning(f'Missing promotion_score for project {project_id}, defaulting to 0.0')
                promotion_score = 0.0

            # 7. Skill level match score
            # Boost content that matches user's skill level from their profile
            content_difficulty = candidate.get('difficulty_taxonomy_name')
            skill_match_score = scorer.calculate_skill_match_score(content_difficulty)

            # Combine with settings-adjusted weights
            # Skill match is applied as a multiplier (0.8 to 1.2) to avoid overwhelming other signals
            skill_multiplier = 0.8 + (skill_match_score * 0.4)  # Range: 0.8 (mismatch) to 1.2 (perfect match)

            total_score = (
                (vector_score * weights['vector_similarity'])
                + (explicit_score * weights['explicit_preferences'])
                + (behavioral_score * weights['behavioral_signals'])
                + (collaborative_score * weights['collaborative'])
                + (popularity_score * weights['popularity'])
                + (promotion_score * weights['promotion'])
            ) * skill_multiplier

            scored_projects.append(
                ScoredProject(
                    project_id=project_id,
                    total_score=total_score,
                    vector_score=vector_score,
                    explicit_score=explicit_score,
                    behavioral_score=behavioral_score,
                    collaborative_score=collaborative_score,
                    popularity_score=popularity_score,
                    promotion_score=promotion_score,
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

    def _apply_filters(
        self,
        scored_projects: list[ScoredProject],
        tool_ids: list[int] | None,
        category_ids: list[int] | None,
        topic_names: list[str] | None,
    ) -> list[ScoredProject]:
        """
        Filter scored projects by tools, categories, and topics (OR logic).

        Projects must match ANY of the selected filters.
        """
        from core.projects.models import Project

        if not scored_projects:
            return scored_projects

        project_ids = [sp.project_id for sp in scored_projects]

        # Build query to get projects that match filters
        query = Project.objects.filter(id__in=project_ids)

        # Apply OR logic filters - projects matching ANY filter are included
        if tool_ids:
            query = query.filter(tools__id__in=tool_ids)
        if category_ids:
            query = query.filter(categories__id__in=category_ids)
        if topic_names:
            query = query.filter(topics__overlap=topic_names)

        matching_ids = set(query.distinct().values_list('id', flat=True))

        # Filter scored_projects to only those matching filters
        filtered = [sp for sp in scored_projects if sp.project_id in matching_ids]

        logger.debug(
            f'Applied filters: {len(scored_projects)} -> {len(filtered)} projects '
            f'(tools={tool_ids}, categories={category_ids}, topics={topic_names})'
        )

        return filtered

    def _get_popular_fallback(
        self,
        page: int,
        page_size: int,
        exclude_ids: list[int],
        tool_ids: list[int] | None = None,
        category_ids: list[int] | None = None,
        topic_names: list[str] | None = None,
    ) -> dict:
        """Fallback to popular projects when personalization fails."""
        from core.projects.models import Project

        # Note: Don't filter by is_published to include playground projects in explore
        # Sort by newest first to show fresh content
        projects = Project.objects.filter(is_private=False, is_archived=False).exclude(id__in=exclude_ids)

        # Apply filters if provided (OR logic)
        if tool_ids:
            projects = projects.filter(tools__id__in=tool_ids)
        if category_ids:
            projects = projects.filter(categories__id__in=category_ids)
        if topic_names:
            projects = projects.filter(topics__overlap=topic_names)

        projects = (
            projects.annotate(like_count=Count('likes'))
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
                'algorithm': 'popular_fallback',
                'filters_applied': {
                    'tool_ids': tool_ids,
                    'category_ids': category_ids,
                    'topic_names': topic_names,
                },
            },
        }
