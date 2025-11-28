# Core App Reorganization Plan

## Current Problem

The `/core` Django app has grown to contain 30+ files in a single flat directory, making it hard to navigate and maintain:

- Many `*_models.py` files (quiz, battle, referral, taxonomy, social, user, role, audit)
- Many `*_views.py` files
- Many `*_serializers.py` files
- Shared files like `urls.py`, `permissions.py`, `signals.py`

## Proposed Structure: Domain-Based Subpackages

Organize code by **domain** (feature area) rather than by layer (models/views/serializers):

```
core/
├── __init__.py
├── apps.py
├── urls.py                  # Main URL router
├── permissions.py           # Shared permissions
├── signals.py               # Shared signals
├── admin.py                 # Shared admin (or split later)
├── models.py                # Global/common models (if any remain)
├── views.py                 # Global/common views (db_health, etc.)
├── serializers.py           # Global/common serializers (if any remain)
│
├── users/                   # User management domain
│   ├── __init__.py
│   ├── models.py            # User, UserRole (from user_models.py + role_models.py)
│   ├── views.py             # User profile, activity views (from auth_views.py)
│   ├── serializers.py       # UserSerializer, etc. (from auth_serializers.py)
│   └── admin.py             # User-specific admin (optional)
│
├── auth/                    # Authentication domain
│   ├── __init__.py
│   ├── views.py             # GoogleLogin, GitHubLogin, signup, logout, oauth_callback
│   ├── chat_views.py        # auth_chat_stream, auth_chat_state (from auth_chat_views.py)
│   ├── serializers.py       # Auth-specific serializers (from auth_serializers.py)
│   └── throttles.py         # Auth-specific throttles (if any)
│
├── projects/                # Project management domain
│   ├── __init__.py
│   ├── models.py            # Project-related models (from models.py if split)
│   ├── views.py             # ProjectViewSet, etc. (from views.py)
│   ├── chat_views.py        # project_chat_stream, project_chat_stream_v2
│   ├── serializers.py       # Project serializers (from serializers.py)
│   └── admin.py             # Project-specific admin (optional)
│
├── quizzes/                 # Quiz feature domain
│   ├── __init__.py
│   ├── models.py            # Quiz, QuizQuestion, QuizAttempt (from quiz_models.py)
│   ├── views.py             # QuizViewSet, QuizAttemptViewSet (from quiz_views.py)
│   ├── serializers.py       # Quiz serializers (from quiz_serializers.py)
│   └── throttles.py         # QuizStartThrottle, QuizAnswerThrottle (from quiz_throttles.py)
│
├── referrals/               # Referral program domain
│   ├── __init__.py
│   ├── models.py            # ReferralCode, Referral (from referral_models.py)
│   ├── views.py             # ReferralCodeViewSet, ReferralViewSet (from referral_views.py)
│   └── serializers.py       # Referral serializers (from serializers.py or create)
│
├── taxonomy/                # User personalization & taxonomy domain
│   ├── __init__.py
│   ├── models.py            # Taxonomy, UserTag, UserInteraction (from taxonomy_models.py)
│   ├── views.py             # TaxonomyViewSet, UserTagViewSet (from taxonomy_views.py)
│   └── serializers.py       # Taxonomy serializers (from taxonomy_serializers.py)
│
├── social/                  # Social OAuth connections domain
│   ├── __init__.py
│   ├── models.py            # SocialConnection, SocialProvider (from social_models.py)
│   ├── views.py             # list_connections, connect_provider, etc. (from social_views.py)
│   └── serializers.py       # Social serializers (create if needed)
│
├── battles/                 # Prompt Battle feature domain
│   ├── __init__.py
│   ├── models.py            # PromptBattle, BattleSubmission, BattleInvitation (from battle_models.py)
│   ├── views.py             # PromptBattleViewSet, BattleInvitationViewSet (from battle_views.py)
│   └── serializers.py       # Battle serializers (from battle_serializers.py)
│
├── uploads/                 # File upload domain
│   ├── __init__.py
│   └── views.py             # upload_image, upload_file (from upload_views.py)
│
├── integrations/            # External integrations domain
│   ├── __init__.py
│   └── github/
│       ├── __init__.py
│       ├── views.py         # github_sync_*, github_repos_list (from github_sync_views.py)
│       └── serializers.py   # GitHub-specific serializers (create if needed)
│
├── audits/                  # Audit logging domain
│   ├── __init__.py
│   └── models.py            # UserAuditLog (from audit_models.py)
│
├── fixtures/                # Keep existing fixtures
├── management/              # Keep existing management commands
├── migrations/              # Keep existing migrations (Django will handle)
└── tests/                   # Keep existing tests
    ├── test_users.py
    ├── test_auth.py
    ├── test_quizzes.py
    ├── test_battles.py
    └── ...
```

