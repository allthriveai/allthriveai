.PHONY: help up down restart restart-frontend restart-backend build logs shell-frontend shell-backend

help:
	@echo "Available commands:"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make restart-frontend - Restart frontend only"
	@echo "  make restart-backend  - Restart backend only"
	@echo "  make build           - Build all services"
	@echo "  make logs            - View logs for all services"
	@echo "  make shell-frontend  - Open shell in frontend container"
	@echo "  make shell-backend   - Open shell in backend container"

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

restart-frontend:
	docker-compose restart frontend

restart-backend:
	docker-compose restart backend

build:
	docker-compose up --build -d

logs:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

shell-frontend:
	docker-compose exec frontend /bin/sh

shell-backend:
	docker-compose exec backend /bin/bash
