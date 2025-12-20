.PHONY: help up down restart restart-all restart-frontend restart-backend build rebuild logs logs-frontend logs-backend logs-celery logs-redis logs-db shell-frontend shell-backend shell-db shell-redis django-shell test test-backend test-frontend test-username test-coverage test-e2e test-e2e-chat test-e2e-chat-ai test-e2e-chat-edge test-e2e-ui test-e2e-debug frontend create-pip recreate-pip seed-quizzes seed-challenge-types seed-all add-tool export-tools load-tools export-tasks load-tasks reset-db sync-backend sync-frontend sync-all diagnose-sync clean clean-all clean-volumes clean-cache migrate makemigrations collectstatic createsuperuser dbshell lint lint-backend lint-frontend format format-backend format-frontend type-check pre-commit security-check ps status setup-test-login reset-onboarding stop-impersonation end-all-impersonations aws-validate cloudfront-clear-cache pull-prod-db anonymize-users create-youtube-agent regenerate-battle-images regenerate-user-images

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
	@echo "  make seed-ai-pricing - Seed AI provider pricing for cost tracking"
	@echo "  make seed-battle-prompts - Seed battle prompts for prompt battles"
	@echo "  make seed-test-users - Create test users for admin impersonation"
	@echo "  make seed-test-users-clean - Recreate test users (delete old ones first)"
	@echo "  make seed-all        - Seed all initial data (topics, categories, tools, quizzes, challenges, billing, pip, test users)"
	@echo "  make add-tool        - Add a new tool (interactive, or: WEBSITE=url LOGO=filename.png)"
	@echo "  make export-tools    - Export tools from database to YAML file"
	@echo "  make load-tools      - Load tools from YAML file into database"
	@echo "  make export-tasks    - Export tasks from database to YAML file"
	@echo "  make load-tasks      - Load tasks from YAML file into database"
	@echo "  make export-uat-scenarios - Export UAT scenarios from database to YAML file"
	@echo "  make load-uat-scenarios   - Load UAT scenarios from YAML file into database"
	@echo "  make aws-load-uat-scenarios - Load UAT scenarios on AWS production"
	@echo "  make refresh-tool-news - Refresh What's New for tools (TOOL=slug, LIMIT=n, DRY_RUN=1)"
	@echo "  make create-youtube-agent - Create YouTube feed agent (CHANNEL_URL, SOURCE_NAME required)"
	@echo "  make regenerate-battle-images - Regenerate battle images (USER=username, DRY_RUN=1)"
	@echo "  make regenerate-user-images - Regenerate user article hero images (USER=username, STYLE=dark_academia)"
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
	@echo "  make test-e2e        - Run all Playwright E2E tests"
	@echo "  make test-e2e-github - Run GitHub Import E2E tests (mission critical)"
	@echo "  make test-e2e-critical - Run ALL mission critical E2E tests"
	@echo "  make test-ai-integration - Run GitHub AI hallucination tests (requires API keys)"
	@echo "  make test-chat-ai-integration - Run Intelligent Chat AI tests (requires API keys)"
	@echo "  make test-all-ai-integration - Run ALL AI integration tests"
	@echo "  make test-e2e-chat   - Run Intelligent Chat E2E tests"
	@echo "  make test-e2e-chat-ai - Run AI workflow tests (requires API keys)"
	@echo "  make test-e2e-chat-edge - Run Chat edge case tests"
	@echo "  make test-e2e-battles - Run Prompt Battles E2E tests (quick)"
	@echo "  make test-e2e-battles-critical - Run Prompt Battles tests with full AI judging (~90s)"
	@echo "  make test-e2e-ui     - Run E2E tests with browser UI (headed)"
	@echo "  make test-e2e-debug  - Run E2E tests in debug mode"
	@echo "  make setup-test-login - Set password for test user (for Chrome DevTools MCP)"
	@echo "  make reset-onboarding - Print JS to reset Ember onboarding (run in browser console)"
	@echo "  make stop-impersonation - Print JS to stop admin impersonation (run in browser console)"
	@echo "  make end-all-impersonations - End all active impersonation sessions in database"
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
	@echo "AWS Deployment:"
	@echo "  make aws-validate    - Validate AWS infrastructure connections (ENVIRONMENT=production|staging)"
	@echo "  make cloudfront-clear-cache - Invalidate CloudFront cache (ENVIRONMENT=production|staging)"
	@echo "  make aws-run-command CMD=\"...\" - Run a Django management command on AWS ECS"
	@echo "  make aws-seed-test-users - Create test users on AWS for impersonation"
	@echo "  make aws-seed-all    - Seed all initial data on AWS"
	@echo "  make sync-user-projects USERNAME=... - Export local user projects to S3"
	@echo "  make aws-import-user-projects USERNAME=... - Import user projects on AWS from S3"
	@echo "  make pull-prod-db    - Pull production database to local (anonymizes user PII)"
	@echo "  make anonymize-users - Anonymize user PII in local database (for prod data safety)"
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

# Create a YouTube feed agent
# Usage: make create-youtube-agent CHANNEL_URL="https://www.youtube.com/@ChannelName" SOURCE_NAME="Channel Name"
# Optional: AVATAR="https://..." WEBSITE="https://..." TWITTER="https://..." INSTAGRAM="https://..." LINKEDIN="https://..." GITHUB="https://..."
create-youtube-agent:
ifndef CHANNEL_URL
	$(error CHANNEL_URL is required. Usage: make create-youtube-agent CHANNEL_URL="https://www.youtube.com/@ChannelName" SOURCE_NAME="Channel Name")
