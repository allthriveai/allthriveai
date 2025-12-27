# E2E Journey Test Issues Found

**Date**: 2025-12-26
**Test Suite**: Deep User Journey Tests
**Test Files**: `frontend/e2e/deep/journeys/*.spec.ts`

## Overview

The new journey E2E tests (Phase 1 of nightly test expansion) found 3 real bugs in the application. These tests validate complete user flows end-to-end rather than isolated features.

---

## Issue 1: Conversation Persistence Bug

**Severity**: Critical
**Component**: `core/agents/`
**Status**: ✅ FIXED (2025-12-26)

### Description

Ava home chat messages are NOT persisted to the database. The WebSocket chat system uses Redis cache for temporary conversation history but never saves messages to the `Conversation` and `Message` database models.

### Evidence

1. Test output shows: `Found 0 conversations` after sending multiple chat messages
2. Code comment in `core/agents/tasks.py:857`:
   ```python
   # Future: Store WebSocket messages in Message model for persistence
   ```
3. No `Conversation.objects.create` or `Message.objects.create` calls in the chat processing flow
4. `ConversationViewSet.get_queryset()` returns `Conversation.objects.filter(user=self.request.user)` but no records are created

### Impact

- Users lose conversation history on page refresh (after Redis cache expires)
- `/api/v1/me/conversations/` returns empty results even after active chat sessions
- No audit trail of user-AI interactions
- Conversation context lost between sessions

### Affected Code

- `core/agents/consumers.py` - ChatConsumer doesn't persist messages
- `core/agents/tasks.py` - `process_chat_message_task` uses cache, not DB
- `core/agents/views.py` - ConversationViewSet expects DB records that don't exist

### Suggested Fix

In `core/agents/tasks.py`, modify `process_chat_message_task` to:

1. Create or get `Conversation` record on first message:
   ```python
   from .models import Conversation, Message

   conversation, created = Conversation.objects.get_or_create(
       user_id=user_id,
       title=conversation_id,  # or extract meaningful title
       defaults={'context': {}}
   )
   ```

2. Save user message:
   ```python
   Message.objects.create(
       conversation=conversation,
       role='user',
       content=message
   )
   ```

3. Save assistant response after streaming completes:
   ```python
   Message.objects.create(
       conversation=conversation,
       role='assistant',
       content=full_response
   )
   ```

### Actual Fix Implemented

**Files Changed:**
- `core/agents/models.py` - Added `conversation_id`, `conversation_type` fields + user-scoped UniqueConstraint
- `core/agents/tasks.py` - Added `persist_conversation_message` Celery task, response accumulator in `_process_with_ava()`, persistence call in `_process_image_generation()`
- `core/agents/serializers.py` - Added new fields to `ConversationSerializer`
- `core/agents/views.py` - Added `annotate(message_count=Count('messages'))` to ViewSet

**Key Design Decisions:**
- **Async persistence**: Via Celery task after streaming completes (no latency impact)
- **User-scoped isolation**: UniqueConstraint on `(user, conversation_id)` for security
- **Selective persistence**: Only sidebar chats persisted; project chats skipped

**Tests Added:**
- `core/agents/tests/test_conversation_persistence.py` - 33 unit tests
- `core/agents/tests/test_e2e_issue_1_conversation_persistence.py` - 10 integration tests

**Migrations:**
- `0071_conversation_conversation_id_and_more.py`
- `0072_update_conversation_type_choices.py`
- `0073_fix_conversation_type_default.py`

---

## Issue 2: Database Connection Pool Exhaustion

**Severity**: High
**Component**: Database / Docker Configuration
**Status**: ✅ FIXED (2025-12-26)

### Description

PostgreSQL runs out of connections during E2E tests, causing 500 errors with message: `FATAL: sorry, too many clients already`

### Evidence

Test failure output:
```
OperationalError at /api/v1/auth/test-login/
connection failed: connection to server at "192.168.192.5", port 5432 failed:
FATAL: sorry, too many clients already
```

### Root Cause Analysis

1. **PostgreSQL default limit**: `max_connections = 100`
2. **Connection consumers in local dev**:
   - Web container (Django): ~10-20 connections per worker
   - Celery worker: ~10-20 connections
   - Celery beat: ~5 connections
   - Each E2E test worker: Creates new connections
3. **Playwright runs 4 parallel workers** for deep tests
4. **No connection pooling in DEBUG mode**: `dj_db_conn_pool` only enabled in production

### Configuration Analysis

`config/settings.py`:
```python
# Pool only used when DEBUG=False
if not DEBUG:
    DATABASES['default']['ENGINE'] = 'dj_db_conn_pool.backends.postgresql'
    DATABASES['default']['POOL_OPTIONS'] = {
        'POOL_SIZE': 25,
        'MAX_OVERFLOW': 25,
        ...
    }
```

`docker-compose.yml`:
```yaml
db:
  image: postgres:18.1-alpine
  # No max_connections override - uses default 100
```

### Suggested Fixes

**Option A: Increase PostgreSQL connections (Quick fix)**

In `docker-compose.yml`:
```yaml
db:
  image: postgres:18.1-alpine
  command: postgres -c max_connections=200
```

