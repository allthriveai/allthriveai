# Test Strategy Improvement Plan

## Problem Statement
Tests pass but real features break in production. Root causes identified:
1. **Over-mocking** - External services (GitHub, Stripe, Weaviate) mocked at HTTP layer, hiding real integration failures
2. **Test isolation failures** - `duplicate key value violates unique constraint` errors from hardcoded usernames
3. **E2E tests not blocking PRs** - Only smoke tests run on PRs; 35+ deep E2E and 86 backend E2E tests run nightly or never
4. **No factory pattern** - 279 occurrences of `User.objects.create()` with static usernames
5. **Only 6 frontend unit tests** - Component interactions untested, async/race conditions not caught
6. **No API contract testing** - Frontend TypeScript types can drift from backend serializers
7. **Frontend async/race conditions** - No tests for concurrent state updates, WebSocket reconnection races, or stale closure bugs

---

## Recommended Implementation (Phased Approach)

### Phase 1: Fix Test Isolation (Week 1) - HIGHEST IMPACT
**Goal**: Eliminate flaky tests and constraint violations

**1.1 Add factory_boy**
```bash
# Add to requirements.txt
factory-boy>=3.3.0
```

**1.2 Create factories** - `core/tests/factories/`
```python
# core/tests/factories/users.py
import factory
from factory.django import DjangoModelFactory
from core.users.models import User, UserRole

class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True  # Avoid double-save with set_password

    # Required unique fields - Sequence ensures no collisions
    username = factory.Sequence(lambda n: f'testuser_{n}')
    email = factory.LazyAttribute(lambda o: f'{o.username}@test.allthrive.ai')

    # Required fields with defaults matching model
    role = UserRole.EXPLORER
    tier = 'seedling'
    is_active = True

    # Password handling
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')

    class Params:
        # Traits for common test scenarios
        admin = factory.Trait(
            role=UserRole.ADMIN,
            is_staff=True,
        )
        agent = factory.Trait(
            role=UserRole.AGENT,
            tier='team',
        )
        curation = factory.Trait(
            tier='curation',
        )
```

**1.3 Migrate highest-impact test files first:**
| File | User.objects.create occurrences |
|------|--------------------------------|
| `core/battles/tests/test_async_battles.py` | 31 |
| `core/referrals/tests/test_views.py` | 22 |
| `core/community/tests/test_consumers.py` | 13 |

**Files to create:**
- `core/tests/factories/__init__.py`
- `core/tests/factories/users.py`
- `core/tests/factories/projects.py`
- `core/tests/factories/battles.py`
- `core/tests/factories/community.py`

**1.4 Fix TransactionTestCase isolation**
WebSocket tests use `TransactionTestCase` which doesn't auto-rollback. Add explicit cleanup:

```python
# core/tests/base.py
from django.test import TransactionTestCase
from core.tests.factories import UserFactory

class WebSocketTestCase(TransactionTestCase):
    """Base class for WebSocket consumer tests with proper isolation."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Reset factory sequences at class level
        UserFactory.reset_sequence()

    def tearDown(self):
        super().tearDown()
        # Clean up any test data created with factory sequences
        from core.users.models import User
        User.objects.filter(username__startswith='testuser_').delete()
```

---

### Phase 2: Critical E2E on Every PR (Week 1-2)
**Goal**: Catch feature regressions before merge

**2.1 Create critical E2E test suite**
Create `frontend/e2e/critical/` with tests for **user flows** (not page loads - smoke tests already cover those):
- `battles.spec.ts` - Create battle, join via link, submit prompt (no AI judging)
- `imports.spec.ts` - Start GitHub/Figma import, verify project created
- `websocket.spec.ts` - Chat reconnection, message delivery confirmation
- `auth-flows.spec.ts` - Login→action→logout (not just "page loads")

**Note**: Smoke tests already cover page loads and AI response quality. Critical tests should test **user journeys**.

**2.2 Update Playwright config**
```typescript
// frontend/playwright.config.ts - add project
{
  name: 'critical',
  testMatch: '**/critical/**/*.spec.ts',
  timeout: 60 * 1000,
  retries: 2,
  workers: 2,
}
```

