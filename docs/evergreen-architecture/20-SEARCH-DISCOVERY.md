# Search & Discovery Architecture

**Source of Truth** | **Last Updated**: 2025-12-20

This document describes AllThrive's unified search system with intelligent intent routing, hybrid search, and personalization.

---

## 1. Overview

The unified search system provides:
- **Intent detection**: Classifies queries to route to appropriate content types
- **Hybrid search**: Combines semantic vectors + keyword matching
- **Personalization**: Boosts results based on user preferences
- **Multi-type search**: Projects, quizzes, tools, lessons, games

**Key Files:**
- `services/search/unified_search.py` - Core search service
- `services/search/intent_router.py` - Query classification
- `services/weaviate/` - Vector search backend

---

## 2. Architecture

```
User Query
    ↓
[IntentRouter] → Detect intent, extract topic, route to content types
    ↓
[UnifiedSearchService] → Generate embeddings, fetch user preferences
    ↓
[Parallel Searches] → Search each content type in Weaviate (async)
    ↓
[Result Ranking] → Score, boost, merge, paginate
    ↓
SearchResponse {results, metadata, timing}
```

---

## 3. Intent Router

### 3.1 Intent Types

| Intent | Meaning | Default Content Types |
|--------|---------|----------------------|
| `search` | Find specific content | All types |
| `learn` | Educational content | micro_lesson, project, quiz |
| `practice` | Hands-on practice | quiz, game, project |
| `compare` | Compare options | tool, project |
| `discover` | Explore broadly | All types |

### 3.2 Intent Keywords

```python
INTENT_KEYWORDS = {
    'quiz': ['quiz', 'test', 'challenge', 'assessment', 'exam'],
    'tool': ['tool', 'app', 'software', 'platform', 'service'],
    'micro_lesson': ['lesson', 'learn', 'tutorial', 'guide', 'concept'],
    'project': ['project', 'example', 'demo', 'showcase', 'build'],
    'game': ['game', 'play', 'snake', 'defender', 'battle'],
}
```

### 3.3 Intent Modifiers

| Pattern | Sets Intent To |
|---------|---------------|
| `how to`, `how do` | `learn` |
| `what is`, `what are` | `learn` |
| `find`, `search`, `show` | `search` |
| `compare`, `vs`, `versus` | `compare` |

### 3.4 Detection Examples

| Query | Intent | Content Types | Confidence |
|-------|--------|---------------|------------|
| "quiz about RAG" | discover | quiz | 0.95 |
| "how to learn agents" | learn | micro_lesson, project, quiz | 0.80 |
| "compare vector databases" | compare | tool | 0.95 |
| "content about LLMs" | discover | All types | 0.50 |

### 3.5 Usage

```python
from services.search import IntentRouter

# Simple detection
intent, content_types = IntentRouter.detect_intent("quiz about RAG")

# Full analysis
result = IntentRouter.analyze_query("how to learn agents")
# IntentResult:
#   primary_intent: 'learn'
#   content_types: ['micro_lesson', 'project', 'quiz']
#   confidence: 0.80
#   extracted_topic: 'agents'
```

---

## 4. Content Types

### 4.1 Searchable Collections

| Type | Description | Key Properties |
|------|-------------|----------------|
| `project` | User-created projects | title, tools, categories, topics, engagement |
| `quiz` | Learning assessments | title, topic, difficulty, questions |
| `tool` | Software/platforms | name, description, use_cases |
| `micro_lesson` | Short educational content | title, concept, difficulty |
| `game` | Interactive games | title, learning_outcomes, difficulty |

### 4.2 Property Mapping

| Taxonomy Type | Weaviate Property |
|---------------|-------------------|
| `topic` | `topic_names` |
| `category` | `category_names` |
| `tool` | `tool_names` |
| `difficulty` | `difficulty_taxonomy_name` |
| `time_investment` | `time_investment_name` |
| `content_type` | `content_type_name` |

---

## 5. Hybrid Search

### 5.1 Scoring Weights

| Signal | Weight | Source |
|--------|--------|--------|
| Semantic similarity | 35% | Weaviate vector search |
| Taxonomy matching | 25% | Filter alignment |
| Social signals | 20% | Engagement, likes |
| Collaborative filtering | 15% | User similarity |
| Popularity/freshness | 5% | Trending score |

### 5.2 Alpha Parameter

Controls vector vs keyword balance:

```python
alpha = 0.7  # Default: 70% vector, 30% keyword
# alpha=1.0: Pure semantic (vector-only)
# alpha=0.0: Pure keyword (text-only)
```

### 5.3 Search Flow