---

## Migration Strategy

We'll migrate **one domain at a time** to minimize risk and keep everything working.

### Phase 1: Quizzes (Small, self-contained)

1. **Create domain package:**
   ```bash
   mkdir core/quizzes
   touch core/quizzes/__init__.py
   ```

2. **Move files:**
   - `quiz_models.py` → `core/quizzes/models.py`
   - `quiz_views.py` → `core/quizzes/views.py`
   - `quiz_serializers.py` → `core/quizzes/serializers.py`
   - `quiz_throttles.py` → `core/quizzes/throttles.py`

3. **Update imports in moved files:**
   - Change `from .quiz_models import` → `from .models import`
   - Change `from .quiz_serializers import` → `from .serializers import`
   - Change `from .auth_serializers import` → `from core.auth.serializers import` (once auth is migrated)

4. **Update `core/urls.py`:**
   ```python
   from .quizzes.views import QuizViewSet, QuizAttemptViewSet
   ```

5. **Test:**
   - Run Django checks: `python manage.py check`
   - Run quiz tests: `python manage.py test core.tests.test_quizzes`
   - Try quiz endpoints in browser/Postman

6. **Optional: Leave compatibility shim temporarily:**
   ```python
   # core/quiz_views.py
   from core.quizzes.views import *  # noqa
   ```
   (Delete once confirmed no other imports exist)

---

### Phase 2: Referrals

1. Create `core/referrals/`
2. Move `referral_models.py` → `referrals/models.py`
3. Move `referral_views.py` → `referrals/views.py`
4. Extract or create `referrals/serializers.py` from `serializers.py`
5. Update imports in `urls.py` and within the moved files
6. Test referral endpoints

---

### Phase 3: Taxonomy

1. Create `core/taxonomy/`
2. Move `taxonomy_models.py` → `taxonomy/models.py`
3. Move `taxonomy_views.py` → `taxonomy/views.py`
4. Move `taxonomy_serializers.py` → `taxonomy/serializers.py`
5. Update imports
6. Test taxonomy endpoints

---

### Phase 4: Social

1. Create `core/social/`
2. Move `social_models.py` → `social/models.py`
3. Move `social_views.py` → `social/views.py`
4. Create `social/serializers.py` if needed
5. Update imports
6. Test social OAuth connections

---

### Phase 5: Battles

1. Create `core/battles/`
2. Move `battle_models.py` → `battles/models.py`
3. Move `battle_views.py` → `battles/views.py`
4. Move `battle_serializers.py` → `battles/serializers.py`
5. Update imports
6. Test battle endpoints

---

### Phase 6: Uploads

1. Create `core/uploads/`
2. Move `upload_views.py` → `uploads/views.py`
3. Update imports in `urls.py`
4. Test upload endpoints

---

### Phase 7: Integrations (GitHub)

1. Create `core/integrations/github/`
2. Move `github_sync_views.py` → `integrations/github/views.py`
3. Create `integrations/github/serializers.py` if needed
4. Update imports
5. Test GitHub sync endpoints

---

### Phase 8: Auth (More complex)

1. Create `core/auth/`
2. Move relevant parts of `auth_views.py` → `auth/views.py`
3. Move `auth_chat_views.py` → `auth/chat_views.py`
4. Move relevant parts of `auth_serializers.py` → `auth/serializers.py`
5. Update imports in `urls.py` and internal references
6. Test all auth flows (signup, login, OAuth, chat)

---

### Phase 9: Users

1. Create `core/users/`
2. Move `user_models.py` → `users/models.py`
3. Move `role_models.py` models into `users/models.py` (combine)
4. Move user-related views from `auth_views.py` (like `UserProfileView`, `user_activity`) → `users/views.py`
5. Move user-related serializers → `users/serializers.py`
6. Update imports
7. Test user profile and activity endpoints

---

### Phase 10: Audits

1. Create `core/audits/`
2. Move `audit_models.py` → `audits/models.py`
3. No views/serializers yet (mostly internal)
4. Update imports where `UserAuditLog` is used

---

### Phase 11: Projects (Last, since it ties into main models.py)

