# GitHub MCP Import - Implementation Plan

## Goal

Create a **unified flow** where users import GitHub projects **only through the Create Project Agent**, using GitHub's official MCP server for repository analysis.

---

## Official GitHub MCP Server

**Repository:** https://github.com/github/github-mcp-server (24.7k stars)

**Remote Server URL:** `https://api.githubcopilot.com/mcp/`

### Available Toolsets

| Toolset | URL | Purpose |
|---------|-----|---------|
| Default | `/mcp/` | repos, issues, pull_requests, users, context |
| Repos | `/mcp/x/repos` | Repository operations only |
| Git | `/mcp/x/git` | Git tree operations |
| All | `/mcp/x/all` | All toolsets |

### Key Tools for Project Import

From the `repos` toolset:
- `SearchRepositories` - Find repos
- `GetFileContents` - Get README, package.json, etc.
- `ListCommits` - Recent activity
- `GetRepositoryTree` (git toolset) - Full file structure
- `ListBranches`, `ListTags`, `ListReleases` - Project metadata

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Create Project Agent                          │
│                                                                  │
│  User: "Import https://github.com/user/repo"                    │
│                           ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              import_github_project tool                  │    │
│  │                                                          │    │
│  │  1. Validate URL                                         │    │
│  │  2. Get user's GitHub OAuth token                       │    │
│  │  3. Call GitHub MCP Server                              │    │
│  │     ├── get_file_contents(README.md)                    │    │
│  │     ├── get_file_contents(package.json)                 │    │
│  │     ├── get_file_contents(requirements.txt)             │    │
│  │     └── get_repository_tree()                           │    │
│  │  4. AI Analysis (AIProvider.complete)                   │    │
│  │     ├── Generate description                            │    │
│  │     ├── Suggest categories                              │    │
│  │     ├── Extract topics                                  │    │
│  │     └── Match tools                                     │    │
│  │  5. Parse README → structured blocks                    │    │
│  │  6. Generate Mermaid diagram                            │    │
│  │  7. Create Project with full metadata                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│  Return: project_id, slug, url                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Clean up existing GitHub integration

Before implementing the new MCP-based flow, simplify the landscape so there is a single, obvious path for GitHub imports.

**Keep (core behavior we want):**
- `services/github_ai_analyzer.py` – AI metadata generation (description, categories, topics, tools) from repo + README.
- `services/readme_parser.py` – README → structured blocks, hero image, Mermaid diagrams, demo URLs.

These already match the desired output behavior and are source-agnostic (REST vs MCP).

**Plan to remove or archive (legacy integration paths):**
- `core/integrations/github/views.py` – `github_import_preview`, `github_import_confirm` and the old UI-based import flow.
- `services/github_sync_service.py` – REST-centric sync logic and dual flows; we will only salvage small helpers (token lookup, maybe URL parsing).
- `services/analyzers/github.py` and its use in `AnalyzerFactory` – the "MCP analyzer" that now just shells out to REST.
- `core/projects/tasks.py::analyze_project_with_mcp` – only if we decide not to keep a separate background "deep analysis" path.

The goal of this step is that **the only GitHub entrypoint that matters is the Create Project Agent + the new importer**; everything else becomes either deleted or clearly marked as legacy and unused on this branch.

### Step 2: Update MCP Configuration

**File:** `config/settings.py`

```python
MCP_SERVERS = {
    'github': {
        'transport': 'http',
        'url': 'https://api.githubcopilot.com/mcp/',  # Already correct!
        # Headers will be set per-request with user's OAuth token
    },
}
```

### Step 3: Create GitHub MCP Service

**File:** `services/github_mcp_service.py` (NEW)

Instead of hand-rolling HTTP calls to `https://api.githubcopilot.com/mcp/`, we will build on the existing `MCPClientFactory` and `fastmcp.Client` so the MCP protocol and streaming are handled by the library.

**Note:** The `call_tool` usage below is pseudocode. Verify FastMCP's actual API (it may be async-only or use different method names). Wrap async methods with `asyncio.run()` if needed for sync tool compatibility.

