# Import Guidelines for AllThrive AI

**Purpose:** Establish consistent import patterns across the codebase following the domain-driven architecture.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Import Patterns by Context](#import-patterns-by-context)
3. [Domain Architecture](#domain-architecture)
4. [Common Scenarios](#common-scenarios)
5. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
6. [Examples](#examples)

---

## Quick Reference

| Context | Pattern | Example |
|---------|---------|---------|
| **Within same domain** | Relative imports | `from .models import Quiz` |
| **Cross-domain** | Absolute imports | `from core.users.models import User` |
| **Tests (backward compat)** | Use re-exports | `from core.models import User, Project` |
| **Model ForeignKeys** | Use settings string | `settings.AUTH_USER_MODEL` |
| **Views importing models** | Domain imports | `from .models import Project` |
| **URLs importing views** | Domain imports | `from .projects.views import ProjectViewSet` |

---

## Import Patterns by Context

### 1. Within the Same Domain

**Rule:** Use relative imports for files within the same domain package.

**Why:** Makes the domain self-contained and easier to move or refactor.

```python
# ✅ GOOD - Inside core/projects/views.py
from .models import Project, ProjectQuerySet
from .serializers import ProjectSerializer

# ❌ BAD - Don't use absolute paths within same domain
from core.projects.models import Project
from core.projects.serializers import ProjectSerializer
```

**Applies to:**
- Views importing from same domain's models/serializers
- Serializers importing from same domain's models
- Tests importing from same domain's views/models

### 2. Cross-Domain Imports

**Rule:** Use absolute imports when importing from another domain.

**Why:** Makes dependencies explicit and easier to track.

```python
# ✅ GOOD - In core/projects/models.py importing User
from django.conf import settings

class Project(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, ...)

# ✅ GOOD - In core/projects/views.py importing User for queries
from core.users.models import User

# ❌ BAD - Don't use relative imports for cross-domain
from ..users.models import User
```

**Applies to:**
- Any domain importing from another domain
- Views needing models from other domains
- Serializers needing validators from other domains

### 3. Model ForeignKey References

**Rule:** Always use `settings.AUTH_USER_MODEL` for User ForeignKeys.

**Why:** Allows User model to be swapped without breaking references.

```python
# ✅ GOOD - Using settings string reference
from django.conf import settings

class Project(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects'
    )

# ❌ BAD - Direct User import in model ForeignKey
from core.users.models import User

class Project(models.Model):
    user = models.ForeignKey(User, ...)  # Don't do this!
```

**Applies to:**
- All ForeignKey fields referencing User
- All OneToOneField fields referencing User
- All ManyToManyField fields referencing User

### 4. URL Configuration

**Rule:** Import views using domain paths.

**Why:** Makes URL configuration explicit about which domain handles each endpoint.

```python
# ✅ GOOD - In core/urls.py
from .agents.views import ConversationViewSet, MessageViewSet
from .projects.views import ProjectViewSet, public_user_projects
from .auth.views import GoogleLogin, GitHubLogin

# ❌ BAD - Don't use root-level view imports
from .views import ProjectViewSet  # views.py should be minimal
```

### 5. Admin Configuration

**Rule:** Import models using domain paths OR re-exports.

**Why:** Admin can use either pattern since it's a central configuration file.

```python
# ✅ GOOD - Direct domain imports
from .quizzes.models import Quiz, QuizQuestion
from .projects.models import Project

# ✅ ALSO GOOD - Using re-exports for brevity
from .models import Quiz, QuizQuestion, Project
```

### 6. Tests

**Rule:** Use re-exports from `core.models` for backward compatibility.

**Why:** Tests should work with both old and new import patterns.

```python
# ✅ GOOD - Using re-exports
from core.models import User, Project, Quiz

# ✅ ALSO GOOD - Direct domain imports
from core.users.models import User
from core.projects.models import Project
from core.quizzes.models import Quiz

# Choose based on test scope:
# - Integration tests: Use re-exports (testing backward compat)
# - Domain tests: Use direct imports (testing specific domain)
```

### 7. Signals

**Rule:** Use domain imports for clarity.

**Why:** Signals connect multiple domains, so explicit imports are clearer.

```python
# ✅ GOOD - In core/signals.py
from .users.models import User
from .projects.models import Project

@receiver(post_save, sender=Project)
def invalidate_project_cache(sender, instance, **kwargs):
    # ...
```

---

## Domain Architecture

### Domain Structure

```
core/
├── agents/          # AI conversations
├── auth/            # Authentication
├── users/           # User management
├── projects/        # User projects
├── quizzes/         # Quiz system
├── referrals/       # Referral system
├── taxonomy/        # Tags & categories
├── social/          # Social connections
├── battles/         # Prompt battles
├── tools/           # Tool directory
├── uploads/         # File uploads
├── audits/          # Audit logging
├── integrations/    # External integrations
│   └── github/
└── tests/           # Integration tests only
```

### Each Domain Contains

```
domain/
├── __init__.py      # Public API exports
├── models.py        # Domain models
├── views.py         # Domain views/viewsets
├── serializers.py   # Domain serializers
├── permissions.py   # Domain-specific permissions (optional)
├── services.py      # Business logic (optional)
└── tests/           # Domain-specific tests
    ├── __init__.py
    ├── test_models.py
    ├── test_views.py
    └── test_serializers.py
```

---

## Common Scenarios

### Scenario 1: Creating a New View in a Domain

```python
# In core/projects/views.py

# Within-domain imports (relative)
from .models import Project
from .serializers import ProjectSerializer

# Cross-domain imports (absolute)
from core.users.models import User
from core.throttles import PublicProjectsThrottle

# Django/DRF imports
from rest_framework import viewsets
from rest_framework.decorators import action
```

### Scenario 2: Creating a New Model with User Reference

```python
# In core/newdomain/models.py

from django.db import models
from django.conf import settings

class NewModel(models.Model):
    # ✅ Use settings.AUTH_USER_MODEL
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='new_models'
    )
```

### Scenario 3: Creating a Serializer That References Another Domain

```python
# In core/projects/serializers.py

from rest_framework import serializers

# Within-domain (relative)
from .models import Project

# If you need User model for validation
from core.users.models import User

class ProjectSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Project
        fields = ['id', 'username', 'title', ...]
```

### Scenario 4: Writing Tests

```python
# In core/projects/tests/test_views.py

from django.test import TestCase
from rest_framework.test import APIClient

# For domain tests, use direct imports
from core.projects.models import Project
from core.users.models import User

# OR use re-exports for integration tests
from core.models import Project, User

class ProjectViewSetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test')
        self.project = Project.objects.create(user=self.user, title='Test')
```

### Scenario 5: Adding a New Domain

1. Create domain directory: `core/newdomain/`
2. Create files: `__init__.py`, `models.py`, `views.py`, `serializers.py`
3. Add explicit exports to `__init__.py`:

```python
# core/newdomain/__init__.py
"""New domain - Brief description."""

from .models import NewModel
from .views import NewViewSet
from .serializers import NewSerializer

__all__ = [
    'NewModel',
    'NewViewSet',
    'NewSerializer',
]
```

4. Add re-export to `core/models.py`:

```python
# core/models.py
from .newdomain.models import NewModel

__all__ = [
    # ... existing exports
    'NewModel',
]
```

---

## Anti-Patterns to Avoid

### ❌ 1. Don't Import from `core.models` in Domain Code

```python
# ❌ BAD - In core/projects/views.py
from core.models import Project  # Don't do this!

# ✅ GOOD - Use relative import
from .models import Project
```

**Why:** Domain code should be self-contained. `core.models` is for backward compatibility only.

### ❌ 2. Don't Use Relative Imports for Cross-Domain

```python
# ❌ BAD - In core/projects/models.py
from ..users.models import User

# ✅ GOOD - Use absolute import or settings
from django.conf import settings
# Then use: settings.AUTH_USER_MODEL
```

**Why:** Relative cross-domain imports are fragile and hard to refactor.

### ❌ 3. Don't Import User Directly in Model ForeignKeys

```python
# ❌ BAD
from core.users.models import User

class Project(models.Model):
    user = models.ForeignKey(User, ...)

# ✅ GOOD
from django.conf import settings

class Project(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, ...)
```

**Why:** Hard-coded User breaks if User model is swapped.

### ❌ 4. Don't Create Circular Dependencies

```python
# ❌ BAD - core/projects/models.py
from core.users.models import User

# ❌ BAD - core/users/models.py
from core.projects.models import Project  # Circular!
```

**Why:** Creates import errors and maintenance nightmares.

**Solution:** Use `settings.AUTH_USER_MODEL` and reverse relationships.

### ❌ 5. Don't Import from `__init__.py` in Same Domain

```python
# ❌ BAD - In core/projects/views.py
from core.projects import Project  # Don't do this

# ✅ GOOD
from .models import Project
```

**Why:** Can cause circular import issues and is unnecessary.

---

## Examples by File Type

### Models (`models.py`)

```python
from django.db import models
from django.conf import settings

# Only import from Django and settings
# Don't import from other domains in models

class MyModel(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, ...)
```

### Views (`views.py`)

```python
from rest_framework import viewsets

# Within-domain (relative)
from .models import MyModel
from .serializers import MySerializer

# Cross-domain (absolute)
from core.users.models import User
from core.permissions import CustomPermission
```

### Serializers (`serializers.py`)

```python
from rest_framework import serializers

# Within-domain (relative)
from .models import MyModel

# Cross-domain if needed for validation
from core.users.models import User
```

### URLs (`urls.py`)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Domain imports (absolute from core)
from .projects.views import ProjectViewSet
from .auth.views import GoogleLogin
from .agents.views import ConversationViewSet
```

### Tests (`tests/test_*.py`)

```python
from django.test import TestCase

# Use re-exports for convenience
from core.models import User, Project

# OR use domain imports
from core.users.models import User
from core.projects.models import Project
```

---

## Migration Guide

### If You're Adding New Code

- Follow the patterns in this guide
- Use `settings.AUTH_USER_MODEL` for User ForeignKeys
- Use relative imports within domain
- Use absolute imports across domains

### If You're Updating Existing Code

1. Check if the import is within the same domain
   - Yes → Change to relative import (`.models`)
   - No → Keep absolute import (`core.domain.models`)

2. Check if it's a User ForeignKey in a model
   - Yes → Change to `settings.AUTH_USER_MODEL`
   - No → Keep as is

3. Check if it's in tests
   - Keep `core.models` imports for backward compatibility
   - OR update to domain imports if modernizing tests

---

## Quick Checklist for Code Reviews

- [ ] Models use `settings.AUTH_USER_MODEL` for User ForeignKeys
- [ ] Within-domain imports are relative (`.models`, `.serializers`)
- [ ] Cross-domain imports are absolute (`core.domain.models`)
- [ ] No circular dependencies between domains
- [ ] `__init__.py` files have `__all__` exports
- [ ] Tests can still use `core.models` re-exports
- [ ] URL imports use domain paths (`.domain.views`)

---

## References

- [Django Best Practices - Swappable User Model](https://docs.djangoproject.com/en/stable/topics/auth/customizing/#referencing-the-user-model)
- [Python Import Best Practices - PEP 8](https://pep8.org/#imports)
- [Domain-Driven Design Principles](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**Last Updated:** 2025-01-19
**Maintained By:** Development Team
**Questions?** See `docs/CORE_REFACTOR_CODE_REVIEW.md` for architecture details