**Option B: Enable pooling for E2E tests**

Create environment variable for E2E that enables pooling:
```python
# In settings.py
E2E_MODE = config('E2E_MODE', default=False, cast=bool)
if not DEBUG or E2E_MODE:
    DATABASES['default']['ENGINE'] = 'dj_db_conn_pool.backends.postgresql'
```

**Option C: Reduce Playwright parallelism for deep tests**

In `playwright.config.ts`:
```typescript
projects: [
  {
    name: 'deep',
    testMatch: /e2e\/deep\/.*.spec.ts/,
    workers: 2,  // Reduce from 4
  }
]
```

**Recommended**: Implement Option A + Option C for local development.

### Actual Fix Implemented

Both Option A and Option C were implemented:

**Option A - Increased PostgreSQL max_connections:**

`docker-compose.yml`:
```yaml
db:
  image: postgres:18.1-alpine
  # Increase max_connections from default 100 to handle:
  # - Django web workers (~20 connections)
  # - Celery workers (~20 connections)
  # - Celery beat (~5 connections)
  # - E2E test workers (4 parallel × ~10 each)
  command: postgres -c max_connections=200
```

**Option C - Reduced Playwright workers for deep tests:**

`frontend/playwright.config.ts`:
```typescript
{
  name: 'deep',
  testMatch: '**/deep/**/*.spec.ts',
  workers: 2, // Reduced from default 4 to prevent DB connection exhaustion
  // ...
}
```

**Note**: After applying these changes, restart the database container:
```bash
docker compose down db && docker compose up -d db
```

---

## Issue 3: AI Routing / Intent Detection

**Severity**: Medium
**Component**: `core/agents/` and `services/agents/`
**Status**: ✅ FIXED (2025-12-26)

### Description

Some evidence suggests Ava may misroute certain query types. For example, learning questions might be treated as profile interest updates rather than being answered directly.

### Evidence

- Test logs showed unexpected response patterns for learning queries
- Response to "What is RAG in AI?" appeared to trigger profile update rather than educational response

### Root Cause Analysis

Investigation revealed three issues:

1. **System prompt encouraged profile questions during learning** - The `ask_profile_question` guidelines said to use it "during natural pauses in conversation" and "after 3+ messages of good conversation", which the LLM could interpret as valid during learning sessions.

2. **Learning question detection only applied to first message** - The `force_tool_choice` for `find_content` was only applied when the last message was a `HumanMessage`, meaning multi-turn learning conversations lost this safeguard.

3. **No learning context tracking** - The system had no way to detect that the user was in an active learning session (recent `find_content` or `create_learning_path` calls) to suppress profile questions.

### Actual Fix Implemented

**Files Changed:**
- `services/agents/ava/prompts.py` - Added explicit "When NOT to use" rules for `ask_profile_question()`
- `services/agents/ava/agent.py` - Added `_is_in_learning_context()` helper and dynamic system prompt hint

**Key Changes:**

1. **Updated system prompt guidelines** (prompts.py:83-89):
   ```python
   **When NOT to use:**
   - User is in learning mode (asking "what is", "explain", "how does", educational questions)
   - You just called find_content or create_learning_path (wait at least 3 more exchanges)
   - User is actively exploring content or learning paths
   ```

2. **Added learning context detection** (agent.py:745-764):
   - New `_is_in_learning_context()` function checks last 6 messages for learning tool calls
   - Detects: `find_content`, `create_learning_path`, `update_learner_profile`, `get_quiz_hint`

3. **Dynamic system prompt injection** (agent.py:814-824):
   - When learning context detected, injects: "User is in active learning mode. Do NOT call ask_profile_question()"
   - Logged for observability: `[AGENT_NODE] User is in learning context, suppressing profile questions`

**Why this works:**
- LLM now has explicit guidance NOT to use profile questions during learning
- System dynamically detects learning context and reinforces the constraint
- Multi-turn conversations maintain learning mode protection

---

## Test Files That Caught These Issues

| Test File | Issues Found |
|-----------|--------------|
| `ai-chat-flow.spec.ts` | Conversation persistence (0 conversations after chat) |
| `core-loop-retention.spec.ts` | Database connection exhaustion |
| `new-user-activation.spec.ts` | Database connection exhaustion |

---

## Recommendations

### Completed Actions ✅

1. ~~**Fix conversation persistence**~~ - ✅ Fixed with async Celery task
2. ~~**Increase PostgreSQL max_connections**~~ - ✅ Set to 200 in docker-compose.yml
3. ~~**Investigate AI routing**~~ - ✅ Fixed with learning context detection

### Follow-up Actions

1. Add database connection metrics to observability stack
2. Consider adding E2E tests for multi-turn learning conversations
3. Monitor logging for "[AGENT_NODE] User is in learning context" to validate fix

---

## Related Documentation

- Test expansion plan: `/docs/plans/nightly-e2e-expansion.md`
- Journey test helpers: `frontend/e2e/deep/journeys/journey-helpers.ts`
- AI quality assertions: `frontend/e2e/deep/ai-quality-assertions.ts`
