# Scalable Taxonomy System for Content Discovery via Chat

## Goal
Build a **fully agentic** taxonomy system that tags all content (Projects, Tools, Quizzes, MicroLessons) with **zero human intervention** so that Ava chat can surface relatable content to users through:
- Vector embeddings (semantic similarity via Weaviate)
- Flat tag matching (taxonomy filters)
- Fuzzy semantic search (hybrid keyword + vector)
- Real-time collaborative filtering (via Weaviate user vectors)

## Scale Target
- **100,000+ users**
- **Millions of content items**
- **Sub-100ms discovery queries**

## Key Principles
1. **Fully Agentic**: No review queues, no manual approval. AI tags content autonomously and self-corrects over time via feedback loops.
2. **Weaviate-First Discovery**: Weaviate is the primary discovery layer. No heavy Django ORM joins for search. PostgreSQL remains source of truth for CRUD.
3. **AI Gateway with Cost Optimization**: Use `AIProvider` with a new `purpose='tagging'` that routes to cheaper models. Add tiered tagging: cheap model for bulk, expensive for high-value content.
4. **No Pre-computed User Similarity**: Use real-time Weaviate vector similarity instead of storing billions of user pairs.
5. **Self-Improving**: Track tag quality metrics; the system learns from user engagement signals.

---

## Prerequisites: Entity Taxonomy Fields

**IMPORTANT**: Before implementing AI tagging, entity models must have taxonomy fields to populate.

### Current State (16 Taxonomy Types Defined)

| Entity | Currently Connected | Missing Fields |
|--------|---------------------|----------------|
| **User** | None (uses UserTag intermediary) | personality, learning_styles, roles, goals, interests, industries |
| **Project** | categories, topics | content_type, time_investment, pricing, difficulty (FK) |
| **Quiz** | categories, topics | content_type, time_investment, difficulty, pricing |
| **SideQuest** | topic | content_type, time_investment, difficulty, pricing |
| **MicroLesson** | via Concept | content_type, time_investment, difficulty, pricing |

### Key Decision: UserTag vs Direct Fields

**Keep both systems** - they serve complementary purposes:

| System | Purpose | Data Source |
|--------|---------|-------------|
| **Direct User fields** | Explicit preferences | User selection during onboarding |
| **UserTag** | Inferred preferences | AI analysis of behavior (auto-generated) |

Rationale: A user might *say* they're a "developer" but mostly engage with marketing content. Both signals are valuable for recommendations.

### Phase 0A: Add Taxonomy Fields to User Model

**File**: `core/users/models.py`

```python
# Single-select (FK)
personality = models.ForeignKey(
    'taxonomy.Taxonomy',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='users_with_personality',
    limit_choices_to={'taxonomy_type': 'personality', 'is_active': True},
)

# Multi-select (M2M)
learning_styles = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='users_with_learning_style',
    limit_choices_to={'taxonomy_type': 'learning_style', 'is_active': True},
)

roles = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='users_with_role',
    limit_choices_to={'taxonomy_type': 'role', 'is_active': True},
)

goals = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='users_with_goal',
    limit_choices_to={'taxonomy_type': 'goal', 'is_active': True},
)

interests = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='users_with_interest',
    limit_choices_to={'taxonomy_type': 'interest', 'is_active': True},
)

industries = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='users_in_industry',
    limit_choices_to={'taxonomy_type': 'industry', 'is_active': True},
)
```

### Phase 0B: Add Taxonomy Fields to Content Models

Create a shared mixin for all content models:

**File**: `core/taxonomy/mixins.py` (new)

```python
class ContentMetadataMixin(models.Model):
    """Shared taxonomy fields for all content types."""

    content_type_taxonomy = models.ForeignKey(
        'taxonomy.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_of_type',
        limit_choices_to={'taxonomy_type': 'content_type', 'is_active': True},
    )

    time_investment = models.ForeignKey(
        'taxonomy.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_time',
        limit_choices_to={'taxonomy_type': 'time_investment', 'is_active': True},
    )

    difficulty_taxonomy = models.ForeignKey(
        'taxonomy.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_difficulty',
        limit_choices_to={'taxonomy_type': 'difficulty', 'is_active': True},
    )

    pricing = models.ForeignKey(
        'taxonomy.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_with_pricing',
        limit_choices_to={'taxonomy_type': 'pricing', 'is_active': True},
    )

    ai_tag_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='AI-generated tag metadata: {field: {confidence, model, source}}'
    )

    class Meta:
        abstract = True
```

