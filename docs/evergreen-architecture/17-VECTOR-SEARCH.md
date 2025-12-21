# Vector Search Architecture

**Source of Truth** | **Last Updated**: 2025-12-20

This document describes AllThrive's vector search infrastructure powered by Weaviate, enabling semantic search, recommendations, and personalization across all content types.

---

## 1. Overview

The vector search system provides:
- **Semantic search** across projects, quizzes, tools, lessons, and games
- **Personalization** via user preference embeddings
- **Recommendations** using vector similarity
- **Hybrid search** combining semantic + keyword matching

**Tech Stack:**
- **Vector DB**: Weaviate (self-hosted)
- **Embeddings**: OpenAI `text-embedding-3-small` (1,536 dimensions)
- **Client**: Python SDK with connection pooling
- **Sync**: Django signals + Celery tasks

---

## 2. Architecture

```
User Query
    ↓
[EmbeddingService] → Generate query vector (OpenAI)
    ↓
[WeaviateClient] → Hybrid search (vector + keyword)
    ↓
[Results] → Ranked by combined score
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `WeaviateClient` | `services/weaviate/client.py` | Connection management, search operations |
| `WeaviateConnectionPool` | `services/weaviate/client.py` | Thread-safe connection pooling |
| `EmbeddingService` | `services/weaviate/embeddings.py` | OpenAI embedding generation |
| `WeaviateSchema` | `services/weaviate/schema.py` | Collection definitions |
| Signal handlers | `services/weaviate/signals.py` | Auto-sync on model changes |
| Celery tasks | `services/weaviate/tasks.py` | Async indexing pipeline |

---

## 3. Collections (Schemas)

### 3.1 Project
User-created technical projects and implementations.

| Property | Type | Purpose |
|----------|------|---------|
| `project_id` | int | Django model ID |
| `title` | text | Project name |
| `combined_text` | text | Full-text searchable content |
| `tool_names` | text[] | Tools used |
| `category_names` | text[] | Categories |
| `topics` | text[] | Topic tags |
| `owner_id`, `owner_username` | int/text | Creator info |
| `engagement_velocity` | number | Trending score |
| `like_count`, `view_count` | int | Social signals |
| `is_private`, `is_archived` | boolean | Visibility flags |
| `promotion_score` | number | Quality signal (0-1, decaying) |

**Security:** All project searches auto-filter to `is_private=False AND is_archived=False`.

### 3.2 UserProfile
User preference vectors for personalization.

| Property | Type | Purpose |
|----------|------|---------|
| `user_id` | int | Django user ID |
| `tool_interests` | text[] | Aggregated tool interests |
| `category_interests` | text[] | Category interests |
| `topic_interests` | text[] | Topic interests |
| `allow_similarity_matching` | boolean | Privacy consent |

**Privacy:** `preference_text` intentionally NOT stored.

### 3.3 Tool
Software applications and platforms for recommendation diversification.

### 3.4 Quiz
Learning assessments for semantic discovery.

### 3.5 MicroLesson
Short educational content and concept explanations.

### 3.6 Game
Interactive learning games (Context Snake, Ethics Defender, Prompt Battle).

---

## 4. Embedding Generation

### 4.1 Configuration

```python
# config/settings.py
WEAVIATE_EMBEDDING_MODEL = 'text-embedding-3-small'  # 1,536 dimensions
```

### 4.2 Circuit Breaker Pattern

Prevents cascading failures during OpenAI outages:
- **Failure Threshold**: 5 consecutive failures
- **Recovery Timeout**: 60 seconds
- **States**: CLOSED → OPEN → HALF_OPEN → CLOSED

### 4.3 Text Generation

**Project embedding text includes:**
- Title (repeated for weight)
- Creator info
- Description
- Topics, tools, categories (M2M relations)
- Structured content sections (overview, features, challenges, tech stack)

**User profile embedding text includes:**
- Bio/headline
- UserTags (ordered by confidence, max 50)
- Behavioral summary (top keywords, viewed topics/tools)

---

## 5. Signal-Based Indexing

### 5.1 Project Signals

| Signal | Trigger | Action |
|--------|---------|--------|
| `pre_save` | Project update | Cache visibility/promotion state |
| `post_save` | Project create/update | Sync to Weaviate (or remove if private) |
| `post_delete` | Project delete | Remove from Weaviate |

### 5.2 User Signals

| Signal | Trigger | Action |
|--------|---------|--------|
| `post_save` on UserTag | Tag change | Sync user profile |
| `post_save` on ProjectLike | New like | Sync project + user profile |
| `post_delete` on User | User deletion | GDPR removal (5 retries) |

### 5.3 Content Signals

- **Quiz**: Sync on publish
- **Tool**: Sync on activation
- **MicroLesson**: Sync on activation
- **M2M changes**: Re-sync on taxonomy edits

---

## 6. Async Task Pipeline

### 6.1 Orchestrator Pattern

Large reindex jobs split into chunks to avoid long-running tasks:

```python
# Engagement metrics (hourly)
update_engagement_metrics()  # Orchestrator
  └── update_engagement_metrics_chunk(offset, limit)  # 500 projects/chunk

