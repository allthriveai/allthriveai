# Hyper-Personalized Explore Pages with Weaviate Integration

> **Status**: Planning Complete
> **Last Updated**: November 2025
> **Estimated Duration**: 18 days

## Executive Summary

Transform the explore pages (For You & Trending) into hyper-personalized feeds using Weaviate vector database. The system combines explicit preferences, behavioral signals, and collaborative filtering to deliver highly relevant content recommendations.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Weaviate Hosting | Self-hosted Docker | Free, integrates with existing docker-compose |
| Embedding Model | OpenAI text-embedding-3-small | Fast, cheap ($0.02/1M tokens), uses existing API key |
| Signal Weighting | Balanced hybrid | Equal weight to explicit, behavioral, and social signals |
| Trending Algorithm | Engagement velocity | Rate of likes/views acceleration over time |
| Cold Start | Onboarding quiz + popular | Short 3-5 question quiz, fall back to popular content |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
│  ExplorePage.tsx → OnboardingQuiz.tsx → ProjectsGrid.tsx        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  /projects/explore/ → PersonalizationEngine / TrendingEngine    │
│  /search/semantic/  → Weaviate hybrid search                    │
│  /onboarding/       → Quiz questions/responses                  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Weaviate     │ │   PostgreSQL    │ │     Redis       │
│  (Vectors +     │ │  (Source of     │ │   (Cache +      │
│   Embeddings)   │ │    Truth)       │ │    Sessions)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Phase 1: Weaviate Infrastructure (2 days)

### 1.1 Docker Setup

Add to `docker-compose.yml`:

```yaml
services:
  weaviate:
    image: semitechnologies/weaviate:1.23.0
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'text2vec-openai'
      ENABLE_MODULES: 'text2vec-openai'
      OPENAI_APIKEY: ${OPENAI_API_KEY}
      CLUSTER_HOSTNAME: 'node1'
    volumes:
      - weaviate_data:/var/lib/weaviate

volumes:
  weaviate_data:
```

### 1.2 Configuration

**File: `config/settings.py`**

```python
# Weaviate Configuration
WEAVIATE_URL = config('WEAVIATE_URL', default='http://weaviate:8080')
WEAVIATE_API_KEY = config('WEAVIATE_API_KEY', default='')
WEAVIATE_EMBEDDING_MODEL = config('WEAVIATE_EMBEDDING_MODEL', default='text-embedding-3-small')
WEAVIATE_BATCH_SIZE = config('WEAVIATE_BATCH_SIZE', default=100, cast=int)
```

### 1.3 Weaviate Schema

**New File: `services/weaviate/schema.py`**

```python
"""Weaviate collection schemas for personalization."""

PROJECT_SCHEMA = {
    "class": "Project",
    "description": "User-created projects with semantic embeddings",
    "vectorizer": "text2vec-openai",
    "moduleConfig": {
        "text2vec-openai": {
            "model": "text-embedding-3-small",
            "modelVersion": "3",
            "type": "text"
        }
    },
    "properties": [
        {"name": "project_id", "dataType": ["int"], "description": "Django Project ID"},
        {"name": "title", "dataType": ["text"], "description": "Project title"},
        {"name": "description", "dataType": ["text"], "description": "Project description"},
        {"name": "combined_text", "dataType": ["text"], "description": "Combined searchable text"},
        {"name": "tool_names", "dataType": ["text[]"], "description": "Associated tool names"},
        {"name": "category_names", "dataType": ["text[]"], "description": "Category names"},
        {"name": "topics", "dataType": ["text[]"], "description": "User-generated topics"},
        {"name": "username", "dataType": ["text"], "description": "Owner username"},
        {"name": "project_type", "dataType": ["text"], "description": "Type: github_repo, reddit_thread, etc."},
        {"name": "created_at", "dataType": ["date"], "description": "Creation timestamp"},
        {"name": "popularity_score", "dataType": ["number"], "description": "Calculated popularity"},
        {"name": "engagement_velocity", "dataType": ["number"], "description": "Recent engagement rate"},
    ]
}

USER_PROFILE_SCHEMA = {
    "class": "UserProfile",
    "description": "User preference profiles for collaborative filtering",
    "vectorizer": "text2vec-openai",
    "properties": [
        {"name": "user_id", "dataType": ["int"], "description": "Django User ID"},
        {"name": "preference_text", "dataType": ["text"], "description": "Combined preferences for embedding"},
        {"name": "tool_interests", "dataType": ["text[]"], "description": "Interested tools with weights"},
        {"name": "category_interests", "dataType": ["text[]"], "description": "Category preferences"},
        {"name": "activity_summary", "dataType": ["text"], "description": "Behavioral summary text"},
        {"name": "tier", "dataType": ["text"], "description": "User tier"},
        {"name": "total_points", "dataType": ["int"], "description": "Gamification points"},
    ]
}

TOOL_SCHEMA = {
    "class": "Tool",
    "description": "AI tools and technologies",
    "vectorizer": "text2vec-openai",
    "properties": [
        {"name": "tool_id", "dataType": ["int"], "description": "Django Tool ID"},
        {"name": "name", "dataType": ["text"], "description": "Tool name"},
        {"name": "description", "dataType": ["text"], "description": "Tool description"},
        {"name": "tagline", "dataType": ["text"], "description": "Tool tagline"},
        {"name": "category", "dataType": ["text"], "description": "Tool category"},
        {"name": "tags", "dataType": ["text[]"], "description": "Tool tags"},
        {"name": "use_cases", "dataType": ["text"], "description": "Combined use cases text"},
    ]
}
```