endif
ifndef SOURCE_NAME
	$(error SOURCE_NAME is required. Usage: make create-youtube-agent CHANNEL_URL="https://www.youtube.com/@ChannelName" SOURCE_NAME="Channel Name")
endif
	@echo "Creating YouTube feed agent for $(SOURCE_NAME)..."
	docker-compose exec web python manage.py create_youtube_feed_agent \
		--channel-url="$(CHANNEL_URL)" \
		--source-name="$(SOURCE_NAME)" \
		$(if $(AVATAR),--avatar="$(AVATAR)") \
		$(if $(WEBSITE),--website="$(WEBSITE)") \
		$(if $(TWITTER),--twitter="$(TWITTER)") \
		$(if $(INSTAGRAM),--instagram="$(INSTAGRAM)") \
		$(if $(LINKEDIN),--linkedin="$(LINKEDIN)") \
		$(if $(GITHUB),--github="$(GITHUB)") \
		--sync

seed-quizzes:
	@echo "Seeding quizzes..."
	docker-compose exec web python manage.py seed_quizzes

seed-ai-pricing:
	@echo "Seeding AI provider pricing..."
	docker-compose exec web python manage.py seed_ai_pricing

seed-battle-prompts:
	@echo "Seeding battle prompts..."
	docker-compose exec web python manage.py seed_battle_prompts

# Legacy alias for seed-challenge-types (now uses seed_battle_prompts)
seed-challenge-types: seed-battle-prompts

seed-test-users:
	@echo "Creating test users for impersonation..."
	docker-compose exec web python manage.py create_test_users --count=10

seed-test-users-clean:
	@echo "Recreating test users (deleting old ones first)..."
	docker-compose exec web python manage.py create_test_users --delete-existing --delete-beta --count=10

seed-all:
	@echo "Seeding all initial data..."
	docker-compose exec web python manage.py seed_topics
	docker-compose exec web python manage.py seed_taxonomies
	docker-compose exec web python manage.py seed_categories
	docker-compose exec web python manage.py seed_tools
	docker-compose exec web python manage.py seed_quizzes
	docker-compose exec web python manage.py seed_battle_prompts
	docker-compose exec web python manage.py seed_billing
	docker-compose exec web python manage.py seed_credit_packs
	docker-compose exec web python manage.py seed_ai_pricing
	docker-compose exec web python manage.py seed_achievements
	docker-compose exec web python manage.py create_pip
	docker-compose exec web python manage.py create_test_users --count=10
	@echo "✓ All data seeded successfully!"

add-tool:
	@echo "Adding new tool to directory..."
ifdef WEBSITE
	docker-compose exec web python manage.py add_tool --website $(WEBSITE) --logo /logos/$(LOGO)
else
	docker-compose exec web python manage.py add_tool
endif

export-tools:
	@echo "Exporting tools to YAML..."
	docker-compose exec -T web python manage.py export_tools

refresh-tool-news:
	@echo "Refreshing tool news..."
ifdef TOOL
	docker-compose exec -T web python manage.py refresh_tool_news --tool $(TOOL) $(if $(DRY_RUN),--dry-run,)
else ifdef LIMIT
	docker-compose exec -T web python manage.py refresh_tool_news --limit $(LIMIT) $(if $(DRY_RUN),--dry-run,)
else
	docker-compose exec -T web python manage.py refresh_tool_news $(if $(DRY_RUN),--dry-run,)
endif

# Image regeneration commands
regenerate-battle-images:
	@echo "Regenerating battle images from saved prompts..."
ifdef USER
	docker-compose exec -T web python manage.py regenerate_battle_images --user $(USER) $(if $(DRY_RUN),--dry-run,) $(if $(LIMIT),--limit $(LIMIT),)
else
	docker-compose exec -T web python manage.py regenerate_battle_images $(if $(DRY_RUN),--dry-run,) $(if $(LIMIT),--limit $(LIMIT),)
endif

regenerate-user-images:
ifndef USER
	$(error USER is required. Usage: make regenerate-user-images USER=username [STYLE=dark_academia] [DRY_RUN=1])
endif
	@echo "Regenerating article hero images for $(USER)..."
	docker-compose exec -T web python manage.py regenerate_user_images $(USER) $(if $(STYLE),--style $(STYLE),) $(if $(DRY_RUN),--dry-run,)

load-tools:
	@echo "Loading tools from YAML..."
	docker-compose exec -T web python manage.py seed_tools

# Task YAML commands
export-tasks:
	@echo "Exporting tasks to YAML..."
	docker-compose exec -T web python manage.py export_tasks

load-tasks:
	@echo "Loading tasks from YAML..."
	docker-compose exec -T web python manage.py seed_tasks

# UAT Scenarios YAML commands
export-uat-scenarios:
	@echo "Exporting UAT scenarios to YAML..."
	docker-compose exec web python manage.py export_uat_scenarios

load-uat-scenarios:
	@echo "Loading UAT scenarios from YAML..."
	docker-compose exec web python manage.py seed_uat_scenarios

# Deploy UAT scenarios to production
aws-load-uat-scenarios:
	@echo "Loading UAT scenarios on AWS $(ENVIRONMENT)..."
	@make aws-run-command CMD="seed_uat_scenarios"

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
	docker-compose exec web python manage.py test --verbosity=2 --noinput --keepdb