Apply mixin to: Project, Quiz, SideQuest, MicroLesson

### Phase 0C: Seed Taxonomy Data

Ensure all taxonomy types have seed data via `seed_taxonomies` management command:

- `personality`: 16 MBTI types (INTJ, ENFP, etc.)
- `learning_style`: visual, reading, hands-on, audio, social
- `role`: developer, designer, product-manager, founder, marketer, creator, etc.
- `goal`: existing goals
- `interest`: existing interests
- `industry`: existing industries
- `content_type`: code-repo, article, video, course, etc.
- `time_investment`: quick, short, medium, deep-dive
- `difficulty`: beginner, intermediate, advanced
- `pricing`: free, freemium, paid

---

## Architecture Overview (Simplified for Scale)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CHAT (Ava Agent)                          │
│  User: "Show me beginner content about RAG"                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIFIED SEARCH SERVICE                           │
│  - Intent detection (quiz? project? any?)                          │
│  - Single Weaviate query (hybrid + filters)                        │
│  - Real-time user similarity via nearVector                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          ▼                                     ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│       WEAVIATE          │         │    REDIS (Cache)        │
│  Content (unified)      │         │  - User embeddings      │
│  - Vector search        │         │  - Hot content cache    │
│  - Hybrid search        │         │  - Rate limiting        │
│  - Filtering by tags    │         └─────────────────────────┘
│  - User profile vectors │
└─────────────────────────┘
          ▲
          │ (async index on content save)
          │
┌─────────────────────────────────────────────────────────────────────┐
│                    AI TAGGING PIPELINE (Celery)                     │
│  - Extract taxonomy tags via AIProvider(purpose='tagging')        │
│  - Tiered: cheap model for bulk, expensive for high-value         │
│  - Source inheritance (YouTube channel → all its videos)           │
└─────────────────────────────────────────────────────────────────────┘
```

### What Changed for Scale
1. **Removed ContentRegistry Django model** - No more GenericForeignKey queries
2. **Removed UserSimilarity table** - Use real-time Weaviate nearVector instead
3. **Weaviate is the discovery layer** - All search goes to Weaviate, not Django ORM
4. **PostgreSQL stays for CRUD** - Project, Tool, Quiz models unchanged
5. **Tags stored in Weaviate** - As filterable arrays, not M2M joins

---

## Phase 1: Minimal Django Changes + Weaviate Schema

### 1.1 Keep Existing Django Models (No ContentRegistry!)

**No new Django models needed for discovery.** Existing models stay as-is:
- `Project` - keeps existing `categories`, `topics` M2M to Taxonomy
- `Tool` - keeps existing `taxonomy` OneToOne
- `Quiz` - keeps existing `categories`, `topics` M2M
- `MicroLesson` - via Concept relationship

**Only add one field** to track Weaviate sync:

**File**: `core/projects/models.py`, `core/tools/models.py`, `core/quizzes/models.py`

```python
# Add to each content model
weaviate_uuid = models.UUIDField(null=True, blank=True, db_index=True)
last_indexed_at = models.DateTimeField(null=True, blank=True)
```

### 1.2 Lightweight Tag Metadata (Optional - for AI confidence tracking)

If you want to track AI tag confidence without heavy M2M, use a JSONField:

**File**: `core/projects/models.py`

```python
# Add to Project model
ai_tag_metadata = models.JSONField(
    default=dict,
    blank=True,
    help_text='AI-generated tag metadata: {taxonomy_slug: {confidence: 0.85, model: "gpt-3.5"}}'
)
```

This avoids creating millions of rows in a separate table.

### 1.3 Manual Edits Override AI Tags

**Critical**: When users manually edit taxonomy on their projects/profiles, those edits:
1. Override any AI-generated tags
2. Sync immediately to Weaviate
3. Are marked as `source='manual'` (confidence = 1.0)

**File**: `core/projects/signals.py`

```python
@receiver(m2m_changed, sender=Project.categories.through)
@receiver(m2m_changed, sender=Project.topics.through)
def sync_taxonomy_to_weaviate(sender, instance, action, **kwargs):
    """
    When user manually edits project taxonomy, sync to Weaviate immediately.
    Manual edits always override AI-generated tags.
    """
    if action in ['post_add', 'post_remove', 'post_clear']:
        from services.weaviate.tasks import sync_content_to_weaviate
        sync_content_to_weaviate.delay(
            content_type='project',
            content_id=instance.id,
            source='manual',  # Mark as manual edit
        )