### 1.4 Weaviate Client

**New File: `services/weaviate/client.py`**

```python
"""Weaviate client wrapper with connection management and fallbacks."""

import logging
import weaviate
from django.conf import settings
from functools import lru_cache
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class WeaviateClient:
    """Wrapper for Weaviate operations with automatic fallback."""

    _instance: Optional['WeaviateClient'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize Weaviate connection."""
        try:
            self.client = weaviate.Client(
                url=settings.WEAVIATE_URL,
                auth_client_secret=weaviate.AuthApiKey(api_key=settings.WEAVIATE_API_KEY)
                if settings.WEAVIATE_API_KEY else None,
                additional_headers={
                    "X-OpenAI-Api-Key": settings.OPENAI_API_KEY,
                }
            )
            self.is_available = self.client.is_ready()
            logger.info(f"Weaviate connection: {'ready' if self.is_available else 'not ready'}")
        except Exception as e:
            logger.error(f"Failed to connect to Weaviate: {e}")
            self.client = None
            self.is_available = False

    def hybrid_search(
        self,
        collection: str,
        query: str,
        alpha: float = 0.7,
        limit: int = 50,
        filters: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search (vector + keyword).

        Args:
            collection: Weaviate class name
            query: Search query text
            alpha: Vector vs keyword weight (1.0 = pure vector)
            limit: Max results
            filters: Optional Weaviate filters

        Returns:
            List of results with properties and scores
        """
        if not self.is_available:
            logger.warning("Weaviate unavailable, falling back to empty results")
            return []

        try:
            query_builder = (
                self.client.query
                .get(collection, list(self._get_properties(collection)))
                .with_hybrid(query=query, alpha=alpha)
                .with_limit(limit)
                .with_additional(["score", "explainScore"])
            )

            if filters:
                query_builder = query_builder.with_where(filters)

            result = query_builder.do()
            return result.get("data", {}).get("Get", {}).get(collection, [])

        except Exception as e:
            logger.error(f"Weaviate hybrid search failed: {e}")
            return []

    def near_vector_search(
        self,
        collection: str,
        vector: List[float],
        limit: int = 100,
        filters: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """Search by vector similarity."""
        if not self.is_available:
            return []

        try:
            query_builder = (
                self.client.query
                .get(collection, list(self._get_properties(collection)))
                .with_near_vector({"vector": vector})
                .with_limit(limit)
                .with_additional(["distance"])
            )

            if filters:
                query_builder = query_builder.with_where(filters)

            result = query_builder.do()
            return result.get("data", {}).get("Get", {}).get(collection, [])

        except Exception as e:
            logger.error(f"Weaviate nearVector search failed: {e}")
            return []

    def get_user_vector(self, user_id: int) -> Optional[List[float]]:
        """Retrieve user's preference vector."""
        if not self.is_available:
            return None

        try:
            result = (
                self.client.query
                .get("UserProfile", ["user_id"])
                .with_where({
                    "path": ["user_id"],
                    "operator": "Equal",
                    "valueInt": user_id
                })
                .with_additional(["vector"])
                .do()
            )

            profiles = result.get("data", {}).get("Get", {}).get("UserProfile", [])
            if profiles:
                return profiles[0].get("_additional", {}).get("vector")
            return None

        except Exception as e:
            logger.error(f"Failed to get user vector: {e}")
            return None

    def batch_import(self, collection: str, objects: List[Dict[str, Any]]) -> int:
        """Batch import objects to Weaviate."""
        if not self.is_available:
            return 0

        try:
            with self.client.batch as batch:
                batch.batch_size = settings.WEAVIATE_BATCH_SIZE
                for obj in objects:
                    batch.add_data_object(
                        data_object=obj,
                        class_name=collection
                    )
            return len(objects)

        except Exception as e:
            logger.error(f"Batch import failed: {e}")
            return 0

    def update_object(self, collection: str, uuid: str, properties: Dict[str, Any]):
        """Update object properties."""
        if not self.is_available:
            return

        try:
            self.client.data_object.update(
                data_object=properties,
                class_name=collection,
                uuid=uuid
            )
        except Exception as e:
            logger.error(f"Update object failed: {e}")

    def _get_properties(self, collection: str) -> set:
        """Get property names for a collection."""
        from .schema import PROJECT_SCHEMA, USER_PROFILE_SCHEMA, TOOL_SCHEMA

        schemas = {
            "Project": PROJECT_SCHEMA,
            "UserProfile": USER_PROFILE_SCHEMA,
            "Tool": TOOL_SCHEMA,
        }

        schema = schemas.get(collection, {})
        return {p["name"] for p in schema.get("properties", [])}


# Convenience function
def get_weaviate_client() -> WeaviateClient:
    """Get singleton Weaviate client instance."""
    return WeaviateClient()
```