# Mission Critical E2E Tests - These should NEVER fail
test-e2e-github:
	@echo "Running GitHub Import E2E tests (mission critical)..."
	docker-compose exec -T web python manage.py test core.tests.e2e.test_github_import --verbosity=2 --noinput --keepdb

test-e2e-critical:
	@echo "Running ALL mission critical E2E tests..."
	docker-compose exec -T web python manage.py test core.tests.e2e --verbosity=2 --noinput --keepdb

test-ai-integration:
	@echo "Running AI Integration tests (calls real AI - requires API keys)..."
	@echo "These tests validate AI doesn't hallucinate tech stacks, categories, etc."
	docker-compose exec -T web python manage.py test core.tests.e2e.test_github_ai_integration --verbosity=2 --noinput --keepdb

test-chat-ai-integration:
	@echo "Running Intelligent Chat AI Integration tests (calls real AI)..."
	@echo "Tests: GitHub import, URL clipping, help questions, video upload, infographics"
	docker-compose exec -T web python manage.py test core.tests.e2e.test_intelligent_chat --verbosity=2 --noinput --keepdb

test-all-ai-integration:
	@echo "Running ALL AI Integration tests (GitHub + Chat)..."
	docker-compose exec -T web python manage.py test core.tests.e2e.test_github_ai_integration core.tests.e2e.test_intelligent_chat --verbosity=2 --noinput --keepdb

# Clean formatted output versions (suppress noisy logs)
test-e2e-critical-clean:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║         MISSION CRITICAL E2E TESTS - Clean Output                ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@docker-compose exec -T -e LOG_LEVEL=WARNING web python manage.py test core.tests.e2e --verbosity=2 --noinput --keepdb 2>&1 | grep -E "^(test_|ok|FAIL|ERROR|Ran |OK|FAILED|------)" || true
	@echo ""

test-ai-integration-clean:
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════════════╗"
	@echo "║         AI INTEGRATION TESTS - Clean Output                      ║"
	@echo "╚══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@docker-compose exec -T -e LOG_LEVEL=WARNING web python manage.py test core.tests.e2e.test_github_ai_integration core.tests.e2e.test_intelligent_chat --verbosity=2 --noinput --keepdb 2>&1 | grep -E "^(test_|ok|FAIL|ERROR|Ran |OK|FAILED|------|✅|❌)" || true
	@echo ""

test-frontend:
	@echo "Running frontend tests..."
	docker-compose exec frontend npm test

test-username:
	@echo "Running username and user isolation tests..."
	docker-compose exec web python manage.py test core.tests.test_user_username --verbosity=2 --noinput --keepdb

test-websocket:
	@echo "Running WebSocket unit tests..."
	docker-compose exec web python manage.py test core.agents.tests.test_websocket --verbosity=2 --noinput --keepdb

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
	docker-compose exec web coverage run --source='.' manage.py test --noinput --keepdb
	docker-compose exec web coverage report
	docker-compose exec web coverage html
	@echo "Coverage report generated in htmlcov/index.html"

test-e2e:
	@echo "Running all E2E tests..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test

test-e2e-chat:
	@echo "Running Intelligent Chat E2E tests..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test e2e/intelligent-chat.spec.ts

test-e2e-chat-ai:
	@echo "Running AI workflow E2E tests (requires API keys)..."
	@echo "Note: Make sure backend is running (make up) and AI API keys are configured"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test e2e/intelligent-chat.spec.ts --grep "Real User Workflows"

test-e2e-chat-edge:
	@echo "Running Chat Edge Case E2E tests..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test e2e/intelligent-chat.spec.ts --grep "Edge Cases"

test-e2e-battles:
	@echo "Running Prompt Battles E2E tests (quick)..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test e2e/prompt-battles.spec.ts

test-e2e-battles-critical:
	@echo "Running Prompt Battles CRITICAL E2E tests (with full AI judging ~90s)..."
	@echo "Note: Make sure backend is running (make up)"
	@echo "This test waits for AI image generation and judging to complete."
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 RUN_CRITICAL_E2E=true npx playwright test e2e/prompt-battles.spec.ts --headed

test-e2e-ui:
	@echo "Running E2E tests with UI (headed mode)..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test --headed

test-e2e-debug:
	@echo "Running E2E tests in debug mode..."
	@echo "Note: Make sure backend is running (make up)"
	cd frontend && VITE_WS_URL=ws://127.0.0.1:8000 npx playwright test --debug

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
setup-test-login:
	@echo "Setting up test user login for Chrome DevTools MCP testing..."
	@docker-compose exec -T web python manage.py shell -c "from core.users.models import User; u = User.objects.filter(username='alliejones42').first(); exec('u.set_password(\"testpass123\"); u.save(); print(\"✅ Password set for alliejones42\")') if u else print('❌ User alliejones42 not found')"
	@echo ""
	@echo "To log in via Chrome DevTools MCP, run this JavaScript in the browser:"
	@echo ""
	@echo "fetch('/api/v1/auth/test-login/', {"
	@echo "  method: 'POST',"
	@echo "  headers: { 'Content-Type': 'application/json' },"
	@echo "  body: JSON.stringify({ username: 'alliejones42', password: 'testpass123' }),"
	@echo "  credentials: 'include'"
	@echo "}).then(r => r.json()).then(console.log);"
	@echo ""

