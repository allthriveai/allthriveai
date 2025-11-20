# AllThrive AI - Warp Assistant Guidelines

This document provides project-specific guidelines for Warp AI Assistant when working on the AllThrive AI codebase.

## Project Overview

AllThrive AI is a full-stack AI application featuring:
- **Backend**: Django REST Framework with PostgreSQL
- **Frontend**: TypeScript/React/Vite (port 3000)
- **Backend API**: Django (port 8000)
- **Task Queue**: Celery with Redis
- **AI Integration**: OpenAI, Anthropic, LangChain

## Architecture & Structure

### Directory Organization

```
allthriveai/
├── core/              # Django app with domain-driven architecture
│   ├── agents/        # Conversation & Message models
│   ├── auth/          # Authentication views, serializers, tests
│   ├── users/         # User, UserRole, UserProfile models
│   ├── projects/      # Project models, views, serializers
│   ├── quizzes/       # Quiz, QuizAttempt, QuizQuestion models
│   ├── referrals/     # Referral, ReferralCode models
│   ├── taxonomy/      # Taxonomy, UserTag, UserInteraction models
│   ├── social/        # SocialConnection, SocialProvider models
│   ├── battles/       # Battle-related models
│   ├── uploads/       # FileUpload models
│   ├── tools/         # Tool-related models
│   ├── audits/        # UserAuditLog models
│   └── tests/         # Integration tests only (domain tests in respective folders)
├── services/          # Business logic and AI provider integrations
├── config/            # Django settings and configuration
├── frontend/          # TypeScript/React frontend application
├── docs/              # All documentation files
├── scripts/           # Utility scripts (setup_oauth.py, pre-commit hooks)
├── templates/         # Django HTML templates
├── staticfiles/       # Collected static files
└── examples/          # Example code and demos
```

### Key Files

- `manage.py` - Django management script
- `config/celery.py` - Celery task queue configuration
- `docker-compose.yml` - Multi-service Docker setup
- `Makefile` - Development commands and shortcuts
- `.pre-commit-config.yaml` - Pre-commit hooks configuration
- `requirements.txt` - Python dependencies

## Development Practices

### Docker & Ports

- **Always use Docker** for development with standardized ports:
  - Frontend: port 3000
  - Backend: port 8000
- Use `make` commands for all Docker operations (see Makefile)

### Environment Variables

- Never commit `.env` files
- Always update `.env.example` when adding new environment variables
- Use environment variables for all secrets (OAuth, API keys, etc.)

### Git Workflow

- **Pre-commit hooks are INSTALLED and ACTIVE**
- **Never bypass pre-commit hooks** (no `git commit --no-verify`)
- **Never bypass pre-push hooks** (no `git push --no-verify`)
- Hooks automatically enforce:
  - Code formatting (black, isort)
  - Linting (flake8, autoflake)
  - Security checks (bandit)
  - No hardcoded URLs
  - Explicit ViewSet permissions
  - Domain imports (no `from core.models import`)
  - `settings.AUTH_USER_MODEL` usage
- Only commit when explicitly asked by the user
- See `docs/PRE_COMMIT_SETUP.md` for details

### Code Quality

- Pre-commit hooks use **black** for Python formatting (line length: 120)
- Use **isort** for import sorting (compatible with black)
- Use **TypeScript** for all frontend development
- Hooks automatically run linting and formatting on commit
- Write tests for new features

## Code Organization Rules

### Services Pattern

- Keep all business logic in `/services` subfolder
- Services handle AI provider integrations, authentication logic, etc.
- Example: `services/ai_provider.py`, `services/auth_agent/`

### Domain-Driven Architecture

**IMPORTANT**: Core has been restructured into 12 domain packages. Always use domain imports.

#### Import Guidelines

```python
# ✅ CORRECT - Domain imports
from core.users.models import User, UserRole, UserProfile
from core.projects.models import Project
from core.agents.models import Conversation, Message
from core.quizzes.models import Quiz, QuizAttempt
from core.referrals.models import Referral, ReferralCode
from core.taxonomy.models import Taxonomy, UserTag
from core.social.models import SocialConnection, SocialProvider
from core.audits.models import UserAuditLog

# ❌ WRONG - Never import from core.models
from core.models import User, Project  # Pre-commit hook will reject this!
```

#### ForeignKey Usage

```python
# ✅ CORRECT - Use settings.AUTH_USER_MODEL
from django.conf import settings

class Project(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

# ❌ WRONG - Direct User import
from core.users.models import User

class Project(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
```

#### Domain Structure

Each domain package contains:
- `models.py` - Domain models
- `serializers.py` - API serializers
- `views.py` - ViewSets and views
- `tests/` - Domain-specific tests
- `__init__.py` - Explicit exports with `__all__`

#### Key Domains

- **users**: User, UserRole, UserProfile
- **projects**: Project and related models
- **agents**: Conversation, Message (AI chat)
- **auth**: Authentication views, serializers, logic
- **quizzes**: Quiz system
- **referrals**: Referral tracking
- **taxonomy**: Tags and personalization
- **social**: OAuth connections
- **audits**: User activity logs

