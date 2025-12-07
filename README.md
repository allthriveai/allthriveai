# All Thrive

**Showcase, Learn & Play with AI**

The community platform for AI creators. Automate your AI portfolio, learn something new with gamified challenges, and compete in Prompt Battles.

*Create with AI anywhere. Consolidate here. Thrive together.*

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
- **Automatic Capture**: Chrome extension automatically adds projects as you work
- **Integrations**: Auto-sync projects from whichever AI tool you're building with
- **Privacy Controls**: Public/private projects, customizable profiles, and visibility settings
- **Professional Presence**: Showcase your AI journey in one coherent place

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

### ⚔️ Prompt Battles
- **Competitive AI Challenges**: Face off against other creators in timed prompt challenges
- **Multiple Categories**: Image generation, text, code, and more
- **Leaderboards**: Climb the rankings and earn recognition
- **Earn Points**: Win battles to earn XP and level up your profile

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

### Evergreen Architecture Documentation
- [Overview](docs/evergreen-architecture/README.md) - Architecture overview and guidelines
- [Core Features](docs/evergreen-architecture/01-CORE-FEATURES.md) - Platform features and capabilities
- [Data Models](docs/evergreen-architecture/02-DATA-MODELS.md) - Database schemas and relationships
- [API Contracts](docs/evergreen-architecture/03-API-CONTRACTS.md) - API endpoints and specifications
- [AI Architecture](docs/evergreen-architecture/04-AI-ARCHITECTURE.md) - LLM integration and AI systems
- [Security & Authentication](docs/evergreen-architecture/05-SECURITY-AUTH.md) - Security patterns and auth flows
- [Integration Patterns](docs/evergreen-architecture/06-INTEGRATION-PATTERNS.md) - Third-party integrations
- [WebSocket Implementation](docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md) - Real-time communication architecture
- [Onboarding Architecture](docs/evergreen-architecture/08-ONBOARDING-ARCHITECTURE.md) - User onboarding flow
- [Intelligent Chat Architecture](docs/evergreen-architecture/intelligent-chat-architecture.md) - AI chat system design
- [Feature Matrix - Membership Tiers](docs/evergreen-architecture/Feature%20Matrix%20-%20Membership%20Tiers.md) - Subscription tier features

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
