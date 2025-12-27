# Learning Tool Simplification Plan

## Goal
Reduce 14 learning tools to 3 tools + injected state + backend middleware.

---

## Data Model Context

### Dynamic Taxonomy Integration

**Critical Design Principle**: All filtering dimensions are **taxonomy-driven, not hardcoded**. When new taxonomy terms are added, learning tools automatically support them without code changes.

### Three Filtering Dimensions

| Dimension | Model | Examples | Use Case |
|-----------|-------|----------|----------|
| **Tool** | `Tool` model | LangChain, Claude, React, Python | "Learn about LangChain" |
| **Topic** | `Taxonomy` (topic) | AI Agents, RAG, Prompt Engineering | "Learn about RAG" |
| **Format** | `Taxonomy` (content_type) | video, article, quiz, game, code-repo | "Show me videos" |

### Taxonomy-Driven Behavior

When new taxonomy terms are added, learning tools automatically:

1. **Content Discovery**: `find_learning_content` queries Projects/Quizzes by taxonomy relationships, not hardcoded slugs
2. **Format Filtering**: Valid `content_type` values come from `Taxonomy.objects.filter(taxonomy_type='content_type')`
3. **Difficulty Levels**: Come from `Taxonomy.objects.filter(taxonomy_type='difficulty')`
4. **Time Commitments**: Come from `Taxonomy.objects.filter(taxonomy_type='time_investment')`
5. **Learning Modalities**: Come from `Taxonomy.objects.filter(taxonomy_type='modality')`

**Example**: If someone adds `content_type="podcast"` to Taxonomy:
- `find_learning_content(query="rag", content_type="podcast")` works immediately
- `create_learning_path` can include podcasts in curriculum
- No code changes required

### Tool Model (`core/tools/models.py`)
- `name`, `slug` - LangChain, Claude, etc.
- `description`, `key_features`, `use_cases`, `usage_tips`, `best_practices`
- `documentation_url`, `website_url`
- Projects have `tools` M2M field
- Quizzes have `tools` M2M field

### Content Sources
- **Projects** with `is_learning_eligible=True` + `tools` M2M + `topics` M2M
- **Quizzes** with `tools` M2M + `topics` M2M + difficulty
- **Games** (context-snake, ethics-defender, etc.)
- All filterable by: Tool + Topic + Format

### User Learning State
| Model | Purpose |
|-------|---------|
| `LearnerProfile` | Learning style, streak, goals, preferred difficulty |
| `UserLearningPath` | Per-topic progress (skill level, points) |
| `UserConceptMastery` | Per-concept proficiency |

---

## User Flows

### Flow 1: "I want to learn something new"
```
User: I want to learn something new
Ava: What do you want to learn about?
User: LangChain
Ava: [Knows user prefers videos from injected state]
Ava: Here's a quiz and a video project about LangChain
        [Quiz Teaser Card] [Project Teaser Card]
```

### Flow 2: "Surprise me"
```
User: Surprise me
Ava: Try this Context Window Snake Game!
        [Live game embedded in chat]
```

### Flow 3: "Structured learning path"
```
User: I want a structured learning path about AI architecture
Ava: Great, I'm creating a personalized learning path for you.
Ava: [Creates curriculum with videos, quizzes, articles, code repos]
Ava: Access it here: /learn/ai-architecture-abc123
```

### Flow 4: "What is X?"
```
User: What is LangChain?
Ava: [Uses Tool info + own knowledge to explain]
Ava: Here are 3 projects using LangChain:
        [Project Cards]
```

### Flow 5: "User expresses preference"
```
User: I learn better with videos
Ava: Got it! I'll prioritize video content for you.
        [Calls update_learner_profile]
```

---

## Final Architecture

### 3 Learning Tools

#### Tool 1: `find_learning_content`
**Purpose**: Find learning content about a tool or topic.

**Parameters**:
```python
query: str              # "langchain", "rag", "ai-agents"
content_type: str = ""  # "quiz", "video", "article", "game" (optional filter)
limit: int = 5
```

