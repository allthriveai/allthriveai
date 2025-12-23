# AI Architecture

**Source of Truth** | **Last Updated**: 2025-12-20

This document defines the AI architecture for AllThrive AI, including the unified Ember agent, AI provider integrations, tool system, and observability.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interaction Layer                   │
│  (WebSocket/HTTP) ← Frontend → Django Views                 │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Celery Task Queue                          │
│  - Async processing                                         │
│  - Circuit breaker + Rate limiting                          │
│  - AIUsageTracker (quota management)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│            Unified Ember Agent (LangGraph)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  services/agents/ember/                               │  │
│  │  - agent.py: LangGraph StateGraph + streaming         │  │
│  │  - prompts.py: System prompts + learner context       │  │
│  │  - tools.py: Unified registry (31 tools)              │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐   │
│  │  Tool Categories (5):                                │   │
│  │  - Discovery (9): Search, recommendations, challenges│   │
│  │  - Learning (3): Content, paths, profile updates     │   │
│  │  - Project (9): Create, import, media handling       │   │
│  │  - Orchestration (7): Navigation, UI, games          │   │
│  │  - Profile (3): Data gathering, section generation   │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                AI Provider Abstraction                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   OpenAI    │  │  Anthropic  │  │   Gemini    │         │
│  │ (gpt-4o-mini│  │(Claude 3.5) │  │(2.0 Flash)  │         │
│  │   default)  │  │             │  │ Image Gen   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│               Observability & Tracking                       │
│  - LangSmith tracing                                        │
│  - AIUsageLog per-request tracking                          │
│  - Quota management (daily/monthly limits)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Unified Ember Agent

### Agent Architecture

AllThrive AI uses a **single unified Ember agent** built on LangGraph. The agent has access to ~25 tools across 4 categories and handles all chat interactions.

**Key Characteristics**:
- **Single agent**: No supervisor routing - one agent handles all requests
- **Tool-based**: Tools organized into discovery/learning (consolidated), project, orchestration, and profile categories
- **State injection**: Tools receive user context (user_id, username, session_id) automatically
- **Streaming**: Token-by-token streaming via Redis Pub/Sub → WebSocket
- **Learner context**: Learning-related context injected at conversation start via `LearnerContextService`

### Location

```
services/agents/ember/
├── agent.py           # LangGraph StateGraph + streaming + state injection
├── prompts.py         # System prompts with learner context building
└── tools.py           # Unified tool registry (imports from all categories)

services/agents/
├── discovery/
│   ├── find_content.py  # Unified discovery tool (replaces 7 overlapping tools)
│   └── tools.py         # Challenge and community tools
├── learning/
│   ├── tools.py         # Learning path and profile tools
│   └── components/
│       └── content_finder.py  # Content aggregation component
├── project/tools.py     # 10+ project tools (create, import, media)
├── orchestration/tools.py # 7 orchestration tools
└── profile/tools.py     # 3 profile tools
```

### State Schema

```python
class EmberState(TypedDict):
    messages: Annotated[list, add_messages]  # Conversation history
    user_id: int
    username: str
    session_id: str
    context: dict  # Page context, attachments, etc.
```

### Agent Graph

```
START
   │
   ▼
┌─────────────┐     ┌──────────────┐
│  LLM Node   │────▶│  Tool Node   │
│ (gpt-4o-mini│◀────│ (31 tools)   │
│  + tools)   │     └──────────────┘
└─────────────┘
   │
   ▼ (no more tool calls)
  END
```

### Tool Categories (~25 total, consolidated)

| Category | Count | Purpose |
|----------|-------|---------|
| Discovery + Learning | 5 | Unified `find_content` (replaces 7 overlapping tools), learning paths, profile updates, challenges, connections |
| Project | 10+ | Create projects, import from URLs/GitHub, media handling, architecture diagrams |
| Orchestration | 7 | Navigation, UI highlighting, toasts, inline games, fun activities |
| Profile | 3 | Gather user data, generate/save profile sections |

**Tool Consolidation** (12 → 5 discovery/learning tools):

| New Unified Tool | Replaces | Description |
|------------------|----------|-------------|
| `find_content` | `search_projects`, `get_recommendations`, `find_similar_projects`, `get_trending_projects`, `unified_search`, `get_related_content`, `find_learning_content` | One hyper-personalized tool for all content discovery with Weaviate hybrid search |
| `create_learning_path` | - | Generate structured curriculum |
| `update_learner_profile` | - | Save preferences/interests/skills |
| `get_current_challenge` | - | Weekly challenge info |
| `find_people_to_connect` | - | Community connections |