---

## Phase 2: Embedding Pipeline (3 days)

### 2.1 Embedding Service

**New File: `services/weaviate/embeddings.py`**

```python
"""Generate embeddings for projects, users, and tools."""

import logging
from datetime import timedelta
from django.utils import timezone
from core.projects.models import Project
from core.users.models import User
from core.taxonomy.models import UserTag, UserInteraction

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generate text for embedding from Django models."""

    def generate_project_embedding_text(self, project: Project) -> str:
        """Combine project fields for semantic embedding.

        Includes: title, description, topics, tools, categories, reddit content
        """
        parts = [
            project.title,
            project.description or "",
        ]

        # Add topics
        if project.topics:
            parts.append(" ".join(project.topics))

        # Add tool names
        tool_names = list(project.tools.values_list('name', flat=True))
        if tool_names:
            parts.append(f"Tools: {', '.join(tool_names)}")

        # Add category names
        category_names = list(project.categories.values_list('name', flat=True))
        if category_names:
            parts.append(f"Categories: {', '.join(category_names)}")

        # Add Reddit-specific content if applicable
        if hasattr(project, 'reddit_thread') and project.reddit_thread:
            rt = project.reddit_thread
            parts.append(f"Subreddit: r/{rt.subreddit}")
            if rt.reddit_metadata and rt.reddit_metadata.get('selftext'):
                parts.append(rt.reddit_metadata['selftext'][:500])

        return " ".join(filter(None, parts))

    def generate_user_profile_embedding_text(self, user: User) -> str:
        """Build user preference profile for embedding.

        Combines: explicit tags, bio, behavioral summary
        """
        parts = []

        # Explicit preferences (UserTags)
        tags = UserTag.objects.filter(user=user).select_related('taxonomy')

        tool_prefs = []
        category_prefs = []

        for tag in tags:
            weighted_name = f"{tag.name} ({tag.confidence_score:.1f})"
            if tag.taxonomy and tag.taxonomy.taxonomy_type == 'tool':
                tool_prefs.append(weighted_name)
            else:
                category_prefs.append(weighted_name)

        if tool_prefs:
            parts.append(f"Preferred tools: {', '.join(tool_prefs)}")
        if category_prefs:
            parts.append(f"Interests: {', '.join(category_prefs)}")

        # Bio
        if user.bio:
            parts.append(f"Bio: {user.bio}")

        # Behavioral summary
        recent_interactions = UserInteraction.objects.filter(
            user=user,
            created_at__gte=timezone.now() - timedelta(days=30)
        ).values_list('interaction_type', flat=True)

        if recent_interactions:
            interaction_summary = ", ".join(set(recent_interactions))
            parts.append(f"Recent activity: {interaction_summary}")

        # Tier indicates engagement level
        parts.append(f"Engagement tier: {user.tier}")

        return " ".join(parts)

    def generate_tool_embedding_text(self, tool) -> str:
        """Build tool embedding text."""
        parts = [
            tool.name,
            tool.description or "",
            tool.tagline or "",
        ]

        if tool.category:
            parts.append(f"Category: {tool.category}")

        # Add tags
        if hasattr(tool, 'tags') and tool.tags:
            parts.append(f"Tags: {', '.join(tool.tags)}")

        return " ".join(filter(None, parts))

    def prepare_project_for_weaviate(self, project: Project) -> dict:
        """Prepare project data for Weaviate import."""
        return {
            "project_id": project.id,
            "title": project.title,
            "description": project.description or "",
            "combined_text": self.generate_project_embedding_text(project),
            "tool_names": list(project.tools.values_list('name', flat=True)),
            "category_names": list(project.categories.values_list('name', flat=True)),
            "topics": project.topics or [],
            "username": project.user.username,
            "project_type": project.type,
            "created_at": project.created_at.isoformat(),
            "popularity_score": project.likes.count(),
            "engagement_velocity": getattr(project, 'engagement_velocity', 0.0),
        }

    def prepare_user_profile_for_weaviate(self, user: User) -> dict:
        """Prepare user profile for Weaviate import."""
        tags = UserTag.objects.filter(user=user)

        return {
            "user_id": user.id,
            "preference_text": self.generate_user_profile_embedding_text(user),
            "tool_interests": [
                t.name for t in tags
                if t.taxonomy and t.taxonomy.taxonomy_type == 'tool'
            ],
            "category_interests": [
                t.name for t in tags
                if t.taxonomy and t.taxonomy.taxonomy_type != 'tool'
            ],
            "activity_summary": f"Tier: {user.tier}, Points: {user.total_points}",
            "tier": user.tier,
            "total_points": user.total_points,
        }
```

### 2.2 Sync Tasks

**New File: `services/weaviate/tasks.py`**