**Returns**:
```python
{
    # If query matches a Tool (LangChain, Claude, etc.)
    "tool": {
        "name": "LangChain",
        "slug": "langchain",
        "description": "...",
        "key_features": [...],
        "use_cases": [...],
        "usage_tips": [...],
        "best_practices": [...],
        "documentation_url": "..."
    },
    # Projects tagged with this tool/topic
    "projects": [
        {"title": "...", "type": "video", "thumbnail": "...", "url": "...", "difficulty": "..."}
    ],
    # Quizzes about this tool/topic
    "quizzes": [
        {"title": "...", "difficulty": "intermediate", "question_count": 10, "url": "..."}
    ],
    # Games related to this topic
    "games": [
        {"title": "Context Window Snake", "slug": "context-snake", "description": "..."}
    ]
}
```

**Logic**:
1. Check if `query` matches a Tool slug → include Tool info
2. Find Projects with matching `tools` or `topics`
3. Find Quizzes with matching `tools` or `topics`
4. Find Games related to the topic
5. Filter by `content_type` if provided
6. Auto-prioritize based on user's preferred format (from injected state)

**Replaces**: 6 tools
- `set_learning_topic`
- `get_learning_content`
- `suggest_next_activity`
- `deliver_micro_lesson`
- `get_quiz_details`
- `explain_concept` (Tool info replaces this)

---

#### Tool 2: `create_learning_path`
**Purpose**: Generate a rich, structured learning path leveraging the full taxonomy.

**Parameters**:
```python
query: str                    # "ai-architecture", "langchain", "rag"
difficulty: str = ""          # beginner, intermediate, advanced (or auto from profile)
time_commitment: str = ""     # quick, short, medium, deep-dive
```

**Returns**:
```python
{
    "path": {
        "id": "...",
        "title": "AI Architecture Learning Path",
        "description": "...",
        "url": "/learn/ai-architecture-abc123",
        "estimated_time": "4 hours",
        "difficulty": "intermediate"
    },
    "curriculum": [
        {"order": 1, "type": "tool", "title": "Understanding LangChain", "tool_slug": "langchain"},
        {"order": 2, "type": "video", "title": "RAG Architecture Overview", "project_id": "..."},
        {"order": 3, "type": "quiz", "title": "RAG Basics Quiz", "quiz_id": "..."},
        {"order": 4, "type": "article", "title": "Building Production RAG", "project_id": "..."},
        {"order": 5, "type": "game", "title": "Context Window Snake", "game_slug": "context-snake"},
        {"order": 6, "type": "code-repo", "title": "Example RAG Implementation", "project_id": "..."},
    ],
    "tools_covered": ["langchain", "pinecone", "openai"],
    "topics_covered": ["rag", "embeddings", "vector-databases"]
}
```

**Logic**:
1. Identify relevant Tools and Topics from query
2. Pull content from ALL content_types: video, article, quiz, game, code-repo
3. Order by difficulty progression (beginner → advanced)
4. Filter by user's time_commitment preference
5. Create/update UserLearningPath record
6. Return structured curriculum

---

#### Tool 3: `update_learner_profile`
**Purpose**: Save learner preferences, interests, and skills discovered during conversation.

**Parameters**:
```python
preferences: dict = {}     # {"learning_style": "video", "difficulty": "intermediate"}
interests: list = []       # ["langchain", "rag", "ai-agents"]
skills: dict = {}          # {"prompt-engineering": "advanced", "rag": "beginner"}
notes: str = ""            # Free-form observation about the learner
```

**Returns**:
```python
{
    "success": True,
    "updated_fields": ["preferences.learning_style", "interests"],
    "message": "Profile updated"
}
```

**Use cases**:
- User says "I prefer videos" → `update_learner_profile(preferences={"learning_style": "video"})`
- User shows interest in RAG → `update_learner_profile(interests=["rag"])`
- Ava infers user is advanced → `update_learner_profile(skills={"ai-agents": "advanced"})`
- User struggles with concept → `update_learner_profile(notes="Needs more help with embeddings")`

