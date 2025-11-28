.PHONY: help up down restart restart-frontend restart-backend build logs shell-frontend shell-backend test test-backend test-frontend test-username test-coverage frontend create-pip recreate-pip seed-quizzes seed-all reset-db

help:
	@echo "Available commands:"
	@echo "  make frontend        - Run frontend dev server"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make restart-frontend - Restart frontend only"
	@echo "  make restart-backend  - Restart backend only"
	@echo "  make build           - Build all services"
	@echo "  make logs            - View logs for all services"
	@echo "  make shell-frontend  - Open shell in frontend container"
	@echo "  make shell-backend   - Open shell in backend container"
	@echo ""
	@echo "Data commands:"
	@echo "  make create-pip      - Create Pip bot user (if doesn't exist)"
	@echo "  make recreate-pip    - Delete and recreate Pip with latest data"
	@echo "  make seed-quizzes    - Seed initial quiz data into the database"
	@echo "  make seed-all        - Seed all initial data (topics, taxonomies, tools, quizzes)"
	@echo "  make reset-db        - DANGER: Flush database, migrate, and seed all data"
	@echo ""
	@echo "Testing commands:"
	@echo "  make test            - Run all tests (backend + frontend)"
	@echo "  make test-backend    - Run all backend tests"
	@echo "  make test-frontend   - Run all frontend tests"
	@echo "  make test-username   - Run username/user isolation tests"
	@echo "  make test-coverage   - Run tests with coverage report"

frontend:
	cd frontend && npm run dev

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

restart-frontend:
	docker-compose restart frontend

restart-backend:
	docker-compose restart web

build:
	docker-compose up --build -d

logs:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f web

shell-frontend:
	docker-compose exec frontend /bin/sh

shell-backend:
	docker-compose exec web /bin/bash

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

test-coverage:
	@echo "Running backend tests with coverage..."
	docker-compose exec web coverage run --source='.' manage.py test
	docker-compose exec web coverage report
	docker-compose exec web coverage html
	@echo "Coverage report generated in htmlcov/index.html"