```

**Same pattern for UserTag** (user profile taxonomy):

```python
@receiver(post_save, sender=UserTag)
@receiver(post_delete, sender=UserTag)
def sync_user_profile_to_weaviate(sender, instance, **kwargs):
    """Sync user profile vector when they update their tags."""
    from services.weaviate.tasks import sync_user_profile
    sync_user_profile.delay(user_id=instance.user_id)
```

### 1.4 Knowledge Graph in Weaviate (Not Django)

Instead of a Django `ContentRelationship` model, store relationships as **Weaviate cross-references**:

```python
# In Weaviate schema, Content objects can reference each other
{
    'name': 'related_content',
    'dataType': ['Content'],  # Cross-reference to other Content objects
    'description': 'Related content (similar, prerequisite, etc.)',
}
```

This scales to millions of edges without PostgreSQL joins.

---

## Phase 2: AI Tagging Pipeline (Fully Agentic + Cost Optimized)

### 2.0 AI Gateway Cost Optimization

**FIRST: Add a new `purpose='tagging'` to AI Gateway** that routes to cheaper models.

**File**: `config/settings/base.py`

```python
AI_MODELS = {
    'openai': {
        'default': 'gpt-4o-mini',      # General use
        'reasoning': 'gpt-5-mini',      # Complex reasoning
        'tagging': 'gpt-3.5-turbo',     # NEW: Cheap model for bulk tagging
        'tagging_premium': 'gpt-4o-mini', # NEW: Better model for high-value content
    },
    # ... other providers
}
```

**File**: `services/ai/provider.py`

```python
# Update VALID_PURPOSES
VALID_PURPOSES = ('default', 'reasoning', 'image', 'vision', 'tagging', 'tagging_premium')
```

### 2.1 Tiered Tagging Strategy

**Cost breakdown at scale:**
| Tier | Model | Cost/1K tokens | When to use |
|------|-------|----------------|-------------|
| Bulk | gpt-3.5-turbo | $0.0005 | New imports, backfill |
| Premium | gpt-4o-mini | $0.00015 | High-engagement content, re-tagging |

**Tiering logic:**
- **Bulk (cheap)**: All new content on first import
- **Premium (better)**: Content that gets >10 likes or >100 views in first 24h

### 2.2 Tagging Service

**File**: `services/tagging/service.py` (new)

```python
from services.ai.provider import AIProvider

class AITaggingService:
    """
    Fully agentic AI-powered taxonomy extraction with cost optimization.

    NO HUMAN REVIEW: All tags are auto-applied.
    TIERED MODELS: Cheap for bulk, expensive for high-value.
    """

    def analyze_content(self, content, tier: str = 'bulk') -> TaggingResult:
        """
        Extract taxonomy tags using tiered AI models.

        Args:
            content: Project, Quiz, Tool, or MicroLesson instance
            tier: 'bulk' (cheap) or 'premium' (better quality)
        """
        purpose = 'tagging' if tier == 'bulk' else 'tagging_premium'
        ai = AIProvider()

        response = ai.complete(
            prompt=self._build_extraction_prompt(content),
            purpose=purpose,  # Routes to appropriate model
            temperature=0.2,  # Low temperature for consistency
            system_message=TAXONOMY_EXTRACTION_SYSTEM_PROMPT,
        )

        return self._parse_extraction_response(response)

    def apply_tags_to_weaviate(self, content, result: TaggingResult):
        """
        Update content's Weaviate object with extracted tags.

        Tags stored as arrays in Weaviate, not Django M2M.
        """
        from services.weaviate.client import get_weaviate_client

        client = get_weaviate_client()
        client.data_object.update(
            uuid=content.weaviate_uuid,
            class_name='Content',
            data_object={
                'tool_names': result.tool_names,
                'category_names': result.category_names,
                'topic_names': result.topic_names,
                'skill_names': result.skill_names,
                'difficulty': result.difficulty,
                'ai_confidence': result.avg_confidence,
            }
        )

        # Also update Django for persistence (optional, lightweight)
        content.ai_tag_metadata = result.to_json_metadata()
        content.save(update_fields=['ai_tag_metadata'])