```python
"""Celery tasks for Weaviate synchronization."""

import logging
from celery import shared_task
from datetime import timedelta
from django.utils import timezone

from core.projects.models import Project
from core.users.models import User
from .client import get_weaviate_client
from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def sync_project_to_weaviate(self, project_id: int):
    """Sync a single project to Weaviate.

    Triggered on: Project create/update signal
    """
    try:
        project = Project.objects.select_related('user').prefetch_related(
            'tools', 'categories'
        ).get(id=project_id)

        if project.is_private or project.is_archived:
            # Remove from Weaviate if private/archived
            client = get_weaviate_client()
            # Delete by project_id filter
            return

        embedding_service = EmbeddingService()
        data = embedding_service.prepare_project_for_weaviate(project)

        client = get_weaviate_client()
        client.batch_import("Project", [data])

        logger.info(f"Synced project {project_id} to Weaviate")

    except Project.DoesNotExist:
        logger.warning(f"Project {project_id} not found for Weaviate sync")
    except Exception as e:
        logger.error(f"Failed to sync project {project_id}: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3)
def sync_user_profile_to_weaviate(self, user_id: int):
    """Sync user preference profile to Weaviate.

    Triggered on: UserTag change
    """
    try:
        user = User.objects.get(id=user_id)

        embedding_service = EmbeddingService()
        data = embedding_service.prepare_user_profile_for_weaviate(user)

        client = get_weaviate_client()
        client.batch_import("UserProfile", [data])

        logger.info(f"Synced user profile {user_id} to Weaviate")

    except User.DoesNotExist:
        logger.warning(f"User {user_id} not found for Weaviate sync")
    except Exception as e:
        logger.error(f"Failed to sync user {user_id}: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task
def update_engagement_metrics():
    """Update engagement velocity for all recent projects.

    Scheduled: Every hour via Celery beat
    """
    from services.personalization.trending import TrendingEngine

    engine = TrendingEngine()
    client = get_weaviate_client()

    # Get projects with recent activity
    recent_cutoff = timezone.now() - timedelta(days=30)
    projects = Project.objects.filter(
        is_private=False,
        is_archived=False,
        created_at__gte=recent_cutoff
    ).only('id')

    updated = 0
    for project in projects:
        velocity = engine.calculate_engagement_velocity(project.id)

        # Update in Django
        Project.objects.filter(id=project.id).update(
            engagement_velocity=velocity,
            last_velocity_update=timezone.now()
        )

        # Update in Weaviate
        # (Would need UUID lookup - simplified here)
        updated += 1

    logger.info(f"Updated engagement metrics for {updated} projects")


@shared_task
def full_reindex_projects():
    """Full reindex of all public projects.

    Scheduled: Daily at 3 AM via Celery beat
    """
    client = get_weaviate_client()
    embedding_service = EmbeddingService()

    projects = Project.objects.filter(
        is_private=False,
        is_archived=False
    ).select_related('user').prefetch_related('tools', 'categories')

    batch = []
    for project in projects.iterator(chunk_size=100):
        data = embedding_service.prepare_project_for_weaviate(project)
        batch.append(data)

        if len(batch) >= 100:
            client.batch_import("Project", batch)
            batch = []

    # Import remaining
    if batch:
        client.batch_import("Project", batch)

    logger.info(f"Full reindex complete: {projects.count()} projects")
```

---

## Phase 3: Hybrid Scoring Algorithm (4 days)

### 3.1 Personalization Engine

**New File: `services/personalization/engine.py`**

