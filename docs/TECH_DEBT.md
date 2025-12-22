# Technical Debt Tracking

Last Updated: 2025-12-21

This document tracks technical debt items identified during code review of the `new-onboarding-and-feelings-not-features` branch.

## Completed in This Review

### Backend Silent Errors - Fixed
- [x] `core/community/consumers.py` - Added debug logging to 3 `except Message.DoesNotExist: pass` blocks
- [x] `core/avatars/tasks.py` - Added `exc_info=True` to 4 warning/error logs for stack traces
- [x] `services/agents/context/member_context.py` - Added debug logging to silent exceptions
- [x] `services/agents/discovery/find_content.py` - Added logging to generic exception handler

### Frontend Cleanup - Fixed
- [x] `LearningContentMessage.tsx` - Removed debug console.log statements
- [x] `LearningContentMessage.tsx` - Removed dead `useCompactGrid` code (always true conditional)
- [x] `useIntelligentChat.ts` - Removed 10+ console.log debug statements

### New Utilities Created
- [x] `frontend/src/utils/errors.ts` - Type-safe error handling utilities

### Type Safety Fixes - Fixed
- [x] `useIntegrationFlow.ts` - Fixed 3 `catch (error: any)` blocks using `getErrorMessage()`
- [x] `IntegrationsSettingsPage.tsx` - Fixed 11 `catch (error: any)` blocks using `getErrorMessage()`
- [x] `PrivacySettingsPage.tsx` - Fixed 2 `catch (error: any)` blocks using `getErrorMessage()`
- [x] `ReferralsPage.tsx` - Fixed 1 `catch (error: any)` block using `getErrorMessage()`
- [x] `SocialSettingsPage.tsx` - Fixed 1 `catch (error: any)` block using `getErrorMessage()`

### React Hook Dependencies - Fixed
- [x] `DashboardLayout.tsx` - Fixed 3 useEffect hooks missing `handleOpenAddProject` dependency

### Test Coverage Added
- [x] `services/agents/ember/tests/test_agent.py` - Tests for Ember agent utilities (error handling, serialization, locking, truncation)
- [x] `core/community/tests/test_consumers.py` - WebSocket consumer tests (connection, auth, messaging, DM)
- [x] `core/learning_paths/tests/test_api.py` - API endpoint tests for learning paths

---

## Deferred - Community Features (TODOs in Code)

These features are stubbed but not implemented. They should be completed in a follow-up PR.

### 1. Unread Message Count
**Location:** `core/community/serializers.py`
```python
def get_unread_count(self, obj):
    # TODO: Implement unread count based on last_read_at
```
**Priority:** Medium
**Effort:** 2-3 hours
**Description:** Calculate unread message count by comparing `last_read_at` timestamp with message creation times.

### 2. Trust Calculation System
**Location:** `core/community/consumers.py`
```python
# TODO: Implement proper trust calculation based on user activity
```
**Priority:** Low
**Effort:** 4-6 hours
**Description:** Build a trust score system based on:
- Account age
- Message count
- Reactions received
- Report history

### 3. XP Awards for Content Creators
**Location:** `core/community/consumers.py`
```python
# TODO: Implement XP award to creator
```
**Priority:** Medium
**Effort:** 2-3 hours
**Description:** When users react positively to messages, award XP to the message author.

### 4. OpenAI Moderation API Integration
**Location:** `core/community/consumers.py`
```python
# TODO: Integrate with OpenAI Moderation API
```
**Priority:** High (for production safety)
**Effort:** 4-6 hours
**Description:** Add content moderation using OpenAI's moderation endpoint before messages are saved.

---

## Deferred - Type Safety (Frontend)

### Remaining `as any` Casts
| File | Lines | Fix |
|------|-------|-----|
| `VideoProjectLayout.tsx` | ~19515 | Replace `as any` with proper interface |

---

## Deferred - Test Coverage

These new modules have no tests and should have coverage added:

| Module | Lines | Priority |
|--------|-------|----------|
| `services/agents/ember/agent.py` | 1,064 | High |
| `core/community/` | 711 | Medium |
| `core/avatars/` | 666 | Medium |
| `core/learning_paths/views.py` (new endpoints) | ~500 | Medium |

### Suggested Test Files to Create
- `services/agents/ember/tests/test_agent.py`
- `core/community/tests/test_consumers.py`
- `core/learning_paths/tests/test_api.py`

---

## Deferred - Backend Type Hints

### Missing Return Type Hints
**Location:** `core/agents/security.py`

Methods that need type hints:
- `_skip_rate_limit()` → `bool`
- `check_websocket_connection_limit()` → `tuple[bool, str]`
- `increment_websocket_connection()` → `None`
- `decrement_websocket_connection()` → `None`
- `check_connection_rate_limit()` → `tuple[bool, int]`
- `validate_message_size()` → `tuple[bool, str]`

---

## Deferred - Memory/Hook Fixes

### WebSocket Cleanup
**Location:** `useIntelligentChat.ts`

The cleanup function exists but could be improved:
```typescript
// Current: WebSocket closed on unmount via intentionalCloseRef
// Consider: More explicit cleanup with removeEventListener
```

