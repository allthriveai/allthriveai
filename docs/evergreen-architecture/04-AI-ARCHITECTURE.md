# AI Architecture

**Source of Truth** | **Last Updated**: 2025-11-29

This document defines the AI architecture for AllThrive AI, including LangGraph state machines, AI provider integrations, prompt engineering, and observability.

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
│  - Circuit breaker                                          │
│  - Rate limiting                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│               LangGraph Agent Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Auth Agent  │  │ Project Agent│  │  Chat Agent  │      │
│  │ (StateGraph) │  │ (StateGraph) │  │ (StateGraph) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                AI Provider Abstraction                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Azure OpenAI│  │   OpenAI    │  │  Anthropic  │         │
│  │   (GPT-4)   │  │  (GPT-4o)   │  │ (Claude 3.5)│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│               Observability & Tracking                       │
│  - LangSmith tracing                                        │
│  - Cost tracking (tokens, $)                                │
│  - Performance metrics                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## LangGraph Agents

### Agent Architecture

AllThrive AI uses **LangGraph** for building stateful, conversational AI agents. Each agent is a directed graph where:
- **Nodes** represent processing steps (functions)
- **Edges** define transitions between steps
- **State** is persisted in Redis for multi-turn conversations
- **Conditional edges** enable branching logic

### Key Agents

#### 1. Auth Agent

**Purpose**: Conversational onboarding for signup/login.

**Location**: `services/auth_agent/`

**State Schema**:
```python
class AuthState(TypedDict):
    messages: list[dict]  # Conversation history
    mode: str  # 'signup' or 'login'
    email: str
    username: str
    name: str
    password: str
    interests: list[str]
    user_exists: bool
    step: str  # Current step in the flow
    suggested_usernames: list[str]
```

**Flow Graph**:
```
welcome
   │
   ├─→ ask_email ─→ check_email ─┬─→ (exists) ─→ ask_password ─→ complete_login
   │                              │
   │                              └─→ (new) ─→ ask_username_suggest
   │                                           │
   │                                           ├─→ confirm_username ─→ ask_name
   │                                           │
   │                                           └─→ ask_username_custom ─→ confirm_username
   │
   └─→ ask_name ─→ ask_password ─→ ask_interests ─→ show_values ─→ ask_agreement ─→ complete_signup
```

**Key Nodes**:
- `welcome_node`: Initial greeting
- `ask_email_node`: Collect email
- `check_email_node`: Check if user exists in DB
- `ask_username_suggest_node`: AI-generated username suggestions
- `confirm_username_node`: Validate username availability
- `complete_signup_node`: Create user account, award points

**Persistence**: State saved to Redis with `thread_id` (conversation ID)

---

#### 2. Project Agent

**Purpose**: Guided project creation via conversational interface.

**Location**: `services/project_agent/`

**State Schema**:
```python
class ProjectState(TypedDict):
    messages: list[dict]
    title: str
    description: str
    type: str  # github_repo, figma_design, prompt, etc.
    is_showcase: bool
    step: str
    project_id: int | None
```

**Flow Graph**:
```
welcome
   │
   ├─→ process_title ─→ (wait for input)
   │
   ├─→ process_description ─→ (wait for input)
   │
   ├─→ process_type ─→ (wait for input)
   │
   ├─→ process_showcase ─→ (wait for confirmation)
   │
   └─→ create_project ─→ (create in DB, award points) ─→ END
```

**Key Features**:
- Real-time validation (e.g., title length, type enum)
- AI suggestions (e.g., "Based on your description, this sounds like a 'prompt' project")
- Interrupts for user corrections
- Automatic Thrive Circle point award (50 points)

---

#### 3. Chat Agent (General)

**Purpose**: General-purpose conversational AI for Q&A, help, etc.

**Location**: `core/agents/` (consumer + tasks)

**State Schema**:
```python
class ChatState(TypedDict):
    messages: list[dict]
    conversation_id: str
    user_id: int
    context: dict  # Optional context (e.g., project data)
```

**Flow**:
- User sends message via WebSocket
- Message queued to Celery
- LangGraph agent processes with streaming
- Responses streamed back via Redis Pub/Sub → WebSocket

