# Technical Debt Tracking

Last Updated: 2024-12-21

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

## Notes

- This branch introduces significant architectural changes (unified Ember agent, learning paths)
- Overall code quality is good - these are refinements, not critical issues
- Priority should be: Tests > Type Safety > TODOs > Hook Fixes