```python
"""
GitHub MCP Service - wraps FastMCP client for GitHub tools.
"""
import logging

from django.conf import settings

from services.mcp.client_factory import MCPClientFactory
from services.github_helpers import detect_tech_stack_from_files

logger = logging.getLogger(__name__)


class GitHubMCPService:
    """Service for interacting with GitHub's official MCP server via FastMCP."""

    def __init__(self, user_token: str | None):
        factory = MCPClientFactory(settings.MCP_SERVERS)
        # This injects the per-user token into the Authorization header config
        self.client = factory.create_github_client(user_token=user_token)

    def get_readme(self, owner: str, repo: str) -> str | None:
        """Fetch README.md contents via the repos toolset."""
        try:
            result = self.client.call_tool(
                name="get_file_contents",
                arguments={"owner": owner, "repo": repo, "path": "README.md"},
            )
            return (result or {}).get("content")
        except Exception as e:
            logger.warning(f"Failed to fetch README for {owner}/{repo}: {e}")
            return None

    def get_repository_tree(self, owner: str, repo: str) -> list[dict]:
        """Fetch the git tree for HEAD via the git toolset."""
        try:
            result = self.client.call_tool(
                name="get_repository_tree",
                arguments={"owner": owner, "repo": repo, "sha": "HEAD", "recursive": True},
            )
            return (result or {}).get("tree", [])
        except Exception as e:
            logger.warning(f"Failed to fetch tree for {owner}/{repo}: {e}")
            return []

    def get_dependency_files(self, owner: str, repo: str) -> dict:
        """Best-effort fetch of key dependency files (package.json, requirements.txt, etc.)."""
        files: dict[str, str | None] = {}
        for path in ["package.json", "requirements.txt", "Pipfile", "go.mod", "Cargo.toml"]:
            try:
                resp = self.client.call_tool(
                    name="get_file_contents",
                    arguments={"owner": owner, "repo": repo, "path": path},
                )
                files[path] = (resp or {}).get("content")
            except Exception:
                files[path] = None
        return files

    def get_repository_info(self, owner: str, repo: str) -> dict:
        """High-level helper: fetch README, tree, dependency files, and tech stack."""
        logger.info(f"Fetching repository info for {owner}/{repo} via MCP")

        readme = self.get_readme(owner, repo)
        tree = self.get_repository_tree(owner, repo)
        deps = self.get_dependency_files(owner, repo)
        tech_stack = detect_tech_stack_from_files(tree, deps)

        logger.info(f"Completed MCP fetch for {owner}/{repo}")

        return {
            "readme": readme or "",
            "tree": tree,
            "dependencies": deps,
            "tech_stack": tech_stack,
        }
```

On top of this, we'll:

- derive a `repo_summary` with `name`, `description`, `language`, `topics`, `stargazers_count`, etc. The GitHub MCP server may have a tool for this; if not, a single REST call to `https://api.github.com/repos/{owner}/{repo}` is acceptable as a fallback.
- reuse the existing tech stack detection logic from `GitHubAnalyzer._detect_tech_stack_sync` (extracted into `services/github_helpers.py::detect_tech_stack_from_files`).

**Shared helpers to create:** `services/github_helpers.py`