**2.3 Update CI workflow**
```yaml
# .github/workflows/ci.yml - add after smoke tests
- name: Run Critical E2E Tests
  run: npx playwright test --project=critical
```

---

### Phase 3: Reduce Over-Mocking (Week 2-3)
**Goal**: Tests that catch real integration failures

**3.1 Create service test doubles (fakes)**
Instead of `@patch('httpx.AsyncClient.get')`, inject testable fakes:

```python
# core/integrations/github/test_doubles.py
class FakeGitHubService:
    def __init__(self, repositories=None, should_fail=False):
        self.repositories = repositories or {}
        self.should_fail = should_fail

    async def get_repository_info(self, owner: str, repo: str):
        if self.should_fail:
            raise IntegrationError("GitHub API unavailable")
        return self.repositories.get(f"{owner}/{repo}")
```

**3.2 Add N+1 query detection**
```python
# core/tests/conftest.py
from django.db import connection
from django.test.utils import CaptureQueriesContext
from contextlib import contextmanager

@contextmanager
def assert_max_queries(max_count: int):
    """Context manager that fails if query count exceeds max_count."""
    with CaptureQueriesContext(connection) as context:
        yield context
    if len(context) > max_count:
        queries = '\n'.join(f"  {i+1}. {q['sql'][:80]}..." for i, q in enumerate(context))
        raise AssertionError(
            f"Expected max {max_count} queries, got {len(context)}:\n{queries}"
        )

@pytest.fixture
def query_counter():
    """Pytest fixture wrapper for assert_max_queries."""
    return assert_max_queries

# Usage in tests:
def test_project_list_no_n_plus_1(client, query_counter):
    with query_counter(5):
        client.get('/api/v1/projects/')
```

---

### Phase 4: Parallelize CI (Week 2)
**Goal**: Keep CI fast despite more tests

```yaml
# .github/workflows/ci.yml - run in parallel
jobs:
  backend-lint:     # ~2 min
  frontend-lint:    # ~2 min
  backend-tests:    # ~10 min
  frontend-tests:   # ~3 min
  # These depend on unit tests:
  e2e-smoke:        # ~5 min (parallel with e2e-critical)
  e2e-critical:     # ~5 min (parallel with e2e-smoke)
```

---

### Phase 5: API Contract Testing (Week 3-4)
**Goal**: Prevent API/frontend type drift

**5.1 Generate TypeScript types from OpenAPI**
```json
// frontend/package.json
"scripts": {
  "generate-api-types": "openapi-typescript ../openapi-schema.json -o src/types/api-generated.ts"
}
```

**5.2 CI validation**
- Generate OpenAPI schema from Django
- Generate TypeScript types
- Fail if types have drifted from committed version

---

### Phase 6: Comprehensive Frontend Unit Tests (Week 5-6)

**Goal**: Increase frontend unit test coverage from 6 tests to comprehensive coverage

**Current state**: Only 6 frontend unit test files exist:
- `frontend/src/utils/caseTransform.test.ts`
- `frontend/src/services/projects.test.ts`
- `frontend/src/utils/gameLogic.test.ts`
- `frontend/src/hooks/websocket/__tests__/useWebSocketBase.test.ts`
- `frontend/src/types/sections.test.ts`
- `frontend/src/services/github.test.ts`

**6.1 Component Unit Tests**

```typescript
// Test rendering, props, and user interactions
// frontend/src/components/__tests__/BattleCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BattleCard } from '../BattleCard';

describe('BattleCard', () => {
  it('renders battle title and status', () => {
    render(<BattleCard battle={mockBattle} />);
    expect(screen.getByText('Test Battle')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('calls onJoin when join button clicked', () => {
    const onJoin = vi.fn();
    render(<BattleCard battle={mockBattle} onJoin={onJoin} />);
    fireEvent.click(screen.getByRole('button', { name: /join/i }));
    expect(onJoin).toHaveBeenCalledWith(mockBattle.id);
  });

  it('disables join button when battle is full', () => {
    render(<BattleCard battle={{ ...mockBattle, isFull: true }} />);
    expect(screen.getByRole('button', { name: /join/i })).toBeDisabled();
  });
});
```