**Features**:
- Streaming responses (token-by-token)
- Context-aware (can access user's projects, profile)
- Tool calling (future: search projects, create reminders, etc.)

---

### State Persistence

**Technology**: Redis + LangGraph Checkpointer

**Checkpointer**: `services/auth_agent/checkpointer.py`

```python
from langgraph.checkpoint.redis import RedisSaver

def get_checkpointer():
    redis_client = get_redis_connection('default')
    return RedisSaver(redis_client)
```

**Checkpoint Keys**:
- Format: `langgraph:checkpoint:{thread_id}:{checkpoint_id}`
- Thread ID = Conversation ID (UUID)
- Checkpoints store full state at each step

**Benefits**:
- Multi-turn conversations (state persists across requests)
- Resume interrupted conversations
- Rollback to previous states (undo)

---

## AI Provider Abstraction

### Unified API

**Service**: `services/ai_provider.py`

**Supported Providers**:
1. **Azure OpenAI** (primary)
2. **OpenAI** (fallback)
3. **Anthropic** (Claude)

**Usage**:
```python
from services.ai_provider import AIProvider

# Use default provider (from settings)
ai = AIProvider(user_id=request.user.id)
response = ai.complete("Explain transformers", temperature=0.7)

# Switch provider dynamically
ai.set_provider("anthropic")
response = ai.complete("Generate a haiku")

# Streaming
for chunk in ai.stream("Tell me a story"):
    print(chunk, end='')
```

---

### Configuration

**Environment Variables**:
```bash
# Azure OpenAI (primary)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# OpenAI (fallback)
OPENAI_API_KEY=...

# Anthropic (alternative)
ANTHROPIC_API_KEY=...

# Default provider
DEFAULT_AI_PROVIDER=azure  # or openai, anthropic
```

---

### Model Selection

**Default Models**:
- **Azure OpenAI**: `gpt-4` (deployment name)
- **OpenAI**: `gpt-4-turbo-preview`
- **Anthropic**: `claude-3-5-sonnet-20240620`

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

**Auth Agent System Prompt**:
```
You are a friendly onboarding AI agent for AllThrive AI, a community platform
for AI creators. Your role is to guide users through signup or login in a 
conversational, helpful manner.

Guidelines:
- Be concise and friendly
- Validate input (e.g., email format, username availability)
- Suggest creative usernames based on user's name
- Explain Thrive Circles and achievements during signup
- Never store passwords in state (only password hashes)
```

**Project Agent System Prompt**:
```
You are an AI assistant helping users create projects on AllThrive AI.
Ask clarifying questions to collect:
1. Title (required, max 100 chars)
2. Description (required, what the project does)
3. Type (github_repo, figma_design, image_collection, prompt, video, other)
4. Showcase preference (public or private)

Be encouraging and suggest improvements to titles/descriptions.
```

**Chat Agent System Prompt**:
```
You are AllThrive AI, an AI assistant for a community of AI creators.
You help users:
- Learn about AI tools and techniques
- Get feedback on projects
- Discover new ideas
- Navigate the platform

Be helpful, technical when needed, and encouraging.
```

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
    provider = CharField()  # azure, openai, anthropic
    model = CharField()  # gpt-4, claude-3-5-sonnet, etc.
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

## Vector Search (Future)

**Technology**: RedisVL (Redis Vector Library)

**Use Cases**:
- Semantic project search
- Tool recommendations
- Similar projects
- RAG (Retrieval-Augmented Generation) for chat

**Schema** (planned):
```python
from redisvl.schema import IndexSchema

schema = IndexSchema.from_dict({
    "index": {
        "name": "projects",
        "prefix": "project:",
    },
    "fields": [
        {"name": "title", "type": "text"},
        {"name": "description", "type": "text"},
        {"name": "embedding", "type": "vector", "dims": 1536, "algorithm": "HNSW"}
    ]
})
```

**Embedding**:
```python
from openai import OpenAI

client = OpenAI()
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=project.description
)
embedding = response.data[0].embedding
```

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

## Future Enhancements

### Planned Features

1. **Multi-agent orchestration**: Agent coordination (e.g., auth agent → project agent)
2. **Tool calling**: LangChain tools for search, calculations, API calls
3. **RAG (Retrieval-Augmented Generation)**: Context from docs, projects
4. **Voice interface**: Speech-to-text → AI → text-to-speech
5. **Custom models**: Fine-tuned models for AllThrive-specific tasks
6. **Agent marketplace**: User-created AI agents

### Research Areas

1. **Prompt optimization**: Automated prompt tuning
2. **Multi-modal AI**: Image analysis, generation
3. **Reinforcement learning**: Agents learn from user feedback
4. **Privacy-preserving AI**: Local models, federated learning

---

**Version**: 1.0  
**Status**: Stable  
**Review Cadence**: Quarterly