```python
"""
Shared helpers for GitHub integration.
Extracted from GitHubAnalyzer and GitHubSyncService.
"""
import logging
import re

from allauth.socialaccount.models import SocialAccount, SocialToken
from core.social.models import SocialConnection, SocialProvider

logger = logging.getLogger(__name__)


def parse_github_url(url: str) -> tuple[str, str]:
    """Parse GitHub URL and return (owner, repo). Raises ValueError if invalid."""
    pattern = r'github\.com[:/]([^/]+)/([^/\.]+?)(?:\.git)?/?$'
    match = re.search(pattern, url)
    if not match:
        raise ValueError(f"Invalid GitHub URL: {url}")
    return match.group(1), match.group(2)


def get_user_github_token(user) -> str | None:
    """Get user's GitHub OAuth token from encrypted storage."""
    # Try django-allauth first
    try:
        social_account = SocialAccount.objects.get(user=user, provider='github')
        social_token = SocialToken.objects.get(account=social_account)
        return social_token.token
    except (SocialAccount.DoesNotExist, SocialToken.DoesNotExist):
        pass

    # Fall back to SocialConnection
    try:
        connection = SocialConnection.objects.get(
            user=user,
            provider=SocialProvider.GITHUB,
            is_active=True
        )
        return connection.access_token
    except SocialConnection.DoesNotExist:
        return None


def detect_tech_stack_from_files(tree: list[dict], deps: dict) -> dict:
    """Detect tech stack from file tree and dependency file contents."""
    tech_stack = {
        "languages": {},
        "frameworks": [],
        "tools": [],
    }

    # Detect from dependency files
    if deps.get("package.json"):
        tech_stack["languages"]["JavaScript"] = "primary"
        # Could parse JSON for frameworks like React, Vue, etc.
    if deps.get("requirements.txt") or deps.get("Pipfile"):
        tech_stack["languages"]["Python"] = "primary"
    if deps.get("go.mod"):
        tech_stack["languages"]["Go"] = "primary"
    if deps.get("Cargo.toml"):
        tech_stack["languages"]["Rust"] = "primary"

    # Detect tools from tree
    file_paths = [f.get("path", "") for f in tree]
    if any("docker" in p.lower() for p in file_paths):
        tech_stack["tools"].append("Docker")
    if any("docker-compose" in p.lower() for p in file_paths):
        tech_stack["tools"].append("Docker Compose")

    return tech_stack


def normalize_mcp_repo_data(owner: str, repo: str, url: str, repo_files: dict) -> dict:
    """
    Normalize MCP response into the shape expected by analyze_github_repo.
    
    If MCP doesn't provide repo metadata (stars, description, etc.), this function
    should make a single REST call to https://api.github.com/repos/{owner}/{repo}.
    """
    import requests

    # Fetch top-level repo metadata via REST (acceptable fallback)
    try:
        resp = requests.get(f"https://api.github.com/repos/{owner}/{repo}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "name": data.get("name", repo),
                "description": data.get("description", ""),
                "language": data.get("language", ""),
                "topics": data.get("topics", []),
                "stargazers_count": data.get("stargazers_count", 0),
                "forks_count": data.get("forks_count", 0),
                "html_url": url,
            }
    except Exception as e:
        logger.warning(f"Failed to fetch repo metadata for {owner}/{repo}: {e}")

    # Fallback with minimal data
    return {
        "name": repo,
        "description": "",
        "language": list(repo_files.get("tech_stack", {}).get("languages", {}).keys())[:1] or [""],
        "topics": [],
        "stargazers_count": 0,
        "forks_count": 0,
        "html_url": url,
    }


def apply_ai_metadata(project, analysis: dict) -> None:
    """
    Apply AI-suggested categories, topics, and tools to a project.
    Extracted from GitHubSyncService._create_project_from_repo.
    """
    from core.taxonomy.models import Taxonomy
    from core.tools.models import Tool

    # Apply categories
    for cat_id in analysis.get("category_ids", []):
        try:
            category = Taxonomy.objects.get(id=cat_id, taxonomy_type="category", is_active=True)
            project.categories.add(category)
        except Taxonomy.DoesNotExist:
            logger.warning(f"Category {cat_id} not found")

    # Apply topics
    topics = analysis.get("topics", [])
    if topics:
        project.topics = topics[:20]  # Limit to 20
        project.save(update_fields=["topics"])

    # Apply tools
    for tool_name in analysis.get("tool_names", []):
        tool = Tool.objects.filter(name__iexact=tool_name).first()
        if tool:
            project.tools.add(tool)
```

### Step 4: Create Unified Import Tool

**File:** `services/project_agent/tools.py` (UPDATE)

First define a dedicated input schema for the tool:

```python
class ImportGitHubProjectInput(BaseModel):
    """Input for import_github_project tool."""

    url: str = Field(description="GitHub repository URL (e.g., https://github.com/user/repo)")
    is_showcase: bool = Field(default=False, description="Whether to add the project to the showcase tab")
```

Then implement the tool:

```python
import logging

from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


@tool(args_schema=ImportGitHubProjectInput)
def import_github_project(
    url: str,
    is_showcase: bool = False,
    config: RunnableConfig | None = None,
) -> dict:
    """Import a GitHub repository as a portfolio project with full AI analysis.

    This tool:
    1. Uses GitHub MCP to fetch README, file tree, and dependency files
    2. Normalizes that data into the `repo_data` shape used by analyze_github_repo
    3. Calls analyze_github_repo to get description, categories, topics, tools, and blocks
    4. Creates a structured project page and applies AI-suggested metadata
    """
    from django.contrib.auth import get_user_model

    from core.projects.models import Project
    from services.github_ai_analyzer import analyze_github_repo
    from services.github_helpers import (
        apply_ai_metadata,
        get_user_github_token,
        normalize_mcp_repo_data,
        parse_github_url,
    )
    from services.github_mcp_service import GitHubMCPService

    User = get_user_model()

    # Validate config / user context
    if not config or "configurable" not in config or "user_id" not in config["configurable"]:
        return {"success": False, "error": "User not authenticated"}

    user_id = config["configurable"]["user_id"]

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {"success": False, "error": "User not found"}

    # Parse and validate URL
    try:
        owner, repo = parse_github_url(url)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    # Get user's GitHub token
    token = get_user_github_token(user)
    if not token:
        return {
            "success": False,
            "error": "GitHub account not connected. Please connect GitHub in settings.",
        }

    logger.info(f"Starting GitHub import for {owner}/{repo} by user {user.username}")

    # Fetch repository files/structure via MCP
    mcp = GitHubMCPService(token)
    repo_files = mcp.get_repository_info(owner, repo)

    # Normalize MCP output into the schema analyze_github_repo expects
    repo_summary = normalize_mcp_repo_data(owner, repo, url, repo_files)

    # Run AI analysis
    logger.info(f"Running AI analysis for {owner}/{repo}")
    analysis = analyze_github_repo(
        repo_data=repo_summary,
        readme_content=repo_files.get("readme", ""),
    )

    # Create project with full metadata
    project = Project.objects.create(
        user=user,
        title=repo_summary.get("name", repo),
        description=analysis.get("description") or repo_summary.get("description", ""),
        type=Project.ProjectType.GITHUB_REPO,
        external_url=url,
        content={
            "github": repo_summary,
            "blocks": analysis.get("readme_blocks", []),
            "mermaid_diagrams": analysis.get("mermaid_diagrams", []),
            "tech_stack": repo_files.get("tech_stack", {}),
        },
        is_showcase=is_showcase,
    )

    # Apply AI-suggested categories, topics, tools
    apply_ai_metadata(project, analysis)

    logger.info(f"Successfully imported {owner}/{repo} as project {project.id}")

    return {
        "success": True,
        "project_id": project.id,
        "slug": project.slug,
        "url": f"/{user.username}/{project.slug}",
    }


# Update PROJECT_TOOLS to include the new tool
PROJECT_TOOLS = [create_project, extract_url_info, import_github_project]
```

All helper functions (`parse_github_url`, `get_user_github_token`, `normalize_mcp_repo_data`, `apply_ai_metadata`, `detect_tech_stack_from_files`) are defined in `services/github_helpers.py` above.

#### Async, LangGraph & Checkpointers

The above tool definition is **synchronous** to match the current agent wiring (LLM bound to `PROJECT_TOOLS` and a `ToolNode`). For a more robust design that embraces LangGraph and checkpointers, we can layer in async behavior and persistence without changing the public API:

1. **Keep the LangChain tool sync, move async work into a service**
   - `GitHubMCPService` can expose async methods internally, but the tool itself should call a sync facade (e.g., `GitHubMCPServiceSync`) that uses `asyncio.run` or FastMCP's sync APIs.
   - This keeps `ToolNode(PROJECT_TOOLS)` and `agent_node` unchanged while still allowing non-blocking IO inside dedicated services if we later move to a fully-async tool stack.

2. **Option B: Dedicated LangGraph node for heavy imports**
   - Instead of doing all MCP + AI work inside a single tool call, we can introduce a new node, for example `github_import_node`, in the LangGraph workflow:
     - Extend `ProjectAgentState` with fields like `import_status`, `import_url`, and `project_id`.
     - Add a node function `github_import_node(state)` that:
       - Reads `import_url` from state
       - Calls `GitHubMCPService` + `analyze_github_repo`
       - Creates/updates the `Project`
       - Updates state with `project_id`, `project_slug`, and `import_status='complete'`.
   - Routing:
     - The LLM/tool phase sets `import_url` and a flag (e.g., via a small tool call or by emitting a control message), then `should_continue` routes to `github_import_node` instead of ending immediately.