```python
# 1. Generate query embedding
query_embedding = embeddings.generate_embedding(query)

# 2. Get user preference vector (optional)
user_embedding = get_user_embedding(user_id)  # Cached 5 min

# 3. Execute hybrid search per content type (parallel)
results = await asyncio.gather(*[
    search_collection(content_type, query, query_embedding, filters)
    for content_type in content_types
])

# 4. Apply personalization boost
for result in results:
    similarity = cosine_similarity(query_embedding, user_embedding)
    result.score *= 1.0 + (similarity * 0.015)

# 5. Merge and rank
all_results.sort(key=lambda r: r.score, reverse=True)
```

---

## 6. Personalization

### 6.1 User Preference Embeddings

Generated from:
- UserTag confidence scores
- Behavioral signals (likes, views)
- Profile data (bio, interests)

**Privacy:** Only aggregated interests stored, no raw PII.

### 6.2 Cache Strategy

```python
CACHE_KEY = 'search:user_embed:{user_id}'
CACHE_TTL = 300  # 5 minutes
```

### 6.3 Consent Control

```python
# UserProfile.allow_similarity_matching must be True
# for collaborative filtering features
```

---

## 7. Filtering

### 7.1 Taxonomy Filters

```python
response = service.search_sync(
    query="machine learning",
    taxonomy_filters={
        'tool': ['Python', 'TensorFlow'],
        'category': ['AI', 'Machine Learning'],
        'difficulty': 'beginner'
    }
)
```

### 7.2 Weaviate Filter Translation

```python
filters = {
    'operator': 'And',
    'operands': [
        {
            'path': ['difficulty_taxonomy_name'],
            'operator': 'Equal',
            'valueText': 'beginner'
        },
        {
            'path': ['tool_names'],
            'operator': 'ContainsAny',
            'valueTextArray': ['Python', 'TensorFlow']
        }
    ]
}
```

---

## 8. API Usage

### 8.1 Basic Search

```python
from services.search import UnifiedSearchService

service = UnifiedSearchService()

response = service.search_sync(
    query="how to build a RAG system",
    limit=10
)

print(response.detected_intent)  # 'learn'
print(response.searched_types)   # ['micro_lesson', 'project', 'quiz']
```

### 8.2 Personalized Search

```python
response = service.search_sync(
    query="data visualization tools",
    user_id=456,
    limit=20
)
```

### 8.3 Filtered Search

```python
response = service.search_sync(
    query="machine learning projects",
    difficulty="beginner",
    taxonomy_filters={
        'tool': ['Python'],
        'category': ['AI']
    }
)
```

### 8.4 Async Usage

```python
async def search_content():
    service = UnifiedSearchService()
    response = await service.search(
        query="vector databases",
        user_id=456
    )
    return response
```

---

## 9. Response Structure

```python
SearchResponse {
    results: [
        {
            content_type: "project",
            content_id: 123,
            title: "Building RAG Systems",
            score: 0.945,
            weaviate_uuid: "abc-123",
            tool_names: ["LangChain", "Pinecone"],
            category_names: ["AI", "NLP"]
        },
        ...
    ],
    total_count: 247,
    query: "RAG systems",
    detected_intent: "learn",
    searched_types: ["project", "micro_lesson", "quiz"],
    search_time_ms: 342.15
}
```

---

## 10. Agent Integration

### 10.1 Discovery Tool

```python
from services.agents.discovery.tools import unified_search

result = unified_search(
    query="tools for image generation",
    content_types=["tool"],
    difficulty="beginner",
    limit=10,
    state={'user_id': 456}
)
```

### 10.2 Related Content

```python
related = await service.get_related_content(
    content_type='project',
    content_id=123,
    limit=5,
    exclude_ids=[123]
)
```

---

## 11. Performance

### 11.1 Metrics

| Metric | Typical Value |
|--------|---------------|
| Search time | 300-500ms |
| Parallel speedup | ~1.5x vs sequential |
| User embedding cache hit | ~90% |
| Embedding generation | 100-200ms |

### 11.2 Parallelization

```python
# All content type searches run concurrently
search_tasks = [
    search_collection(ct, query, embedding, filters)
    for ct in content_types
]
results = await asyncio.gather(*search_tasks, return_exceptions=True)
```

### 11.3 Error Handling

- Individual search failures don't halt entire search
- Circuit breaker for OpenAI embedding failures
- 30-second timeout per search

---

## 12. Configuration

```python
# config/settings.py
WEAVIATE_URL = 'http://localhost:8080'
WEAVIATE_TIMEOUT = 30
OPENAI_API_KEY = '...'  # For embeddings
```

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
