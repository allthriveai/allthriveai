.PHONY: help up down restart restart-all restart-frontend restart-backend build rebuild logs logs-frontend logs-backend logs-celery logs-redis logs-db shell-frontend shell-backend shell-db shell-redis django-shell test test-backend test-frontend test-username test-coverage frontend create-pip recreate-pip seed-quizzes seed-all reset-db sync-backend sync-frontend sync-all diagnose-sync clean clean-all clean-volumes clean-cache migrate makemigrations collectstatic createsuperuser dbshell lint lint-backend lint-frontend format format-backend format-frontend type-check pre-commit security-check ps status reset-onboarding

help:
	@echo "Available commands:"
	@echo ""
	@echo "Service Management:"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make restart-all     - Shut down and restart all services"
	@echo "  make restart-frontend - Restart frontend only"
	@echo "  make restart-backend  - Restart backend only"
	@echo "  make build           - Build all services"
	@echo "  make rebuild         - Rebuild all services (no cache)"
	@echo "  make ps              - Show running containers"
	@echo "  make status          - Show container status"
	@echo ""
	@echo "Logs:"
	@echo "  make logs            - View all logs (follow)"
	@echo "  make logs-frontend   - View frontend logs"
	@echo "  make logs-backend    - View backend logs"
	@echo "  make logs-celery     - View Celery worker logs"
	@echo "  make logs-redis      - View Redis logs"
	@echo "  make logs-db         - View PostgreSQL logs"
	@echo ""
	@echo "Shells:"
	@echo "  make shell-frontend  - Open shell in frontend container"
	@echo "  make shell-backend   - Open shell in backend container"
	@echo "  make shell-db        - Open PostgreSQL shell"
	@echo "  make shell-redis     - Open Redis CLI"
	@echo "  make django-shell    - Open Django shell"
	@echo "  make dbshell         - Open Django dbshell"
	@echo ""
	@echo "Database & Migrations:"
	@echo "  make migrate         - Run Django migrations"
	@echo "  make makemigrations  - Create new Django migrations"
	@echo "  make dbshell         - Open Django database shell"
	@echo "  make createsuperuser - Create Django superuser"
	@echo ""
	@echo "Data Management:"
	@echo "  make create-pip      - Create Pip bot user (if doesn't exist)"
	@echo "  make recreate-pip    - Delete and recreate Pip with latest data"
	@echo "  make seed-quizzes    - Seed initial quiz data"
	@echo "  make seed-all        - Seed all initial data"
	@echo "  make reset-db        - ⚠️  DANGER: Flush database and reseed"
	@echo ""
	@echo "Testing:"
	@echo "  make test            - Run all tests (backend + frontend)"
	@echo "  make test-backend    - Run all backend tests"
	@echo "  make test-frontend   - Run all frontend tests"
	@echo "  make test-username   - Run username/user isolation tests"
	@echo "  make test-websocket  - Run WebSocket unit tests"
	@echo "  make test-websocket-e2e - Run WebSocket end-to-end test"
	@echo "  make test-proxy      - Test Docker proxy connectivity (run this first!)"
	@echo "  make test-coverage   - Run backend tests with coverage report"
	@echo "  make reset-onboarding - Print JS to reset Ember onboarding (run in browser console)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint            - Run linting for all code"
	@echo "  make lint-backend    - Run backend linting (ruff)"
	@echo "  make lint-frontend   - Run frontend linting"
	@echo "  make format          - Format all code"
	@echo "  make format-backend  - Format backend code (ruff)"
	@echo "  make format-frontend - Format frontend code"
	@echo "  make type-check      - Run frontend type checking"
	@echo "  make security-check  - Run security checks (bandit)"
	@echo "  make pre-commit      - Run pre-commit hooks on all files"
	@echo ""
	@echo "Docker Sync (for troubleshooting):"
	@echo "  make sync-backend    - Manually sync backend files to Docker"
	@echo "  make sync-frontend   - Manually sync frontend files to Docker"
	@echo "  make sync-all        - Manually sync all files to Docker"
	@echo "  make diagnose-sync   - Run Docker volume sync diagnostics"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean           - Clean Python cache and build files"
	@echo "  make clean-cache     - Clean cache files only"
	@echo "  make clean-volumes   - ⚠️  Remove Docker volumes (data loss!)"
	@echo "  make clean-all       - ⚠️  Remove containers, volumes, and cache"
	@echo ""
	@echo "Django:"
	@echo "  make collectstatic   - Collect static files"
	@echo "  make frontend        - Run frontend dev server locally (non-Docker)"

