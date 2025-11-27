# GitHub Repository Import - Architectural Review & Implementation Plan

## Executive Summary

**Goal:** Enable users to import their GitHub repositories through an agent-based chat interface, with AI-powered analysis to create rich portfolio project pages.

**Current Problem:** Technical debt from bouncing between MCP and REST implementations.

**Decision:** Use GitHub REST API directly (not MCP).

**Rationale:** For hundreds of thousands of users importing their own repositories, REST API is simpler, more scalable, more reliable, and has no additional infrastructure costs.

---

## User Flow (Target Experience)

### Option 1: Select from Dropdown
1. User opens agent-based chat interface
2. User: "I want to import a GitHub repository"
3. UI shows dropdown of user's GitHub repos (authenticated via OAuth)
4. User selects a repository
5. Agent validates access and analyzes repository

### Option 2: Paste GitHub URL
1. User opens agent-based chat interface
2. User pastes: "https://github.com/username/my-repo"
3. System parses URL and validates user has access
4. If authorized → Agent analyzes repository
5. If not authorized → Error: "You don't have access to this repository"

### Analysis Output (Both Options)
Agent creates project with:
- Project portfolio page
- Featured image (hero image)
- Tool/technology tags
- Category assignment
- Topic tags
- AI-generated summary
- Mermaid diagram of project architecture

---

## Security: Access Validation

**Critical Feature:** REST API validates user access before analysis.

**How It Works:**
```
User pastes any GitHub URL
↓
Parse: extract owner/repo from URL
↓
Call GitHub API with user's OAuth token:
GET /repos/{owner}/{repo}
↓
GitHub Response:
- 200 OK → User has access (proceed with analysis)
- 404 → Repo doesn't exist OR user has no access (reject)
- 403 → Explicitly denied (reject)
```

**What This Protects Against:**
- ❌ Analyzing repos user doesn't own
- ❌ Analyzing repos user can't access
- ❌ Privacy violations
- ❌ Unauthorized data access

**What This Allows:**
- ✅ User's own public repos
- ✅ User's own private repos
- ✅ Repos where user is collaborator
- ✅ Organization repos (if user is member)
- ✅ Any repo user can view on GitHub

**Implementation in GitHubService:**

The validation happens automatically in the first API call. We can add explicit validation:

```python
async def validate_access(self, owner: str, repo: str) -> tuple[bool, str | None]:
    """
    Validate user has access to repository.

    Returns:
        (has_access: bool, error_message: str | None)
    """
    try:
        url = f"{self.BASE_URL}/repos/{owner}/{repo}"
        response = await self._make_request(url)

        if response is None:
            return False, f"Repository {owner}/{repo} not found or you don't have access."

        return True, None

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            return False, f"Access denied to {owner}/{repo}."
        return False, f"Unable to access {owner}/{repo}."
```

This validation runs BEFORE any analysis, ensuring we only process repos the user is authorized to access.

---

## Architectural Decision: REST API vs MCP

### Why REST API is the Right Choice

| Factor | REST API | MCP |
|--------|----------|-----|
| **Complexity** | ✅ Simple, direct | ❌ Additional abstraction layer |
| **Scalability** | ✅ Horizontal scaling, no bottleneck | ⚠️ MCP server becomes bottleneck |
| **Infrastructure** | ✅ No additional servers | ❌ Requires MCP server(s) |
| **Cost** | ✅ Zero additional cost | ❌ MCP server hosting costs |
| **Reliability** | ✅ One less point of failure | ❌ MCP server downtime risk |
| **Rate Limits** | ✅ 5000 req/hr per user token | ⚠️ Shared MCP server limits |
| **Debugging** | ✅ Direct logs, curl testable | ❌ Extra layer to debug |
| **Documentation** | ✅ Extensive GitHub docs | ⚠️ Limited MCP docs |
| **User Isolation** | ✅ User token = user repos only | ✅ Same (token passed through) |
| **AI Integration** | ✅ AI analyzes fetched data | ✅ Same (AI is separate) |

### When MCP Makes Sense (NOT this use case)
- Dynamic tool discovery for AI agents
- Abstracting multiple data sources behind unified interface
- Frequently swapping implementations
- AI agents that need to invoke tools directly

### Our Use Case Reality
- **Known operations:** Get README, get tree, get files
- **Single data source:** GitHub API
- **One-time operation:** Import and store
- **AI analysis:** Happens AFTER data fetch, not during
- **Scale target:** Hundreds of thousands of users

**Conclusion:** MCP adds complexity without benefits. REST API is the correct architectural choice.

---

## Current State Analysis

### What Currently Exists

#### Backend Files (Python/Django)