reset-onboarding:
	@echo ""
	@echo "🐉 To reset Ember onboarding, run this in your browser console:"
	@echo ""
	@echo "// Clear all onboarding state for all users"
	@echo "Object.keys(localStorage).filter(k => k.startsWith('ember_onboarding_')).forEach(k => localStorage.removeItem(k));"
	@echo "localStorage.removeItem('ember_open_chat');"
	@echo "localStorage.removeItem('allthrive_completed_quests');"
	@echo "location.reload();"
	@echo ""
	@echo "This will clear all onboarding state and show the Ember modal again."
	@echo ""

stop-impersonation:
	@echo ""
	@echo "🎭 To stop impersonation, run this in your browser console (on localhost:3000):"
	@echo ""
	@echo "fetch('/api/v1/admin/impersonate/stop/', { method: 'POST', credentials: 'include' })"
	@echo "  .then(r => r.json())"
	@echo "  .then(d => { console.log('Stopped impersonation:', d); location.reload(); })"
	@echo "  .catch(e => console.error('Error:', e));"
	@echo ""
	@echo "Or to just clear cookies and log out completely:"
	@echo ""
	@echo "document.cookie.split(';').forEach(c => document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/');"
	@echo "location.reload();"
	@echo ""

end-all-impersonations:
	@echo "Ending all active impersonation sessions in the database..."
	docker-compose exec web python manage.py shell -c "from core.users.models import ImpersonationLog; from django.utils import timezone; count = ImpersonationLog.objects.filter(ended_at__isnull=True).update(ended_at=timezone.now()); print(f'Ended {count} active impersonation session(s)')"

