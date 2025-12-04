# TODO Audit - AllThrive AI Codebase

**Generated:** 2025-12-03
**Total TODOs Found:** 37

This document catalogs all TODO comments found across the codebase, organized by functional area.

---

## Table of Contents

1. [Achievements & Gamification](#achievements--gamification)
2. [AI & Agents](#ai--agents)
3. [Integrations](#integrations)
4. [Projects](#projects)
5. [Frontend](#frontend)
6. [Services](#services)
7. [Documentation](#documentation)

---

## Achievements & Gamification

### Achievement Tracking Fields
**Location:** `core/achievements/management/commands/seed_achievements.py`

Multiple achievement types require new tracking fields to be implemented:

- **Line 196:** Battle Explorer - Missing `battle_types_tried` field
- **Line 289:** Community Helper - Missing `new_users_welcomed` field
- **Line 446:** Quiz Master - Missing `perfect_quiz_scores` field
- **Line 588:** Goal Setter - Missing `weekly_goals_completed` field
- **Line 603:** XP Grinder - Missing `weekly_xp_gained` tracking
- **Line 633:** Streak Breaker - Missing `broke_streak_record` tracking
- **Line 648:** Monthly Active - Missing `days_active_this_month` tracking
- **Line 663:** Achievement Hunter - Missing `achievement_categories_earned` tracking

**Priority:** Medium
**Impact:** These achievements are defined but cannot be earned until tracking fields are added to the user model.

### Signal Handlers
**Location:** `core/achievements/signals.py:63`

```python
# TODO: Add more signals for other trackable events:
# - Quiz completion
# - Battle participation
# - Project creation
# - Comment posting
# - Profile updates
```

**Priority:** Medium
**Impact:** Expands achievement system coverage to more user actions.

### Retroactive Tracking
**Location:**
- `services/achievements/tracker.py:239`
- `services/gamification/achievements/tracker.py:239`

```python
# TODO: Add more retroactive tracking for battles, quizzes, etc.
```

**Priority:** Low
**Impact:** Allow users to earn achievements for past actions when new achievements are added.

---

## AI & Agents

### Agent AI Service Integration
**Location:** `core/agents/views.py:109`

```python
# TODO: Integrate with AI service (OpenAI/Anthropic)
```

**Priority:** HIGH
**Impact:** Core feature - agents need actual AI integration to function.
**Also in:** `docs/archived/TECHNICAL_DEBT_AUDIT.md:30`

### Circuit Breaker FAQ Cache
**Location:** `core/agents/circuit_breaker.py:245`

```python
# TODO: Implement actual FAQ cache
```

**Priority:** Medium
**Impact:** Performance optimization for frequently asked questions.

### Agent Task Integration Context
**Location:** `core/agents/tasks.py:96`

```python
integration_type=None,  # TODO: extract from conversation context
```

**Priority:** Low
**Impact:** Better context awareness for agent tasks.

---

## Integrations

### GitHub Integration

**Location:** `core/integrations/github/tests/test_service.py`

Multiple async test implementations needed:

- **Line 28:** Convert to async test or create sync wrapper
- **Line 38:** Implement async test for repository fetching
- **Line 54:** Implement async test for authentication
- **Line 58:** Test rate limit header parsing
- **Line 63:** Test 401 response handling
- **Line 67:** Add comprehensive tests for error handling, pagination, caching

**Priority:** Medium
**Impact:** Ensures robust GitHub integration testing.

### AI Analyzer Tests
**Location:** `core/integrations/github/tests/test_ai_analyzer.py:454`

```python
# TODO: Re-enable when CI has AI keys configured
```

**Priority:** Low
**Impact:** Enable full test coverage in CI/CD pipeline.

### General Integration Tests

**Location:** `core/integrations/tests/test_import_flow.py`

- **Line 72:** Implement sync import method for testing
- **Line 91:** Test that duplicate projects are detected
- **Line 96:** Add tests for error handling, rate limiting, auth flow

**Location:** `core/integrations/tests/test_views.py`

- **Line 95:** Add tests for task status endpoint
- **Line 96:** Add tests for list integrations endpoint

**Location:** `core/integrations/tests/test_utils.py:127`

```python
# TODO: Add tests for get_integration_token and check_duplicate_project
```

**Priority:** Medium
**Impact:** Comprehensive test coverage for integrations.

### Token Refresh
**Location:** `core/integrations/utils.py:289`

```python
# TODO: Check token expiry and refresh if needed
```

**Priority:** HIGH
**Impact:** Prevents integration failures due to expired tokens.

---

## Projects

### Project Endpoints
**Location:** `docs/archived/PROJECT_CREATION_FLOW_REVIEW.md:187`

```typescript
// TODO: Add dedicated backend endpoint for /{username}/{slug}
```

**Priority:** Medium
**Impact:** Better API design for project detail pages.

### Test Fixes
**Location:** `core/projects/tests/test_projects.py`

- **Line 269:** Fix bulk delete endpoint (currently returns 400)
- **Line 320:** Fix comment deletion permissions (non-owners can delete)

**Priority:** HIGH
**Impact:** Security and functionality issues in project management.

---

## Frontend

### File Upload
**Location:** `frontend/src/components/chat/IntelligentChatPanel.tsx:109`

```typescript
// TODO: Implement proper file upload via the upload service
```

**Priority:** Medium
**Impact:** Enable file attachments in chat conversations.

### Error Tracking
**Location:** `frontend/src/utils/errorHandler.ts:156`

```typescript
// TODO: Send to error tracking service
```

**Priority:** Medium
**Impact:** Production error monitoring (Sentry, LogRocket, etc.).

### Component Registry
**Location:** `frontend/src/components/project-components/ComponentRenderer.tsx:69`

```typescript
// TODO: Add more components as they're created
```

**Priority:** Low
**Impact:** Expand component library for project customization.

### SSE Streaming
**Location:** `docs/archived/AGENTIC_PROJECT_CHAT_PLAN.md:1268`

```typescript
// TODO: Add SSE streaming client
```

**Priority:** Medium
**Impact:** Real-time streaming for AI responses.

### Layout Updates
**Location:** `docs/archived/AGENTIC_PROJECT_CHAT_PLAN.md:1274`

```typescript
// TODO: Replace old chat with IntelligentChatPanel
```

**Priority:** Low
**Impact:** UI consistency and modern chat interface.

---

## Services

### View Tracking
**Location:** `services/weaviate/tasks.py:77`

```python
'view_count': 0,  # TODO: Add view tracking
```

**Priority:** Low
**Impact:** Analytics for content popularity.

---

## Documentation

### Archived References

**Location:** `docs/archived/ultrathink-seo-llm-discovery.md:1365`

```python
bookmark_count = models.PositiveIntegerField(default=0)  # TODO: implement bookmarks
```

**Priority:** N/A (Archived)
**Impact:** Historical reference only.

**Location:** `docs/archived/THRIVE_CIRCLES_IMPLEMENTATION_PLAN.md:649`

```python
# TODO: Make this dynamic based on what user hasn't done recently
```

**Priority:** N/A (Archived)
**Impact:** Historical reference only.

**Location:** `docs/archived/PRE_COMMIT_SETUP.md:267`

Reference to TODO comment format in pre-commit documentation.

---

## Priority Summary

### HIGH Priority (3 items)
1. **AI Service Integration** - `core/agents/views.py:109`
   Core feature blocking agent functionality

2. **Token Refresh** - `core/integrations/utils.py:289`
   Prevents integration failures

3. **Project Tests** - `core/projects/tests/test_projects.py:269,320`
   Security and functionality bugs

### MEDIUM Priority (15 items)
- Achievement tracking fields (8 items)
- Achievement signals
- GitHub integration tests
- Integration test coverage
- Project endpoints
- File upload in chat
- Error tracking
- Circuit breaker FAQ cache
- SSE streaming client

### LOW Priority (7 items)
- Retroactive achievement tracking
- Agent task context
- AI analyzer CI tests
- View count tracking
- Component registry expansion
- Chat UI replacement
- Archived/documentation TODOs

---

## Recommendations

### Immediate Actions
1. **Integrate AI services with agents** - Critical for core functionality
2. **Implement token refresh** - Prevent integration outages
3. **Fix project test failures** - Security and data integrity

### Short Term (Next Sprint)
1. Add missing achievement tracking fields
2. Implement file upload in chat
3. Add error tracking service integration
4. Complete GitHub integration tests

### Long Term (Next Quarter)
1. Expand achievement system with new signals
2. Implement retroactive achievement tracking
3. Build out component library
4. Migrate to SSE streaming for AI responses

---

## Notes

- Many TODOs are in archived documentation and can be ignored
- Achievement system has the most pending work (8 tracking fields)
- Test coverage needs improvement across integrations
- Several frontend features await backend support

**Last Updated:** 2025-12-03
**Audit Performed By:** Claude Code