**MCP Infrastructure (to be removed):**
- `services/mcp/client_factory.py` - MCPClientFactory (keep for Figma only)
- `services/github_mcp_service.py` - GitHubMCPService (replace with REST)

**GitHub Integration (to be refactored):**
- `core/integrations/github/views.py` - API endpoints:
  - `list_user_repos()` - Lists user's repos (already uses REST ✅)
  - `import_github_repo()` - Imports repo (currently uses MCP ❌)
- `services/github_helpers.py` - Helper functions:
  - `parse_github_url()` ✅
  - `get_user_github_token()` ✅
  - `detect_tech_stack_from_files()` ✅
  - `normalize_mcp_repo_data()` (needs refactoring)
  - `apply_ai_metadata()` ✅
- `services/github_ai_analyzer.py` - AI analysis (separate from MCP ✅)
- `services/github_constants.py` - Constants (has MCP retry constants to remove)

**Project Agent (LangChain):**
- `services/project_agent/tools.py` - Contains `import_github_project` tool (uses MCP ❌)

**Tests:**
- `services/tests/test_github_mcp_service.py` - MCP service tests (delete)
- `core/integrations/github/tests/test_github_import.py` - Import tests (update)

**Configuration:**
- `config/settings.py` - MCP_SERVERS config (remove GitHub, keep Figma)

#### Frontend Files (React/TypeScript)

**GitHub Service:**
- `frontend/src/services/github.ts` - API client functions:
  - `fetchGitHubRepos()` - Lists repos ✅
  - `checkGitHubConnection()` - Connection check ✅
  - `importGitHubRepo()` - Import repo ✅

**UI Components:**
- `frontend/src/components/projects/RightAddProjectChat.tsx` - Agent chat UI ✅

#### What Works vs What's Broken

**Working (uses REST):**
- ✅ List user's GitHub repos
- ✅ GitHub connection check
- ✅ AI analysis after data is fetched
- ✅ Project creation and metadata application

**Broken (uses MCP):**
- ❌ README fetching (returns 0 bytes)
- ❌ Repository tree fetching (empty)
- ❌ Dependency file fetching (empty)
- ❌ Overall import flow fails

**Root Cause:** MCP configuration issues + unnecessary complexity.

---

## Recommended Architecture

### Simple, Scalable GitHub Service (REST API)

```
User Auth (OAuth) → GitHub REST API → AI Analysis → Project Creation
     ↓                    ↓                 ↓              ↓
User's Token      Direct API Calls   OpenAI/Claude    PostgreSQL
```

**Key Components:**

1. **GitHubService** (new, replaces GitHubMCPService)
   - Direct REST API calls
   - Uses user's OAuth token
   - Handles rate limiting
   - Retry logic with exponential backoff

2. **GitHub Import Endpoint** (`/github/import/`)
   - Parse URL
   - Fetch repo data via GitHubService
   - Run AI analysis
   - Create project with metadata

3. **AI Analyzer** (existing, no changes needed)
   - Analyzes fetched data
   - Generates description, categories, topics, tools
   - Creates Mermaid diagram

4. **Frontend** (existing, no changes needed)
   - Repo list dropdown
   - Import button
   - Loading states

---

## Implementation Plan

### Phase 1: Create New GitHubService (REST API)

**File:** `services/github_service.py` (new)

**Purpose:** Replace GitHubMCPService with clean REST API implementation.

**Methods:**
```python
class GitHubService:
    def __init__(self, user_token: str):
        """Initialize with user's GitHub OAuth token."""

    async def get_readme(self, owner: str, repo: str) -> str | None:
        """Fetch README.md via REST API."""
        # GET /repos/{owner}/{repo}/contents/README.md
        # Decode from base64

    async def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """Fetch repository file tree via REST API."""
        # GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1

    async def get_file_contents(self, owner: str, repo: str, path: str) -> str | None:
        """Fetch file contents via REST API."""
        # GET /repos/{owner}/{repo}/contents/{path}
        # Decode from base64

    async def get_dependency_files(self, owner: str, repo: str) -> dict[str, str | None]:
        """Fetch common dependency files."""
        # Call get_file_contents for each: package.json, requirements.txt, etc.

    async def get_repository_info(self, owner: str, repo: str) -> dict:
        """Main method: fetch all repo data."""
        # Aggregate: readme + tree + dependencies + metadata
        # Call detect_tech_stack_from_files

    def get_repository_info_sync(self, owner: str, repo: str) -> dict:
        """Synchronous wrapper for LangChain tools."""
        # asyncio.run(self.get_repository_info(...))
```

