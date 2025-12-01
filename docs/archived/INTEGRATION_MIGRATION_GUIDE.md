# Integration Architecture Migration Guide

**Date:** 2025-11-27
**Version:** 1.0
**Status:** ✅ Complete

---

## Overview

The integration architecture has been refactored to support multiple external platforms (GitHub, GitLab, npm, PyPI, etc.) with a clean, scalable design. This guide helps developers migrate code that uses the old structure.

---

## What Changed

### Directory Structure

**Before:**
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

**After:**
```
/core/integrations/
  base/                      # Shared across ALL integrations
    integration.py           # BaseIntegration (abstract interface)
    parser.py                # BaseParser (markdown/README parsing)
    ai_analyzer.py           # BaseAIAnalyzer
    exceptions.py            # Integration-specific exceptions
    __init__.py

  github/                    # GitHub-specific implementation
    integration.py           # GitHubIntegration (extends BaseIntegration)
    service.py               # GitHubService (API calls)
    helpers.py               # GitHub utilities
    ai_analyzer.py           # GitHub AI analysis
    repository_analyzer.py   # Repo analysis
    rate_limiter.py          # Rate limiting
    constants.py             # Constants
    views.py                 # Django API endpoints
    tests/                   # Tests
    __init__.py

  registry.py                # IntegrationRegistry
```

---

## Import Changes

### 1. Parser (BaseParser)

**Old:**
```python
from services.readme_parser import ReadmeParser

result = ReadmeParser.parse(readme_content, repo_data)
```

**New:**
```python
from core.integrations.base.parser import BaseParser

result = BaseParser.parse(readme_content, platform_data)
```

**Notes:**
- Class renamed: `ReadmeParser` → `BaseParser`
- Parameter renamed: `repo_data` → `platform_data` (more generic)
- Functionality identical, just renamed for clarity

---

### 2. GitHub Service

**Old:**
```python
from services.github_service import GitHubService

service = GitHubService(token)
data = service.get_repository_info_sync(owner, repo)
```

**New:**
```python
from core.integrations.github.service import GitHubService

service = GitHubService(token)
data = service.get_repository_info_sync(owner, repo)
```

**Notes:**
- Import path changed only
- API remains the same

---

### 3. GitHub Helpers

**Old:**
```python
from services.github_helpers import (
    parse_github_url,
    normalize_github_repo_data,
    get_user_github_token,
)
```

**New:**
```python
from core.integrations.github.helpers import (
    parse_github_url,
    normalize_github_repo_data,
    get_user_github_token,
)
```

**Notes:**
- Import path changed only
- Functions unchanged

---

### 4. GitHub AI Analyzer

**Old:**
```python
from services.github_ai_analyzer import analyze_github_repo

analysis = analyze_github_repo(repo_data, readme_content)
```

**New:**
```python
from core.integrations.github.ai_analyzer import analyze_github_repo

analysis = analyze_github_repo(repo_data, readme_content)
```

**Notes:**
- Import path changed only
- Function unchanged

---

### 5. Rate Limiting

**Old:**
```python
from services.github_rate_limiter import github_rate_limit, GitHubRateLimiter

@github_rate_limit('repo_fetch')
def my_view(request):
    pass
```

**New:**
```python
from core.integrations.github.rate_limiter import github_rate_limit, GitHubRateLimiter

@github_rate_limit('repo_fetch')
def my_view(request):
    pass
```

**Notes:**
- Import path changed only
- Decorators unchanged

---

### 6. Constants

**Old:**
```python
from services.github_constants import MAX_RETRIES, API_TIMEOUT
```

**New:**
```python
from core.integrations.github.constants import MAX_RETRIES, API_TIMEOUT
```

**Notes:**
- Import path changed only

---

## New Features

### 1. IntegrationRegistry (Recommended Pattern)

For platform-agnostic code that should work with ANY integration:

```python
from core.integrations.registry import IntegrationRegistry

# Automatically detect which integration to use based on URL
integration_class = IntegrationRegistry.get_for_url(url)

if integration_class:
    integration = integration_class()
    print(f"Using {integration.display_name} integration")

    # Fetch data (works for GitHub, GitLab, npm, etc.)
    project_data = await integration.fetch_project_data(url, user)
```

**Benefits:**
- ✅ No need to know which platform in advance
- ✅ Automatically works when new integrations are added
- ✅ Clean, polymorphic design

---

### 2. Exception Handling

New integration-specific exceptions for better error handling:

```python
from core.integrations.base.exceptions import (
    IntegrationError,
    IntegrationAuthError,
    IntegrationNotFoundError,
    IntegrationRateLimitError,
    IntegrationNetworkError,
    IntegrationValidationError,
)

try:
    integration = GitHubIntegration()
    data = await integration.fetch_project_data(url, user)
except IntegrationAuthError as e:
    # Handle authentication issues
    return Response({'error': 'Please connect your GitHub account'}, status=401)
except IntegrationNotFoundError as e:
    # Handle 404
    return Response({'error': 'Repository not found'}, status=404)
except IntegrationRateLimitError as e:
    # Handle rate limiting
    return Response({'error': 'Rate limit exceeded'}, status=429)
except IntegrationError as e:
    # Handle general errors
    return Response({'error': str(e)}, status=500)
```

---

### 3. Type Hints

Better type hints throughout:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.users.models import User