**6.2 Hook Unit Tests**

```typescript
// Test custom hooks in isolation
// frontend/src/hooks/__tests__/useBattle.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useBattle } from '../useBattle';

describe('useBattle', () => {
  it('fetches battle data on mount', async () => {
    const { result } = renderHook(() => useBattle('battle-123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.battle).toEqual(expect.objectContaining({
      id: 'battle-123',
    }));
  });

  it('handles error when battle not found', async () => {
    mockApi.getBattle.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useBattle('invalid-id'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('refetches when battleId changes', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useBattle(id),
      { initialProps: { id: 'battle-1' } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ id: 'battle-2' });

    await waitFor(() => {
      expect(result.current.battle?.id).toBe('battle-2');
    });
  });
});
```

**6.3 Context Provider Tests**

```typescript
// Test context providers and their consumers
// frontend/src/contexts/__tests__/AuthContext.test.tsx
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

function TestConsumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.username || 'none'}</span>
      <button onClick={() => login('test', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  it('provides user state to consumers', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('none');

    await act(async () => {
      fireEvent.click(screen.getByText('Login'));
    });

    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });
});
```

**6.4 Utility Function Tests**

```typescript
// Test pure utility functions
// frontend/src/utils/__tests__/formatters.test.ts
describe('formatRelativeTime', () => {
  it('returns "just now" for times less than 1 minute ago', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns "X minutes ago" for times less than 1 hour ago', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinAgo)).toBe('30 minutes ago');
  });
});

// frontend/src/utils/__tests__/validation.test.ts
describe('validateUsername', () => {
  it('rejects usernames shorter than 3 characters', () => {
    expect(validateUsername('ab')).toEqual({
      valid: false,
      error: 'Username must be at least 3 characters'
    });
  });

  it('rejects usernames with special characters', () => {
    expect(validateUsername('user@name')).toEqual({
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores'
    });
  });

  it('accepts valid usernames', () => {
    expect(validateUsername('valid_user123')).toEqual({ valid: true });
  });
});
```

**6.5 Service Layer Tests**

```typescript
// Test API service functions
// frontend/src/services/__tests__/battles.test.ts
import { battlesService } from '../battles';

describe('battlesService', () => {
  it('creates a battle with correct payload', async () => {
    const battle = await battlesService.create({
      title: 'Test Battle',
      battleType: 'pip',
    });

    expect(mockAxios.post).toHaveBeenCalledWith('/api/v1/battles/', {
      title: 'Test Battle',
      battle_type: 'pip', // Verify camelCase → snake_case conversion
    });
  });

  it('transforms response from snake_case to camelCase', async () => {
    mockAxios.get.mockResolvedValue({
      data: { battle_type: 'pip', created_at: '2024-01-01' }
    });

    const battle = await battlesService.get('123');

    expect(battle.battleType).toBe('pip'); // Not battle_type
    expect(battle.createdAt).toBe('2024-01-01'); // Not created_at
  });
});
```

**6.6 Async Behavior & Race Condition Tests**

```typescript
// frontend/src/hooks/__tests__/useWebSocketBase.race.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

describe('WebSocket race conditions', () => {
  it('handles rapid connect/disconnect cycles without state corruption', async () => {
    const { result } = renderHook(() => useWebSocketBase(url));

    // Simulate rapid connect/disconnect (user navigating quickly)
    await act(async () => {
      result.current.connect();
      result.current.disconnect();
      result.current.connect();
      result.current.disconnect();
      result.current.connect();
    });

    // Should settle to a consistent state
    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });
  });

  it('cancels pending reconnection when component unmounts', async () => {
    const { result, unmount } = renderHook(() => useWebSocketBase(url));

    // Trigger reconnection
    await act(async () => {
      result.current.simulateDisconnect();
    });

    // Unmount while reconnecting
    unmount();

    // Verify no state updates after unmount (would cause React warning)
    await vi.advanceTimersByTimeAsync(5000);
    // Test passes if no "Can't perform state update on unmounted component" warning
  });

  it('handles out-of-order message delivery', async () => {
    const { result } = renderHook(() => useChatMessages(roomId));

    // Simulate messages arriving out of order
    await act(async () => {
      result.current.handleMessage({ id: 3, text: 'third', timestamp: 300 });
      result.current.handleMessage({ id: 1, text: 'first', timestamp: 100 });
      result.current.handleMessage({ id: 2, text: 'second', timestamp: 200 });
    });

    // Should be sorted by timestamp
    expect(result.current.messages.map(m => m.id)).toEqual([1, 2, 3]);
  });
});
```