*See `services/agents/ember/tools.py` for the unified registry.*

### State Injection

Tools that need user context receive a `state` dict with:
- `user_id`: Authenticated user's database ID
- `username`: User's username
- `session_id`: WebSocket session ID

Handled by `create_tool_node_with_state_injection()` in `ember/agent.py`.

### Scalability Settings

| Setting | Value | Location |
|---------|-------|----------|
| `EMBER_MAX_TOOL_ITERATIONS` | 10 | Django settings |
| `EMBER_MAX_CONTEXT_MESSAGES` | 50 | Django settings |
| `EMBER_TOOL_EXECUTION_TIMEOUT` | 30s | Django settings |
| `EMBER_DEFAULT_MODEL` | gpt-4o-mini | AI gateway config |

---

### State Persistence

**Technology**: Redis + LangGraph Checkpointer

**Checkpointer**: `services/agents/auth/checkpointer.py`

```python
from langgraph.checkpoint.redis import RedisSaver

def get_checkpointer():
    redis_client = get_redis_connection('default')
    return RedisSaver(redis_client)
```

**Checkpoint Keys**:
- Format: `langgraph:checkpoint:{thread_id}:{checkpoint_id}`
- Thread ID = Conversation ID (e.g., `ember-home-{timestamp}`)
- Checkpoints store full state at each step

**Conversation ID Patterns**:
- `ember-home-{timestamp}` - EmberHomePage full-page chat
- `ember-learn-{timestamp}` - Learn page context
- `ember-explore-{timestamp}` - Explore page context
- `ember-project-{timestamp}` - Project page context
- `ember-default-{timestamp}` - Default context

**Benefits**:
- Multi-turn conversations (state persists across requests)
- Resume interrupted conversations
- Rollback to previous states (undo)

---

## AI Provider Abstraction

### Provider Overview

| Provider | Use Case | Default Model |
|----------|----------|---------------|
| **OpenAI** | Chat (Ember agent) | `gpt-4o-mini` |
| **Gemini** | Image generation (Nano Banana) | `gemini-2.0-flash-exp` |
| **Anthropic** | Alternative (not currently used) | `claude-3-5-sonnet` |

### Unified API

**Service**: `services/ai_provider.py`

**Usage**:
```python
from services.ai_provider import AIProvider

# Use default provider (OpenAI)
ai = AIProvider(user_id=request.user.id)
response = ai.complete("Explain transformers", temperature=0.7)

# Switch provider dynamically
ai.set_provider("anthropic")
response = ai.complete("Generate a haiku")

# Streaming
for chunk in ai.stream("Tell me a story"):
    print(chunk, end='')
```

### Gemini Image Generation (Nano Banana)

**Purpose**: AI image generation directly in chat using Gemini 2.0 Flash.

**Trigger Keywords**: "draw", "create image", "generate image", "make art", "infographic", "nano banana"

**Flow**:
1. User requests image in chat
2. Orchestrator detects image keywords
3. Routes to `_process_with_gemini_image()`
4. Gemini 2.0 Flash generates image
5. Image saved to S3, URL streamed back

**Service**: `services/ai/gemini_service.py`

```python
from services.ai.gemini_service import generate_image_with_gemini

result = await generate_image_with_gemini(
    prompt="A dragon made of code",
    user_id=user.id,
    session_id=session_id
)
# Returns: {'image_url': 'https://...', 'filename': '...'}
```

---

### Configuration

**Environment Variables**:
```bash
# OpenAI (primary for chat)
OPENAI_API_KEY=...

# Google Gemini (image generation)
GOOGLE_API_KEY=...
GEMINI_MODEL_NAME=gemini-2.0-flash-exp

# Anthropic (alternative)
ANTHROPIC_API_KEY=...

# Default provider
DEFAULT_AI_PROVIDER=openai
```

---

### Model Selection

**Default Models**:
- **OpenAI**: `gpt-4o-mini` (Ember chat agent)
- **Gemini**: `gemini-2.0-flash-exp` (image generation)
- **Anthropic**: `claude-3-5-sonnet-20240620` (alternative)