```

### 2.3 Celery Tasks

**File**: `services/tagging/tasks.py` (new)

```python
@shared_task(rate_limit='30/m', queue='tagging')
def tag_content_task(content_registry_id: int):
    """Tag single content item with AI analysis."""
    pass

@shared_task(queue='tagging')
def batch_tag_content_task(content_ids: list[int]):
    """Tag multiple items in batch."""
    pass

@shared_task
def backfill_tags_task(content_type: str = None, limit: int = 500):
    """Backfill tags for existing content (run during off-peak)."""
    pass
```

### 2.4 Source Inheritance

Extend `ContentSource` model to support default tags:

**File**: `core/integrations/models.py` (modify)

```python
# Add to ContentSource
default_taxonomy_tags = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    related_name='default_for_sources',
)
```

When content is imported from a YouTube channel or RSS feed, it inherits the source's default tags with `confidence_score=0.9` and `source=inherited`.

---

## Phase 3: Unified Weaviate Collection

### 3.1 Schema

**File**: `services/weaviate/schema.py` (modify)

```python
CONTENT_COLLECTION = 'Content'  # Unified collection replacing separate Project/Quiz/Tool

def get_content_schema():
    return {
        'class': 'Content',
        'vectorizer': 'none',
        'properties': [
            {'name': 'registry_id', 'dataType': ['int'], 'indexFilterable': True},
            {'name': 'content_type', 'dataType': ['text'], 'indexFilterable': True},
            {'name': 'title', 'dataType': ['text'], 'indexSearchable': True},
            {'name': 'combined_text', 'dataType': ['text'], 'indexSearchable': True},
            {'name': 'tool_names', 'dataType': ['text[]'], 'indexFilterable': True},
            {'name': 'category_names', 'dataType': ['text[]'], 'indexFilterable': True},
            {'name': 'topic_names', 'dataType': ['text[]'], 'indexFilterable': True},
            {'name': 'difficulty', 'dataType': ['text'], 'indexFilterable': True},
            {'name': 'owner_id', 'dataType': ['int'], 'indexFilterable': True},
            {'name': 'engagement_velocity', 'dataType': ['number'], 'indexFilterable': True},
            {'name': 'is_public', 'dataType': ['boolean'], 'indexFilterable': True},
            {'name': 'created_at', 'dataType': ['date'], 'indexFilterable': True},
        ],
    }
```

### 3.2 Embedding Strategy

Generate embeddings from:
- Title (weighted 2x)
- Description
- Tag names (tools, topics, categories)
- Type-specific content (README for GitHub, transcript for video, questions for quiz)

---

## Phase 4: Unified Search Service

### 4.1 Search Service

**File**: `services/search/unified_search.py` (new)

```python
class UnifiedSearchService:
    """
    Multi-content-type search with hybrid matching.

    Scoring weights:
    - Semantic similarity (Weaviate): 35%
    - Taxonomy tag matching: 25%
    - Social graph signals: 20%
    - Collaborative filtering: 15%
    - Popularity/freshness: 5%
    """

    async def search(
        self,
        query: str,
        user_id: int | None = None,
        content_types: list[str] | None = None,
        taxonomy_ids: list[int] | None = None,
        difficulty: str | None = None,
        limit: int = 20,
    ) -> list[SearchResult]:
        """
        Unified search across all content types.

        1. Detect intent (which content types to search)
        2. Parallel fetch: Weaviate + tag boosts + social graph + collaborative
        3. Fuse scores with configurable weights
        4. Return ranked results
        """
        pass
