# AllThrive AI

**Explore AI Together**

Find trending AI projects, automate your portfolio, and grow your skills.

## Key Features

### 🔍 Discover & Explore
- **For You Feed**: Personalized AI project discovery based on your interests and activity
- **Trending Tab**: See what's hot in the AI builder community right now
- **All Projects Feed**: Browse the full catalog with filters by tool, category, and topic
- **Curation Agents**: AI agents that curate the latest AI news and conversations
- **AI Tool Directory**: 200+ curated AI tools with real examples of what people build
- **Smart Filters**: Find exactly what you're looking for by skill level, tool, or topic
- **No More Tab Chaos**: Everything happening in AI, without drowning in Reddit threads and YouTube rabbit holes

### 🎨 Portfolio & Showcase
- **Unified Portfolio**: Consolidate all your AI projects from any tool into one professional portfolio
- **Integrations**: Auto-sync your AI projects from whichever AI tool you're building with
- **Automatic Capture**: Chrome extension automatically adds projects as you work
- **Privacy Controls**: Public/private projects, customizable profiles, and visibility settings
- **Professional Presence**: Showcase your AI journey in one coherent place
- **Analytics and Insights**: Measurable insights on which AI tools you are using and new ones that interest you based on your activity

### 🎮 Learn & Level Up
- **Personalized Learning Paths**: Interactive courses tailored to your interests and skill level
- **Interactive Quizzes**: True/false, multiple choice, and swipe-based quiz formats across AI/ML topics
- **Achievement System**: Unlock achievements for milestones and accomplishments
- **Side Quests**: Optional challenges like Quiz Mastery, Project Showcase, Community Helper, Learning Streak
- **Weekly Community Build Challenges**: Collaborative building challenges with bonus rewards
- **Streak Tracking**: Daily login streaks with bonus rewards
- **Learn By Doing**: Gain XP and progress through Thrive Circles as you build

### 🛒 Marketplace
- **Creator Marketplace**: Sell your AI prompts, courses, and digital products
- **Discover Resources**: Find and purchase community-created prompts, templates, and courses
- **Monetize Your Knowledge**: Turn your AI experiments and expertise into income
- **Curated Quality**: Browse vetted resources from experienced builders

### 👥 Community & Collaboration
- **Thrive Circles**: Community groups based on your activity: Seedling, Sprout, Blossom, Bloom, or Evergreen
- **Multi-Level System**: Dynamic progression with increasing point thresholds
- **Weekly Events**: Webinars, topic discussions, interviews, and community project highlights
- **Comments & Feedback**: Discussion and peer feedback on projects

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

Run `make help` to see all available commands. Here are the most commonly used:

### Quick Start
- `make up` - Start all services
- `make down` - Stop all services
- `make logs` - View all logs
- `make help` - Show all available commands

### Development
- `make restart-backend` - Restart backend after code changes
- `make restart-frontend` - Restart frontend
- `make shell-backend` - Open backend shell for debugging
- `make django-shell` - Open Django Python shell
- `make lint` - Run linting (backend + frontend)
- `make format` - Auto-format code
- `make test` - Run all tests

### Database & Migrations
- `make migrate` - Run migrations
- `make makemigrations` - Create migrations
- `make createsuperuser` - Create admin user
- `make seed-all` - Seed all initial data
- `make reset-db` - ⚠️ DANGER: Flush and reseed database

### Code Quality
- `make lint` - Lint all code
- `make format` - Format all code
- `make type-check` - TypeScript type checking
- `make security-check` - Run security checks
- `make pre-commit` - Run pre-commit hooks

### Cleanup
- `make clean` - Clean cache and build files
- `make clean-cache` - Clean cache only
- `make clean-all` - ⚠️ Remove everything

**See [Makefile Reference](docs/MAKEFILE_REFERENCE.md) for complete command list.**

## Documentation

- [Styleguide](docs/STYLEGUIDE.md) - Coding standards and best practices
- [SEO Implementation](docs/SEO_IMPLEMENTATION.md) - SEO and LLM discoverability guide
- [Database Seeding Guide](docs/DATABASE_SEEDING_GUIDE.md) - How to seed initial data
- [Quiz Seeding](docs/QUIZ_SEEDING.md) - Quiz data seeding guide
- [Public Info](docs/PUBLIC_INFO.md) - Comprehensive platform description
- [Makefile Reference](docs/MAKEFILE_REFERENCE.md) - Complete make command reference
- [Docker Volume Sync](docs/DOCKER_VOLUME_SYNC.md) - Troubleshooting Docker file syncing issues
- [Docker Sync Quick Reference](docs/DOCKER_SYNC_QUICK_REFERENCE.md) - Quick commands for Docker sync

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