```python
"""Hybrid recommendation engine for personalized feeds."""

import logging
from collections import Counter
from datetime import timedelta
from typing import List, Dict, Optional

from django.db.models import Count, Q
from django.utils import timezone

from core.projects.models import Project, ProjectLike
from core.users.models import User
from core.taxonomy.models import UserTag, UserInteraction
from services.weaviate.client import get_weaviate_client

logger = logging.getLogger(__name__)


class PersonalizationEngine:
    """Hybrid recommendation combining multiple signals."""

    # Weight configuration (totals to 1.0)
    WEIGHTS = {
        'vector_similarity': 0.30,      # Content-based (Weaviate)
        'explicit_preferences': 0.25,    # UserTag matches
        'behavioral_signals': 0.25,      # Interaction history
        'collaborative': 0.15,           # Similar users
        'popularity': 0.05,              # Baseline popularity
    }

    def __init__(self):
        self.weaviate = get_weaviate_client()

    def get_for_you_feed(
        self,
        user: User,
        page: int = 1,
        page_size: int = 30
    ) -> List[Project]:
        """Generate personalized 'For You' feed.

        Algorithm:
        1. Get user's preference vector from Weaviate
        2. nearVector search for candidate projects
        3. Score with explicit preferences, behavioral, collaborative
        4. Apply diversity boost
        5. Return paginated results
        """
        # Get user's preference vector
        user_vector = self.weaviate.get_user_vector(user.id)

        if not user_vector:
            logger.info(f"No vector for user {user.id}, falling back to popular")
            return self._get_popular_fallback(page, page_size)

        # Get candidate projects via vector similarity
        user_project_ids = list(
            Project.objects.filter(user=user).values_list('id', flat=True)
        )

        candidates = self.weaviate.near_vector_search(
            collection="Project",
            vector=user_vector,
            limit=200,
            filters={
                "operator": "And",
                "operands": [
                    {"path": ["project_id"], "operator": "NotEqual", "valueInt": pid}
                    for pid in user_project_ids[:10]  # Limit filter size
                ]
            } if user_project_ids else None
        )

        if not candidates:
            return self._get_popular_fallback(page, page_size)

        # Get project IDs and fetch Django objects
        project_ids = [c.get('project_id') for c in candidates if c.get('project_id')]
        projects = Project.objects.filter(
            id__in=project_ids,
            is_private=False,
            is_archived=False
        ).select_related('user').prefetch_related('tools', 'categories', 'likes')

        project_map = {p.id: p for p in projects}

        # Score each candidate
        scored_projects = []
        for candidate in candidates:
            project_id = candidate.get('project_id')
            project = project_map.get(project_id)

            if not project:
                continue

            # Vector similarity score (from Weaviate distance)
            distance = candidate.get('_additional', {}).get('distance', 1.0)
            vector_score = 1.0 - min(distance, 1.0)

            # Explicit preference score
            explicit_score = self._score_explicit_preferences(user, project)

            # Behavioral score
            behavioral_score = self._score_behavioral_signals(user, project)

            # Collaborative score
            collaborative_score = self._score_collaborative(user, project)

            # Popularity score (normalized)
            popularity_score = min(project.likes.count() / 100, 1.0)

            # Combined weighted score
            final_score = (
                self.WEIGHTS['vector_similarity'] * vector_score +
                self.WEIGHTS['explicit_preferences'] * explicit_score +
                self.WEIGHTS['behavioral_signals'] * behavioral_score +
                self.WEIGHTS['collaborative'] * collaborative_score +
                self.WEIGHTS['popularity'] * popularity_score
            )

            scored_projects.append((project, final_score))

        # Sort by score
        scored_projects.sort(key=lambda x: x[1], reverse=True)

        # Apply diversity (avoid category homogeneity)
        diversified = self._apply_diversity([p for p, s in scored_projects])

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size

        return diversified[start:end]

    def _score_explicit_preferences(self, user: User, project: Project) -> float:
        """Score based on UserTag matches."""
        user_tags = UserTag.objects.filter(user=user).select_related('taxonomy')

        score = 0.0
        project_tool_ids = set(project.tools.values_list('id', flat=True))
        project_category_ids = set(project.categories.values_list('id', flat=True))

        for tag in user_tags:
            if not tag.taxonomy:
                continue

            # Tool match
            if hasattr(tag.taxonomy, 'tool_entity') and tag.taxonomy.tool_entity:
                if tag.taxonomy.tool_entity.id in project_tool_ids:
                    score += tag.confidence_score * 0.3

            # Category match
            if tag.taxonomy_id in project_category_ids:
                score += tag.confidence_score * 0.15

        return min(score, 1.0)

    def _score_behavioral_signals(self, user: User, project: Project) -> float:
        """Score based on user's past interactions."""
        score = 0.0

        # Penalize already-seen projects
        recent_views = UserInteraction.objects.filter(
            user=user,
            interaction_type='project_view',
            created_at__gte=timezone.now() - timedelta(days=7)
        ).values_list('metadata__project_id', flat=True)

        if project.id in list(recent_views):
            score -= 0.3

        # Already liked = lower priority (already engaged)
        if ProjectLike.objects.filter(user=user, project=project).exists():
            score -= 0.2

        # Tool affinity from interaction history
        viewed_projects = Project.objects.filter(
            id__in=recent_views
        ).prefetch_related('tools')

        tool_affinity = Counter()
        for viewed in viewed_projects:
            for tool in viewed.tools.all():
                tool_affinity[tool.id] += 1

        for tool_id in project.tools.values_list('id', flat=True):
            if tool_id in tool_affinity:
                score += min(tool_affinity[tool_id] * 0.05, 0.15)

        return max(min(score, 1.0), -0.5)

    def _score_collaborative(self, user: User, project: Project) -> float:
        """Score based on similar users' preferences."""
        # Find users with similar tags
        user_tag_names = set(
            UserTag.objects.filter(user=user).values_list('name', flat=True)
        )

        if not user_tag_names:
            return 0.0

        # Find similar users
        similar_users = User.objects.filter(
            tags__name__in=user_tag_names
        ).exclude(id=user.id).annotate(
            overlap=Count('tags', filter=Q(tags__name__in=user_tag_names))
        ).filter(overlap__gte=2).order_by('-overlap')[:30]

        if not similar_users:
            return 0.0

        # Check if similar users liked this project
        similar_likes = ProjectLike.objects.filter(
            user__in=similar_users,
            project=project
        ).count()

        return min(similar_likes / 10, 1.0)

    def _apply_diversity(self, projects: List[Project], max_per_category: int = 3) -> List[Project]:
        """Ensure diversity in categories."""
        result = []
        category_counts = Counter()

        for project in projects:
            project_categories = set(project.categories.values_list('id', flat=True))

            # Check if any category is over-represented
            can_add = True
            for cat_id in project_categories:
                if category_counts[cat_id] >= max_per_category:
                    can_add = False
                    break

            if can_add:
                result.append(project)
                for cat_id in project_categories:
                    category_counts[cat_id] += 1

        return result

    def _get_popular_fallback(self, page: int, page_size: int) -> List[Project]:
        """Fallback to popular projects."""
        return list(
            Project.objects.filter(
                is_private=False,
                is_archived=False
            ).annotate(
                like_count=Count('likes')
            ).order_by('-like_count', '-created_at')[(page-1)*page_size : page*page_size]
        )
```