**Model Override**:
```python
ai.complete("...", model="gpt-4o")  # Specific model
```

---

### Token Tracking

**Per-Request Tracking**:
```python
response = ai.complete("...")
print(ai.last_usage)
# {
#   'prompt_tokens': 45,
#   'completion_tokens': 120,
#   'total_tokens': 165
# }
```

**Database Tracking**: Stored in `AIUsageLog` model (future)

---

## Prompt Engineering

### System Prompts

**Ember System Prompt** (`services/agents/ember/prompts.py`):

The Ember agent uses a dynamic system prompt that includes:

1. **Base personality**: Friendly AI companion named Ember
2. **Tool instructions**: When and how to use each of the 31 tools
3. **Learner context**: Injected at runtime via `LearnerContextService`

```python
# Simplified structure
EMBER_SYSTEM_PROMPT = """
You are Ember, a friendly AI companion on AllThrive AI.

You help users:
- Discover projects, tools, and content
- Learn about AI through games, quizzes, and content
- Create and import projects
- Navigate the platform
- Build their profiles

## Tool Usage
- Use `find_learning_content` when users want to learn about topics
- Use `launch_inline_game` for "what is a context window?" → snake game
- Use `navigate_to_page` when users say "take me to..."
- Use `get_fun_activities` when users say "surprise me" or "I'm bored"
...

{learner_context}  # Injected at runtime
"""
```

### Learner Context Injection

**Service**: `services/agents/learning/context.py` → `LearnerContextService`

At conversation start, learner context is fetched and injected:

```python
learner_context = LearnerContextService.get_context_for_prompt(user_id)
# Returns:
# - Learning profile (style, preferred difficulty)
# - Recent activity (quizzes completed, streaks)
# - Skill levels and interests
# - Personalized suggestions
```

This eliminates the need for tools like `get_learner_profile` or `get_learning_progress` - the context is already in the system prompt.

---

### Prompt Templates

**Username Suggestion Prompt**:
```python
template = f"""
Generate 3 creative, memorable usernames based on this name: {name}

Requirements:
- 3-20 characters
- Lowercase letters, numbers, hyphens, underscores only
- No offensive words
- Tech/AI themed if possible

Return as JSON: ["username1", "username2", "username3"]
"""
```

**Project Type Detection**:
```python
template = f"""
Based on this project description, what type is it most likely to be?

Description: {description}

Types:
- github_repo: Code repository
- figma_design: Design mockup
- image_collection: AI-generated images
- prompt: Prompt engineering example
- video: Video tutorial/demo
- other: Something else

Return only the type name.
"""
```

---

## Streaming Responses

### Architecture

1. **Client** sends message via WebSocket
2. **Server** queues task to Celery
3. **Celery worker** streams AI response
4. **Redis Pub/Sub** broadcasts chunks to WebSocket group
5. **WebSocket** sends chunks to client

### Implementation

**WebSocket Consumer** (`core/agents/consumers.py`):
```python
async def receive(self, text_data: str):
    data = json.loads(text_data)
    message = data.get('message')
    
    # Queue to Celery
    task = process_chat_message_task.delay(
        conversation_id=self.conversation_id,
        message=message,
        user_id=self.user.id,
        channel_name=self.group_name
    )
```

**Celery Task** (`core/agents/tasks.py`):
```python
@app.task
def process_chat_message_task(conversation_id, message, user_id, channel_name):
    ai = AIProvider(user_id=user_id)
    
    for chunk in ai.stream(message):
        # Broadcast to WebSocket group via Redis
        channel_layer.group_send(
            channel_name,
            {
                'type': 'chat_message',
                'event': 'stream_chunk',
                'content': chunk,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
```

---

## Observability & Monitoring

### LangSmith Integration

**Purpose**: Trace AI requests, debug prompts, analyze performance.

**Configuration**:
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=allthrive-ai-prod
```

**Decorator**:
```python
from langsmith.run_helpers import traceable

@traceable(name='ai_provider_complete', run_type='llm')
def complete(self, prompt, **kwargs):
    # Automatically traced to LangSmith
    pass