```

### 4.2 Intent Router

**File**: `services/search/intent_router.py` (new)

```python
class IntentRouter:
    """
    Detect user intent to route to appropriate content types.

    Examples:
    - "quiz about RAG" → content_types=['quiz']
    - "tools for image generation" → content_types=['tool']
    - "learn about agents" → content_types=['project', 'quiz', 'micro_lesson']
    """

    INTENT_KEYWORDS = {
        'quiz': ['quiz', 'test', 'challenge'],
        'tool': ['tool', 'app', 'software'],
        'micro_lesson': ['lesson', 'learn', 'teach', 'explain'],
        'project': ['project', 'example', 'demo', 'showcase'],
    }

    @classmethod
    def detect_intent(cls, query: str) -> tuple[str, list[str]]:
        """Return (intent, content_types) based on query."""
        pass
```

---

## Phase 5: Ava Agent Integration

### 5.1 New Discovery Tool

**File**: `services/agents/discovery/tools.py` (modify)

```python
@tool
def unified_search(
    query: str,
    content_types: list[str] | None = None,
    difficulty: str | None = None,
    limit: int = 10,
    state: dict | None = None,
) -> dict:
    """
    Search across all content types: projects, quizzes, tools, lessons.

    Use when user wants to find content without specifying a type,
    or when searching across multiple types.

    Returns mixed results ranked by relevance to user.
    """
    pass

@tool
def get_related_content(
    content_id: str,
    content_type: str,
    relationship_types: list[str] | None = None,
    limit: int = 5,
) -> dict:
    """
    Get content related to a specific item via knowledge graph.

    Use after user engages with content to suggest "what's next".
    """
    pass
```

---

## Phase 6: Caching & Performance

### 6.1 Redis Cache Keys

**File**: `services/personalization/cache.py` (extend)

```python
CACHE_KEYS = {
    'user_embedding': 'user:embed:{user_id}',           # 5 min TTL
    'user_social_graph': 'user:social:{user_id}',       # 10 min TTL
    'user_taxonomy_prefs': 'user:taxprefs:{user_id}',   # 5 min TTL
    'collaborative_map': 'user:collab:{user_id}',       # 5 min TTL
}
```

### 6.2 Pre-computation Tasks

```python
@shared_task
def precompute_user_social_graph(user_id: int):
    """Compute followed users + similar users for fast lookup."""
    pass

@shared_task
def precompute_content_relationships():
    """Compute similar_to edges from Weaviate vector similarity."""
    pass

@shared_task
def compute_user_similarity_batch():
    """Update UserSimilarity table based on engagement overlap."""
    pass
