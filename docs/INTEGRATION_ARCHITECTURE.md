# Integration Architecture

**Date:** 2025-11-27
**Purpose:** Scalable architecture for 10+ external platform integrations

---

## Overview

AllThrive supports importing projects from multiple external platforms (GitHub, GitLab, npm, PyPI, Docker Hub, etc.). This document describes the architecture that makes it easy to add new integrations.

---

## Architecture Principles

### 1. Separation of Concerns
- **Platform-specific code** → `core/integrations/{platform}/`
- **Shared functionality** → `core/integrations/base/`
- **Generic services** → `services/`

### 2. Base Classes, Not Code Duplication
- Each integration extends `BaseIntegration`
- Shared parsing, AI analysis, block creation in `base/`
- Only implement platform-specific logic

### 3. Self-Contained Integrations
- Each integration is a complete module
- Can be developed/tested independently
- Clear boundaries and responsibilities

---

## Directory Structure

```
/core/integrations/

  base/                          # SHARED across all integrations
    __init__.py
    integration.py              # BaseIntegration (abstract interface)
    parser.py                   # BaseParser (markdown/README parsing)
    ai_analyzer.py              # BaseAIAnalyzer (AI analysis)

  github/                        # GitHub integration
    __init__.py
    views.py                    # Django API endpoints
    service.py                  # GitHubService (API calls)
    helpers.py                  # GitHub utilities
    ai_analyzer.py              # GitHub AI analysis
    repository_analyzer.py      # Repo analysis
    rate_limiter.py             # Rate limiting
    constants.py                # Constants
    tests/                      # Tests

  gitlab/                        # GitLab integration (future)
    __init__.py
    views.py
    service.py
    helpers.py
    ...

  npm/                          # npm integration (future)
    __init__.py
    views.py
    service.py
    ...

  registry.py                   # Integration registry
```

---

## Base Classes

### BaseIntegration

Abstract interface that all integrations must implement:

```python
from abc import ABC, abstractmethod

class BaseIntegration(ABC):
    """Base class for all platform integrations."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Integration name: 'github', 'gitlab', 'npm'."""
        pass

    @abstractmethod
    async def fetch_project_data(self, url: str, user = None) -> dict:
        """Fetch project from platform API."""
        pass

    @abstractmethod
    def normalize_project_url(self, url: str) -> str:
        """Normalize/validate URL."""
        pass

    @abstractmethod
    def extract_project_identifier(self, url: str) -> dict:
        """Extract platform-specific IDs (e.g., owner/repo)."""
        pass
```

**What each integration implements:**
- ✅ How to fetch data from their API
- ✅ How to authenticate (OAuth, API keys, etc.)
- ✅ How to normalize/validate URLs
- ✅ Any platform-specific features

### BaseParser

Generic markdown/README parser (shared across all platforms):

```python
class BaseParser:
    """Parse markdown into structured blocks."""

    @staticmethod
    def parse(readme_content: str, platform_data: dict | None = None) -> dict:
        """Parse README into blocks."""
        # Generic markdown parsing
        # Badge detection
        # Section categorization
        # Column layout optimization
```

**Shared functionality:**
- ✅ Markdown parsing
- ✅ Badge detection and grouping
- ✅ Image/link normalization
- ✅ Section categorization
- ✅ Block structure creation

### BaseAIAnalyzer

Generic AI analysis (shared across all platforms):

```python
class BaseAIAnalyzer:
    """AI-powered project analysis."""

    async def analyze_project(self, project_data: dict) -> dict:
        """Analyze project with AI."""
        # Generate architecture diagrams
        # Suggest topics/categories
        # Extract key features
```

---

## Adding a New Integration

### Example: Adding GitLab Support

**Step 1: Create directory structure**
```bash
mkdir -p core/integrations/gitlab
touch core/integrations/gitlab/__init__.py
```

**Step 2: Implement GitLabIntegration**
```python
# core/integrations/gitlab/integration.py

from core.integrations.base.integration import BaseIntegration
from core.integrations.gitlab.service import GitLabService

class GitLabIntegration(BaseIntegration):
    @property
    def name(self) -> str:
        return "gitlab"

    @property
    def display_name(self) -> str:
        return "GitLab"

    async def fetch_project_data(self, url: str, user=None) -> dict:
        # Use GitLabService to call GitLab API
        service = GitLabService()
        return await service.fetch_repository(url)

    def normalize_project_url(self, url: str) -> str:
        # GitLab URL normalization
        pass

    def extract_project_identifier(self, url: str) -> dict:
        # Extract owner/project from GitLab URL
        return {'owner': '...', 'project': '...'}
```