**Features:**
- Uses `httpx.AsyncClient` for true async HTTP
- Handles base64 decoding for GitHub's content API
- Retry logic with `tenacity` (3 attempts, exponential backoff)
- Rate limit detection (check X-RateLimit-Remaining header)
- Proper error handling (404 for missing files, 403 for access denied)
- Timeout configuration (10s per request)

**Dependencies:**
- `httpx>=0.25.0` (already in requirements.txt)
- `tenacity>=8.2.0` (already in requirements.txt)

---

### Phase 2: Update Import Endpoint

**File:** `core/integrations/github/views.py`

**Changes:**

1. **Import change:**
   ```python
   # Old:
   from services.github_mcp_service import GitHubMCPService

   # New:
   from services.github_service import GitHubService
   ```

2. **Usage change (line ~220):**
   ```python
   # Old:
   mcp_service = GitHubMCPService(user_token)
   repo_files = mcp_service.get_repository_info_sync(owner, repo)

   # New:
   github_service = GitHubService(user_token)
   repo_files = github_service.get_repository_info_sync(owner, repo)
   ```

3. **Function rename:**
   ```python
   # services/github_helpers.py
   # Old: normalize_mcp_repo_data()
   # New: normalize_github_repo_data()
   # Remove MCP-specific fallback logic, keep REST API metadata fetch
   ```

**No other changes needed** - the interface is identical.

---

### Phase 3: Update Project Agent Tools

**File:** `services/project_agent/tools.py`

**Changes:**

1. **Import change:**
   ```python
   # Old:
   from services.github_mcp_service import GitHubMCPService

   # New:
   from services.github_service import GitHubService
   ```

2. **Usage change (line ~258):**
   ```python
   # Old:
   mcp = GitHubMCPService(token)
   repo_files = mcp.get_repository_info_sync(owner, repo)

   # New:
   github_service = GitHubService(token)
   repo_files = github_service.get_repository_info_sync(owner, repo)
   ```

---

### Phase 4: Cleanup MCP Technical Debt

#### 4.1 Remove GitHub MCP Service

**Action:** Delete file
- `services/github_mcp_service.py`

**Action:** Delete tests
- `services/tests/test_github_mcp_service.py`

#### 4.2 Update Configuration

**File:** `config/settings.py`

**Remove GitHub MCP config:**
```python
# DELETE THIS SECTION (lines ~226-234):
MCP_SERVERS = {
    'github': {  # ← DELETE entire 'github' key
        'transport': 'http',
        'url': config('GITHUB_MCP_SERVER_URL', default='https://api.githubcopilot.com/mcp'),
        'headers': {
            'Authorization': f'Bearer {GITHUB_API_TOKEN}' if GITHUB_API_TOKEN else None,
        },
    },
    'figma': {  # ← KEEP this for Figma MCP
        'transport': 'http',
        'url': config('FIGMA_MCP_SERVER_URL', default=f'{BACKEND_URL_DEFAULT}:3845/mcp'),
        'env': {
            'FIGMA_ACCESS_TOKEN': config('FIGMA_ACCESS_TOKEN', default=''),
        },
    },
}
```

**After cleanup:**
```python
MCP_SERVERS = {
    'figma': {  # Only Figma remains
        'transport': 'http',
        'url': config('FIGMA_MCP_SERVER_URL', default=f'{BACKEND_URL_DEFAULT}:3845/mcp'),
        'env': {
            'FIGMA_ACCESS_TOKEN': config('FIGMA_ACCESS_TOKEN', default=''),
        },
    },
}
```

#### 4.3 Update Constants

**File:** `services/github_constants.py`

**Remove MCP-specific constants:**
```python
# DELETE these:
MCP_RETRY_ATTEMPTS = 3
MCP_RETRY_MIN_WAIT = 2
MCP_RETRY_MAX_WAIT = 10

# KEEP or ADD generic retry constants:
GITHUB_RETRY_ATTEMPTS = 3
GITHUB_RETRY_MIN_WAIT = 2
GITHUB_RETRY_MAX_WAIT = 10
```

#### 4.4 Update Helper Functions

**File:** `services/github_helpers.py`

**Rename function:**
```python
# Old name: normalize_mcp_repo_data
# New name: normalize_github_repo_data

async def normalize_github_repo_data(
    owner: str,
    repo: str,
    url: str,
    repo_files: dict
) -> dict:
    """
    Normalize GitHub repository data for AI analysis.
    Falls back to REST API if repo_files is incomplete.
    """
    # Keep existing logic, just rename
```

#### 4.5 Keep MCP Infrastructure (for Figma)

**KEEP these files unchanged:**
- `services/mcp/__init__.py`
- `services/mcp/client_factory.py` (keep `create_figma_client` method)
- `services/analyzers/base.py` (MCPAnalyzer base class)
- `services/analyzers/figma.py` (FigmaAnalyzer)
- `services/analyzers/factory.py` (AnalyzerFactory)

