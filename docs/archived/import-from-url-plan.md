# Plan: Unified `import_from_url` Tool

## Problem Statement

The LLM agent (Pip) keeps choosing the wrong tool for URL imports and asks unnecessary ownership questions, leading to:
- Users getting "repository not associated with your GitHub account" errors when clipping
- Confusing UX when users just want to save interesting content they found

## Solution: Single Unified Tool

Create one `import_from_url` tool that handles ALL URL imports with smart domain-based routing.

```
User pastes URL → import_from_url → Domain Router → Appropriate Handler
                                         |
                                         +-- github.com → _handle_github_import()
                                         +-- youtube.com → _handle_youtube_import()
                                         +-- figma.com → _handle_figma_import()
                                         +-- other → _handle_generic_import()
```

## Key Design Decisions

1. **GitHub URLs**: Auto-detect ownership via OAuth - NO questions asked
2. **YouTube URLs**: Use YouTube Data API for rich metadata extraction
3. **Non-GitHub/YouTube URLs**: Still ask "Is this yours?" via tool response
4. **Remove old tools from LLM access** - Keep as internal helpers only
5. **Auto-fallback pattern** - If GitHub OAuth fails or user doesn't own → scrape as clip
6. **Friendly messages** - Tool returns `message` field explaining what happened

## Implementation

### Phase 1: New Tool in `services/agents/project/tools.py`

#### 1.1 Domain Detection Helper
```python
def _detect_url_domain_type(url: str) -> str:
    """Returns: 'github', 'youtube', 'figma', or 'generic'"""
```

#### 1.2 Main Tool
```python
@tool(args_schema=ImportFromURLInput)
def import_from_url(url: str, is_showcase: bool = True, is_private: bool = False, state: dict = None) -> dict:
    """Import any URL as a project with smart domain-specific handling."""
    domain_type = _detect_url_domain_type(url)

    if domain_type == 'github':
        return _handle_github_import(...)
    elif domain_type == 'youtube':
        return _handle_youtube_import(...)
    # etc.
```

#### 1.3 GitHub Handler (Auto-ownership detection)
```python
def _handle_github_import(url, user, is_showcase, is_private, state) -> dict:
    token = get_user_github_token(user)

    if not token:
        # No OAuth → scrape as clip
        return _handle_generic_import(...) + {'message': "Saved to clippings! Connect GitHub for full imports."}

    is_owner = github_service.verify_repo_access_sync(owner, repo)

    if not is_owner:
        # Not owner → scrape as clip
        return _handle_generic_import(...) + {'message': "This belongs to someone else, added to clippings!"}

    # Owner → full import with AI analysis
    return full_github_import(...)
```

#### 1.4 YouTube Handler (YouTube Data API)
```python
def _handle_youtube_import(url, user, is_showcase, is_private, state) -> dict:
    """
    Handle YouTube URL with YouTube Data API for rich metadata.
    - Extract video ID from URL
    - Fetch title, description, thumbnail, channel info via API
    - Create project with video embed
    """
    video_id = extract_youtube_video_id(url)
    video_data = youtube_api.get_video_details(video_id)  # Uses YOUTUBE_API_KEY
    # Create project with rich metadata
```

#### 1.5 Generic Handler (Scraping + Ownership Question)
```python
def _handle_generic_import(url, user, is_owned, ...) -> dict:
    """
    Scrape any URL and create project.

    Returns 'needs_ownership_confirmation': True if is_owned not provided,
    prompting Pip to ask "Is this yours?"
    """
    if is_owned is None:
        return {
            'success': False,
            'needs_ownership_confirmation': True,
            'message': 'Is this your own project, or are you clipping something you found?'
        }
    # Proceed with scraping...
```

### Phase 2: Update Tool Registration

**`services/agents/project/tools.py`** - Update PROJECT_TOOLS:
```python
PROJECT_TOOLS = [
    create_project,
    extract_url_info,
    import_from_url,       # NEW - replaces import_github_project, scrape_webpage_for_project
    import_video_project,  # Keep for uploaded videos
    create_product,
]
```

**`services/agents/project/agent.py`** - Update TOOLS_NEEDING_STATE:
```python
TOOLS_NEEDING_STATE = {
    'create_project',
    'create_product',
    'import_from_url',      # NEW
    'import_video_project',
}
```

### Phase 3: Simplify Prompts

**`services/agents/project/prompts.py`** - Dramatically simplify:

```python
SYSTEM_PROMPT = (
    '## Available Tools\n'
    '1. **import_from_url** - Import ANY URL (GitHub, YouTube, any webpage)\n'
    '2. **import_video_project** - Import uploaded video files\n'
    '3. **create_project** - Create manually from description\n'
    '4. **create_product** - Create marketplace products\n\n'
    '## CRITICAL: URL Handling\n'
    '**When user pastes a URL**: Call `import_from_url` immediately!\n'
    '- GitHub/YouTube URLs: Tool auto-handles, no questions needed\n'
    '- Other URLs: Tool may return needs_ownership_confirmation=True\n'
    '  - If so, ask user "Is this yours?" then call again with is_owned=True/False\n'
    '- ALWAYS show the "message" field from tool response to user\n'
)
```

## Files to Modify

| File | Changes |
|------|---------|
| `services/agents/project/tools.py` | Add `import_from_url` tool + handlers |
| `services/agents/project/agent.py` | Update `TOOLS_NEEDING_STATE` |
| `services/agents/project/prompts.py` | Simplify to single tool instruction |
| `frontend/e2e/intelligent-chat.spec.ts` | Update E2E test |

## TDD Implementation Strategy

We will implement using **Test-Driven Development (TDD)** - writing failing tests FIRST, then implementing code to make them pass.

### TDD Workflow

```
RED → GREEN → REFACTOR
1. Write a failing test
2. Write minimal code to make it pass
3. Refactor while keeping tests green
```

### Test Files to Create/Modify

| Test File | Purpose |
|-----------|---------|
| `services/agents/project/tests/test_import_from_url.py` | **NEW** - Unit tests for unified tool |
| `frontend/e2e/intelligent-chat.spec.ts` | E2E Playwright tests |

### TDD Phase 1: Domain Detection (Write Tests First)

**File: `services/agents/project/tests/test_import_from_url.py`**

```python
import pytest
from services.agents.project.tools import _detect_url_domain_type

class TestDetectURLDomainType:
    """RED: Write these tests first - they should fail until implementation."""

    def test_github_url(self):
        assert _detect_url_domain_type('https://github.com/user/repo') == 'github'
        assert _detect_url_domain_type('https://www.github.com/user/repo') == 'github'
        assert _detect_url_domain_type('http://github.com/user/repo/tree/main') == 'github'

    def test_youtube_url(self):
        assert _detect_url_domain_type('https://youtube.com/watch?v=abc123') == 'youtube'
        assert _detect_url_domain_type('https://www.youtube.com/watch?v=abc123') == 'youtube'
        assert _detect_url_domain_type('https://youtu.be/abc123') == 'youtube'

    def test_figma_url(self):
        assert _detect_url_domain_type('https://figma.com/file/abc') == 'figma'
        assert _detect_url_domain_type('https://www.figma.com/design/abc') == 'figma'

    def test_generic_url(self):
        assert _detect_url_domain_type('https://example.com') == 'generic'
        assert _detect_url_domain_type('https://medium.com/article') == 'generic'
```

### TDD Phase 2: GitHub Handler (Write Tests First)

```python
class TestHandleGitHubImport:
    """RED: Write these tests first - they should fail until implementation."""

    @pytest.fixture
    def mock_user(self, mocker):
        user = mocker.Mock()
        user.id = 1
        user.username = 'testuser'
        return user

    def test_no_oauth_token_auto_clips(self, mocker, mock_user):
        """User without GitHub OAuth should auto-clip."""
        mocker.patch('services.agents.project.tools.get_user_github_token', return_value=None)
        mocker.patch('services.agents.project.tools._handle_generic_import', return_value={
            'success': True, 'url': '/testuser/fastmcp'
        })

        result = _handle_github_import(
            url='https://github.com/jlowin/fastmcp',
            user=mock_user,
            is_showcase=True,
            is_private=False,
            state={'user_id': 1}
        )

        assert result['success'] is True
        assert result['auto_clipped'] is True
        assert 'message' in result
        assert 'clipping' in result['message'].lower()

    def test_user_does_not_own_repo_auto_clips(self, mocker, mock_user):
        """User with OAuth but doesn't own repo should auto-clip."""
        mocker.patch('services.agents.project.tools.get_user_github_token', return_value='token123')
        mocker.patch('services.agents.project.tools.github_service.verify_repo_access_sync', return_value=False)
        mocker.patch('services.agents.project.tools._handle_generic_import', return_value={
            'success': True, 'url': '/testuser/fastmcp'
        })

        result = _handle_github_import(
            url='https://github.com/jlowin/fastmcp',
            user=mock_user,
            is_showcase=True,
            is_private=False,
            state={'user_id': 1}
        )

        assert result['success'] is True
        assert result['auto_clipped'] is True
        assert 'message' in result

    def test_user_owns_repo_full_import(self, mocker, mock_user):
        """User who owns repo gets full GitHub import with AI analysis."""
        mocker.patch('services.agents.project.tools.get_user_github_token', return_value='token123')
        mocker.patch('services.agents.project.tools.github_service.verify_repo_access_sync', return_value=True)
        mocker.patch('services.agents.project.tools._full_github_import', return_value={
            'success': True, 'url': '/testuser/my-repo', 'project_type': 'github_repo'
        })

        result = _handle_github_import(
            url='https://github.com/testuser/my-repo',
            user=mock_user,
            is_showcase=True,
            is_private=False,
            state={'user_id': 1}
        )

        assert result['success'] is True
        assert result.get('auto_clipped') is not True
        assert result['project_type'] == 'github_repo'
```