1. Create `core/projects/`
2. Extract project-related models from `models.py` → `projects/models.py`
3. Extract project views from `views.py` → `projects/views.py`
4. Move `project_chat_views.py` → `projects/chat_views.py`
5. Extract project serializers from `serializers.py` → `projects/serializers.py`
6. Update imports
7. Test project CRUD and chat endpoints

---

### Phase 12: Clean up root `/core` files

After all migrations:

1. **Review remaining files in `/core`:**
   - `models.py` – should be empty or contain only global models (Conversation, Message if not moved)
   - `views.py` – should contain only global views like `db_health`, `csp_report`, `public_user_projects`
   - `serializers.py` – should be empty or contain only global serializers
   - `permissions.py`, `signals.py`, `admin.py`, `urls.py` – keep as shared

2. **Delete compatibility shims** (e.g., `quiz_views.py` re-exports)

3. **Update WARP.md** to reflect new structure

4. **Run full test suite:**
   ```bash
   python manage.py test
   ```

5. **Verify all API endpoints work in local dev environment**

---

## Import Path Changes

### Before:
```python
from core.quiz_models import Quiz
from core.quiz_views import QuizViewSet
from core.quiz_serializers import QuizSerializer
```

### After:
```python
from core.quizzes.models import Quiz
from core.quizzes.views import QuizViewSet
from core.quizzes.serializers import QuizSerializer
```

---

## Benefits of This Reorganization

1. **Easier navigation:** All quiz-related code is in `core/quizzes/`, all battle code in `core/battles/`, etc.
2. **Better modularity:** Each domain package is self-contained and can be understood independently.
3. **Clearer dependencies:** It's obvious when one domain depends on another (e.g., `from core.users.models import User`).
4. **Easier testing:** Test files map cleanly to domain packages.
5. **Scalability:** As features grow, we add more domains without cluttering the root `/core` folder.
6. **Onboarding:** New developers can explore one domain at a time.

---

## Key Guidelines

- **Domain-first, not layer-first:** We organize by feature (quizzes, battles), not by layer (models, views).
- **Minimize cross-domain imports in models:** Models in one domain should avoid importing models from others where possible (use Django's string references like `'users.User'` in ForeignKey if needed).
- **Keep `/core/urls.py` as the main router:** It imports from domain packages and wires them up.
- **Use `__init__.py` to expose main classes:** Optionally, each domain's `__init__.py` can re-export key classes for cleaner imports:
  ```python
  # core/quizzes/__init__.py
  from .models import Quiz, QuizQuestion, QuizAttempt
  from .views import QuizViewSet, QuizAttemptViewSet
  from .serializers import QuizSerializer
  ```

---

## Example: After Quizzes Migration

```python
# core/urls.py
from .quizzes.views import QuizViewSet, QuizAttemptViewSet

main_router = DefaultRouter()
main_router.register(r'quizzes', QuizViewSet, basename='quiz')
```

```python
# core/quizzes/models.py
import uuid
from django.db import models
from django.conf import settings

class Quiz(models.Model):
    # ...
```

```python
# core/quizzes/views.py
from rest_framework import viewsets
from .models import Quiz, QuizQuestion, QuizAttempt
from .serializers import QuizSerializer, QuizDetailSerializer
from .throttles import QuizStartThrottle, QuizAnswerThrottle

class QuizViewSet(viewsets.ReadOnlyModelViewSet):
    # ...
```

```python
# core/quizzes/serializers.py
from rest_framework import serializers
from .models import Quiz, QuizQuestion, QuizAttempt
from core.auth.serializers import UserSerializer  # Once auth is migrated

class QuizSerializer(serializers.ModelSerializer):
    # ...
```

---

## Timeline Estimate

Assuming this is a local-only repo with no migrations to worry about:

- **Phase 1 (Quizzes):** ~30 minutes
- **Phases 2-7 (Referrals, Taxonomy, Social, Battles, Uploads, Integrations):** ~30 minutes each = ~3 hours
- **Phase 8 (Auth):** ~1 hour (more complex)
- **Phase 9 (Users):** ~1 hour (more complex)
- **Phase 10 (Audits):** ~15 minutes
- **Phase 11 (Projects):** ~1 hour
- **Phase 12 (Clean up):** ~30 minutes

**Total:** ~8-10 hours, spread across multiple sessions

---

## Next Steps

1. **Review and approve this plan**
2. **Start with Phase 1 (Quizzes)** as a proof-of-concept
3. **Test thoroughly after each phase**
4. **Continue through remaining phases**
5. **Update WARP.md with new structure once complete**

---

This reorganization will make `/core` much more maintainable and scalable as the application grows.