---

### Injected State (Not a Tool)

Learner context is pre-loaded into agent state at conversation start:

```python
learner_context = {
    "profile": {
        "learning_style": "video",           # visual, hands_on, conceptual, mixed
        "difficulty_level": "intermediate",  # beginner, intermediate, advanced
        "session_length": 15,                # preferred minutes
        "learning_goal": "build_projects"    # build_projects, understand_concepts, career, exploring
    },
    "stats": {
        "streak_days": 7,
        "total_xp": 1250,
        "quizzes_completed": 12
    },
    "progress": [
        {"topic": "ai-agents", "skill_level": "intermediate", "progress_pct": 45},
        {"topic": "rag", "skill_level": "beginner", "progress_pct": 20}
    ],
    "suggestions": [
        {"topic": "rag", "reason": "knowledge_gap"},
        {"topic": "langchain", "reason": "trending"}
    ],
    "interests": ["ai-agents", "langchain", "automation"]
}
```

Ava always has this context available - no tool call needed to personalize.

---

### Backend Middleware (Automatic Tracking)

These events are tracked automatically without Ava calling a tool:

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| Content view | Project page opened | project_id, time_spent |
| Quiz start | Quiz page opened | quiz_id |
| Quiz complete | Quiz submitted | quiz_id, score, answers |
| Game played | Game component mounted | game_slug, score |
| Learning path started | Path page opened | path_id |

Implementation: Middleware observes tool calls and API requests, creates `LearningEvent` records.

---

## Summary

| Before | After |
|--------|-------|
| 14 tools | 3 tools |

**Final architecture**:
- `find_learning_content` - Discover Tool info + Projects + Quizzes + Games
- `create_learning_path` - Generate rich structured curriculum
- `update_learner_profile` - Save preferences/interests/skills
- **Injected state** - Learner context always available
- **Backend middleware** - Auto-track events

---

## Tools to DELETE

| Tool | Reason |
|------|--------|
| `get_learning_progress` | Injected state |
| `get_learner_profile` | Injected state |
| `get_concept_mastery` | Injected state |
| `find_knowledge_gaps` | Injected state (suggestions) |
| `get_due_reviews` | Injected state |
| `start_learning_session` | Not needed - Ava uses context |
| `set_learning_topic` | Merged into `find_learning_content` |
| `get_learning_content` | Merged into `find_learning_content` |
| `suggest_next_activity` | Injected state (suggestions) |
| `deliver_micro_lesson` | Merged into `find_learning_content` |
| `get_quiz_details` | Merged into `find_learning_content` |
| `explain_concept` | Tool info + Ava's knowledge |
| `get_quiz_hint` | Removed - not needed |
| `record_learning_event` | Backend middleware |

---

## Files to Modify

### Existing Files
1. **`/services/agents/learning/tools.py`** - Thin tool definitions delegating to components
2. **`/services/agents/ember/tools.py`** - Update registry (3 tools instead of 14)
3. **`/services/agents/ember/prompts.py`** - Simplify learning section, document injected state
4. **`/services/agents/ember/agent.py`** - Inject learner context at conversation start
5. **`/core/learning_paths/services.py`** - Add unified query methods, curriculum generator

### New Files (Component Structure)
6. **`/services/agents/learning/components/__init__.py`**
7. **`/services/agents/learning/components/content_finder.py`** - find_learning_content logic
8. **`/services/agents/learning/components/path_generator.py`** - create_learning_path logic
9. **`/services/agents/learning/components/profile_updater.py`** - update_learner_profile logic
10. **`/services/agents/learning/components/learner_context.py`** - Injected state aggregation
11. **`/services/agents/learning/components/event_tracker.py`** - Middleware event tracking
12. **`/services/agents/learning/queries/__init__.py`**
13. **`/services/agents/learning/queries/projects.py`** - Project query helpers
14. **`/services/agents/learning/queries/quizzes.py`** - Quiz query helpers
15. **`/services/agents/learning/queries/taxonomy.py`** - Taxonomy query helpers
16. **`/services/agents/learning/serializers/__init__.py`**
17. **`/services/agents/learning/serializers/learning.py`** - Response serialization
18. **`/core/learning_paths/middleware.py`** - Event tracking middleware

