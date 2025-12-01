# Makefile Command Reference

Complete reference for all `make` commands in AllThrive AI.

## Quick Start

```bash
make help    # Show all available commands
make up      # Start all services
make down    # Stop all services
```

---

## Service Management

### `make up`
Start all Docker services in detached mode.
```bash
make up
```

### `make down`
Stop all running Docker services.
```bash
make down
```

### `make restart`
Restart all services without stopping containers.
```bash
make restart
```

### `make restart-all`
Complete restart - stops all services and starts them fresh.
```bash
make restart-all
```

### `make restart-frontend`
Restart only the frontend container.
```bash
make restart-frontend
```

### `make restart-backend`
Restart only the backend (web) container.
```bash
make restart-backend
```

### `make build`
Build and start all services.
```bash
make build
```

### `make rebuild`
Rebuild all services from scratch (no cache). Use when dependencies change.
```bash
make rebuild
```

### `make ps`
Show running containers.
```bash
make ps
```

### `make status`
Show detailed container status.
```bash
make status
```

---

## Logs

### `make logs`
View all service logs (follows/tails).
```bash
make logs
```
Press `Ctrl+C` to exit.

### `make logs-frontend`
View frontend logs only.
```bash
make logs-frontend
```

### `make logs-backend`
View backend (Django) logs only.
```bash
make logs-backend
```

### `make logs-celery`
View Celery worker logs.
```bash
make logs-celery
```

### `make logs-redis`
View Redis logs.
```bash
make logs-redis
```

### `make logs-db`
View PostgreSQL database logs.
```bash
make logs-db
```

---

## Interactive Shells

### `make shell-frontend`
Open a shell in the frontend container.
```bash
make shell-frontend
# You'll get: /bin/sh
```

### `make shell-backend`
Open a bash shell in the backend container.
```bash
make shell-backend
# You'll get: /bin/bash
```

### `make shell-db`
Open PostgreSQL command line interface.
```bash
make shell-db
# You'll get: psql
```

### `make shell-redis`
Open Redis CLI.
```bash
make shell-redis
# You'll get: redis-cli
```

### `make django-shell`
Open Django's interactive Python shell.
```bash
make django-shell
# You'll get: Django shell with models loaded
```

### `make dbshell`
Open Django's database shell.
```bash
make dbshell
# You'll get: psql via Django
```

---

## Database & Migrations

### `make migrate`
Run Django database migrations.
```bash
make migrate
```

### `make makemigrations`
Create new Django migrations based on model changes.
```bash
make makemigrations
```

### `make createsuperuser`
Create a Django superuser for admin access.
```bash
make createsuperuser
# Interactive - you'll be prompted for username, email, password
```

---

## Data Management

### `make create-pip`
Create the Pip bot user if it doesn't exist.
```bash
make create-pip
```

### `make recreate-pip`
Delete and recreate Pip bot with latest data.
```bash
make recreate-pip
```

### `make seed-quizzes`
Seed initial quiz data into the database.
```bash
make seed-quizzes
```

### `make seed-all`
Seed all initial data (topics, taxonomies, categories, tools, quizzes).
```bash
make seed-all
```

### `make reset-db` ⚠️
**DANGER**: Flush database, run migrations, and reseed all data.
```bash
make reset-db
# You'll be prompted for confirmation
```

---

## Testing

### `make test`
Run all tests (backend + frontend).
```bash
make test
```

### `make test-backend`
Run all backend (Django) tests with verbosity.
```bash
make test-backend
```

### `make test-frontend`
Run all frontend tests.
```bash
make test-frontend
```

### `make test-username`
Run username and user isolation tests specifically.
```bash
make test-username
```

### `make test-coverage`
Run backend tests with coverage report.
```bash
make test-coverage
# Generates htmlcov/index.html
```

---

## Code Quality

### `make lint`
Run linting for all code (backend + frontend).
```bash
make lint
```

### `make lint-backend`
Run backend linting with ruff.
```bash
make lint-backend
```

### `make lint-frontend`
Run frontend linting.
```bash
make lint-frontend
```

### `make format`
Format all code (backend + frontend).
```bash
make format
```

### `make format-backend`
Format backend code with ruff.
```bash
make format-backend
```