**6.7 Test patterns for stale closures**

```typescript
describe('Stale closure prevention', () => {
  it('useCallback uses latest state in event handlers', async () => {
    const { result } = renderHook(() => useBattleSubmission(battleId));

    // Update state
    await act(async () => {
      result.current.setPrompt('updated prompt');
    });

    // Submit should use the updated value, not stale closure
    await act(async () => {
      result.current.submit();
    });

    expect(mockApi.submitPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'updated prompt' })
    );
  });
});
```

**6.8 Test patterns for concurrent requests**

```typescript
describe('Concurrent request handling', () => {
  it('prevents double-submit on rapid clicks', async () => {
    const { result } = renderHook(() => useFormSubmit(onSubmit));

    // Rapid clicks
    await act(async () => {
      result.current.submit();
      result.current.submit();
      result.current.submit();
    });

    // Should only call once
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('uses latest request result when requests race', async () => {
    const { result } = renderHook(() => useSearch());

    // Slow request followed by fast request
    mockApi.search
      .mockImplementationOnce(() => delay(1000).then(() => ({ results: ['slow'] })))
      .mockImplementationOnce(() => delay(100).then(() => ({ results: ['fast'] })));

    await act(async () => {
      result.current.search('query1'); // Slow
      result.current.search('query2'); // Fast, should win
    });

    await waitFor(() => {
      expect(result.current.results).toEqual(['fast']); // Not 'slow'
    });
  });
});
```

**6.9 Frontend test files to create**
- `frontend/src/hooks/__tests__/useWebSocketBase.race.test.ts`
- `frontend/src/hooks/__tests__/useBattleState.race.test.ts`
- `frontend/src/hooks/__tests__/useChatMessages.race.test.ts`
- `frontend/src/components/__tests__/FormSubmit.race.test.ts`
- `frontend/src/utils/__tests__/requestDeduplication.test.ts`

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `core/tests/factories/__init__.py` | Factory exports |
| `core/tests/factories/users.py` | UserFactory with unique sequences |
| `core/tests/factories/projects.py` | ProjectFactory |
| `core/tests/factories/battles.py` | BattleFactory |
| `core/tests/factories/community.py` | RoomFactory, MessageFactory |
| `core/tests/conftest.py` | Shared pytest fixtures (query assertions, etc.) |
| `core/integrations/github/test_doubles.py` | FakeGitHubService |
| `core/billing/test_doubles.py` | FakeStripeService |
| `frontend/e2e/critical/auth-flows.spec.ts` | Critical auth user journey tests |
| `frontend/e2e/critical/battles.spec.ts` | Critical battle tests |
| `frontend/e2e/critical/imports.spec.ts` | Critical import tests |
| `frontend/e2e/critical/websocket.spec.ts` | WebSocket stability tests |
| `scripts/validate_openapi_schema.py` | Schema validation |
| `frontend/src/hooks/__tests__/useWebSocketBase.race.test.ts` | WebSocket race condition tests |
| `frontend/src/hooks/__tests__/useBattleState.race.test.ts` | Battle state race condition tests |
| `frontend/src/hooks/__tests__/useChatMessages.race.test.ts` | Chat message ordering/race tests |
| `frontend/src/components/__tests__/FormSubmit.race.test.ts` | Double-submit prevention tests |
| `frontend/src/utils/__tests__/requestDeduplication.test.ts` | Request deduplication tests |
| `frontend/src/components/__tests__/BattleCard.test.tsx` | Component rendering & interactions |
| `frontend/src/hooks/__tests__/useBattle.test.ts` | Hook data fetching & state |
| `frontend/src/contexts/__tests__/AuthContext.test.tsx` | Auth context provider tests |
| `frontend/src/utils/__tests__/formatters.test.ts` | Date/time formatting utilities |
| `frontend/src/utils/__tests__/validation.test.ts` | Form validation utilities |
| `frontend/src/services/__tests__/battles.test.ts` | Battle API service tests |
| `frontend/src/services/__tests__/chat.test.ts` | Chat API service tests |
| `frontend/src/services/__tests__/imports.test.ts` | Import API service tests |