# Full reindex (daily, 3 AM)
full_reindex_projects()  # Orchestrator
  └── reindex_projects_chunk(offset, limit)  # 100 projects/chunk
```

### 6.2 Key Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| `sync_project_to_weaviate` | On signal | Single project sync |
| `update_engagement_metrics` | Hourly | Update velocity scores |
| `full_reindex_projects` | Daily 3 AM | Complete reindex |
| `reindex_stale_content` | Periodic | Find unindexed content |
| `remove_user_profile_from_weaviate` | On user delete | GDPR compliance |

### 6.3 Retry Policy

- Standard tasks: 3 attempts, 60s delay
- GDPR deletions: 5 attempts (legally required)
- Engagement chunks: 2 attempts, 30s delay

---

## 7. Search Operations

### 7.1 Hybrid Search

Combines vector similarity (α) with keyword matching (1-α):

```python
client.hybrid_search(
    collection='Project',
    query='RAG systems',
    vector=query_embedding,
    alpha=0.7,  # 70% vector, 30% keyword
    filters={'difficulty_taxonomy_name': 'beginner'}
)
```

### 7.2 Security Enforcement

All Project searches auto-apply visibility filter:
```python
{
    'operator': 'And',
    'operands': [
        {'path': ['is_private'], 'operator': 'Equal', 'valueBoolean': False},
        {'path': ['is_archived'], 'operator': 'Equal', 'valueBoolean': False}
    ]
}
```

### 7.3 Collaborative Filtering

For users with `allow_similarity_matching=True`:
```python
similar_users = client.find_similar_users(
    user_id=123,
    limit=10
)
# Returns only user_ids (no PII)
```

---

## 8. Performance Optimizations

### 8.1 Connection Pooling

```python
# Default: 10 connections, 3 pre-warmed
pool = WeaviateConnectionPool(pool_size=10)
with pool.get_client() as client:
    results = client.hybrid_search(...)
```

### 8.2 Query Optimizations

- **N+1 Prevention**: `select_related()` / `prefetch_related()` on all sync tasks
- **Django aggregations**: Single query for engagement metrics
- **Text truncation**: 30,000 chars max for embeddings

### 8.3 Batch Operations

```python
client.batch_add_objects(objects, batch_size=100)
```

---

## 9. Configuration

```python
# config/settings.py
WEAVIATE_HOST = 'localhost'
WEAVIATE_PORT = 8080
WEAVIATE_URL = 'http://localhost:8080'
WEAVIATE_API_KEY = ''  # Optional for local
WEAVIATE_EMBEDDING_MODEL = 'text-embedding-3-small'
WEAVIATE_BATCH_SIZE = 100
WEAVIATE_TIMEOUT = 30
WEAVIATE_POOL_SIZE = 10  # Connection pool
```

---

## 10. Monitoring

### 10.1 Logging

All sync operations log with context:
```
[WEAVIATE] Synced project 123 (embedding: 1536 dims, properties: 15)
[WEAVIATE] Circuit breaker OPEN - embedding service unavailable
```

### 10.2 Health Checks

```python
client.is_available()  # Returns bool
pool.get_health()  # Returns pool utilization metrics
```

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