### `make format-frontend`
Format frontend code.
```bash
make format-frontend
```

### `make type-check`
Run TypeScript type checking.
```bash
make type-check
```

### `make security-check`
Run security checks with bandit.
```bash
make security-check
```

### `make pre-commit`
Run all pre-commit hooks on all files.
```bash
make pre-commit
```

---

## Docker Sync (Troubleshooting)

### `make diagnose-sync`
Run diagnostics to check Docker volume sync status.
```bash
make diagnose-sync
```

### `make sync-backend`
Manually sync backend files to Docker container.
```bash
make sync-backend
# Use when auto-sync isn't working
```

### `make sync-frontend`
Manually sync frontend files to Docker container.
```bash
make sync-frontend
```

### `make sync-all`
Manually sync all files to Docker containers.
```bash
make sync-all
```

See [Docker Volume Sync Guide](DOCKER_VOLUME_SYNC.md) for more details.

---

## Cleanup

### `make clean-cache`
Remove Python cache files (.pyc, __pycache__, etc.).
```bash
make clean-cache
```

### `make clean`
Clean cache files and build artifacts.
```bash
make clean
```

### `make clean-volumes` ⚠️
**DANGER**: Remove Docker volumes (DATABASE DATA WILL BE LOST).
```bash
make clean-volumes
# You'll be prompted for confirmation
```

### `make clean-all` ⚠️
**DANGER**: Remove containers, volumes, and cache.
```bash
make clean-all
# You'll be prompted for confirmation
```

---

## Django Commands

### `make collectstatic`
Collect static files for production.
```bash
make collectstatic
```

### `make frontend`
Run frontend dev server locally (non-Docker).
```bash
make frontend
# Runs: cd frontend && npm run dev
```

---

## Common Workflows

### Starting Development
```bash
make up           # Start all services
make logs         # Watch logs
```

### After Code Changes
```bash
# Backend changes
make restart-backend
make logs-backend

# Frontend changes (usually auto-reloads)
make logs-frontend
```

### After Model Changes
```bash
make makemigrations
make migrate
```

### Before Committing
```bash
make lint
make format
make test
```

### Debugging Issues
```bash
make ps                    # Check container status
make logs-backend          # Check backend logs
make shell-backend         # Debug in container
make django-shell          # Test Django code
```

### Clean Start
```bash
make down
make clean-cache
make up
make migrate
make seed-all
```

### Complete Reset ⚠️
```bash
make clean-all      # Remove everything
make build          # Rebuild
make migrate        # Run migrations
make seed-all       # Reseed data
```

---

## Environment Variables

Commands use environment variables from `.env`:
- `POSTGRES_USER` (default: allthrive)
- `POSTGRES_PASSWORD` (default: allthrive)
- `POSTGRES_DB` (default: allthrive_ai)

Example:
```bash
# Override defaults
POSTGRES_USER=myuser make shell-db
```

---

## Tips

1. **Always check logs** - Use `make logs-<service>` to debug issues
2. **Use tab completion** - Type `make` and press tab to see commands
3. **Restart services** - Use `make restart-<service>` for quick restarts
4. **Clean regularly** - Run `make clean-cache` to free up space
5. **Test before commit** - Run `make lint` and `make test` before pushing

---

## Troubleshooting

### Command fails with "container not running"
```bash
make ps              # Check container status
make up              # Start services if needed
```

### "Permission denied" errors
```bash
# Add execute permission to scripts
chmod +x scripts/*.sh
```

### Migrations not applying
```bash
make down
make up
make migrate
```

### Container won't start
```bash
make logs-<service>  # Check what's wrong
make rebuild         # Rebuild if dependencies changed
```

### Out of disk space
```bash
make clean-cache     # Clean cache files
make clean-volumes   # Remove old volumes (⚠️ data loss)
docker system prune  # Clean Docker system
```

---

## Related Documentation

- [README](../README.md) - Project overview
- [Database Seeding Guide](DATABASE_SEEDING_GUIDE.md) - Data seeding details
- [Docker Volume Sync](DOCKER_VOLUME_SYNC.md) - Sync troubleshooting
- [Styleguide](STYLEGUIDE.md) - Coding standards