3. **Using the existing checkpointer**
   - `create_project_agent()` already compiles with `get_checkpointer()`, so:
     - Long-running imports can be resumed if the process restarts.
     - Intermediate state (e.g., MCP partial results, `project_id`) can be persisted.
   - `github_import_node` can mark milestones in the state (e.g., `"step": "fetched_readme"`, `"step": "analyzed_ai"`) so retries or replays do not redo every external call.

4. **Streaming & UX**
   - `stream_agent_response` already uses `project_agent.astream_events` to surface `on_chat_model_stream` and tool events.
   - With a dedicated import node, we can:
     - Emit progress updates into the state (e.g., "Fetching README via MCP", "Running AI analysis", "Creating project...").
     - Surface those as incremental `token` or `tool` events to the frontend so the user sees import progress instead of a single blocking step.

For an MVP, we can start with the synchronous tool version in this step, and then evolve it into the dedicated LangGraph node pattern once the MCP integration and data normalization are stable.

### Step 5: Update Agent Prompts

**File:** `services/project_agent/prompts.py` (UPDATE)

```python
SYSTEM_PROMPT = '''You are a project creation assistant for AllThrive AI.

## Your Role
Help users create portfolio project entries. You specialize in importing GitHub repositories.

## Tools Available
1. **import_github_project** - Import a GitHub repo with full AI analysis
   - Fetches README, file structure, dependencies via GitHub MCP
   - AI generates description, categories, topics
   - Creates beautiful project page with Mermaid diagrams
   
2. **create_project** - Manual project creation (non-GitHub)

## Workflow for GitHub URLs
When user provides a GitHub URL:
1. Use import_github_project tool immediately
2. Tell user the import is processing
3. Share the project link when complete

## Example
User: "https://github.com/user/cool-project"
You: *call import_github_project(url="https://github.com/user/cool-project")*
Response: "I've imported your repository! Your project page is ready at /username/cool-project"
'''
```

### Step 6: Remove Old Code (final sweep)

Files to remove or deprecate:
- `core/integrations/github/views.py` - `github_import_preview`, `github_import_confirm`
- `services/github_sync_service.py` - Most of the file (keep OAuth token helpers)
- `services/analyzers/github.py` - Remove or replace with a thin MCP-based wrapper **only if** you still want a separate background analysis path.

### Step 7: Update Frontend

Remove the GitHub Import UI in favor of the agent chat:
- Remove "Import from GitHub" button
- Keep GitHub OAuth connection in settings
- All imports go through Create Project Agent chat

---

## Output Format

The imported project will have:

```json
{
  "title": "repo-name",
  "description": "AI-generated compelling description",
  "type": "github_repo",
  "external_url": "https://github.com/owner/repo",
  "content": {
    "blocks": [
      {"type": "text", "style": "heading", "content": "Features"},
      {"type": "text", "style": "body", "content": "..."},
      {"type": "mermaid", "code": "graph TD..."}
    ],
    "tech_stack": {
      "languages": {"Python": "primary"},
      "frameworks": ["Django", "React"],
      "tools": ["Docker", "PostgreSQL"]
    },
    "github": {
      "stars": 100,
      "forks": 20,
      "language": "Python"
    }
  },
  "categories": [9, 2],  // Developer & Coding, Websites & Apps
  "topics": ["python", "django", "api", "redis"],
  "tools": [1, 5]  // Tool IDs
}
```

---

## Testing Guidance

1. **Unit tests:** Mock `GitHubMCPService` to test `import_github_project` without real MCP calls.
2. **Integration test:** Import a real public repo (e.g., `https://github.com/octocat/Hello-World`) and verify:
   - Project created with correct title, description
   - Categories, topics, tools applied
   - `content.blocks` populated from README
3. **Error paths:** Test with:
   - Invalid GitHub URL → should return error
   - User without GitHub connected → should return auth error
   - Private repo without access → should handle gracefully

---

## Questions

1. Should we run the GitHub MCP server locally (Docker) or use the remote hosted version?
   - **Recommendation:** Use remote (`api.githubcopilot.com`) - simpler, maintained by GitHub

2. What happens if user doesn't have GitHub connected?
   - Agent prompts them to connect in settings first

3. Rate limits?
   - GitHub MCP inherits GitHub API rate limits (5000/hour authenticated)