async def fetch_project_data(self, url: str, user: "User | None" = None) -> dict[str, Any]:
    # Now properly typed!
```

---

## Migration Checklist

Use this checklist to migrate your code:

### Files to Update

- [ ] Search for `from services.readme_parser` → replace with `from core.integrations.base.parser`
- [ ] Search for `ReadmeParser` → replace with `BaseParser`
- [ ] Search for `from services.github_` → replace with `from core.integrations.github.`
- [ ] Search for `repo_data` parameter in parser calls → rename to `platform_data`

### Automated Migration (Bash)

Run these commands in your project root:

```bash
# Update parser imports
find . -name "*.py" -type f -exec sed -i '' \
  's/from services\.readme_parser import ReadmeParser/from core.integrations.base.parser import BaseParser/g' {} +

# Update parser class name
find . -name "*.py" -type f -exec sed -i '' \
  's/ReadmeParser\./BaseParser./g' {} +

# Update GitHub service imports
find . -name "*.py" -type f -exec sed -i '' \
  's/from services\.github_/from core.integrations.github./g' {} +

# Verify changes
git diff
```

### Testing After Migration

1. **Run Django Check:**
   ```bash
   python manage.py check
   ```

2. **Run Tests:**
   ```bash
   python manage.py test core.integrations.tests
   ```

3. **Test Import Endpoints:**
   - GitHub import
   - Repository list
   - AI analysis

---

## Examples

### Example 1: Simple Migration

**Before:**
```python
from services.github_service import GitHubService
from services.readme_parser import ReadmeParser

def import_repo(url, user):
    service = GitHubService(user.github_token)
    repo_files = service.get_repository_info_sync(owner, repo)

    parsed = ReadmeParser.parse(repo_files['readme'], repo_data)
    return parsed
```

**After:**
```python
from core.integrations.github.service import GitHubService
from core.integrations.base.parser import BaseParser

def import_repo(url, user):
    service = GitHubService(user.github_token)
    repo_files = service.get_repository_info_sync(owner, repo)

    parsed = BaseParser.parse(repo_files['readme'], platform_data)
    return parsed
```

---

### Example 2: Using IntegrationRegistry (Recommended)

**Before (GitHub-specific):**
```python
from services.github_service import GitHubService
from services.github_helpers import parse_github_url

def import_project(url, user):
    owner, repo = parse_github_url(url)
    service = GitHubService(user.github_token)
    data = service.get_repository_info_sync(owner, repo)
    return data
```

**After (Platform-agnostic):**
```python
from core.integrations.registry import IntegrationRegistry
from core.integrations.base.exceptions import IntegrationError

async def import_project(url, user):
    # Works with ANY integration (GitHub, GitLab, etc.)
    integration_class = IntegrationRegistry.get_for_url(url)

    if not integration_class:
        raise IntegrationError(f"Unsupported URL: {url}")

    integration = integration_class()
    data = await integration.fetch_project_data(url, user)
    return data
```

---

## Adding New Integrations

The new architecture makes adding integrations easy. Example: GitLab

### Step 1: Create Integration Class

```python
# core/integrations/gitlab/integration.py

from core.integrations.base.integration import BaseIntegration

class GitLabIntegration(BaseIntegration):
    @property
    def name(self) -> str:
        return "gitlab"

    @property
    def display_name(self) -> str:
        return "GitLab"

    async def fetch_project_data(self, url: str, user = None) -> dict:
        # Implement GitLab API calls
        pass

    def normalize_project_url(self, url: str) -> str:
        # Normalize GitLab URLs
        pass

    def extract_project_identifier(self, url: str) -> dict:
        # Extract owner/project from GitLab URL
        return {'owner': '...', 'project': '...'}
```

### Step 2: Register Integration

```python
# core/integrations/gitlab/__init__.py

from core.integrations.registry import IntegrationRegistry
from .integration import GitLabIntegration

IntegrationRegistry.register(GitLabIntegration)
```

**Done!** GitLab now works with all registry-based code automatically.

---

## FAQ

### Q: Do I need to update all my code immediately?

A: Yes. The old files have been deleted - all imports must use the new paths.

### Q: Will this break existing functionality?

A: No. The API is fully compatible. Only import paths and some class names changed - functionality is identical.

### Q: How do I know if I've migrated everything?

A: Run: `grep -r "from services.github_\|from services.readme_parser" .`

If it returns nothing, you're done!

### Q: What if I find a bug?

A: Report it with the file path and error message. The refactoring is well-tested but edge cases may exist.

---

## Summary

**What Changed:**
- ✅ Files moved to better locations
- ✅ Parser renamed (ReadmeParser → BaseParser)
- ✅ New exception classes for better error handling
- ✅ IntegrationRegistry for platform-agnostic code
- ✅ Better type hints

**What Stayed the Same:**
- ✅ API surface (methods, parameters mostly unchanged)
- ✅ Functionality (everything works the same)
- ✅ Database (no migrations needed)

**Migration Effort:**
- Small projects: 10-30 minutes
- Medium projects: 1-2 hours
- Large projects: 2-4 hours

Most of the work is find-and-replace imports!

---

## Support

If you need help migrating:
1. Check this guide first
2. Search for similar code in `core/integrations/github/`
3. Ask in #backend-help channel

Happy migrating! 🚀
