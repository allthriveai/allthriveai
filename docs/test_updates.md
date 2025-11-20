# Test Updates After Core Reorganization

## Summary

Updated test imports to work with the new domain-based structure.

## Changes Made

### Fixed Imports

**`core/tests/test_quiz.py`:**
- ❌ OLD: `from core.quiz_models import Quiz, QuizQuestion, QuizAttempt`
- ✅ NEW: `from core.quizzes.models import Quiz, QuizQuestion, QuizAttempt`

### Imports That Still Work (No Changes Needed)

The following imports continue to work because we maintained re-exports in `core/models.py`:

**`core/tests/test_user_username.py`:**
- ✅ `from core.models import User` - Still works (re-exported from `core.users.models`)

**`core/tests/test_projects.py`:**
- ✅ `from core.models import Project` - Still works (kept in `core/models.py`)

**`core/tests/test_profile_update.py`:**
- ✅ Uses `get_user_model()` - Always works

**`core/tests/test_oauth_auth.py`:**
- ✅ Uses `get_user_model()` - Always works

## Test Files Overview

| Test File | Status | Notes |
|-----------|--------|-------|
| `test_quiz.py` | ✅ Fixed | Updated import to use `core.quizzes.models` |
| `test_user_username.py` | ✅ OK | Uses `core.models.User` (re-export) |
| `test_profile_update.py` | ✅ OK | Uses `get_user_model()` |
| `test_oauth_auth.py` | ✅ OK | Uses `get_user_model()` |
| `test_projects.py` | ✅ OK | Uses `core.models.Project` |
| `test_health.py` | ✅ OK | Basic health check test |

## Verification Steps

When you activate your Python environment, run these commands:

### 1. Check for Import Errors
```bash
python manage.py check
```

### 2. Run All Tests
```bash
python manage.py test
```

### 3. Run Specific Test Suites

**Quiz tests:**
```bash
python manage.py test core.tests.test_quiz
```

**User/username tests:**
```bash
python manage.py test core.tests.test_user_username
```

**Profile update tests:**
```bash
python manage.py test core.tests.test_profile_update
```

**OAuth auth tests:**
```bash
python manage.py test core.tests.test_oauth_auth
```

**Project tests:**
```bash
python manage.py test core.tests.test_projects
```

**Health check tests:**
```bash
python manage.py test core.tests.test_health
```

### 4. Run Tests with Coverage (Optional)
```bash
coverage run --source='.' manage.py test
coverage report
```

## Expected Results

All tests should pass without modification (except for the quiz import fix we made).

The reorganization:
- ✅ Did NOT change model behavior
- ✅ Did NOT change API endpoints
- ✅ Did NOT change database schema
- ✅ Only changed internal import paths

## Potential Issues & Solutions

### If Tests Fail with ImportError

**Error:** `ModuleNotFoundError: No module named 'core.quiz_models'`
- **Solution:** Already fixed in `test_quiz.py`

**Error:** `ImportError: cannot import name 'User' from 'core.models'`
- **Solution:** Check that `core/models.py` still has the re-export:
  ```python
  from .users.models import User
  ```

**Error:** `ImportError: cannot import name 'Conversation' from 'core.models'`
- **Solution:** Check that `core/models.py` has the agents re-export:
  ```python
  from .agents.models import Conversation, Message
  ```

### If Tests Fail with AttributeError

This usually means a model method or property is missing. Check that we didn't accidentally remove any model code during the move.

### If Django Can't Find Models

**Error:** `django.core.exceptions.ImproperlyConfigured: Model class ... doesn't declare an explicit app_label`

**Solution:** Ensure all moved models are properly registered in Django. Since we didn't change app structure (everything is still in `core`), this shouldn't happen.

## Test Coverage by Domain

After reorganization, consider organizing tests by domain too:

```
core/tests/
├── __init__.py
├── test_health.py                  # Keep (global)
├── agents/
│   ├── test_conversations.py      # New
│   ├── test_messages.py           # New
│   └── test_auth_chat.py          # New
├── quizzes/
│   └── test_quiz.py               # Move here
├── users/
│   ├── test_user_username.py      # Move here
│   ├── test_profile_update.py     # Move here
│   └── test_oauth_auth.py         # Move here
└── projects/
    └── test_projects.py            # Move here (or keep in root)
```

This is optional but would match the domain structure.

## Summary

- ✅ Only 1 import needed fixing (`test_quiz.py`)
- ✅ All other tests should work as-is
- ✅ Re-exports in `core/models.py` maintain backward compatibility
- ✅ No test logic changes required
- ✅ No API or model behavior changes

Run `python manage.py test` to verify everything works!
