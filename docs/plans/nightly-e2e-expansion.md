# Nightly E2E Test Expansion Plan

> **Status**: Phase 1 Implementation In Progress

## Overview

Add comprehensive E2E tests to the nightly suite that validate **complete end-to-end user success** across all critical journeys. Current tests (61 total) cover individual features but lack complete journey coverage, data persistence validation, and resilience testing.

**Guiding Principle**: Every test must provide **real insights** about actual user-facing functionality. No tests for test's sake - each test should catch real bugs that would impact users.

**Test Users**: Use existing `TEST_USER` and `TEST_USER2` from environment variables (already seeded via `create_test_users`).

---

## Phased Implementation Approach

Each phase ends with a **validation gate** to ensure tests provide real value before proceeding.

---

## Phase 1: Core Journey Tests (Priority: Critical)

### Tests to Implement

| Test File | Journey | Real-World Value |
|-----------|---------|------------------|
| `new-user-activation.spec.ts` | Guest → signup → onboarding → first project | Catches onboarding breaks that lose new users |
| `ai-chat-flow.spec.ts` | Ember chat → multi-turn → context preservation | Catches AI routing bugs and context loss |
| `core-loop-retention.spec.ts` | Login → battle → earn points → achievement | Catches gamification bugs that hurt engagement |

**Location**: `frontend/e2e/deep/journeys/`

### Validation Gate (After Phase 1)
- [ ] Run all 3 tests on local environment 5 times - >90% pass rate
- [ ] Review test output: Does each failure represent a real bug?
- [ ] Measure: Do tests catch issues that unit tests miss?
- [ ] Confirm: Tests complete within 15 minutes total
- [ ] Team review: Are these testing the right things?

### Exit Criteria
- Tests catch at least 1 real bug during development OR
- Tests provide confidence that critical paths work end-to-end

---

## Phase 2: Data Persistence Tests (Priority: High)

### Tests to Implement

| Test File | What It Validates | Why It Matters |
|-----------|-------------------|----------------|
| `data-persistence-points.spec.ts` | Points persist after refresh | Users lose trust if points disappear |
| `data-persistence-chat.spec.ts` | Conversation history survives logout | Critical for AI chat product value |
| `data-persistence-battles.spec.ts` | Battle state and results persist | Competitive integrity |

**Location**: `frontend/e2e/deep/data-validation/`

### Validation Gate (After Phase 2)
- [ ] Tests verify data via API calls, not just UI rendering
- [ ] Each test includes page refresh to confirm persistence
- [ ] Tests catch at least 1 data loss scenario during development
- [ ] Pass rate >90% on 5 consecutive runs

---

## Phase 3: Social & Revenue Journey Tests (Priority: Medium)

### Tests to Implement

| Test File | Journey | Business Value |
|-----------|---------|----------------|
| `social-community.spec.ts` | Follow → kudos → Lounge message | Community engagement features work |
| `revenue-conversion.spec.ts` | Guest invite → pricing → checkout | Revenue funnel doesn't break |

**Location**: `frontend/e2e/deep/journeys/`

### Validation Gate (After Phase 3)
- [ ] Social test verifies activity feed reflects actions
- [ ] Revenue test validates billing API responses
- [ ] No false positives in 5 consecutive runs

---

## Phase 4: Resilience & Edge Case Tests (Priority: Medium)

### Tests to Implement

| Test File | Scenarios | User Impact if Broken |
|-----------|-----------|----------------------|
| `websocket-resilience.spec.ts` | Disconnect/reconnect during chat & battle | Users see broken real-time features |
| `ai-timeout-recovery.spec.ts` | AI timeout, service down, streaming failure | Users see error states and lost work |
| `mobile-resilience.spec.ts` | Slow network, orientation change | Mobile users have degraded experience |

**Location**: `frontend/e2e/deep/resilience/`

### Validation Gate (After Phase 4)
- [ ] Tests use Playwright's network simulation APIs correctly
- [ ] Recovery scenarios show graceful degradation
- [ ] No crashes or unhandled exceptions in any scenario
- [ ] Tests don't flake due to timing issues

---

## Phase 5: Multi-User & Auth Edge Cases (Priority: Lower)

### Tests to Implement

| Test File | Scenarios |
|-----------|-----------|
| `concurrent-conflicts.spec.ts` | Two users editing, battle race conditions |
| `session-auth-edge-cases.spec.ts` | Token expiration, multiple tabs, OAuth |

### Validation Gate (After Phase 5)
- [ ] Multi-user tests use TEST_USER and TEST_USER2
- [ ] No false positives from timing/race conditions
- [ ] Tests add value beyond existing concurrent battle tests

---

## Remaining Data & Settings Tests (Optional Phase 6)

Only implement if earlier phases prove valuable:

| Test File | Value Assessment |
|-----------|------------------|
| `data-persistence-projects.spec.ts` | If project bugs are common |
| `data-persistence-settings.spec.ts` | If settings bugs reported |

---

## Implementation Details

### Shared Helpers

**File**: `frontend/e2e/deep/journeys/journey-helpers.ts`
```typescript
// Extended timeouts for journey tests
export const JOURNEY_TIMEOUT = 300000;
export const AI_RESPONSE_WAIT = 60000;
export const BATTLE_COMPLETE_WAIT = 120000;

// Verify gamification state via API
export async function verifyGamificationState(page: Page): Promise<{
  totalPoints: number;
  tier: string;
  questsCompleted: number;
}>;

// Complete a battle and return result
export async function completeBattleFlow(page: Page, prompt: string): Promise<{
  won: boolean;
  pointsEarned: number;
}>;
```