### 3.2 Trending Engine

**New File: `services/personalization/trending.py`**

```python
"""Trending algorithm based on engagement velocity."""

import logging
from datetime import timedelta
from typing import List, Optional

from django.db.models import Count
from django.utils import timezone

from core.projects.models import Project, ProjectLike
from core.users.models import User
from core.taxonomy.models import UserInteraction
from services.weaviate.client import get_weaviate_client

logger = logging.getLogger(__name__)


class TrendingEngine:
    """Calculate trending projects based on engagement velocity."""

    def calculate_engagement_velocity(self, project_id: int, hours: int = 24) -> float:
        """Calculate rate of engagement acceleration.

        Formula:
        velocity = (recent_engagement - prev_engagement) / prev_engagement
        final = velocity * recency_factor
        """
        now = timezone.now()

        # Recent period (last N hours)
        recent_start = now - timedelta(hours=hours)

        # Previous period (for comparison)
        prev_start = recent_start - timedelta(hours=hours)
        prev_end = recent_start

        # Count likes in each period
        recent_likes = ProjectLike.objects.filter(
            project_id=project_id,
            created_at__gte=recent_start
        ).count()

        prev_likes = ProjectLike.objects.filter(
            project_id=project_id,
            created_at__gte=prev_start,
            created_at__lt=prev_end
        ).count()

        # Count views (from UserInteraction)
        recent_views = UserInteraction.objects.filter(
            interaction_type='project_view',
            metadata__project_id=project_id,
            created_at__gte=recent_start
        ).count()

        prev_views = UserInteraction.objects.filter(
            interaction_type='project_view',
            metadata__project_id=project_id,
            created_at__gte=prev_start,
            created_at__lt=prev_end
        ).count()

        # Calculate velocity (rate of change)
        like_velocity = (recent_likes - prev_likes) / max(prev_likes, 1)
        view_velocity = (recent_views - prev_views) / max(prev_views, 1)

        # Weighted combination (likes matter more)
        velocity = (like_velocity * 0.7) + (view_velocity * 0.3)

        # Apply recency decay
        try:
            project = Project.objects.only('created_at').get(id=project_id)
            days_old = (now - project.created_at).days
            recency_factor = 1.0 / (1 + days_old * 0.1)
        except Project.DoesNotExist:
            recency_factor = 0.5

        return max(velocity * recency_factor, 0)

    def get_trending_feed(
        self,
        user: Optional[User] = None,
        page: int = 1,
        page_size: int = 30
    ) -> List[Project]:
        """Get trending projects with optional light personalization."""
        # Query projects ordered by engagement_velocity
        projects = Project.objects.filter(
            is_private=False,
            is_archived=False
        ).exclude(
            engagement_velocity__isnull=True
        ).order_by('-engagement_velocity', '-created_at')

        # Get extra for filtering
        candidates = list(projects[:page_size * 3])

        # If user is authenticated, apply light personalization boost
        if user and user.is_authenticated:
            candidates = self._apply_preference_boost(user, candidates)

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size

        return candidates[start:end]

    def _apply_preference_boost(
        self,
        user: User,
        projects: List[Project]
    ) -> List[Project]:
        """Lightly boost projects matching user preferences."""
        user_tool_ids = set(
            user.tags.filter(
                taxonomy__taxonomy_type='tool'
            ).values_list('taxonomy__tool_entity__id', flat=True)
        )

        if not user_tool_ids:
            return projects

        def score_project(project):
            base_score = getattr(project, 'engagement_velocity', 0)
            tool_match = len(
                set(project.tools.values_list('id', flat=True)) & user_tool_ids
            )
            boost = tool_match * 0.1
            return base_score + boost

        return sorted(projects, key=score_project, reverse=True)
```

---

## Phase 4: Cold Start Strategy (2 days)

### 4.1 Onboarding Models

**New File: `core/onboarding/models.py`**