### Files to Modify
| File | Changes |
|------|---------|
| `requirements.txt` | Add factory-boy |
| `pytest.ini` | Add markers (integration, e2e, slow) |
| `frontend/playwright.config.ts` | Add critical project |
| `.github/workflows/ci.yml` | Add critical E2E, parallelize jobs |
| `frontend/src/test/setup.ts` | Remove over-mocking of contexts |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test isolation failures | Frequent | Zero |
| E2E tests on PR | Smoke only (26 tests) | Smoke + Critical (~50 tests) |
| Backend tests with factories | 0% | 100% of new tests |
| Files with `@patch` at HTTP layer | 26+ | <10 |
| API contract validation | None | Every PR |
| Frontend unit test files | 6 | 30+ |
| Frontend test coverage | ~5% | 40%+ for hooks/services |

---

## Implementation Order (Prioritized)

**User preferences:**
- Scope: Fix existing tests AND prevent future regressions (thorough approach)
- CI time: No hard limit on PR time; comprehensive nightly suite
- All features break frequently: Battles/WebSockets, Imports, Chat/AI, Auth/Billing

### Execution Plan

**Week 1: Factory Infrastructure**
1. Add `factory-boy>=3.3.0` to requirements.txt
2. Create `core/tests/factories/` with UserFactory, ProjectFactory, BattleFactory, RoomFactory
3. Create `core/tests/base.py` with `WebSocketTestCase` base class
4. Create shared `conftest.py` with query counting fixtures
5. Fix the 18 currently failing tests (constraint violations)
6. Add pre-commit hook to prevent regression

**Week 2: Migrate Existing Tests (High Priority)**
Priority order (by failure frequency & WebSocket usage):
1. `core/battles/tests/` - 42 occurrences, WebSocket-heavy (HIGHEST PRIORITY)
2. `core/community/tests/` - 13 occurrences, WebSocket consumers
3. `core/agents/tests/` - AI/chat related

**Week 3: Migrate Remaining Tests + Critical E2E**
1. `core/referrals/tests/` - 22 occurrences
2. `core/integrations/tests/` - Import flows
3. Create `frontend/e2e/critical/` with user journey tests
4. Update CI to run critical E2E on every PR

**Week 4: WebSocket Test Improvements**
Since WebSockets break frequently:
1. Create WebSocket test utilities (`core/tests/websocket_utils.py`)
2. Add connection/reconnection tests
3. Add concurrent user simulation tests

**Week 5: Service Fakes & Contract Testing**
1. Create `test_doubles.py` for GitHub, Stripe, YouTube services
2. Add OpenAPI schema validation to CI
3. Generate TypeScript types from OpenAPI

**Week 5-6: Comprehensive Frontend Unit Tests**
1. Add component unit tests for key UI components:
   - Battle cards, chat messages, project cards, forms
   - User interactions (clicks, inputs, submissions)
   - Conditional rendering and error states
2. Add hook unit tests:
   - Data fetching hooks (useBattle, useChat, useProjects)
   - State management hooks
   - WebSocket hooks
3. Add context provider tests:
   - AuthContext, QuestContext, ThemeContext
   - Provider composition and state sharing
4. Add service layer tests:
   - API call construction (verify camelCase→snake_case)
   - Response transformation (verify snake_case→camelCase)
   - Error handling
5. Add utility function tests:
   - Formatters (dates, numbers, relative time)
   - Validators (username, email, URLs)
   - Transformers (case conversion)
6. Add async/race condition tests:
   - WebSocket reconnection races
   - Concurrent state updates (rapid clicks, overlapping requests)
   - Stale closure bugs in useEffect/useCallback
   - Optimistic UI with rollback on failure
   - Request cancellation on unmount
   - Out-of-order message handling