---

## Security & Scalability Review

### Scale Assumptions
- 100,000 users
- 1,000s of projects
- High concurrent learning sessions

---

### Scalability Concerns & Mitigations

#### 1. Injected State Loading
**Risk**: Loading full learner context on every conversation start = N+1 queries, slow cold starts

**Mitigations**:
```python
# Use Redis cache with 5-minute TTL
learner_context = cache.get(f"learner_context:{user_id}")
if not learner_context:
    learner_context = LearnerContextService.aggregate(user_id)
    cache.set(f"learner_context:{user_id}", learner_context, timeout=300)
```

- **Cache Strategy**: Redis with 5-min TTL, invalidate on profile update
- **Lazy Loading**: Only load full progress if user asks about it
- **Slim Default**: Inject minimal context (profile + top 3 suggestions), expand on demand

#### 2. find_learning_content Queries
**Risk**: M2M queries on Projects × Tools × Topics could be slow at scale

**Mitigations**:
```python
# Required indexes
class Project:
    class Meta:
        indexes = [
            models.Index(fields=['is_private', 'is_archived', '-created_at']),
            GinIndex(fields=['tools']),  # For M2M lookups
        ]

# Use select_related/prefetch_related
Project.objects.filter(
    tools__slug=query
).select_related(
    'content_type_taxonomy', 'difficulty_taxonomy'
).prefetch_related(
    'tools', 'topics'
)[:limit]
```

- **Pagination**: Always limit results (default 5, max 20)
- **Denormalization**: Consider caching tool/topic counts on Project
- **Search Index**: Use Weaviate for fuzzy matching, Postgres for exact

#### 3. create_learning_path Generation
**Risk**: Real-time curriculum generation across multiple content types is expensive

**Mitigations**:
- **Background Generation**: Queue path creation, return immediately with "generating..." status
- **Template Paths**: Pre-generate popular paths (RAG, LangChain, AI Agents)
- **Caching**: Cache generated paths for 1 hour, personalize on render
- **Limit Scope**: Max 20 items per curriculum

#### 4. Backend Event Tracking
**Risk**: High write volume with 100K active users

**Mitigations**:
```python
# Use Celery for async event processing
@shared_task
def record_learning_event_async(user_id, event_type, metadata):
    LearningEvent.objects.create(...)

# Batch writes
# Collect events in Redis list, flush every 30 seconds
```

- **Async Processing**: Never block request on event writes
- **Batching**: Buffer events, write in batches
- **Sampling**: For high-frequency events (page views), sample 10%

#### 5. Database Query Patterns
**Risk**: N+1 queries, missing indexes

**Required Indexes**:
```python
# Project
Index(fields=['is_learning_eligible', '-learning_quality_score'])

# UserLearningPath
Index(fields=['user', 'topic_taxonomy'])

# LearnerProfile
# Already OneToOne with User, indexed by default

# Taxonomy
Index(fields=['taxonomy_type', 'is_active', 'slug'])
```

---

### Security Concerns & Mitigations

#### 1. User Data Isolation
**Risk**: User A accessing User B's learning data

**Mitigations**:
```python
# ALWAYS filter by authenticated user
def get_learner_context(user_id):
    # Validate user_id matches request.user.id
    if user_id != request.user.id:
        raise PermissionDenied()

    return LearnerProfile.objects.get(user_id=user_id)
```

- **State Injection**: Only inject context for authenticated user
- **Tool Validation**: All tools receive user_id from state, not parameters
- **No User ID in Parameters**: Tools should NEVER accept user_id as input

#### 2. Input Validation
**Risk**: Injection attacks via query parameters