```

**Features**:
- Full request/response logging
- Token usage per request
- Latency tracking
- Error tracking
- Prompt versioning

**Dashboard**: https://smith.langchain.com/

---

### Cost Tracking

**Per-User Tracking**:
```python
class AIUsageLog(models.Model):
    user = ForeignKey(User)
    provider = CharField()  # azure, openai, anthropic, gemini
    model = CharField()  # gpt-4, claude-3-5-sonnet, gemini-1.5-flash, etc.
    prompt_tokens = IntegerField()
    completion_tokens = IntegerField()
    total_tokens = IntegerField()
    estimated_cost = DecimalField()  # USD
    endpoint = CharField()  # auth_chat, project_chat, etc.
    created_at = DateTimeField(auto_now_add=True)
```

**Cost Calculation**:
```python
# GPT-4 pricing (example)
COST_PER_1K_INPUT = 0.03
COST_PER_1K_OUTPUT = 0.06

cost = (
    (prompt_tokens / 1000) * COST_PER_1K_INPUT +
    (completion_tokens / 1000) * COST_PER_1K_OUTPUT
)
```

**Analytics Endpoints**:
- `GET /api/v1/ai/analytics/user/` - User's AI usage
- `GET /api/v1/ai/analytics/system/` - System-wide analytics (admin)
- `POST /api/v1/ai/analytics/user/<id>/reset/` - Reset user spend (admin)

---

### Performance Metrics

**Tracked Metrics**:
- **Latency**: Time to first token (TTFT), total response time
- **Throughput**: Tokens per second
- **Availability**: Circuit breaker success rate
- **Errors**: Rate limit hits, API failures
- **Cost**: Total spend per user/system

**Prometheus Metrics**:
```python
from prometheus_client import Counter, Histogram

