# Personalization Engine Architecture

The personalization engine powers the "For You" feed in the Explore page, providing users with content recommendations tailored to their preferences and behavior.

## Overview

**Location:** `services/personalization/engine.py`

The engine uses a **hybrid scoring algorithm** that combines multiple signals to rank content. Unlike the "New" tab (chronological) or "Trending" tab (engagement-based), the "For You" tab orders content by personalization score.

## Scoring Weights

| Signal | Weight | Description |
|--------|--------|-------------|
| Vector Similarity | 30% | Content-based similarity using Weaviate embeddings |
| Explicit Preferences | 25% | Tag matching against user's saved preferences |
| Behavioral Signals | 25% | Interaction history (views, likes, follows) |
| Collaborative Filtering | 15% | What similar users have liked |
| Popularity | 5% | Baseline popularity (likes + engagement velocity) |

## Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    "For You" Feed Request                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Get User Preference Vector                               │
│   - Check Weaviate UserProfile collection for stored vector      │
│   - If not found, generate on-the-fly from user profile data     │
│   - Vector encodes user's interests based on their activity      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Vector Search in Weaviate                                │
│   - nearVector search against Project collection                 │
│   - Retrieves up to 1000 candidate projects                      │
│   - Filters out private/archived projects                        │
│   - Returns projects with similarity scores                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Score Each Candidate                                     │
│   For each project, calculate:                                   │
│   - vector_score: 1 - distance from user vector                  │
│   - explicit_score: tool/category/topic tag matches              │
│   - behavioral_score: penalties for viewed, boosts for liked     │
│   - collaborative_score: similar users' preferences              │
│   - popularity_score: normalized likes + engagement velocity     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Apply Diversity Boost                                    │
│   - Penalize projects if too many from same category rank high   │
│   - Prevents feed homogeneity                                    │
│   - Encourages content variety                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Sort by Total Score & Paginate                           │
│   - Sort descending by total_score                               │
│   - Apply pagination (page_size default: 20)                     │
│   - Return ordered project list with metadata                    │
└─────────────────────────────────────────────────────────────────┘
```

## Signal Details

### 1. Vector Similarity (30%)

Uses Weaviate's vector database for semantic similarity:

- **User vectors** are stored in `UserProfile` collection
- **Project vectors** are stored in `Project` collection
- Both use embeddings generated from text content
- Distance is converted to similarity: `score = max(0, 1 - distance)`

### 2. Explicit Preferences (25%)

Matches against user's saved `UserTag` records:

```python
explicit_score = (tool_match * 0.5) + (category_match * 0.3) + (topic_match * 0.2)
```

- **Tool match (50%):** Overlap between project tools and user's preferred tools
- **Category match (30%):** Overlap between project categories and user's preferred categories
- **Topic match (20%):** Overlap between project topics and user's general tags

### 3. Behavioral Signals (25%)

Adjusts scores based on user's interaction history:

| Behavior | Score Adjustment |
|----------|------------------|
| Already viewed | -0.5 penalty |
| Already liked | -0.8 penalty (don't re-show) |
| Creator's other content liked | +0.1 to +0.3 boost |

### 4. Collaborative Filtering (15%)

Finds users with similar preference vectors and boosts projects they liked:

1. Query Weaviate for 10 most similar users (by vector proximity)
2. Get projects those users have liked
3. Score projects by count of similar-user likes
4. Normalize to [0, 1] range

### 5. Popularity (5%)

Baseline popularity prevents filter bubble:

```python
popularity_score = (like_count / max_likes) * 0.5 + (engagement_velocity / max_velocity) * 0.5
```

- `like_count`: Total hearts on the project
- `engagement_velocity`: Recent engagement rate (calculated by Celery tasks)

## Diversity Boost

Prevents category homogeneity in results:

1. Sort projects by current score
2. For each project, count how many times its categories appear in higher-ranked results
3. Apply penalty: `-0.02 * category_repeat_count`
4. Re-sort by adjusted scores

This ensures varied content types appear throughout the feed.

## Fallback Behavior

If personalization fails (no user vector, Weaviate unavailable, errors), falls back to:

```python
Project.objects.filter(is_private=False, is_archived=False)
    .order_by('-created_at', '-like_count')
```

Fallback uses newest-first ordering with popularity as secondary sort.

## Key Classes

### `ScoredProject`

Dataclass holding score breakdown for a project:

```python
@dataclass
class ScoredProject:
    project_id: int
    total_score: float
    vector_score: float = 0.0
    explicit_score: float = 0.0
    behavioral_score: float = 0.0
    collaborative_score: float = 0.0
    popularity_score: float = 0.0
    diversity_boost: float = 0.0
```

### `PersonalizationEngine`

Main engine class with methods:

| Method | Description |
|--------|-------------|
| `get_for_you_feed()` | Main entry point - returns paginated personalized feed |
| `_get_user_vector()` | Retrieves or generates user preference vector |
| `_get_vector_candidates()` | Queries Weaviate for candidate projects |
| `_score_candidates()` | Applies hybrid scoring algorithm |
| `_get_collaborative_scores()` | Computes collaborative filtering scores |
| `_apply_diversity_boost()` | Applies category diversity penalties |
| `_get_popular_fallback()` | Fallback to popular/new when personalization fails |

## Configuration

Weights are configurable in the engine:

```python
WEIGHTS = {
    'vector_similarity': 0.30,
    'explicit_preferences': 0.25,
    'behavioral_signals': 0.25,
    'collaborative': 0.15,
    'popularity': 0.05,
}

CANDIDATE_LIMIT = 1000  # Max projects from Weaviate
SIMILAR_USERS_LIMIT = 10  # Users for collaborative filtering
```

## Performance Considerations

1. **Connection Pooling:** Uses Weaviate connection pool for high concurrency
2. **Batch Queries:** Owner like counts fetched in single query to avoid N+1
3. **Candidate Limit:** Caps Weaviate results at 1000 to balance relevance vs. performance
4. **Caching:** User vectors can be cached (see `services/personalization/cache.py`)

## Related Files

- `services/personalization/engine.py` - Main personalization logic
- `services/personalization/cache.py` - Caching layer for personalization data
- `services/weaviate/` - Weaviate client and schema definitions
- `core/projects/views.py` - API endpoint that calls the engine
- `core/taxonomy/models.py` - UserTag and UserInteraction models