```python
"""Models for user onboarding quiz."""

from django.db import models
from core.users.models import User


class OnboardingQuestion(models.Model):
    """Quick preference questions for new users."""

    class QuestionType(models.TextChoices):
        TOOL_SELECT = 'tool_select', 'Select Tools'
        CATEGORY_SELECT = 'category_select', 'Select Categories'
        USE_CASE = 'use_case', 'What do you want to build?'
        EXPERIENCE = 'experience', 'Experience Level'

    question_type = models.CharField(max_length=20, choices=QuestionType.choices)
    question_text = models.TextField()
    options = models.JSONField(
        help_text='List of {id, label, icon, description} options'
    )
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.question_type}: {self.question_text[:50]}"


class OnboardingResponse(models.Model):
    """User's answers to onboarding questions."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='onboarding_responses')
    question = models.ForeignKey(OnboardingQuestion, on_delete=models.CASCADE)
    selected_options = models.JSONField()  # List of selected option IDs
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'question']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.question.question_type}"
```

### 4.2 Cold Start Service

**New File: `services/personalization/cold_start.py`**

```python
"""Handle new users with no interaction history."""

import logging
from typing import List, Optional

from django.db.models import Count, Q

from core.projects.models import Project, ProjectLike
from core.users.models import User
from core.taxonomy.models import UserTag, UserInteraction
from core.onboarding.models import OnboardingResponse

logger = logging.getLogger(__name__)


class ColdStartService:
    """Handle recommendations for users with insufficient data."""

    MINIMUM_TAGS = 3
    MINIMUM_INTERACTIONS = 10
    MINIMUM_LIKES = 5

    def has_sufficient_data(self, user: User) -> bool:
        """Check if user has enough signals for personalization."""
        tag_count = UserTag.objects.filter(user=user).count()
        if tag_count >= self.MINIMUM_TAGS:
            return True

        interaction_count = UserInteraction.objects.filter(user=user).count()
        if interaction_count >= self.MINIMUM_INTERACTIONS:
            return True

        like_count = ProjectLike.objects.filter(user=user).count()
        if like_count >= self.MINIMUM_LIKES:
            return True

        return False

    def has_completed_onboarding(self, user: User) -> bool:
        """Check if user has completed onboarding quiz."""
        return OnboardingResponse.objects.filter(user=user).exists()

    def get_cold_start_feed(
        self,
        user: Optional[User],
        page: int = 1,
        page_size: int = 30
    ) -> List[Project]:
        """Get feed for new/anonymous users.

        Strategy:
        1. If user completed onboarding → use those preferences
        2. Otherwise → show popular content
        """
        if user and self.has_completed_onboarding(user):
            return self._get_onboarding_based_feed(user, page, page_size)

        return self._get_popular_feed(page, page_size)

    def _get_onboarding_based_feed(
        self,
        user: User,
        page: int,
        page_size: int
    ) -> List[Project]:
        """Generate feed from onboarding responses."""
        responses = OnboardingResponse.objects.filter(user=user).select_related('question')

        tool_ids = []
        category_ids = []

        for response in responses:
            if response.question.question_type == 'tool_select':
                tool_ids.extend(response.selected_options)
            elif response.question.question_type == 'category_select':
                category_ids.extend(response.selected_options)

        # Query projects matching these preferences
        queryset = Project.objects.filter(
            is_private=False,
            is_archived=False
        )

        if tool_ids or category_ids:
            queryset = queryset.filter(
                Q(tools__id__in=tool_ids) | Q(categories__id__in=category_ids)
            ).annotate(
                match_score=Count('tools', filter=Q(tools__id__in=tool_ids)) +
                           Count('categories', filter=Q(categories__id__in=category_ids))
            ).order_by('-match_score', '-created_at').distinct()
        else:
            queryset = queryset.order_by('-created_at')

        start = (page - 1) * page_size
        end = start + page_size

        return list(queryset[start:end])

    def _get_popular_feed(self, page: int, page_size: int) -> List[Project]:
        """Fallback to popular/featured content."""
        start = (page - 1) * page_size
        end = start + page_size

        return list(
            Project.objects.filter(
                is_private=False,
                is_archived=False
            ).annotate(
                like_count=Count('likes')
            ).order_by('-like_count', '-created_at')[start:end]
        )

    def get_personalization_status(self, user: User) -> dict:
        """Get user's personalization readiness status."""
        tag_count = UserTag.objects.filter(user=user).count()
        interaction_count = UserInteraction.objects.filter(user=user).count()
        like_count = ProjectLike.objects.filter(user=user).count()

        return {
            'has_sufficient_data': self.has_sufficient_data(user),
            'has_completed_onboarding': self.has_completed_onboarding(user),
            'signal_summary': {
                'tags': tag_count,
                'interactions': interaction_count,
                'likes': like_count,
            },
            'needs_onboarding': not self.has_sufficient_data(user) and not self.has_completed_onboarding(user),
        }
```

---

## Phase 5: API Updates (2 days)

### 5.1 Enhanced Explore Endpoint

**Modify: `core/projects/views.py`**

Replace the existing `explore_projects` function with the enhanced version that uses the new personalization engines.

### 5.2 Onboarding API

**New File: `core/onboarding/views.py`**

