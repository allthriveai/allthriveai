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
├── core/              # Main Django app with models, views, serializers
├── services/          # Business logic and AI provider integrations
├── config/            # Django settings and configuration
├── frontend/          # TypeScript/React frontend application
├── docs/              # All documentation files
├── scripts/           # Utility scripts (e.g., setup_oauth.py)
├── templates/         # Django HTML templates
├── staticfiles/       # Collected static files
└── examples/          # Example code and demos
```

### Key Files

- `manage.py` - Django management script
- `celery.py` - Celery task queue configuration
- `docker-compose.yml` - Multi-service Docker setup
- `Makefile` - Development commands and shortcuts
- `pre-push` - Git hook for pre-push validations
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

- **Never bypass pre-commit hooks** (no `--no-verify`)
- **Never bypass pre-push hooks** (no `git push --no-verify`)
- Run all checks in the pre-push hook before pushing
- Only commit when explicitly asked by the user

### Code Quality

- Use **ruff** for Python code formatting (not black - avoid conflicts)
- Use **TypeScript** for all frontend development
- Run linting and type checking before committing
- Write tests for new features

## Code Organization Rules

### Services Pattern

- Keep all business logic in `/services` subfolder
- Services handle AI provider integrations, authentication logic, etc.
- Example: `services/ai_provider.py`, `services/auth_agent/`

### Models

- User models: `core/user_models.py`
- Audit models: `core/audit_models.py`
- Main models: `core/models.py`

### Views & Serializers

- Authentication views: `core/auth_views.py`, `core/auth_chat_views.py`
- Authentication serializers: `core/auth_serializers.py`
- General views: `core/views.py`
- General serializers: `core/serializers.py`

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

- Backend tests: `core/tests/`, `services/tests/`
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
2. **Never commit .env files**
3. **Always use Docker with standard ports (3000/8000)**
4. **Keep documentation in /docs folder**
5. **Use TypeScript for frontend development**
6. **Use ruff for Python formatting**
7. **Test before committing**
8. **Only commit when explicitly requested**
9. **Use first-party cookies for auth (not localStorage)**
10. **Generate/include thumbnails when relevant**

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

## Troubleshooting

- Check `docs/` folder for specific implementation guides
- OAuth issues: see `docs/OAUTH_COMPLETE_SUMMARY.md`
- Security: see `docs/SECURITY_IMPLEMENTATION.md`
- Deployment: see `docs/DEPLOYMENT_CONFIG.md`