ai_requests = Counter('ai_requests_total', 'AI requests', ['provider', 'model'])
ai_latency = Histogram('ai_latency_seconds', 'AI latency', ['provider'])
ai_tokens = Counter('ai_tokens_total', 'AI tokens', ['provider', 'type'])
```

---

## Rate Limiting & Safety

### Circuit Breaker

**Purpose**: Prevent cascading failures when AI provider is down.

**Implementation**: `core/agents/circuit_breaker.py`

**States**:
1. **Closed**: Normal operation
2. **Open**: Too many failures, block requests
3. **Half-Open**: Test if service recovered

**Configuration**:
```python
CIRCUIT_BREAKER_CONFIG = {
    'failure_threshold': 5,  # Open after 5 failures
    'timeout': 60,  # Retry after 60s
    'expected_exception': (OpenAIError, AnthropicError)
}
```

---

### Rate Limiting

**Per-User Limits**:
- **WebSocket messages**: 20 messages/minute
- **Auth chat**: 10 requests/hour
- **Project chat**: 20 requests/hour
- **General chat**: 50 messages/hour

**Implementation**: `core/agents/security.py`

**Redis Keys**:
```
rate_limit:user:{user_id}:websocket_message:{timestamp}
rate_limit:user:{user_id}:auth_chat:{timestamp}
```

**Response** (rate limited):
```json
{
  "event": "error",
  "error": "Rate limit exceeded. Try again in 5 minutes.",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

### Content Moderation

**Service**: `services/moderation/moderator.py`

**Checks**:
1. **Profanity filter** (basic)
2. **OpenAI Moderation API** (optional)
3. **Keyword blocklist**

**Usage**:
```python
from services.moderation import Moderator

moderator = Moderator()
result = moderator.check(user_input)

if not result.is_safe:
    return {"error": "Content violates policy"}
```

---

## Vector Search (Implemented)

**Technology**: Weaviate (self-hosted) with OpenAI embeddings

**Use Cases** (all implemented):
- Semantic project search via `find_content` tool
- Personalized recommendations
- Similar projects ("more like this")
- Tool and content discovery

**Hybrid Search**:
```python
from services.weaviate import get_weaviate_client, get_embedding_service

client = get_weaviate_client()
embedding_service = get_embedding_service()

# Generate query embedding
query_vector = embedding_service.generate_embedding("RAG systems")

# Hybrid search: 70% keyword, 30% semantic
results = client.hybrid_search(
    collection='Project',
    query='RAG systems',
    vector=query_vector,
    alpha=0.3,  # Favors robust tagging system
    limit=10,
    enforce_visibility=True,  # Only public, non-archived
)
```

*See `17-VECTOR-SEARCH.md` for complete Weaviate architecture.*

---

## Error Handling

### Error Types

| Error | Cause | Mitigation |
|-------|-------|------------|
| `RateLimitError` | API rate limit hit | Circuit breaker, retry with backoff |
| `APIConnectionError` | Network failure | Retry with exponential backoff |
| `InvalidRequestError` | Bad prompt/params | Validation before API call |
| `AuthenticationError` | Invalid API key | Alert ops, check credentials |
| `TimeoutError` | Slow response | Timeout after 30s, retry |

### Error Response

**WebSocket**:
```json
{
  "event": "error",
  "error": "AI service temporarily unavailable",
  "code": "service_unavailable",
  "retry_after": 60
}
```

**HTTP**:
```json
{
  "error": "AI request failed",
  "details": "Rate limit exceeded",
  "code": "rate_limit_error",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

## Security Considerations

### API Key Management

- Store in environment variables (never in code)
- Rotate keys quarterly
- Use separate keys for dev/staging/prod
- Monitor for leaked keys (GitHub, public repos)

### Input Validation

- Sanitize user input before passing to AI
- Limit input length (e.g., max 5000 chars)
- Block injection attempts (e.g., "Ignore previous instructions...")
- Content moderation for harmful content

### Output Validation

- Never execute AI-generated code directly
- Sanitize markdown/HTML in responses
- Validate URLs before displaying
- Rate limit response length (max 10,000 tokens)

---

## Best Practices

### Prompt Engineering

1. **Be specific**: Clear instructions yield better results
2. **Use examples**: Few-shot prompts improve accuracy
3. **System prompts**: Set behavior/personality upfront
4. **Temperature tuning**:
   - 0.0-0.3: Deterministic (facts, validation)
   - 0.5-0.7: Balanced (chat, suggestions)
   - 0.8-1.0: Creative (brainstorming, jokes)

### Token Optimization

1. **Truncate context**: Only send relevant history (last 10 messages)
2. **Compress prompts**: Remove unnecessary words
3. **Use cheaper models**: GPT-3.5 for simple tasks
4. **Cache responses**: Redis for repeated queries

### Performance

1. **Streaming**: Always stream for better UX
2. **Async processing**: Use Celery for long-running tasks
3. **Timeouts**: Set reasonable timeouts (30s)
4. **Fallbacks**: Gracefully degrade if AI unavailable

---

## Testing

### Unit Tests

**Mock AI Provider**:
```python
from unittest.mock import Mock, patch

@patch('services.ai_provider.AIProvider')
def test_auth_agent(mock_ai):
    mock_ai.return_value.complete.return_value = "alice123"
    
    # Test username suggestion
    result = auth_graph.invoke(state)
    assert result['suggested_usernames'] == ["alice123"]
```

### Integration Tests

**Test with Real API** (dev environment):
```python
def test_auth_agent_integration():
    ai = AIProvider(provider='openai')
    result = ai.complete("Generate a username for Alice")
    assert len(result) > 0
```

### Load Tests

**Locust** (`load_testing/locustfile.py`):
```python
class ChatLoadTest(HttpUser):
    @task
    def send_message(self):
        self.client.post('/api/v1/me/conversations/',
            json={'message': 'Hello, AI!'})
```

---

## Implemented Features (Previously Planned)

The following features from the original roadmap are now implemented:

| Feature | Status | Implementation |
|---------|--------|----------------|
| Tool calling | ✅ Implemented | ~25 LangChain tools across 4 categories (consolidated from 31) |
| Multi-modal AI | ✅ Implemented | Gemini 2.0 Flash image generation (Nano Banana) |
| Vector Search | ✅ Implemented | Weaviate hybrid search (alpha=0.3) with OpenAI embeddings |
| Personalization | ✅ Implemented | Difficulty matching, learning style preferences, tool interests |
| RAG | ✅ Implemented | Full project/content embedding with hybrid search in `find_content` |

## Future Enhancements

### Planned Features

1. **Voice interface**: Speech-to-text → AI → text-to-speech
2. **Custom models**: Fine-tuned models for AllThrive-specific tasks
3. **Agent marketplace**: User-created AI agents
4. **Enhanced collaborative filtering**: Cross-user recommendations based on similar profiles

### Research Areas

1. **Prompt optimization**: Automated prompt tuning with evaluation
2. **Reinforcement learning**: Agents learn from user feedback
3. **Privacy-preserving AI**: Local models for sensitive data

---

**Version**: 2.0
**Status**: Stable
**Review Cadence**: Quarterly