# AWS Deployment Commands
aws-validate:
	@echo "=== AWS Infrastructure Validation ==="
	@echo ""
	@ENVIRONMENT=$${ENVIRONMENT:-production}; \
	AWS_REGION=$${AWS_REGION:-us-east-1}; \
	echo "Environment: $$ENVIRONMENT"; \
	echo "AWS Region: $$AWS_REGION"; \
	echo ""; \
	echo "=== Databases & Caching ==="; \
	echo ""; \
	echo "[ ] PostgreSQL (RDS):"; \
	aws rds describe-db-instances --region $$AWS_REGION \
		--query 'DBInstances[?contains(DBInstanceIdentifier, `allthrive`)].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' \
		--output table 2>/dev/null || echo "   ❌ Could not fetch RDS instances"; \
	echo ""; \
	echo "[ ] Redis (ElastiCache):"; \
	aws elasticache describe-replication-groups --region $$AWS_REGION \
		--query 'ReplicationGroups[?contains(ReplicationGroupId, `allthrive`)].{ID:ReplicationGroupId,Status:Status,Endpoint:NodeGroups[0].PrimaryEndpoint.Address}' \
		--output table 2>/dev/null || echo "   ❌ Could not fetch ElastiCache clusters"; \
	echo ""; \
	echo "=== S3 Storage ==="; \
	echo ""; \
	echo "[ ] Media Bucket:"; \
	aws s3 ls 2>/dev/null | grep allthrive-media || echo "   ❌ No allthrive-media bucket found"; \
	echo ""; \
	echo "=== Secrets Manager ==="; \
	echo ""; \
	echo "[ ] Required Secrets:"; \
	for secret in "django/secret-key" "rds/master" "ai/api-keys" "stripe/credentials" "redis/auth" "oauth/credentials"; do \
		if aws secretsmanager describe-secret --secret-id "$$ENVIRONMENT/allthrive/$$secret" --region $$AWS_REGION >/dev/null 2>&1; then \
			echo "   ✅ $$ENVIRONMENT/allthrive/$$secret"; \
		else \
			echo "   ❌ $$ENVIRONMENT/allthrive/$$secret - NOT FOUND"; \
		fi; \
	done; \
	echo ""; \
	echo "=== ECS Services ==="; \
	echo ""; \
	echo "[ ] Service Health:"; \
	aws ecs describe-services --cluster $$ENVIRONMENT-allthrive-cluster --region $$AWS_REGION \
		--services $$ENVIRONMENT-allthrive-web $$ENVIRONMENT-allthrive-celery $$ENVIRONMENT-allthrive-celery-beat $$ENVIRONMENT-allthrive-weaviate \
		--query 'services[*].{Service:serviceName,Running:runningCount,Desired:desiredCount,Status:status}' \
		--output table 2>/dev/null || echo "   ❌ Could not fetch ECS services"; \
	echo ""; \
	echo "=== Environment Variables (Checking for localhost issues) ==="; \
	echo ""; \
	echo "Fetching from web task definition..."; \
	TASK_DEF=$$(aws ecs describe-services --cluster $$ENVIRONMENT-allthrive-cluster --region $$AWS_REGION \
		--services $$ENVIRONMENT-allthrive-web --query 'services[0].taskDefinition' --output text 2>/dev/null); \
	if [ -n "$$TASK_DEF" ]; then \
		echo ""; \
		echo "[ ] Database:"; \
		aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].secrets[?Name==`DATABASE_URL`].{Var:Name,Source:ValueFrom}' \
			--output table 2>/dev/null; \
		echo ""; \
		echo "[ ] Redis (REDIS_HOST):"; \
		REDIS_HOST=$$(aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`REDIS_HOST`].value' --output text 2>/dev/null); \
		if [ -z "$$REDIS_HOST" ] || [ "$$REDIS_HOST" = "None" ] || [ "$$REDIS_HOST" = "localhost" ]; then \
			echo "   ❌ REDIS_HOST = $$REDIS_HOST (PROBLEM: should be ElastiCache endpoint)"; \
		else \
			echo "   ✅ REDIS_HOST = $$REDIS_HOST"; \
		fi; \
		echo ""; \
		echo "[ ] Celery Broker (from Secrets):"; \
		aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].secrets[?Name==`CELERY_BROKER_URL`].{Var:Name,Source:ValueFrom}' \
			--output table 2>/dev/null; \
		echo ""; \
		echo "[ ] Weaviate:"; \
		WEAVIATE_URL=$$(aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`WEAVIATE_URL`].value' --output text 2>/dev/null); \
		if [ -z "$$WEAVIATE_URL" ] || [ "$$WEAVIATE_URL" = "None" ]; then \
			echo "   ❌ WEAVIATE_URL = NOT SET (will default to localhost:8080)"; \
		elif echo "$$WEAVIATE_URL" | grep -q "localhost"; then \
			echo "   ❌ WEAVIATE_URL = $$WEAVIATE_URL (PROBLEM: points to localhost)"; \
		else \
			echo "   ✅ WEAVIATE_URL = $$WEAVIATE_URL"; \
		fi; \
		echo ""; \
		echo "[ ] Frontend URL:"; \
		FRONTEND_URL=$$(aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`FRONTEND_URL`].value' --output text 2>/dev/null); \
		if [ -z "$$FRONTEND_URL" ] || [ "$$FRONTEND_URL" = "None" ]; then \
			echo "   ❌ FRONTEND_URL = NOT SET (will default to localhost:3000)"; \
		elif echo "$$FRONTEND_URL" | grep -q "localhost"; then \
			echo "   ❌ FRONTEND_URL = $$FRONTEND_URL (PROBLEM: points to localhost)"; \
		else \
			echo "   ✅ FRONTEND_URL = $$FRONTEND_URL"; \
		fi; \
		echo ""; \
		echo "[ ] S3/MinIO:"; \
		MINIO_ENDPOINT=$$(aws ecs describe-task-definition --task-definition $$TASK_DEF --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`MINIO_ENDPOINT`].value' --output text 2>/dev/null); \
		if [ -z "$$MINIO_ENDPOINT" ] || [ "$$MINIO_ENDPOINT" = "None" ]; then \
			echo "   ❌ MINIO_ENDPOINT = NOT SET"; \
		elif echo "$$MINIO_ENDPOINT" | grep -q "localhost"; then \
			echo "   ❌ MINIO_ENDPOINT = $$MINIO_ENDPOINT (PROBLEM: points to localhost)"; \
		else \
			echo "   ✅ MINIO_ENDPOINT = $$MINIO_ENDPOINT"; \
		fi; \
	else \
		echo "   ❌ Could not fetch task definition"; \
	fi; \
	echo ""; \
	echo "=== Celery Task Definition Check ==="; \
	echo ""; \
	CELERY_TASK=$$(aws ecs describe-services --cluster $$ENVIRONMENT-allthrive-cluster --region $$AWS_REGION \
		--services $$ENVIRONMENT-allthrive-celery --query 'services[0].taskDefinition' --output text 2>/dev/null); \
	if [ -n "$$CELERY_TASK" ]; then \
		echo "Celery Task: $$CELERY_TASK"; \
		echo ""; \
		echo "[ ] Celery WEAVIATE_URL:"; \
		CELERY_WEAVIATE=$$(aws ecs describe-task-definition --task-definition $$CELERY_TASK --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`WEAVIATE_URL`].value' --output text 2>/dev/null); \
		if [ -z "$$CELERY_WEAVIATE" ] || [ "$$CELERY_WEAVIATE" = "None" ]; then \
			echo "   ❌ WEAVIATE_URL = NOT SET (will default to localhost:8080)"; \
		elif echo "$$CELERY_WEAVIATE" | grep -q "localhost"; then \
			echo "   ❌ WEAVIATE_URL = $$CELERY_WEAVIATE (PROBLEM: points to localhost)"; \
		else \
			echo "   ✅ WEAVIATE_URL = $$CELERY_WEAVIATE"; \
		fi; \
		echo ""; \
		echo "[ ] Celery FRONTEND_URL:"; \
		CELERY_FRONTEND=$$(aws ecs describe-task-definition --task-definition $$CELERY_TASK --region $$AWS_REGION \
			--query 'taskDefinition.containerDefinitions[0].environment[?name==`FRONTEND_URL`].value' --output text 2>/dev/null); \
		if [ -z "$$CELERY_FRONTEND" ] || [ "$$CELERY_FRONTEND" = "None" ]; then \
			echo "   ❌ FRONTEND_URL = NOT SET (will default to localhost:3000)"; \
		elif echo "$$CELERY_FRONTEND" | grep -q "localhost"; then \
			echo "   ❌ FRONTEND_URL = $$CELERY_FRONTEND (PROBLEM: points to localhost)"; \
		else \
			echo "   ✅ FRONTEND_URL = $$CELERY_FRONTEND"; \
		fi; \
	fi; \
	echo ""; \
	echo "=== ECR Repository ==="; \
	echo ""; \
	echo "[ ] Backend Image:"; \
	aws ecr describe-images --repository-name $$ENVIRONMENT/allthrive-backend --region $$AWS_REGION \
		--query 'imageDetails | sort_by(@, &imagePushedAt) | [-1].{Tag:imageTags[0],Pushed:imagePushedAt}' \
		--output table 2>/dev/null || echo "   ❌ Could not fetch ECR images"; \
	echo ""; \
	echo "=== CloudWatch Log Groups ==="; \
	echo ""; \
	echo "[ ] Log Groups:"; \
	for svc in web celery celery-beat weaviate; do \
		aws logs describe-log-groups --log-group-name-prefix "/ecs/$$ENVIRONMENT-allthrive-$$svc" --region $$AWS_REGION \
			--query 'logGroups[0].{Name:logGroupName}' --output text 2>/dev/null && echo "   ✅ /ecs/$$ENVIRONMENT-allthrive-$$svc" || echo "   ❌ /ecs/$$ENVIRONMENT-allthrive-$$svc - NOT FOUND"; \
	done; \
	echo ""; \
	echo "=== DNS & Certificates ==="; \
	echo ""; \
	echo "[ ] Domain DNS Records:"; \
	for domain in "allthrive.ai" "api.allthrive.ai" "www.allthrive.ai" "ws.allthrive.ai"; do \
		RESOLVED=$$(dig +short $$domain 2>/dev/null | head -1); \
		if [ -n "$$RESOLVED" ]; then \
			echo "   ✅ $$domain -> $$RESOLVED"; \
		else \
			echo "   ❌ $$domain - NOT RESOLVING"; \
		fi; \
	done; \
	echo ""; \
	echo "[ ] ACM Certificates:"; \
	for CERT_ARN in $$(aws acm list-certificates --region $$AWS_REGION --query 'CertificateSummaryList[?contains(DomainName, `allthrive`)].CertificateArn' --output text 2>/dev/null); do \
		if [ -n "$$CERT_ARN" ] && [ "$$CERT_ARN" != "None" ]; then \
			CERT_INFO=$$(aws acm describe-certificate --certificate-arn $$CERT_ARN --region $$AWS_REGION \
				--query 'Certificate.{Status:Status,Domains:SubjectAlternativeNames}' --output json 2>/dev/null); \
			STATUS=$$(echo "$$CERT_INFO" | jq -r '.Status'); \
			DOMAINS=$$(echo "$$CERT_INFO" | jq -r '.Domains | join(", ")'); \
			if [ "$$STATUS" = "ISSUED" ]; then \
				echo "   ✅ $$STATUS: $$DOMAINS"; \
			else \
				echo "   ⚠️  $$STATUS: $$DOMAINS"; \
			fi; \
		fi; \
	done; \
	echo ""; \
	echo "=== WebSocket Configuration ==="; \
	echo ""; \
	echo "[ ] WebSocket DNS (ws.allthrive.ai):"; \
	WS_DNS=$$(dig +short ws.allthrive.ai 2>/dev/null | head -1); \
	if [ -n "$$WS_DNS" ]; then \
		if echo "$$WS_DNS" | grep -q "elb.amazonaws.com"; then \
			echo "   ✅ ws.allthrive.ai -> $$WS_DNS (ALB direct - correct for WebSocket)"; \
		elif echo "$$WS_DNS" | grep -q "cloudfront"; then \
			echo "   ❌ ws.allthrive.ai -> $$WS_DNS (CloudFront - WebSocket may not work!)"; \
		else \
			echo "   ⚠️  ws.allthrive.ai -> $$WS_DNS (verify this supports WebSocket)"; \
		fi; \
	else \
		echo "   ❌ ws.allthrive.ai - NOT CONFIGURED (WebSocket connections will fail!)"; \
	fi; \
	echo ""; \
	echo "[ ] ALB WebSocket Target Group:"; \
	WS_TG_ARN=$$(aws elbv2 describe-target-groups --region $$AWS_REGION \
		--query "TargetGroups[?contains(TargetGroupName, \`$$ENVIRONMENT-allthrive-ws\`)].TargetGroupArn" --output text 2>/dev/null); \
	if [ -n "$$WS_TG_ARN" ] && [ "$$WS_TG_ARN" != "None" ]; then \
		HEALTHY=$$(aws elbv2 describe-target-health --target-group-arn $$WS_TG_ARN --region $$AWS_REGION \
			--query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`] | length(@)' --output text 2>/dev/null); \
		TOTAL=$$(aws elbv2 describe-target-health --target-group-arn $$WS_TG_ARN --region $$AWS_REGION \
			--query 'TargetHealthDescriptions | length(@)' --output text 2>/dev/null); \
		if [ "$$HEALTHY" = "$$TOTAL" ] && [ "$$TOTAL" != "0" ]; then \
			echo "   ✅ WebSocket target group: $$HEALTHY/$$TOTAL healthy"; \
		else \
			echo "   ⚠️  WebSocket target group: $$HEALTHY/$$TOTAL healthy"; \
		fi; \
	else \
		echo "   ❌ WebSocket target group not found"; \
	fi; \
	echo ""; \
	echo "[ ] ALB Certificate (ws.allthrive.ai support):"; \
	ALB_ARN=$$(aws elbv2 describe-load-balancers --names $$ENVIRONMENT-allthrive-alb --region $$AWS_REGION \
		--query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null); \
	if [ -n "$$ALB_ARN" ] && [ "$$ALB_ARN" != "None" ]; then \
		LISTENER_CERT=$$(aws elbv2 describe-listeners --load-balancer-arn $$ALB_ARN --region $$AWS_REGION \
			--query 'Listeners[?Port==`443`].Certificates[0].CertificateArn' --output text 2>/dev/null); \
		if [ -n "$$LISTENER_CERT" ] && [ "$$LISTENER_CERT" != "None" ]; then \
			HAS_WS=$$(aws acm describe-certificate --certificate-arn $$LISTENER_CERT --region $$AWS_REGION \
				--query 'Certificate.SubjectAlternativeNames[?contains(@, `ws.`)]' --output text 2>/dev/null); \
			if [ -n "$$HAS_WS" ]; then \
				echo "   ✅ ALB certificate includes ws.allthrive.ai"; \
			else \
				echo "   ❌ ALB certificate does NOT include ws.allthrive.ai (WebSocket TLS will fail!)"; \
			fi; \
		else \
			echo "   ❌ No HTTPS listener certificate found"; \
		fi; \
	else \
		echo "   ❌ ALB not found"; \
	fi; \
	echo ""; \
	echo "[ ] CloudFront WebSocket Bypass:"; \
	API_DNS=$$(dig +short api.allthrive.ai 2>/dev/null | head -1); \
	WS_DNS=$$(dig +short ws.allthrive.ai 2>/dev/null | head -1); \
	if [ "$$API_DNS" != "$$WS_DNS" ]; then \
		echo "   ✅ api.allthrive.ai and ws.allthrive.ai resolve to different endpoints (correct)"; \
	else \
		echo "   ⚠️  api.allthrive.ai and ws.allthrive.ai resolve to same endpoint"; \
		echo "      If both go through CloudFront, WebSocket may fail (HTTP/2 issue)"; \
	fi; \
	echo ""; \
	echo "=== Seed Data Status ==="; \
	echo ""; \
	echo "Checking if seed data exists in production..."; \
	echo "(Running quick count queries via ECS task)"; \
	echo ""; \
	SEED_CHECK_CMD="python -c \"import django; django.setup(); from core.taxonomy.models import Topic, Category; from core.tools.models import Tool; from core.billing.models import SubscriptionTier; from core.battles.models import ChallengeType; from core.accounts.models import User; print('Topics:', Topic.objects.count()); print('Categories:', Category.objects.count()); print('Tools:', Tool.objects.count()); print('SubscriptionTiers:', SubscriptionTier.objects.count()); print('ChallengeTypes:', ChallengeType.objects.count()); print('Pip bot:', 'exists' if User.objects.filter(username='pip').exists() else 'MISSING')\""; \
	SEED_TASK_ARN=$$(aws ecs run-task \
		--cluster $$ENVIRONMENT-allthrive-cluster \
		--task-definition $$TASK_DEF \
		--launch-type FARGATE \
		--network-configuration "awsvpcConfiguration={subnets=$$(aws ecs describe-services --cluster $$ENVIRONMENT-allthrive-cluster --services $$ENVIRONMENT-allthrive-web --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' --output text --region $$AWS_REGION | tr '\t' ','),securityGroups=$$(aws ecs describe-services --cluster $$ENVIRONMENT-allthrive-cluster --services $$ENVIRONMENT-allthrive-web --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' --output text --region $$AWS_REGION | tr '\t' ','),assignPublicIp=ENABLED}" \
		--overrides "{\"containerOverrides\":[{\"name\":\"web\",\"command\":[\"sh\",\"-c\",\"$$SEED_CHECK_CMD\"]}]}" \
		--query 'tasks[0].taskArn' \
		--output text --region $$AWS_REGION 2>/dev/null); \
	if [ -n "$$SEED_TASK_ARN" ] && [ "$$SEED_TASK_ARN" != "None" ]; then \
		echo "   Waiting for seed check task..."; \
		aws ecs wait tasks-stopped --cluster $$ENVIRONMENT-allthrive-cluster --tasks $$SEED_TASK_ARN --region $$AWS_REGION 2>/dev/null; \
		SEED_EXIT=$$(aws ecs describe-tasks --cluster $$ENVIRONMENT-allthrive-cluster --tasks $$SEED_TASK_ARN \
			--query 'tasks[0].containers[?name==`web`].exitCode' --output text --region $$AWS_REGION 2>/dev/null); \
		if [ "$$SEED_EXIT" = "0" ]; then \
			echo "   ✅ Seed check completed - view CloudWatch logs for counts"; \
			echo "   Log group: /ecs/$$ENVIRONMENT-allthrive-web"; \
		else \
			echo "   ⚠️  Seed check task had issues (exit: $$SEED_EXIT)"; \
		fi; \
	else \
		echo "   ⚠️  Could not run seed check task"; \
	fi; \
	echo ""; \
	echo "=== Validation Complete ==="