**Mitigations**:
```python
class FindLearningContentInput(BaseModel):
    query: str = Field(max_length=200, pattern=r'^[a-zA-Z0-9\-\s]+$')
    content_type: str = Field(default='')
    limit: int = Field(default=5, ge=1, le=20)

    @validator('content_type')
    def validate_content_type(cls, v):
        if v and not Taxonomy.objects.filter(
            taxonomy_type='content_type',
            slug=v,
            is_active=True
        ).exists():
            raise ValueError(f'Invalid content_type: {v}')
        return v
```

- **Pydantic Validation**: Strict schemas for all tool inputs
- **Taxonomy Validation**: Only accept valid taxonomy slugs
- **Length Limits**: Prevent oversized queries

#### 3. Rate Limiting
**Risk**: Abuse of update_learner_profile, create_learning_path

**Mitigations**:
```python
# Per-user rate limits
@ratelimit(key='user', rate='10/m', method='ALL')
def update_learner_profile(...):
    ...

@ratelimit(key='user', rate='5/h', method='ALL')
def create_learning_path(...):
    ...
```

- **Profile Updates**: 10/minute max
- **Path Creation**: 5/hour max (expensive operation)
- **Content Queries**: 60/minute max

#### 4. Data Sanitization
**Risk**: XSS in notes field, malicious interests/skills

**Mitigations**:
```python
def update_learner_profile(preferences, interests, skills, notes):
    # Sanitize free-text fields
    if notes:
        notes = bleach.clean(notes, tags=[], strip=True)[:500]

    # Validate interests are valid taxonomy slugs
    if interests:
        valid_interests = Taxonomy.objects.filter(
            slug__in=interests,
            taxonomy_type__in=['topic', 'tool'],
            is_active=True
        ).values_list('slug', flat=True)
        interests = list(valid_interests)
```

- **HTML Stripping**: No HTML in notes field
- **Taxonomy Validation**: Interests/skills must be valid slugs
- **Length Limits**: Max 500 chars for notes, max 50 interests

#### 5. Sensitive Data Handling
**Risk**: Leaking learning data in logs, errors

**Mitigations**:
- **No PII in Logs**: Log user_id, not usernames or emails
- **Error Sanitization**: Don't expose internal errors to users
- **Audit Trail**: Log profile updates for compliance

---

### Performance Benchmarks (Targets)

| Operation | Target P95 | Max Acceptable |
|-----------|------------|----------------|
| Inject learner context | 50ms | 200ms |
| find_learning_content | 100ms | 500ms |
| create_learning_path | 500ms | 2s (async fallback) |
| update_learner_profile | 50ms | 200ms |
| Event tracking | 10ms | 50ms (async) |

---

### Monitoring & Alerts

```python
# Key metrics to track
- learner_context_cache_hit_rate  # Target: >80%
- find_learning_content_p95_ms
- learning_path_generation_queue_depth
- learning_events_per_minute
- profile_updates_per_user_per_hour  # Alert if >10
```

---

### API Naming Conventions

**Backend (Python/Django)**: `snake_case`
**Frontend (TypeScript/React)**: `camelCase`

Conversion happens at the API boundary.

#### Backend Response (snake_case)
```python
# Django serializer output
{
    "learner_context": {
        "learning_style": "video",
        "difficulty_level": "intermediate",
        "streak_days": 7,
        "total_xp": 1250,
        "quizzes_completed": 12,
        "skill_level": "intermediate",
        "progress_pct": 45,
        "topic_taxonomy": "ai-agents"
    },
    "learning_content": {
        "tool_info": {...},
        "content_type": "video",
        "question_count": 10,
        "documentation_url": "..."
    }
}
```

#### Frontend Consumption (camelCase)
```typescript
// After transformation
interface LearnerContext {
    learningStyle: "video" | "hands_on" | "conceptual" | "mixed";
    difficultyLevel: "beginner" | "intermediate" | "advanced";
    streakDays: number;
    totalXp: number;
    quizzesCompleted: number;
    skillLevel: string;
    progressPct: number;
    topicTaxonomy: string;
}

interface LearningContent {
    toolInfo: ToolInfo;
    contentType: string;
    questionCount: number;
    documentationUrl: string;
}
```

#### Transformation Layer

