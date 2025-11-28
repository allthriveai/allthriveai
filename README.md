# AllThrive AI

**AI Portfolio Platform with Gamified Learning & Marketplace**

AllThrive AI is a platform for showcasing AI projects, exploring community creations, learning through interactive challenges, buying and selling digital products, and connecting with builders and learners.

## Key Features

### 🎨 Portfolio, Projects & Marketplace
- **Unified Portfolio**: Consolidate all your AI projects from any tool into one professional portfolio
- **Chrome Extension**: Automatically capture and add AI projects you're working on to your portfolio
- **Integrations**: Automatic project portfolio creation from whichever AI tool you're building with
- **Explore & Discovery**: For You, Trending, and All tabs with filtering by categories, topics, and tools
- **Marketplace**: Sell and discover AI prompts, templates, and digital products
- **Privacy Controls**: Public/private projects, customizable profiles, and visibility settings

### 🎮 Gamified Learning System
- **Personalized Learning Paths**: Interactive courses tailored to your interests and skill level
- **Interactive Quizzes**: True/false, multiple choice, and swipe-based quiz formats across AI/ML topics
- **AI Tool Directory**: Comprehensive catalog of 200+ AI tools with detailed information
- **Achievement System**: Unlock achievements for milestones and accomplishments
- **Side Quests**: Optional challenges like Quiz Mastery, Project Showcase, Community Helper, Learning Streak
- **Weekly Community Build Challenges**: Collaborative building challenges with bonus rewards
- **Streak Tracking**: Daily login streaks with bonus rewards

### 👥 Community & Collaboration
- **Thrive Circles**: Join community groups based on your activity level — Seedling, Sprout, Blossom, Bloom, or Evergreen
- **Multi-Level System**: Dynamic progression with increasing point thresholds
- **Weekly Events**: Webinars, topic discussions, interviews, and community project highlights
- **Comments & Feedback**: Discussion and peer feedback on projects

### 🤖 AI-Powered Features
- **Personalized Recommendations**: AI-driven content discovery based on your interests and activity
- **Multi-Provider AI**: Azure OpenAI, OpenAI, and Anthropic Claude support
- **AI Workflows**: LangChain and LangGraph for intelligent automation
- **Observability & Cost Tracking**: LangSmith integration for monitoring AI usage
- **AI-Assisted Documentation**: Automatic project analysis and content generation

## Technology Stack

- **Backend:** Django REST Framework, Python, PostgreSQL
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **AI/ML:** Azure OpenAI, OpenAI, Anthropic Claude, LangChain, LangGraph, LangSmith
- **Vector Search:** Weaviate
- **Task Queue:** Celery with Redis
- **Caching & Sessions:** Redis
- **Storage:** MinIO (S3-compatible)
- **Authentication:** OAuth (Google, GitHub) + Social account linking (GitLab, LinkedIn, Figma, Hugging Face)
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
- [Database Seeding Guide](docs/DATABASE_SEEDING_GUIDE.md) - How to seed initial data
- [Quiz Seeding](docs/QUIZ_SEEDING.md) - Quiz data seeding guide
- [Public Info](docs/PUBLIC_INFO.md) - Comprehensive platform description

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