```python
"""API views for onboarding quiz."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import OnboardingQuestion, OnboardingResponse
from core.taxonomy.models import UserTag
from core.tools.models import Tool
from services.weaviate.tasks import sync_user_profile_to_weaviate


@api_view(['GET'])
@permission_classes([AllowAny])
def get_onboarding_questions(request):
    """Get onboarding questions for new users."""
    questions = OnboardingQuestion.objects.filter(is_active=True).order_by('order')

    return Response([{
        'id': q.id,
        'type': q.question_type,
        'text': q.question_text,
        'options': q.options,
    } for q in questions])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_onboarding_responses(request):
    """Save user's onboarding responses and create UserTags."""
    responses = request.data.get('responses', [])

    if not responses:
        return Response(
            {'error': 'No responses provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    created_tags = []

    for resp in responses:
        question_id = resp.get('question_id')
        selected_options = resp.get('selected_options', [])

        if not question_id or not selected_options:
            continue

        try:
            question = OnboardingQuestion.objects.get(id=question_id)
        except OnboardingQuestion.DoesNotExist:
            continue

        # Save response
        OnboardingResponse.objects.update_or_create(
            user=request.user,
            question=question,
            defaults={'selected_options': selected_options}
        )

        # Convert to UserTags for immediate personalization
        if question.question_type == 'tool_select':
            for tool_id in selected_options:
                try:
                    tool = Tool.objects.get(id=tool_id)
                    tag, created = UserTag.objects.get_or_create(
                        user=request.user,
                        name=tool.name,
                        defaults={
                            'source': UserTag.TagSource.MANUAL,
                            'confidence_score': 1.0,
                        }
                    )
                    if created:
                        created_tags.append(tag.name)
                except Tool.DoesNotExist:
                    continue

    # Trigger Weaviate profile sync
    sync_user_profile_to_weaviate.delay(request.user.id)

    return Response({
        'status': 'success',
        'tags_created': created_tags,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_personalization_status(request):
    """Get user's personalization readiness."""
    from services.personalization.cold_start import ColdStartService

    service = ColdStartService()
    return Response(service.get_personalization_status(request.user))
```

### 5.3 URL Configuration

**Modify: `core/urls.py`**

Add onboarding URLs:
```python
path('onboarding/questions/', onboarding_views.get_onboarding_questions),
path('onboarding/responses/', onboarding_views.submit_onboarding_responses),
path('personalization/status/', onboarding_views.get_personalization_status),
```

---

## Phase 6: Frontend Updates (3 days)

### 6.1 Onboarding Quiz Component

**New File: `frontend/src/components/onboarding/OnboardingQuiz.tsx`**

Swipeable card-based quiz with:
- 3-5 quick questions
- Multi-select for tools/categories
- Progress indicator
- Smooth transition to personalized feed

### 6.2 ExplorePage Enhancements

**Modify: `frontend/src/pages/ExplorePage.tsx`**

- Check personalization status on mount
- Show onboarding modal for cold-start users
- Add personalization quality indicator badge
- Optional "Why am I seeing this?" tooltip

### 6.3 Service Updates

**Modify: `frontend/src/services/explore.ts`**

Add new API methods for onboarding and personalization status.

---

## Phase 7: Caching & Performance (1 day)

### Redis Cache Keys

```python
CACHE_KEYS = {
    # User-specific (short TTL)
    'for_you_feed:{user_id}:{page}': 60,        # 1 minute
    'user_profile_vector:{user_id}': 300,        # 5 minutes
    'personalization_status:{user_id}': 300,     # 5 minutes

    # Global (longer TTL)
    'trending_feed:{page}': 120,                 # 2 minutes
    'popular_feed:{page}': 300,                  # 5 minutes
    'engagement_velocities': 3600,               # 1 hour

    # Weaviate results
    'semantic_search:{query_hash}': 180,         # 3 minutes
}
```

---

## Phase 8: Database Migrations (1 day)

### New Fields

```python
# Project model
engagement_velocity = FloatField(default=0.0, db_index=True)
last_velocity_update = DateTimeField(null=True)
```

### New Indexes

```python
# UserInteraction
Index(fields=['user', 'interaction_type', '-created_at'])

# ProjectLike
Index(fields=['project', '-created_at'])

# UserTag
Index(fields=['user', 'taxonomy_id', '-confidence_score'])
```

---

## Testing Checklist

- [ ] Weaviate container starts and schema creates successfully
- [ ] Project embedding generation works
- [ ] User profile embedding generation works
- [ ] Hybrid search returns relevant results
- [ ] For You feed personalization varies by user
- [ ] Trending feed reflects recent engagement
- [ ] Cold start serves appropriate content
- [ ] Onboarding quiz creates UserTags
- [ ] Cache invalidation works correctly
- [ ] Fallback to Django ORM works when Weaviate unavailable

---

## Success Metrics

| Metric | Target |
|--------|--------|
| For You CTR | +30% vs current |
| Session duration on Explore | +20% |
| Onboarding completion rate | >70% |
| Cold start → engaged user conversion | >40% |
| Trending engagement rate | +25% |