### CI Integration (After Each Phase)

Update `.github/workflows/nightly-deep-e2e.yml`:
```yaml
- name: Run Journey E2E Tests
  run: npx playwright test e2e/deep/journeys --project=deep
  timeout-minutes: 30

- name: Run Data Persistence E2E Tests
  run: npx playwright test e2e/deep/data-validation --project=deep
  timeout-minutes: 20

- name: Run Resilience E2E Tests
  run: npx playwright test e2e/deep/resilience --project=deep
  timeout-minutes: 45
```

Update `Makefile` with new targets:
```makefile
test-e2e-deep-journeys:
	cd frontend && npx playwright test e2e/deep/journeys --project=deep

test-e2e-deep-data:
	cd frontend && npx playwright test e2e/deep/data-validation --project=deep

test-e2e-deep-resilience:
	cd frontend && npx playwright test e2e/deep/resilience --project=deep
```

## Critical Files to Modify/Create

### New Files (15 total)
```
frontend/e2e/deep/
├── journeys/
│   ├── journey-helpers.ts
│   ├── new-user-activation.spec.ts
│   ├── core-loop-retention.spec.ts
│   ├── ai-chat-flow.spec.ts
│   ├── social-community.spec.ts
│   └── revenue-conversion.spec.ts
├── data-validation/
│   ├── data-persistence-points.spec.ts
│   ├── data-persistence-chat.spec.ts
│   ├── data-persistence-projects.spec.ts
│   ├── data-persistence-battles.spec.ts
│   └── data-persistence-settings.spec.ts
└── resilience/
    ├── resilience-helpers.ts
    ├── websocket-resilience.spec.ts
    ├── ai-timeout-recovery.spec.ts
    ├── concurrent-conflicts.spec.ts
    ├── session-auth-edge-cases.spec.ts
    └── mobile-resilience.spec.ts
```

### Files to Extend
- `frontend/e2e/deep/deep-helpers.ts` - Add journey/resilience helpers
- `frontend/e2e/helpers.ts` - Add second user login helper
- `Makefile` - Add new test targets
- `.github/workflows/nightly-deep-e2e.yml` - Add new test jobs

### Reference Files (Read before implementing)
- `frontend/e2e/deep/ai-quality-assertions.ts` - AI response validation patterns
- `frontend/src/hooks/useIntelligentChat.ts` - WebSocket reconnection logic
- `core/users/models.py` - User model, add_points() method
- `core/thrive_circle/views.py` - Gamification API endpoints
- `core/urls.py` - Complete API endpoint reference

## Test Execution Summary

| Category | Tests | Est. Time | Runs In |
|----------|-------|-----------|---------|
| Current Deep Tests | 20 | 20-30 min | Nightly |
| Journey Tests | 5 | 25-30 min | Nightly |
| Data Persistence | 5 | 15-20 min | Nightly |
| Resilience Tests | 5 | 30-45 min | Nightly |
| **Total** | **35** | **90-125 min** | Nightly |

## API Endpoints Used in Tests

### Gamification
- `GET /api/v1/me/thrive-circle/my-status/` - Points, tier, streak
- `POST /api/v1/me/thrive-circle/award-points/` - Award points
- `GET /api/v1/me/point-activities/` - Activity log
- `GET /api/v1/me/achievements/` - Achievement status

### Chat/Conversations
- `GET /api/v1/me/conversations/` - Conversation list
- `POST /api/v1/auth/chat/stream/` - Streaming chat

### Projects
- `POST /api/v1/me/projects/` - Create project
- `GET /api/v1/me/projects/{id}/` - Get project
- `PATCH /api/v1/me/projects/{id}/` - Update project

### Battles
- `POST /api/v1/me/battles/` - Create battle
- `GET /api/v1/me/battles/{id}/` - Get battle
- `POST /api/v1/battles/invitations/generate-link/` - Generate invite

### Social
- `POST /api/v1/users/{username}/follow/` - Follow user
- `GET /api/v1/me/circles/my-circle/` - Circle membership
- `POST /api/v1/community/rooms/{id}/messages/` - Send message

### Settings
- `GET /api/v1/me/personalization/settings/` - Get settings
- `PATCH /api/v1/me/personalization/settings/` - Update settings

### Billing
- `GET /api/v1/billing/tiers/` - Subscription tiers
- `GET /api/v1/billing/status/` - Current subscription

## Success Criteria

1. All 5 user journeys pass end-to-end
2. Data persists correctly across page refreshes
3. App recovers gracefully from network failures
4. No technical errors (TypeError, 500, etc.) shown to users
5. Mobile experience works on slow networks
6. Multi-user scenarios don't cause conflicts
7. Nightly run completes within 2 hours total

---

## Summary

| Phase | Tests | Focus | Value |
|-------|-------|-------|-------|
| 1 | 3 | Core user journeys | Catch onboarding, chat, engagement breaks |
| 2 | 3 | Data persistence | Catch data loss bugs |
| 3 | 2 | Social + Revenue | Catch community and billing breaks |
| 4 | 3 | Resilience | Catch network/error handling bugs |
| 5 | 2 | Edge cases | Catch multi-user and auth bugs |
| 6 | 2 | Optional | Only if needed |

**Total: 13-15 new tests added to nightly suite over 5-6 phases**
