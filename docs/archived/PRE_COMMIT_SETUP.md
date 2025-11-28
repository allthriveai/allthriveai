# Pre-Commit Hooks Setup Guide

**Purpose:** Automatically enforce code quality and best practices before commits.

---

## Quick Setup

```bash
# 1. Install pre-commit
pip install pre-commit

# 2. Install the git hooks
pre-commit install

# 3. Install hooks for push stage too
pre-commit install --hook-type pre-push

# 4. (Optional) Run on all files to check current state
pre-commit run --all-files
```

---

## What Gets Checked

### On Every Commit:

1. **Black** - Python code formatting (line length: 120)
2. **isort** - Import sorting
3. **flake8** - Linting with docstring checks
4. **autoflake** - Remove unused imports/variables
5. **bandit** - Security vulnerability scanning
6. **General checks**:
   - Trailing whitespace
   - End of file fixer
   - YAML/JSON/TOML syntax
   - Merge conflicts
   - Large files (>1MB)
   - Private keys
7. **Django upgrade** - Ensures Django 4.2+ patterns

### Custom AllThrive AI Rules (On Commit):

✅ **No Hardcoded URLs**
- Blocks: `http://localhost:3000`, `getattr(settings, 'URL', 'http://...')`
- Fix: Use `settings.FRONTEND_URL` or `settings.BACKEND_URL`

✅ **Explicit Permission Classes**
- Ensures all ViewSets have `permission_classes = [...]`
- Prevents accidental security bugs

✅ **No core.models Imports**
- Blocks: `from core.models import User`
- Fix: `from core.users.models import User`

✅ **settings.AUTH_USER_MODEL Usage**
- Ensures ForeignKeys use `settings.AUTH_USER_MODEL`
- Not `models.ForeignKey(User, ...)`

⚠️ **Magic Numbers Warning**
- Warns about numbers >10 that should be constants
- Doesn't block commit, just warns

### On Push Only:

⚠️ **TODO/FIXME Comments**
- Warns about TODO/FIXME/XXX/HACK comments
- Reminds you to complete them before production
- Can bypass with `git push --no-verify` (not recommended)

---

## Example Output

### ✅ Success
```bash
$ git commit -m "Add new feature"

black....................................................................Passed
isort....................................................................Passed
flake8...................................................................Passed
No Hardcoded URLs........................................................Passed
Check ViewSet Permissions................................................Passed

[main abc1234] Add new feature
```

### ❌ Failure
```bash
$ git commit -m "Add feature"

No Hardcoded URLs........................................................Failed
- hook id: no-hardcoded-urls

❌ Hardcoded URLs found in core/referrals/serializers.py:
  Line 44: base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

  Fix: Use settings.FRONTEND_URL or settings.BACKEND_URL instead
  Example: base_url = settings.FRONTEND_URL

============================================================
FAIL: Hardcoded URLs detected
============================================================
```

---

## Bypassing Hooks (Emergency Only)

```bash
# Skip pre-commit hooks (NOT RECOMMENDED)
git commit --no-verify

# Skip pre-push hooks (NOT RECOMMENDED)
git push --no-verify
```

**Warning:** Only bypass hooks if absolutely necessary (e.g., emergency hotfix). The rules exist for good reasons!

---

## Updating Hooks

```bash
# Update to latest versions of all hooks
pre-commit autoupdate

# Re-install after updating
pre-commit install
```

---

## Running Manually

```bash
# Run all hooks on staged files
pre-commit run

# Run all hooks on all files
pre-commit run --all-files

# Run specific hook
pre-commit run black --all-files
pre-commit run no-hardcoded-urls --all-files

# Run only custom hooks
pre-commit run no-hardcoded-urls
pre-commit run check-permissions
pre-commit run no-core-models-import
pre-commit run check-auth-user-model
```

---

## Custom Hook Details

### 1. No Hardcoded URLs

**File:** `scripts/pre-commit-hooks/check_no_hardcoded_urls.py`

**Detects:**
- `http://localhost:3000`
- `http://127.0.0.1:8000`
- `getattr(settings, 'URL', 'http://default')`

**Exceptions:**
- Comments (`# http://example.com`)
- Docstrings
- Test files
- Fixtures
- Migrations