### Hook Dependency Audits
Files that may have incomplete dependency arrays:
- `useIntelligentChat.ts:1062` - Consider adding `conversationId` to some deps
- `DashboardLayout.tsx:~256` - Audit `handleMenuClick` dependencies

---

---

## Ember Agent Critical Issues (Added 2024-12-21)

These issues were discovered during investigation of chat getting "stuck" with multiple messages.

### FIXED: Distributed Lock Mismatch
**Location:** `services/agents/ember/agent.py:112-185`
**Severity:** Critical
**Status:** ✅ Fixed

**Problem:** Lock acquire used Django cache (`cache.add()`) which serializes values, but release used raw Redis (`redis_client.eval()`) expecting plain strings. Values never matched, so locks expired after 120s instead of being released.

**Fix Applied:** Changed acquire to use raw Redis client (`redis_client.set(nx=True, ex=timeout)`) for consistency with release.

---

### REVIEWED: Database Connection Pool Leak in Checkpointer
**Location:** `services/agents/auth/checkpointer.py`
**Severity:** Critical
**Status:** ✅ Reviewed - Already Handled

**Problem:** The checkpointer creates an `AsyncPostgresSaver` for LangGraph checkpointing.

**Resolution:** Code review confirmed the `_get_checkpointer()` context manager in `services/agents/auth/checkpointer.py` already properly closes the connection pool in the `finally` block. No fix needed.

---

### FIXED: Blocking Synchronous Database Calls in Async Context
**Location:** `services/agents/context/member_context.py`
**Severity:** Critical
**Status:** ✅ Fixed

**Problem:** Synchronous ORM calls inside async functions block the event loop.

**Fix Applied:** Changed `_aggregate_context_async()` to use `sync_to_async(thread_sensitive=False)`:
```python
async def _aggregate_context_async(cls, user_id: int) -> MemberContext:
    from asgiref.sync import sync_to_async
    # thread_sensitive=False allows parallel execution in thread pool
    return await sync_to_async(cls._aggregate_context, thread_sensitive=False)(user_id)
```

---

### REVIEWED: Redis Connection Not Returned to Pool
**Location:** `services/agents/ember/agent.py:140-145`
**Severity:** High
**Status:** ✅ Reviewed - Not an Issue

**Problem:** Concern that `cache._cache.get_client()` may not return connection to pool.

**Resolution:** Code review confirmed this is not a leak. The redis-py library uses connection pooling where connections are automatically borrowed for each command and returned after completion. The `redis_client` object is a client wrapper, not a raw connection.

---

### REVIEWED: Tool Timeout Doesn't Propagate
**Location:** `services/agents/ember/agent.py:858-891`
**Severity:** High
**Status:** ✅ Reviewed - Acceptable Risk

**Problem:** When a tool times out via `asyncio.wait_for()`, the underlying thread from `run_in_executor()` continues running.

**Resolution:** This is a Python limitation - threads cannot be forcefully cancelled. The current implementation is acceptable because:
1. Tools have their own internal timeouts for network calls
2. Thread pool size is limited (Python default: `5 * cpu_count`)
3. The timeout protects the event loop from waiting forever
4. Tools eventually complete even if the await timed out

---

### FIXED: Lock Value Collision Risk
**Location:** `services/agents/ember/agent.py:131`
**Severity:** High
**Status:** ✅ Fixed

**Problem:** Lock value uses `id(asyncio.current_task())` which is a memory address that can be reused after task completion.

**Fix Applied:** Now uses `uuid.uuid4()` for guaranteed uniqueness.

---

### FIXED: Member Context Cache Race Condition
**Location:** `services/agents/context/member_context.py:321-363`
**Severity:** Medium
**Status:** ✅ Fixed

**Problem:** Multiple concurrent requests for the same user can all miss the cache and perform expensive aggregation simultaneously (cache stampede).

**Fix Applied:** Added lock-based stampede prevention using `cache.add()`:
```python
lock_key = f'{cache_key}:lock'
if cache.add(lock_key, '1', timeout=30):  # Only one request wins
    try:
        context = await cls._aggregate_context_async(user_id)
        cache.set(cache_key, context, timeout=MEMBER_CONTEXT_CACHE_TTL)
    finally:
        cache.delete(lock_key)
else:
    # Other requests wait briefly and retry cache
    for _ in range(5):
        await asyncio.sleep(0.1)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
```

---

### REVIEWED: Unbounded Thread Lock Cache
**Location:** `services/agents/ember/agent.py:80-108`
**Severity:** Medium
**Status:** ✅ Reviewed - Sufficient

**Problem:** Concern that the in-memory thread lock cache could grow unbounded.

**Resolution:** Code review confirmed the existing LRU eviction is sufficient:
- `MAX_THREAD_LOCKS = 10000` caps memory at ~1MB
- Uses `OrderedDict` with `move_to_end()` for LRU behavior
- Eviction happens on every new lock creation (`while len > MAX`)
- For distributed locking, Redis is used instead (with TTL)
- Additional periodic cleanup would add complexity without significant benefit

---

## Notes

- This branch introduces significant architectural changes (unified Ember agent, learning paths)
- Overall code quality is good - these are refinements, not critical issues
- **All Ember Agent critical/high/medium issues have been fixed or reviewed**
- Remaining priority: Tests > Type Safety > TODOs > Hook Fixes