**Update client_factory.py:**
```python
# REMOVE create_github_client() method
# KEEP create_figma_client() method
```

#### 4.6 Delete Documentation

**Remove GitHub MCP docs:**
- `docs/GITHUB_MCP_IMPLEMENTATION_PLAN.md`
- `docs/GITHUB_MCP_TESTING.md`
- `docs/GITHUB_MCP_LOGGING_ANALYSIS.md`
- `docs/GITHUB_MCP_FIXES_SUMMARY.md`

---

### Phase 5: Update Tests

#### 5.1 Create New Tests

**File:** `services/tests/test_github_service.py` (new)

**Test cases:**
- `test_github_service_initialization`
- `test_get_readme_success`
- `test_get_readme_not_found`
- `test_get_repository_tree_success`
- `test_get_dependency_files_success`
- `test_get_repository_info_complete_flow`
- `test_sync_wrapper`
- `test_rate_limit_handling`
- `test_retry_on_failure`
- `test_base64_decoding`
- `test_user_token_authentication`

#### 5.2 Update Import Tests

**File:** `core/integrations/github/tests/test_github_import.py`

**Changes:**
- Mock `GitHubService` instead of `GitHubMCPService`
- Update assertions to match REST API responses
- Test full import flow

---

### Phase 6: Environment & Dependencies

#### 6.1 Environment Variables

**Remove from .env / .env.example:**
```bash
GITHUB_MCP_SERVER_URL=https://api.githubcopilot.com/mcp  # DELETE
```

**Keep:**
```bash
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
# (OAuth credentials for user authentication)
```

#### 6.2 Python Dependencies

**No changes needed** - httpx and tenacity already in requirements.txt:
```
httpx>=0.25.0
tenacity>=8.2.0
```

**Can optionally remove if ONLY used for MCP:**
```
# Check if fastmcp is only for GitHub MCP:
fastmcp>=0.1.0  # Keep if Figma uses it, remove if not
```

---

## Testing Strategy

### Unit Tests
1. GitHubService methods (all cases)
2. Error handling (404, 403, rate limits)
3. Base64 decoding
4. Retry logic
5. Synchronous wrapper

### Integration Tests
1. Full import flow with real GitHub repo (use test repo)
2. Missing README handling
3. Missing dependency files handling
4. Rate limit simulation
5. Token authentication

### Manual Testing
1. Import public repository
2. Import private repository
3. Import repository with no README
4. Import large repository (1000+ files)
5. Test with invalid token
6. Test rate limit handling

---

## Rollout Plan

### Phase 1: Development (Day 1-2)
- Implement GitHubService
- Write unit tests
- Local testing with personal repos

### Phase 2: Integration (Day 3)
- Update all imports and usage
- Update integration tests
- Run full test suite

### Phase 3: Cleanup (Day 4)
- Delete MCP files
- Update configuration
- Update documentation
- Code review

### Phase 4: Deployment (Day 5)
- Deploy to staging
- Test with real users
- Monitor logs for errors
- Deploy to production

### Phase 5: Monitoring (Week 1)
- Monitor import success rate
- Monitor GitHub API rate limits
- Monitor error logs
- User feedback collection

---

## Risk Mitigation

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| GitHub API rate limits | Medium | High | Use user tokens (5000/hr each), cache data |
| Breaking existing imports | Low | High | Maintain same interface, thorough testing |
| Base64 decoding errors | Low | Medium | Try/catch with logging, fallback to empty |
| Figma MCP broken | Low | High | Don't touch Figma code, separate testing |
| Token expiration | Medium | Medium | Clear error messages, OAuth refresh flow |

---

## Success Metrics

### Technical Metrics
- Import success rate > 95%
- Average import time < 10 seconds
- Zero MCP-related errors
- Test coverage > 80%

### User Experience Metrics
- User can import repo in < 30 seconds
- AI analysis quality maintained
- Zero user-facing errors during import
- Positive user feedback on reliability

---

## Summary

**What we're doing:**
- Removing GitHub MCP complexity
- Implementing clean GitHub REST API integration
- Maintaining exact same functionality
- Keeping Figma MCP (it works)

**Why this is the right approach:**
- Simpler architecture
- Better scalability for hundreds of thousands of users
- Zero additional infrastructure
- Lower costs
- Easier debugging and maintenance

**Timeline:** 5 days from dev to production

**Files touched:** ~10 files
**Files deleted:** ~6 files
**New code:** ~400 lines (GitHubService + tests)
**Deleted code:** ~300 lines (MCP service + config)

**Net result:** Simpler, more reliable, more scalable GitHub import.