### Documentation

- Keep all `.md` documentation files in `/docs` folder
- Exception: `README.md` stays in root
- Update relevant docs when making significant changes

## Authentication & Security

### OAuth Implementation

- OAuth providers: Google and GitHub
- Use **first-party cookies** for authentication (no localStorage tokens)
- Never use `localStorage.getItem('access_token')` in frontend code
- OAuth setup scripts are in `/scripts` folder

### Permissions

- Custom permissions defined in `core/permissions.py`
- Follow existing permission patterns for new features

## AI Integration

### Vector Storage

- Use **RedisVL** for vector storage (not Qdrant)
- AI provider logic in `services/ai_provider.py`

### Terminology

- Use "AI agents" (not "AI assistants")
- Never use the word "compliance" in any user-facing text
- Never use "REFACTORED" or "legacy" in text or communication

## Testing

### Running Tests

```bash
make test              # All tests
make test-backend      # Backend tests only
make test-frontend     # Frontend tests only
```

### Test Organization

- **Domain tests**: `core/<domain>/tests/` (e.g., `core/projects/tests/test_projects.py`)
- **Integration tests**: `core/tests/` (cross-domain tests)
- **Service tests**: `services/tests/`
- Always verify code with tests before marking work complete
- Check README or codebase for project-specific test frameworks

## Database

- **PostgreSQL** is the primary database
- Migrations in `core/migrations/`
- Always run migrations after model changes:
  ```bash
  python manage.py makemigrations
  python manage.py migrate
  ```

## Common Commands

### Make Commands
```bash
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make logs            # View all logs
make shell-backend   # Backend container shell
make shell-frontend  # Frontend container shell
```

### Django Commands
```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py test
python manage.py collectstatic
```

## API Structure

All API endpoints are versioned under `/api/v1/`:
- `/api/v1/conversations/` - Conversation management
- `/api/v1/messages/` - Message history
- `/api/v1/projects/` - Project management
- `/api/v1/auth/` - Authentication endpoints
- `/api/v1/db/health/` - Database health check

## Important Reminders

1. **Never disable or bypass pre-commit/pre-push hooks**
2. **Always use domain imports** (never `from core.models import`)
3. **Use `settings.AUTH_USER_MODEL`** in ForeignKeys
4. **Never commit .env files**
5. **Always use Docker with standard ports (3000/8000)**
6. **Keep documentation in /docs folder**
7. **Use TypeScript for frontend development**
8. **Use black + isort** (pre-commit enforces this)
9. **Test before committing**
10. **Only commit when explicitly requested**
11. **Use first-party cookies for auth (not localStorage)**
12. **Generate/include thumbnails when relevant**
13. **All ViewSets must have explicit `permission_classes`**

## Style & Documentation

- Refer to `docs/STYLEGUIDE.md` for detailed coding standards
- Follow existing patterns and idioms in the codebase
- Write clear commit messages
- Update documentation when making significant changes

## Frontend Development

- React with TypeScript
- Vite build tool
- See `frontend/README.md` for frontend-specific guidelines
- Frontend code should not access `localStorage` for tokens

## Pre-Commit Hooks

### What Gets Checked

**Standard Tools:**
- Black (formatting, line length 120)
- isort (import sorting)
- flake8 (linting with docstrings)
- autoflake (remove unused imports)
- bandit (security scanning)
- Django upgrade (Django 4.2+ patterns)

**Custom AllThrive AI Rules:**
1. **No Hardcoded URLs** - Blocks `http://localhost:3000`, requires `settings.FRONTEND_URL`
2. **Explicit Permissions** - All ViewSets must have `permission_classes = [...]`
3. **Domain Imports** - Blocks `from core.models import`, requires domain imports
4. **AUTH_USER_MODEL** - ForeignKeys must use `settings.AUTH_USER_MODEL`
5. **Magic Numbers** - Warns about magic numbers (doesn't block)

### Setup

```bash
# Pre-commit is already installed and configured
# Hooks run automatically on commit

# Manual run on all files
pre-commit run --all-files

# Manual run on specific files
pre-commit run --files core/projects/models.py
```

### Common Fixes

```bash
# If hooks fail, they often auto-fix files
# Just re-add and commit:
git add .
git commit -m "Your message"

# View hook details
cat .pre-commit-config.yaml
```

See `docs/PRE_COMMIT_SETUP.md` for complete documentation.

## Troubleshooting

- Check `docs/` folder for specific implementation guides
- OAuth issues: see `docs/OAUTH_COMPLETE_SUMMARY.md`
- Security: see `docs/SECURITY_IMPLEMENTATION.md`
- Deployment: see `docs/DEPLOYMENT_CONFIG.md`
- Domain structure: see `docs/CORE_REFACTOR_CODE_REVIEW.md`
- Import guidelines: see `docs/IMPORT_GUIDELINES.md`
- Pre-commit setup: see `docs/PRE_COMMIT_SETUP.md`