cloudfront-clear-cache:
	@echo "Invalidating CloudFront cache..."
	@ENVIRONMENT=$${ENVIRONMENT:-production}; \
	AWS_REGION=$${AWS_REGION:-us-east-1}; \
	echo "Environment: $$ENVIRONMENT"; \
	echo "AWS Region: $$AWS_REGION"; \
	DIST_ID=$$(aws cloudformation describe-stacks \
		--stack-name $$ENVIRONMENT-allthrive-cloudfront \
		--region $$AWS_REGION \
		--query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
		--output text 2>/dev/null); \
	if [ -z "$$DIST_ID" ] || [ "$$DIST_ID" = "None" ]; then \
		echo "❌ Error: Could not find CloudFront distribution for $$ENVIRONMENT environment"; \
		echo "Make sure the stack '$$ENVIRONMENT-allthrive-cloudfront' exists in $$AWS_REGION"; \
		exit 1; \
	fi; \
	echo "Distribution ID: $$DIST_ID"; \
	INVALIDATION_ID=$$(aws cloudfront create-invalidation \
		--distribution-id $$DIST_ID \
		--paths "/*" \
		--query 'Invalidation.Id' \
		--output text); \
	echo "✓ Invalidation created: $$INVALIDATION_ID"; \
	echo "CloudFront cache is being cleared. This may take a few minutes."

