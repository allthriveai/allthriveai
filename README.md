# AllThrive AI

**AI Portfolio Platform with Gamified Learning & Discovery**

AllThrive AI is a comprehensive platform where AI practitioners, learners, and researchers showcase projects, level up skills through gamified challenges, and connect with a thriving community.

## Key Features

### 🎨 Portfolio & Projects
- Build professional AI project portfolios
- Import projects from GitHub
- Rich documentation with markdown, diagrams, and code examples
- Project discovery and exploration

### 🎮 Gamified Learning
- Interactive AI/ML challenges and courses
- Achievement system with badges and XP
- Learning paths for NLP, Computer Vision, Deep Learning, and more
- Side quests and community challenges

### 👥 Community & Collaboration
- Thrive Circles - topic-based learning communities
- Peer feedback and project reviews
- AI tool directory
- Mentorship connections

### 🤖 AI-Powered Features
- OpenAI and Anthropic Claude integrations
- LangChain for AI workflows
- Vector search with RedisVL
- AI-assisted project documentation

## Technology Stack

- **Backend:** Django REST Framework, Python, PostgreSQL
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **AI/ML:** OpenAI, Anthropic, LangChain, RedisVL
- **Task Queue:** Celery with Redis
- **Authentication:** OAuth (Google, GitHub)
- **Infrastructure:** Docker-based development

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

### Database & Data Seeding
- `make reset-db` - **DANGER**: Flush database, migrate, and seed all initial data
- `make seed-all` - Seed all initial data (topics, taxonomies, tools, quizzes)
- `make seed-quizzes` - Seed initial quiz data only
- `make create-pip` - Create Pip bot user

See [Database Seeding Guide](docs/DATABASE_SEEDING_GUIDE.md) for detailed instructions.

## Documentation

- [Styleguide](docs/STYLEGUIDE.md) - Coding standards and best practices
- [SEO Implementation](docs/SEO_IMPLEMENTATION.md) - SEO and LLM discoverability guide
- [Public Info](PUBLIC_INFO.md) - Comprehensive platform description

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