**Fix Example:**
```python
# ❌ BAD
base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

# ✅ GOOD
base_url = settings.FRONTEND_URL  # Fails fast if not configured
```

---

### 2. Check ViewSet Permissions

**File:** `scripts/pre-commit-hooks/check_permissions.py`

**Detects:**
- ViewSets without explicit `permission_classes`

**Fix Example:**
```python
# ❌ BAD
class MyViewSet(viewsets.ModelViewSet):
    serializer_class = MySerializer
    # Missing permission_classes!

# ✅ GOOD
class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MySerializer
```

---

### 3. No core.models Imports

**File:** `scripts/pre-commit-hooks/check_no_core_models.py`

**Detects:**
- `from core.models import User, Project`

**Exceptions:**
- Test files
- `core/admin.py` (allowed for convenience)

**Fix Example:**
```python
# ❌ BAD
from core.models import User, Project

# ✅ GOOD
from core.users.models import User
from core.projects.models import Project
```

---

### 4. Check AUTH_USER_MODEL

**File:** `scripts/pre-commit-hooks/check_auth_user_model.py`

**Detects:**
- `models.ForeignKey(User, ...)` in model files

**Exceptions:**
- Test files
- `core/users/models.py` (where User is defined)

**Fix Example:**
```python
# ❌ BAD
from core.users.models import User

class Project(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)

# ✅ GOOD
from django.conf import settings

class Project(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
```

---

### 5. Check TODOs (Push Only)

**File:** `scripts/pre-commit-hooks/check_todos.py`

**Detects:**
- `# TODO: ...`
- `# FIXME: ...`
- `# XXX: ...`
- `# HACK: ...`

**Behavior:**
- Only runs on `git push`, not on commit
- Warns but allows push if needed
- Reminds to complete TODOs before production

---

### 6. Magic Numbers (Warning Only)

**File:** `scripts/pre-commit-hooks/check_magic_numbers.py`

**Detects:**
- Numeric literals > 10 that aren't in a constants file

**Exceptions:**
- 0, 1, 2, -1, 100, 1000 (common values)
- Port numbers
- Version numbers
- Test files
- Migrations
- Files named `constants.py`

**Behavior:**
- Warns but doesn't block commit
- Suggests extracting to constants

---

## Troubleshooting

### Hook fails but file looks fine
```bash
# Try running black/isort manually
black core/
isort core/

# Then try again
git add .
git commit -m "Fix"
```

### "command not found: pre-commit"
```bash
# Make sure pre-commit is installed
pip install pre-commit

# Or install globally
pipx install pre-commit
```

### Hooks not running
```bash
# Reinstall hooks
pre-commit uninstall
pre-commit install
pre-commit install --hook-type pre-push
```

### Want to skip ONE hook
```bash
# Set environment variable
SKIP=no-hardcoded-urls git commit -m "Message"

# Skip multiple
SKIP=black,flake8 git commit -m "Message"
```

### Too many false positives
Edit `.pre-commit-config.yaml` and adjust the `exclude` patterns for specific hooks.

---

## Configuration File

Location: `.pre-commit-config.yaml`

### Modify Hook Behavior

```yaml
# Change line length
- id: black
  args: ['--line-length=100']  # Changed from 120

# Add file exclusions
- id: no-hardcoded-urls
  exclude: |
    (?x)^(
      .*/tests/.*|
      my_special_file\.py|  # Add this
      scripts/pre-commit-hooks/.*
    )$
```

---

## CI/CD Integration

Add to your CI pipeline (GitHub Actions, GitLab CI, etc.):

```yaml
# .github/workflows/pre-commit.yml
name: Pre-commit Checks
on: [push, pull_request]

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - uses: pre-commit/action@v3.0.0
```

---

## Summary

**Pre-commit hooks ensure:**
- ✅ Consistent code formatting
- ✅ No security vulnerabilities
- ✅ No hardcoded configuration
- ✅ Explicit security permissions
- ✅ Clean imports and architecture
- ✅ No magic numbers
- ✅ TODOs completed before production

**Install once, benefit forever!**

---

**Last Updated:** 2025-01-19
**Maintained By:** Development Team
**Questions?** See `.pre-commit-config.yaml` for hook details