# Run a management command on AWS ECS as a one-off task
# Usage: make aws-run-command ENVIRONMENT=production CMD="seed_test_users --count=10"
aws-run-command:
	@if [ -z "$(CMD)" ]; then \
		echo "❌ Error: CMD is required"; \
		echo "Usage: make aws-run-command ENVIRONMENT=production CMD=\"create_test_users --count=10\""; \
		exit 1; \
	fi
	@ENVIRONMENT=$${ENVIRONMENT:-production} ./scripts/aws-run-command.sh "$(CMD)"

# Seed test users on AWS
aws-seed-test-users:
	@echo "Seeding test users on AWS..."
	@make aws-run-command CMD="create_test_users --count=10"

# Seed all data on AWS (run after initial deployment)
# Note: This matches the seed commands in .github/workflows/deploy-aws.yml
aws-seed-all:
	@echo "Seeding all data on AWS..."
	@make aws-run-command CMD="seed_topics"
	@make aws-run-command CMD="seed_taxonomies"
	@make aws-run-command CMD="seed_categories"
	@make aws-run-command CMD="seed_tools"
	@make aws-run-command CMD="seed_quizzes"
	@make aws-run-command CMD="seed_battle_prompts"
	@make aws-run-command CMD="seed_billing"
	@make aws-run-command CMD="seed_credit_packs"
	@make aws-run-command CMD="seed_ai_pricing"
	@make aws-run-command CMD="seed_achievements"
	@make aws-run-command CMD="create_pip"
	@make aws-run-command CMD="seed_ai_daily_brief_agent"
	@echo "✓ All data seeded on AWS!"