```

---

## Implementation Order

### Phase 0: Entity Taxonomy Fields (PREREQUISITE - Do First)

**Phase 0A: User Model Fields**
1. Add personality (FK), learning_styles (M2M), roles (M2M), goals (M2M), interests (M2M), industries (M2M) to User model
2. Update UserSerializer to expose new fields
3. Update profile API endpoints
4. Create migration

**Phase 0B: Seed Taxonomy Data**
1. Verify all 16 taxonomy types have seed data
2. Run `seed_taxonomies` management command
3. Verify via admin or API

**Phase 0C: Content Model Fields**
1. Create `ContentMetadataMixin` in `core/taxonomy/mixins.py`
2. Apply mixin to Project, Quiz, SideQuest, MicroLesson
3. Data migration: Map existing `difficulty_level` CharField to `difficulty_taxonomy` FK
4. Update serializers to expose new fields

---

### Phase 1: AI Gateway + Weaviate Schema
1. Add `purpose='tagging'` and `purpose='tagging_premium'` to AI Gateway
2. Create unified `Content` Weaviate collection schema
3. Add `weaviate_uuid` field to Project, Tool, Quiz, MicroLesson models
4. Create basic Weaviate indexing task

### Phase 2: AI Tagging Service
1. Create `services/tagging/` package with `AITaggingService`
2. Implement tiered tagging (bulk vs premium)
3. Add Celery tasks for async tagging
4. Integrate with YouTube/RSS import pipelines

### Phase 3: Unified Search
1. Implement `UnifiedSearchService` that queries Weaviate only
2. Add `IntentRouter` for content type detection
3. Add user profile vectors to Weaviate for collaborative filtering
4. Implement Redis caching for user embeddings

### Phase 4: Ava Integration
1. Add `unified_search` tool to Ava agent
2. Add `get_related_content` tool using Weaviate cross-references
3. Performance testing at scale
4. Backfill existing content to Weaviate

---

## Critical Files to Modify

### Phase 0 (Entity Taxonomy Fields)

| File | Changes |
|------|---------|
| `core/users/models.py` | Add personality, learning_styles, roles, goals, interests, industries |
| `core/users/serializers.py` | Expose new taxonomy fields in API |
| `core/taxonomy/mixins.py` | **NEW**: ContentMetadataMixin |
| `core/projects/models.py` | Add mixin, migrate difficulty_level → difficulty_taxonomy |
| `core/quizzes/models.py` | Add mixin |
| `core/thrive_circle/models.py` | Add mixin to SideQuest |
| `core/concepts/models.py` | Add mixin to MicroLesson |
| `core/taxonomy/management/commands/seed_taxonomies.py` | Verify all types seeded |

### Phase 1-4 (AI Tagging & Weaviate)

| File | Changes |
|------|---------|
| `services/ai/provider.py` | Add `tagging` and `tagging_premium` to VALID_PURPOSES |
| `config/settings/base.py` | Add tagging models to AI_MODELS config |
| `core/integrations/models.py` | Add default_taxonomy_tags to ContentSource |
| `services/weaviate/schema.py` | Add Content collection schema |
| `services/weaviate/embeddings.py` | Add unified embedding generation |
| `services/agents/discovery/tools.py` | Add unified_search, get_related_content |
| `services/personalization/cache.py` | Add caching for social graph, taxonomy prefs |
| `config/celery.py` | Add tagging queue and scheduled tasks |

### New Files to Create

| File | Purpose |
|------|---------|
| `core/taxonomy/mixins.py` | ContentMetadataMixin for content models |
| `services/tagging/__init__.py` | Package init |
| `services/tagging/service.py` | AITaggingService |
| `services/tagging/tasks.py` | Celery tasks for tagging |
| `services/tagging/prompts.py` | AI extraction prompts |
| `services/search/__init__.py` | Package init |
| `services/search/unified_search.py` | UnifiedSearchService |
| `services/search/intent_router.py` | Query intent detection |

---

## Key Design Decisions (Updated for Scale)

1. **NO ContentRegistry Django model**: Removed to avoid GenericForeignKey performance issues at millions of records. Existing models (Project, Tool, Quiz) stay as-is.

2. **Weaviate-first discovery**: Weaviate is the primary query layer. PostgreSQL is source of truth for CRUD only. No Django ORM joins for search.

3. **Tags in Weaviate, not M2M**: Taxonomy tags stored as filterable arrays in Weaviate (`tool_names[]`, `topic_names[]`). Avoids millions of M2M join rows.

4. **Real-time collaborative filtering**: Use Weaviate `nearVector` with user profile vectors instead of pre-computed UserSimilarity table. Scales to 100K+ users without billions of rows.

5. **Tiered AI tagging**: Two tiers to control costs:
   - `purpose='tagging'` → cheap model (gpt-3.5-turbo) for bulk
   - `purpose='tagging_premium'` → better model for high-engagement content

6. **Knowledge graph in Weaviate**: Content relationships stored as Weaviate cross-references, not Django FK joins.

7. **Fully agentic**: No human review queues. AI tags auto-applied. System self-corrects via engagement feedback.

8. **Minimal Django changes**: Only add `weaviate_uuid` and `ai_tag_metadata` (JSONField) to content models.

9. **Manual edits override AI**: User taxonomy edits sync immediately to Weaviate and take precedence over AI-generated tags.