### TDD Phase 3: Generic Handler (Write Tests First)

```python
class TestHandleGenericImport:
    """RED: Write these tests first - they should fail until implementation."""

    def test_no_ownership_returns_confirmation_needed(self, mocker):
        """When is_owned is None, should return needs_ownership_confirmation."""
        result = _handle_generic_import(
            url='https://example.com/cool-project',
            user=mocker.Mock(),
            is_owned=None,
            is_showcase=True,
            is_private=False,
            state={'user_id': 1}
        )

        assert result['success'] is False
        assert result['needs_ownership_confirmation'] is True
        assert 'message' in result

    def test_owned_true_creates_project(self, mocker):
        """When is_owned=True, should create project with is_owned=True."""
        mocker.patch('services.agents.project.tools.scrape_url', return_value={
            'title': 'Cool Project', 'description': 'A cool project'
        })
        # ... mock project creation

        result = _handle_generic_import(
            url='https://example.com/cool-project',
            user=mocker.Mock(),
            is_owned=True,
            is_showcase=True,
            is_private=False,
            state={'user_id': 1}
        )

        assert result['success'] is True

    def test_owned_false_creates_clipping(self, mocker):
        """When is_owned=False, should create clipping."""
        # ... similar to above but verifies project_type='clipped'
```

### TDD Phase 4: Response Caching (Write Tests First)

```python
class TestImportFromURLCaching:
    """RED: Write these tests first - they should fail until implementation."""

    def test_cache_hit_returns_cached_result(self, mocker):
        """Should return cached result if URL was recently imported."""
        cache_mock = mocker.patch('services.agents.project.tools.cache')
        cache_mock.get.return_value = {'success': True, 'url': '/user/cached-project', 'cached': True}

        result = import_from_url(
            url='https://github.com/jlowin/fastmcp',
            state={'user_id': 1, 'username': 'testuser'}
        )

        assert result['cached'] is True
        # Verify handler was NOT called
        # ...

    def test_cache_miss_calls_handler_and_caches(self, mocker):
        """Should call handler and cache result on cache miss."""
        cache_mock = mocker.patch('services.agents.project.tools.cache')
        cache_mock.get.return_value = None

        # ... mock handler

        result = import_from_url(...)

        cache_mock.set.assert_called_once()
```

### TDD Phase 5: E2E Test (Write Test First)

**File: `frontend/e2e/intelligent-chat.spec.ts`**

```typescript
describe('Mission Critical - GitHub Clipping', () => {
  test('CRITICAL: should auto-clip GitHub repo user does not own', async ({ page }) => {
    // Setup: Login as test user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/feed');

    // Navigate to chat
    await page.click('[data-testid="add-project-button"]');
    await page.waitForSelector('[data-testid="chat-input"]');

    // Paste GitHub URL - should NOT ask ownership question
    const chatInput = page.getByPlaceholder('Ask me anything...');
    await chatInput.fill('https://github.com/jlowin/fastmcp');
    await page.click('[data-testid="send-button"]');

    // Wait for response
    await page.waitForTimeout(30000);

    // CRITICAL ASSERTION: Should auto-clip without asking
    const pageText = await page.locator('body').textContent() || '';

    // Should NOT contain ownership question
    expect(pageText).not.toMatch(/is this your own/i);
    expect(pageText).not.toMatch(/are you clipping/i);

    // SHOULD contain auto-clip message
    expect(pageText).toMatch(/clipping|added to your clippings/i);

    // SHOULD contain project link
    expect(pageText).toMatch(/fastmcp/i);
  });
});
```