**Step 3: Implement GitLabService**
```python
# core/integrations/gitlab/service.py

class GitLabService:
    """Handle GitLab API calls."""

    async def fetch_repository(self, url: str) -> dict:
        # Call GitLab API
        # Return normalized data
        pass
```

**Step 4: Create Django view**
```python
# core/integrations/gitlab/views.py

from rest_framework.decorators import api_view
from core.integrations.base.parser import BaseParser
from core.integrations.gitlab.integration import GitLabIntegration

@api_view(['POST'])
async def import_gitlab_project(request):
    url = request.data.get('url')

    # Use GitLab integration
    integration = GitLabIntegration()
    project_data = await integration.fetch_project_data(url)

    # Use shared parser
    parsed = BaseParser.parse(project_data['readme_content'])

    # Create project
    # ...
```

**Step 5: Register integration**
```python
# core/integrations/gitlab/__init__.py

from core.integrations.registry import IntegrationRegistry
from .integration import GitLabIntegration

IntegrationRegistry.register(GitLabIntegration)
```

**Done!** GitLab integration complete. 🎉

---

## Integration Registry

Central registry for managing all integrations:

```python
from core.integrations.registry import IntegrationRegistry

# Auto-detect integration from URL
integration_class = IntegrationRegistry.get_for_url(url)
if integration_class:
    integration = integration_class()
    data = await integration.fetch_project_data(url)

# List all available integrations
integrations = IntegrationRegistry.list_all()
# ['github', 'gitlab', 'npm', ...]
```

---

## What's Shared vs Platform-Specific

### Shared (in `/core/integrations/base/`)

✅ **README/markdown parsing** - All platforms use markdown
✅ **Badge detection** - shields.io works everywhere
✅ **AI analysis** - Generic project analysis
✅ **Block creation** - Standard block structure
✅ **Image normalization** - Generic image handling
✅ **Link normalization** - Generic link handling

### Platform-Specific (per integration)

❌ **API calls** - GitHub API ≠ GitLab API ≠ npm API
❌ **Authentication** - Different OAuth providers
❌ **Rate limiting** - Different rules per platform
❌ **URL patterns** - Different URL structures
❌ **Metadata** - Different data formats

---

## Benefits

### 1. Easy to Add Integrations
- Copy template, implement 3-4 methods
- Inherit all shared functionality
- Self-contained module

### 2. No Code Duplication
- Parser written once, used by all
- AI analyzer shared
- Block structure standardized

### 3. Clean Organization
- Each integration is self-contained
- Clear separation of concerns
- Easy to find and maintain code

### 4. Testable
- Each integration can be tested independently
- Base classes have their own tests
- Mock integrations for testing

### 5. Scalable
- Adding integration #10 is as easy as integration #2
- No cluttered `/services/` directory
- Plugin-like architecture

---

## Migration Complete

### What Was Moved

**From:**
```
/services/
  github_service.py
  github_helpers.py
  github_ai_analyzer.py
  github_repository_analyzer.py
  github_rate_limiter.py
  github_constants.py
  readme_parser.py
```

**To:**
```
/core/integrations/
  base/
    parser.py           # Generic parser
    ai_analyzer.py      # Generic AI analysis
  github/
    service.py          # ← github_service.py
    helpers.py          # ← github_helpers.py
    ai_analyzer.py      # ← github_ai_analyzer.py
    repository_analyzer.py
    rate_limiter.py
    constants.py
```

### Import Changes

**Old:**
```python
from services.github_service import GitHubService
from services.github_helpers import normalize_github_repo_data
from services.readme_parser import ReadmeParser
```

**New:**
```python
from core.integrations.github.service import GitHubService
from core.integrations.github.helpers import normalize_github_repo_data
from core.integrations.base.parser import BaseParser
```

---

## Next Steps

### Immediate
- ✅ Base classes created
- ✅ GitHub migrated
- ✅ Imports updated
- ✅ Tests passing

### Future Integrations

**Priority 1:**
- GitLab
- Bitbucket

**Priority 2:**
- npm
- PyPI
- RubyGems

**Priority 3:**
- Docker Hub
- Packagist (PHP)
- Cargo (Rust)
- Homebrew

Each integration = ~4-6 files, ~500 lines of code

---

## Summary

New integration architecture is:
- ✅ **Scalable** - Easy to add 10+ integrations
- ✅ **Clean** - Self-contained modules
- ✅ **DRY** - No code duplication
- ✅ **Testable** - Independent testing
- ✅ **Maintainable** - Clear organization

Ready to add integrations #2-10! 🚀