**Option A: DRF renderer (recommended)**
```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'djangorestframework_camel_case.render.CamelCaseJSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'djangorestframework_camel_case.parser.CamelCaseJSONParser',
    ],
}
```

**Option B: Frontend utility**
```typescript
// utils/api.ts
import camelcaseKeys from 'camelcase-keys';
import snakecaseKeys from 'snakecase-keys';

export const api = {
    get: async (url: string) => {
        const response = await fetch(url);
        const data = await response.json();
        return camelcaseKeys(data, { deep: true });
    },
    post: async (url: string, body: object) => {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(snakecaseKeys(body, { deep: true })),
        });
        return camelcaseKeys(await response.json(), { deep: true });
    }
};
```

#### Tool Parameters

Tools receive `snake_case` from backend state:
```python
# Tool implementation
def find_learning_content(
    query: str,
    content_type: str = "",  # snake_case
    limit: int = 5,
    state: dict | None = None,
):
    user_id = state.get('user_id')  # snake_case
    learning_style = state.get('learning_style')  # snake_case
```

Frontend sends `camelCase`, transformed before reaching tools:
```typescript
// Frontend call
await emberChat.send({
    action: 'findLearningContent',
    query: 'langchain',
    contentType: 'video',  // camelCase
});

// Transformed to snake_case before tool receives it
```

---

## Code Maintainability

### Component-Based Architecture

Each learning tool should be broken into small, focused components:

```
services/agents/learning/
├── tools.py                    # Tool definitions (thin layer)
├── components/
│   ├── __init__.py
│   ├── content_finder.py       # find_learning_content logic
│   ├── path_generator.py       # create_learning_path logic
│   ├── profile_updater.py      # update_learner_profile logic
│   ├── learner_context.py      # Injected state aggregation
│   └── event_tracker.py        # Middleware event tracking
├── queries/
│   ├── __init__.py
│   ├── projects.py             # Project query helpers
│   ├── quizzes.py              # Quiz query helpers
│   └── taxonomy.py             # Taxonomy query helpers
└── serializers/
    ├── __init__.py
    └── learning.py             # Response serialization
```

**Principles**:
- **Single Responsibility**: Each component does one thing well
- **Testability**: Components can be unit tested in isolation
- **Reusability**: Query helpers shared across tools
- **Thin Tools**: Tool functions delegate to components

### Global Util Logger

Use the project's global util logger for consistent logging:

```python
from utils.logger import logger

# In components
class ContentFinder:
    def find(self, query: str, content_type: str, limit: int, user_id: int):
        logger.info(
            "Finding learning content",
            extra={
                "query": query,
                "content_type": content_type,
                "user_id": user_id,
            }
        )

        try:
            results = self._execute_query(query, content_type, limit)
            logger.debug(
                "Content search results",
                extra={"count": len(results), "query": query}
            )
            return results
        except Exception as e:
            logger.error(
                "Content search failed",
                extra={"query": query, "error": str(e)},
                exc_info=True
            )
            raise
```

**Logging Guidelines**:
- `logger.info` for tool invocations and significant events
- `logger.debug` for query results and internal state
- `logger.warning` for degraded performance or fallbacks
- `logger.error` for failures (with `exc_info=True`)
- Always include `user_id` in extra context (never in message)
- Never log PII (emails, names) - only IDs

---

## Implementation Order

1. **Phase 1: Injected State**
   - Create learner context aggregation service
   - Inject into Ava agent state at conversation start

2. **Phase 2: find_learning_content**
   - Unified content discovery across Tool + Projects + Quizzes + Games
   - Filter by content_type and user preferences

3. **Phase 3: create_learning_path**
   - Curriculum generator using full taxonomy
   - Ordered by difficulty, filtered by time commitment

4. **Phase 4: update_learner_profile**
   - Intentional profile updates from conversation

5. **Phase 5: Backend Middleware**
   - Auto-track content views, quiz completions, game plays

6. **Phase 6: Cleanup**
   - Delete 14 old tools
   - Update Ava prompts