frontend:
	cd frontend && npm run dev

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

restart-all:
	@echo "Shutting down all services..."
	docker-compose down
	@echo "Starting all services..."
	docker-compose up -d
	@echo "✓ All services restarted successfully!"

restart-frontend:
	docker-compose restart frontend

restart-backend:
	docker-compose restart web

build:
	docker-compose up --build -d

rebuild:
	@echo "Rebuilding all services (no cache)..."
	docker-compose build --no-cache
	docker-compose up -d
	@echo "✓ Services rebuilt successfully!"

ps:
	docker-compose ps

status:
	@echo "=== Container Status ==="
	docker-compose ps

logs:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f web

logs-celery:
	docker-compose logs -f celery

logs-redis:
	docker-compose logs -f redis

logs-db:
	docker-compose logs -f db

shell-frontend:
	docker-compose exec frontend /bin/sh

shell-backend:
	docker-compose exec web /bin/bash

shell-db:
	@echo "Opening PostgreSQL shell..."
	docker-compose exec db psql -U ${POSTGRES_USER:-allthrive} -d ${POSTGRES_DB:-allthrive_ai}

shell-redis:
	@echo "Opening Redis CLI..."
	docker-compose exec redis redis-cli

django-shell:
	@echo "Opening Django shell..."
	docker-compose exec web python manage.py shell

dbshell:
	@echo "Opening Django database shell..."
	docker-compose exec web python manage.py dbshell

# Data commands
create-pip:
	@echo "Creating Pip bot user..."
	docker-compose exec web python manage.py create_pip

recreate-pip:
	@echo "Recreating Pip with latest data..."
	docker-compose exec web python manage.py create_pip --recreate

seed-quizzes:
	@echo "Seeding quizzes..."
	docker-compose exec web python manage.py seed_quizzes

seed-all:
	@echo "Seeding all initial data..."
	docker-compose exec web python manage.py seed_topics
	docker-compose exec web python manage.py seed_taxonomies
	docker-compose exec web python manage.py seed_categories
	docker-compose exec web python manage.py seed_tools
	docker-compose exec web python manage.py seed_quizzes
	@echo "✓ All data seeded successfully!"

reset-db:
	@echo "⚠️  WARNING: This will DELETE all data in the database!"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	@echo "Flushing database..."
	docker-compose exec web python manage.py flush --no-input
	@echo "Running migrations..."
	docker-compose exec web python manage.py migrate
	@echo "Seeding initial data..."
	@make seed-all
	@echo "✓ Database reset complete with initial data!"

# Testing commands
test: test-backend test-frontend
	@echo "All tests completed!"

test-backend:
	@echo "Running backend tests..."
	docker-compose exec web python manage.py test --verbosity=2

test-frontend:
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test

test-username:
	@echo "Running username and user isolation tests..."
	docker-compose exec web python manage.py test core.tests.test_user_username --verbosity=2

test-websocket:
	@echo "Running WebSocket unit tests..."
	docker-compose exec web python manage.py test core.agents.tests.test_websocket --verbosity=2

test-websocket-e2e:
	@echo "Running WebSocket end-to-end connectivity test..."
	@echo "Testing from backend container to verify WebSocket infrastructure..."
	docker-compose exec web python scripts/test_websocket.py testuser testpass123

