# AllThrive AI

A full-stack AI application with Django backend and TypeScript frontend, featuring OpenAI and Anthropic integrations.

## Features

- Django REST Framework API
- TypeScript frontend (React/Vite)
- Conversation management
- AI integration ready (OpenAI, Anthropic, LangChain)
- Celery task queue with Redis
- PostgreSQL support
- CORS enabled
- Docker-based development environment

## Quick Start with Docker

### 1. Configure environment variables

Copy `.env.example` to `.env` and update with your settings:

```bash
cp .env.example .env
```

### 2. Start all services

```bash
make up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Make Commands

For your convenience, we provide Make commands to manage the development environment:

### Development
- `make help` - Show all available commands
- `make up` - Start all services (backend + frontend)
- `make down` - Stop all services
- `make build` - Build all services
- `make restart` - Restart all services
- `make frontend` - Run frontend dev server locally

### Service Management
- `make restart-frontend` - Restart frontend only
- `make restart-backend` - Restart backend only
- `make logs` - View logs for all services
- `make logs-frontend` - View frontend logs
- `make logs-backend` - View backend logs
- `make shell-frontend` - Open shell in frontend container
- `make shell-backend` - Open shell in backend container

### Testing
- `make test` - Run all tests (backend + frontend)
- `make test-backend` - Run all backend tests
- `make test-frontend` - Run all frontend tests

## Development Guidelines

Please refer to our [Styleguide](docs/STYLEGUIDE.md) for coding standards and best practices.

## Manual Setup (Alternative)

If you prefer to run services manually without Docker:

### Backend

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run migrations:
```bash
python manage.py migrate
```

3. Create superuser:
```bash
python manage.py createsuperuser
```

4. Run development server:
```bash
python manage.py runserver
```

### Frontend

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

## API Endpoints

All API endpoints are versioned under `/api/v1/`:

- `/admin/` - Django admin interface
- `/api/v1/conversations/` - Conversation management
- `/api/v1/messages/` - Message history
- `/api/v1/projects/` - Project management
- `/api/v1/auth/` - Authentication endpoints
- `/api/v1/db/health/` - Database health check

## Environment Variables

See `.env.example` for all available configuration options.

## Additional Development Commands

### Backend
- Run tests: `python manage.py test`
- Create migrations: `python manage.py makemigrations`
- Apply migrations: `python manage.py migrate`

### Frontend
- See `frontend/README.md` for frontend-specific commands and documentation

## Production Deployment

1. Set `DEBUG=False` in `.env`
2. Configure proper database (PostgreSQL recommended)
3. Set up Redis for Celery
4. Configure static files: `python manage.py collectstatic`
5. Use Gunicorn: `gunicorn config.wsgi:application`

## License

MIT