**Ongoing:**
- Add N+1 query assertions to ViewSet tests
- Migrate remaining test files to factories

---

## Files to Migrate (49 total with hardcoded usernames)

### High Priority (WebSocket/Battle related)
- `core/battles/tests/test_async_battles.py` (31 occurrences)
- `core/battles/tests/test_consumers.py` (11 occurrences)
- `core/community/tests/test_consumers.py` (13 occurrences)
- `core/agents/tests/test_websocket.py`

### Medium Priority (Imports/Integrations)
- `core/integrations/github/tests/test_service.py`
- `core/integrations/figma/tests/test_figma_integration.py`
- `core/integrations/youtube/tests/test_youtube_integration.py`

### Standard Priority (Auth/Billing)
- `core/auth/tests/test_views.py`
- `core/billing/tests/test_webhooks.py`
- `core/users/tests/test_user_username.py` (12 occurrences)

---

## CRITICAL: Stop Breaking Features When Adding New Features

### 1. Feature-to-Test Mapping (Required)

Create a mapping so every feature has at least one E2E test that validates it:

```yaml
# .github/feature-test-mapping.yml
features:
  battles:
    paths: ['core/battles/**', 'frontend/src/**/battle*']
    required_tests:
      - 'e2e/critical/battles.spec.ts'
      - 'e2e/prompt-battles.spec.ts'
    owners: ['@team']

  imports:
    paths: ['core/integrations/**', 'frontend/src/**/import*']
    required_tests:
      - 'e2e/critical/imports.spec.ts'
      - 'e2e/github-import.spec.ts'
    owners: ['@team']

  chat:
    paths: ['core/agents/**', 'services/agents/**', 'frontend/src/**/chat*']
    required_tests:
      - 'e2e/critical/websocket.spec.ts'
      - 'e2e/ai-chat/*.spec.ts'
    owners: ['@team']

  community:
    paths: ['core/community/**', 'frontend/src/**/community*']
    required_tests:
      - 'e2e/critical/websocket.spec.ts'
    owners: ['@team']

  auth:
    paths: ['core/auth/**', 'core/users/**', 'frontend/src/**/auth*']
    required_tests:
      - 'e2e/critical/auth-flows.spec.ts'
    owners: ['@team']
```

### 2. Required Tests Based on Changed Files (CI Enforcement)

```yaml
# .github/workflows/ci.yml - Add this job
required-feature-tests:
  runs-on: ubuntu-latest
  steps:
    - name: Determine affected features
      id: affected
      run: |
        # Get changed files
        CHANGED=$(git diff --name-only origin/main...HEAD)

        # Map to required tests
        TESTS=""
        if echo "$CHANGED" | grep -q "core/battles\|battle"; then
          TESTS="$TESTS e2e/critical/battles.spec.ts"
        fi
        if echo "$CHANGED" | grep -q "core/integrations\|import"; then
          TESTS="$TESTS e2e/critical/imports.spec.ts"
        fi
        if echo "$CHANGED" | grep -q "core/community\|core/agents\|websocket\|chat"; then
          TESTS="$TESTS e2e/critical/websocket.spec.ts"
        fi
        echo "tests=$TESTS" >> $GITHUB_OUTPUT

    - name: Run required feature tests
      if: steps.affected.outputs.tests != ''
      run: npx playwright test ${{ steps.affected.outputs.tests }}
```

### 3. Cross-Feature Integration Tests

Add tests that verify features work together (not just in isolation):

```typescript
// frontend/e2e/integration/cross-feature.spec.ts
describe('Cross-feature integration', () => {
  test('imported project can be used in battle', async ({ page }) => {
    // Import a GitHub project
    await importGitHubProject(page, 'owner/repo');

    // Create a battle using that project
    await createBattle(page, { projectId: importedProject.id });

    // Verify battle shows project details correctly
    await expect(page.getByText('owner/repo')).toBeVisible();
  });

  test('chat message triggers notification', async ({ page }) => {
    // Send a message in chat
    await sendChatMessage(page, 'Hello');

    // Verify notification appears
    await expect(page.getByTestId('notification')).toBeVisible();
  });

  test('battle completion updates user stats', async ({ page }) => {
    const initialPoints = await getUserPoints(page);

    // Complete a battle
    await completeBattle(page, battleId);

    // Verify points updated
    const newPoints = await getUserPoints(page);
    expect(newPoints).toBeGreaterThan(initialPoints);
  });
});
```