# Sync user projects from local to AWS production
# Step 1: Export local projects to S3 (run locally)
sync-user-projects:
	@if [ -z "$(USERNAME)" ]; then \
		echo "❌ Error: USERNAME is required"; \
		echo "Usage: make sync-user-projects USERNAME=midjourney-reddit-agent"; \
		echo "Add DRY_RUN=1 to preview without uploading"; \
		exit 1; \
	fi
	@if [ "$(DRY_RUN)" = "1" ]; then \
		docker-compose exec web python manage.py sync_user_projects_to_prod --username $(USERNAME) --dry-run; \
	else \
		docker-compose exec web python manage.py sync_user_projects_to_prod --username $(USERNAME); \
	fi

# Step 2: Import projects on AWS from S3 (run on AWS)
aws-import-user-projects:
	@if [ -z "$(USERNAME)" ]; then \
		echo "❌ Error: USERNAME is required"; \
		echo "Usage: make aws-import-user-projects USERNAME=midjourney-reddit-agent"; \
		exit 1; \
	fi
	@echo "Importing projects for $(USERNAME) on AWS..."
	@make aws-run-command CMD="sync_user_projects_to_prod --username $(USERNAME) --import"

# Reindex all projects in Weaviate on AWS
# Usage: make aws-weaviate-reindex ENVIRONMENT=production
aws-weaviate-reindex:
	@echo "Triggering Weaviate full reindex on AWS..."
	@echo "This queues Celery tasks to regenerate all embeddings."
	@make aws-run-command CMD="setup_weaviate --reindex"

# Reindex all content (projects, users, quizzes) in Weaviate on AWS
# Usage: make aws-weaviate-reindex-all ENVIRONMENT=production
aws-weaviate-reindex-all:
	@echo "Triggering Weaviate full reindex of ALL content on AWS..."
	@echo "This queues Celery tasks to regenerate embeddings for projects, users, and quizzes."
	@make aws-run-command CMD="setup_weaviate --reindex-all"

# Check Weaviate connection status on AWS
# Usage: make aws-weaviate-check ENVIRONMENT=production
aws-weaviate-check:
	@echo "Checking Weaviate connection on AWS..."
	@make aws-run-command CMD="setup_weaviate --check"

# Pull production database to local
pull-prod-db:
	@echo "⚠️  WARNING: This will REPLACE your local database with production data!"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] || (echo "Cancelled." && exit 1)
	@ENVIRONMENT=$${ENVIRONMENT:-production} ./scripts/pull-prod-db.sh

# Anonymize user PII in local database (for prod data safety)
# Usage: make anonymize-users [PRESERVE_USERNAME=myuser]
anonymize-users:
	@echo "Anonymizing user PII in local database..."
ifdef PRESERVE_USERNAME
	docker-compose exec web python manage.py anonymize_users --confirm --preserve-staff --preserve-agents --preserve-username=$(PRESERVE_USERNAME)
else
	docker-compose exec web python manage.py anonymize_users --confirm --preserve-staff --preserve-agents
endif