### Implementation Order (TDD)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Write `test_detect_url_domain_type` tests | RED (FAIL) |
| 2 | Implement `_detect_url_domain_type()` | GREEN (PASS) |
| 3 | Write `test_handle_github_import` tests | RED (FAIL) |
| 4 | Implement `_handle_github_import()` | GREEN (PASS) |
| 5 | Write `test_handle_generic_import` tests | RED (FAIL) |
| 6 | Implement `_handle_generic_import()` | GREEN (PASS) |
| 7 | Write `test_import_from_url_caching` tests | RED (FAIL) |
| 8 | Implement caching in `import_from_url()` | GREEN (PASS) |
| 9 | Write E2E test | RED (FAIL) |
| 10 | Update prompts, wire everything up | GREEN (PASS) |
| 11 | Refactor while keeping all tests green | GREEN (PASS) |

### Running Tests

```bash
# Run unit tests only (fast feedback loop)
make test-backend -- -k "test_import_from_url"

# Run E2E test
cd frontend && npx playwright test intelligent-chat.spec.ts -g "auto-clip"

# Run all tests before commit
make test
```

## Scalability Review (100K Users)

### Current Bottlenecks Identified

| Component | Issue | Severity |
|-----------|-------|----------|
| **URL Scraper** | Synchronous blocking I/O (~30s Playwright) | HIGH |
| **URL Scraper** | No response caching | HIGH |
| **GitHub API** | `asyncio.run()` creates new event loop per call | MEDIUM |
| **Tool Execution** | Single thread pool for all operations | HIGH |
| **Caching** | No caching of scraped content | HIGH |

### Scalability Enhancements for `import_from_url`

#### 1. Response Caching (Critical)
```python
def import_from_url(...):
    # Check cache first
    cache_key = f'url_import:{hashlib.md5(url.encode()).hexdigest()}'
    cached = cache.get(cache_key)
    if cached:
        return cached  # Return cached project data

    result = _handle_import(...)
    cache.set(cache_key, result, timeout=86400)  # 24h TTL
    return result
```

#### 2. Async Handlers (Recommended)
```python
async def _handle_github_import_async(...):
    """Use native async httpx instead of asyncio.run() wrapper"""
    async with httpx.AsyncClient() as client:
        # Parallel fetches
        readme, tree, deps = await asyncio.gather(
            fetch_readme(client, owner, repo),
            fetch_tree(client, owner, repo),
            fetch_deps(client, owner, repo),
        )
```

#### 3. Task Queue Integration
```python
# For long-running imports, offload to Celery
@celery_app.task(queue='url_import', soft_time_limit=60)
def import_url_task(url: str, user_id: int, ...):
    """Background task for URL imports"""
    return import_from_url(url, ...)

# Tool returns immediately with task ID
def import_from_url(...):
    if should_queue(url):  # e.g., Playwright-requiring URLs
        task = import_url_task.delay(url, user_id, ...)
        return {'success': True, 'queued': True, 'task_id': task.id}
```

#### 4. Rate Limiting Per User
```python
from core.integrations.github.rate_limiter import check_rate_limit

def import_from_url(...):
    # Per-user rate limit (e.g., 10 imports/minute)
    if not check_rate_limit(f'url_import:{user_id}', limit=10, window=60):
        return {'success': False, 'error': 'Rate limit exceeded. Try again in a minute.'}
```

### Implementation Priority

**Phase 1 (MVP - Do Now):**
- Unified `import_from_url` tool with domain routing
- Basic response caching (24h TTL)
- Friendly fallback messages

**Phase 2 (Scale - Next Sprint):**
- Async handlers for GitHub/YouTube
- Celery task queue for long imports
- Per-user rate limiting

**Phase 3 (Optimize - Future):**
- Connection pooling
- Webhook-based GitHub sync
- Per-user YouTube OAuth (quota multiplexing)

## Migration Notes

- Old tools (`import_github_project`, `scrape_webpage_for_project`) kept as internal functions
- No database changes needed
- No frontend changes needed (tool returns same structure)