### 4. PR Checklist (Enforce via CI)

```yaml
# .github/workflows/pr-checklist.yml
- name: Verify PR has tests for changed features
  run: |
    # Get changed files
    CHANGED=$(git diff --name-only origin/main...HEAD)

    # Check if any feature code was changed
    if echo "$CHANGED" | grep -qE "^(core|frontend/src)/" && \
       ! echo "$CHANGED" | grep -qE "test|spec"; then
      echo "⚠️ WARNING: Feature code changed but no test files modified"
      echo "Please add or update tests for your changes"
      # Make this exit 1 to enforce
    fi
```

### 5. Post-Deploy Monitoring (Add to runbook)

After deploying, verify critical features still work:

```bash
# scripts/post-deploy-smoke.sh
#!/bin/bash

# Run critical E2E tests against production
PLAYWRIGHT_BASE_URL=https://allthrive.ai npx playwright test e2e/smoke.spec.ts

# Check error rates didn't spike
# (Integrate with Sentry/Datadog API)
```

### 6. Feature Flag Strategy

For risky features, deploy behind flags:

```python
# core/features/flags.py
FEATURE_FLAGS = {
    'new_battle_ui': {
        'enabled': False,  # Deploy disabled
        'rollout_percentage': 0,  # Gradual rollout
        'allowed_users': ['admin'],  # Test with specific users first
    }
}

# Usage in views:
if feature_enabled('new_battle_ui', request.user):
    return new_battle_view(request)
return old_battle_view(request)
```

---

## Regression Prevention Guardrails

**Add these to prevent re-introducing the problems we're fixing:**

### Pre-commit hook (`.pre-commit-config.yaml`)
```yaml
- repo: local
  hooks:
    - id: no-hardcoded-test-users
      name: Check for hardcoded test usernames
      entry: bash -c 'git diff --cached --name-only | xargs grep -l "tests/" | xargs grep -E "username=['\''\"](testuser|johndoe|alice|bob)['\''\"']" && exit 1 || exit 0'
      language: system
      pass_filenames: false

    - id: use-factories
      name: Enforce factory usage in new tests
      entry: bash -c 'git diff --cached -- "*/tests/*.py" | grep -E "^\+.*User\.objects\.create" && echo "Use UserFactory instead of User.objects.create" && exit 1 || exit 0'
      language: system
      pass_filenames: false
```

### CI lint check (add to `.github/workflows/ci.yml`)
```yaml
- name: Check for anti-patterns in tests
  run: |
    # Fail if new test files use User.objects.create instead of factories
    if git diff origin/main --name-only -- '*/tests/*.py' | xargs grep -l 'User.objects.create' 2>/dev/null; then
      echo "ERROR: Use UserFactory instead of User.objects.create in tests"
      exit 1
    fi
```

---

## Realistic Timeline (Adjusted)

The original plan was optimistic. Here's a more realistic estimate:

| Phase | Original | Realistic | Notes |
|-------|----------|-----------|-------|
| Factory infrastructure | Days 1-3 | Days 1-4 | Need to handle model dependencies |
| Migrate 49 test files | Days 4-7 | Days 5-14 | ~5 files/day is more realistic |
| Critical E2E tests | Days 8-10 | Days 15-18 | Need to write new test flows |
| WebSocket improvements | Days 11-14 | Days 19-22 | Complex async testing |
| Service fakes & contracts | Week 3 | Week 4-5 | Requires DI refactoring |
| Frontend async/race tests | N/A | Week 5-6 | New addition |

**Total: ~5-6 weeks** (not 2-3 weeks)

### Rollback Strategy

If factory migration causes new failures:
1. Add `@pytest.mark.factory_migration` to migrated tests
2. CI can skip with `pytest -m "not factory_migration"` to isolate issues
3. Keep old test versions in `_legacy.py` files until migration is validated