test-proxy:
	@echo "=== Testing Docker Network Connectivity ==="
	@echo ""
	@echo "1. Checking frontend can reach backend (web:8000)..."
	@docker-compose exec -T frontend wget -q -O /dev/null http://web:8000/api/v1/auth/csrf/ 2>/dev/null && echo "   ✅ Frontend -> Backend: OK" || echo "   ❌ Frontend -> Backend: FAILED (check if web container is running)"
	@echo ""
	@echo "2. Checking VITE_API_PROXY_TARGET is set correctly..."
	@docker-compose exec -T frontend sh -c 'echo "   VITE_API_PROXY_TARGET=$$VITE_API_PROXY_TARGET"'
	@docker-compose exec -T frontend sh -c '[ "$$VITE_API_PROXY_TARGET" = "http://web:8000" ] && echo "   ✅ Proxy target correct" || echo "   ❌ Proxy target should be http://web:8000 (run: docker-compose up -d frontend)"'
	@echo ""
	@echo "3. Verifying proxy can fetch data..."
	@docker-compose exec -T frontend wget -q -O - http://web:8000/api/v1/auth/csrf/ 2>/dev/null | grep -q csrfToken && echo "   ✅ API response valid" || echo "   ❌ API response invalid"
	@echo ""
	@echo "=== Proxy Configuration Summary ==="
	@echo "For Docker: VITE_API_PROXY_TARGET is set in docker-compose.yml"
	@echo "For local dev (non-Docker): Set VITE_API_PROXY_TARGET=http://localhost:8000 in frontend/.env"

test-coverage:
	@echo "Running backend tests with coverage..."
	docker-compose exec web coverage run --source='.' manage.py test
	docker-compose exec web coverage report
	docker-compose exec web coverage html
	@echo "Coverage report generated in htmlcov/index.html"

# Docker sync commands (for when automatic volume sync isn't working)
sync-backend:
	@bash scripts/sync_to_docker.sh backend

sync-frontend:
	@bash scripts/sync_to_docker.sh frontend

sync-all:
	@bash scripts/sync_to_docker.sh all

diagnose-sync:
	@bash scripts/diagnose_docker_sync.sh

# Database & Migration Commands
migrate:
	@echo "Running migrations..."
	docker-compose exec web python manage.py migrate

makemigrations:
	@echo "Creating migrations..."
	docker-compose exec web python manage.py makemigrations

createsuperuser:
	@echo "Creating superuser..."
	docker-compose exec web python manage.py createsuperuser

collectstatic:
	@echo "Collecting static files..."
	docker-compose exec web python manage.py collectstatic --no-input

# Code Quality Commands
lint: lint-backend lint-frontend
	@echo "✓ All linting complete!"

lint-backend:
	@echo "Running backend linting (ruff)..."
	docker-compose exec web ruff check .

lint-frontend:
	@echo "Running frontend linting..."
	docker-compose exec frontend npm run lint

format: format-backend format-frontend
	@echo "✓ All formatting complete!"

format-backend:
	@echo "Formatting backend code (ruff)..."
	docker-compose exec web ruff format .

format-frontend:
	@echo "Formatting frontend code..."
	docker-compose exec frontend npm run format

type-check:
	@echo "Running frontend type checking..."
	docker-compose exec frontend npm run type-check

security-check:
	@echo "Running security checks (bandit)..."
	docker-compose exec web bandit -c pyproject.toml -r .

pre-commit:
	@echo "Running pre-commit hooks on all files..."
	pre-commit run --all-files

# Cleanup Commands
clean-cache:
	@echo "Cleaning cache files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	rm -f .coverage
	rm -rf htmlcov/
	@echo "✓ Cache cleaned!"

clean: clean-cache
	@echo "Cleaning build files..."
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Build files cleaned!"

clean-volumes:
	@echo "⚠️  WARNING: This will DELETE all Docker volumes (database data will be lost)!"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker-compose down -v
	@echo "✓ Volumes removed!"

clean-all: down clean
	@echo "⚠️  WARNING: This will remove ALL containers, volumes, and cache!"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✓ Complete cleanup done!"

# Testing Utilities
reset-onboarding:
	@echo ""
	@echo "🐉 To reset Ember onboarding, run this in your browser console:"
	@echo ""
	@echo "localStorage.removeItem('allthrive_onboarding_dismissed'); localStorage.removeItem('allthrive_onboarding_completed_adventures'); localStorage.removeItem('allthrive_completed_quests'); location.reload();"
	@echo ""
	@echo "This will clear all onboarding state and show the Ember modal again."
	@echo ""
