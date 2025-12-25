# All Thrive

**Explore AI Together - Learn, Share, Play**

All Thrive is a community platform for AI enthusiasts. Consolidate your AI portfolio, learn through interactive games and personalized paths, compete in Prompt Battles, and connect with fellow builders.

*Create with AI anywhere. Consolidate here. Thrive together.*

## Key Features

### Discover & Explore
- **For You Feed**: Personalized AI project discovery based on your interests and activity
- **Trending Tab**: See what's hot in the AI builder community
- **AI Tool Directory**: 200+ curated AI tools with real examples of what people build
- **Curation Agents**: AI agents that curate the latest from Reddit, YouTube, and RSS feeds
- **Smart Search**: Full-text search with Weaviate vector search across projects, tools, and topics

### Portfolio & Showcase
- **Unified Portfolio**: All your AI projects in one professional portfolio at `/{username}`
- **Project Import**: Auto-import from GitHub, YouTube, and other platforms
- **Chrome Extension**: Automatically capture projects as you work
- **Privacy Controls**: Public, private, or unlisted projects with customizable visibility
- **Rich Content**: Markdown descriptions, Mermaid diagrams, media attachments

### Learn & Level Up
- **AI-Personalized Learning Paths**: Ember generates custom curricula based on your goals and skill level
- **Micro-Lessons**: Conversational learning with Ember, your AI learning companion
- **Interactive Quizzes**: True/false, multiple choice, and swipe-based formats across AI/ML topics
- **Concept Mastery**: Spaced repetition tracking with proficiency levels (Aware → Expert)
- **Side Quests**: Optional challenges like Quiz Mastery, Project Showcase, Community Helper
- **Weekly Challenges**: Collaborative building challenges with community rewards

### Play - Educational Games
- **Context Snake**: Learn how AI context windows work by "being" the context - eat tokens, grow longer, but don't overflow!
- **Ethics Defender**: Defend against AI ethics threats while learning about bias, transparency, and responsible AI
- **Game Leaderboards**: Compete for high scores with Redis-cached rankings

### Prompt Battles
- **Real-time Battles**: Face off against others in timed prompt challenges with AI judging
- **Async Mode**: Turn-based battles with 3-day deadlines for busy schedules
- **AI Opponents**: Practice against Pip, the AI battle bot
- **Image Generation**: Nano Banana integration (Gemini 2.0 Flash) for visual battles
- **SMS Invitations**: Challenge friends via text message with shareable battle links
- **Matchmaking**: Random matching queue or direct challenges

### Community & Social
- **Thrive Circles**: Progress through tiers based on activity - Seedling → Sprout → Blossom → Bloom → Evergreen
- **The Lounge**: Community rooms for General chat, Showcase, Help, and more (real-time WebSocket)
- **Comments & Feedback**: Threaded discussions with markdown and @mentions
- **Follow System**: Follow creators and see their activity in your feed
- **Achievements**: Unlock badges for milestones and accomplishments

### AI Agents

#### Ember - Your AI Companion
Unified LangGraph agent with 31 specialized tools:
- **Discovery**: Search projects, tools, topics; get personalized recommendations
- **Learning**: Deliver micro-lessons, generate quizzes, track concept mastery
- **Project Management**: Create, edit, import projects; generate Mermaid diagrams
- **Image Generation**: Create images with Nano Banana (Gemini 2.0 Flash)
- **Personalization**: Adaptive responses based on learner profile and skill level

#### Curation Agents
Automated content curation from:
- Reddit subreddits (AI/ML communities)
- YouTube channels (AI creators)
- RSS feeds (AI news and blogs)

### Integrations
- **GitHub**: OAuth login + repository import with README parsing
- **Google**: OAuth authentication
- **YouTube**: Video embedding, metadata extraction, channel syncing
- **OAuth Linking**: Connect GitLab, LinkedIn, Figma, Hugging Face profiles

### Browser Extension
Chrome extension for automatic project capture as you work across AI tools.

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Django 5, Django REST Framework, Django Channels (WebSockets), Celery |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| **AI/LLM** | OpenAI gpt-4o-mini, Google Gemini 2.0 Flash, LangChain, LangGraph, LangSmith |
| **Vector Search** | Weaviate |
| **Database** | PostgreSQL |
| **Cache/Queue** | Redis (caching, sessions, Celery broker) |
| **Storage** | MinIO (S3-compatible) |
| **Infrastructure** | Docker, AWS ECS (production) |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (API keys, etc.)
```

### 2. Start All Services

```bash
make up              # Start backend services (Docker)
make frontend        # Run frontend locally (separate terminal)
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

### 3. Seed Initial Data

```bash
make seed-all        # Seed all initial data (tools, quizzes, core team, etc.)
```

## Make Commands

Run `make help` for the complete list. Here are the essentials:

### Service Management
```bash
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make logs            # View all logs
make logs-backend    # View backend logs
```

### Development
```bash
make shell-backend   # Open backend shell
make django-shell    # Open Django Python shell
make migrate         # Run migrations
make makemigrations  # Create new migrations
make test            # Run all tests
make lint            # Run linting
```

### Database & Data
```bash
make seed-all        # Seed all initial data
make seed-core-team  # Seed Ember, Pip, Sage, Haven
make createsuperuser # Create admin user
make reset-db        # DANGER: Flush and reseed database
```

### Testing
```bash
make test-backend    # Django tests
make test-frontend   # Frontend unit tests
make test-e2e        # Playwright E2E tests
```

### AWS Deployment
```bash
make aws-validate    # Validate AWS infrastructure
make cloudfront-clear-cache  # Invalidate CloudFront
```

See [Makefile Reference](docs/MAKEFILE_REFERENCE.md) for complete documentation.

## Project Structure

```
allthriveai/
├── core/                    # Django apps
│   ├── agents/              # AI agent definitions (Ember, curation agents)
│   ├── battles/             # Prompt Battle system
│   ├── community/           # Chat rooms, messages, WebSocket consumers
│   ├── games/               # Educational games (Context Snake, Ethics Defender)
│   ├── learning_paths/      # AI-generated learning paths, lessons, mastery
│   ├── projects/            # User projects, media, sections
│   ├── quizzes/             # Interactive quizzes
│   ├── thrive_circle/       # Gamification tiers and points
│   ├── tools/               # AI tool directory
│   ├── users/               # User model, profiles, authentication
│   └── ...
├── services/                # Business logic services
│   ├── agents/              # LangGraph agents (Ember)
│   ├── ai/                  # AI provider integrations
│   ├── personalization/     # Recommendation engine
│   ├── weaviate/            # Vector search
│   └── ...
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API clients
│   │   └── types/           # TypeScript types
│   └── e2e/                 # Playwright tests
├── browser-extension/       # Chrome extension
├── docs/                    # Documentation
│   └── evergreen-architecture/  # Architecture docs
└── scripts/                 # Utility scripts
```

## Documentation

### Architecture
- [Overview](docs/evergreen-architecture/README.md) - Architecture overview
- [Core Features](docs/evergreen-architecture/01-CORE-FEATURES.md) - Platform features
- [Data Models](docs/evergreen-architecture/02-DATA-MODELS.md) - Database schemas
- [API Contracts](docs/evergreen-architecture/03-API-CONTRACTS.md) - API endpoints
- [AI Architecture](docs/evergreen-architecture/04-AI-ARCHITECTURE.md) - LLM integration
- [Security & Auth](docs/evergreen-architecture/05-SECURITY-AUTH.md) - Security patterns
- [WebSocket Implementation](docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md) - Real-time features
- [Intelligent Chat](docs/evergreen-architecture/intelligent-chat-architecture.md) - Ember chat system

## API Overview

All endpoints are versioned under `/api/v1/`:

| Endpoint | Description |
|----------|-------------|
| `/api/v1/projects/` | Project CRUD, import, search |
| `/api/v1/tools/` | AI tool directory |
| `/api/v1/users/` | User profiles, follows |
| `/api/v1/battles/` | Prompt battles, matchmaking |
| `/api/v1/quizzes/` | Quiz attempts, scores |
| `/api/v1/learning-paths/` | Learning paths, progress |
| `/api/v1/community/` | Rooms, messages |
| `/api/v1/auth/` | Authentication, OAuth |

WebSocket endpoints:
- `/ws/chat/` - Ember AI chat
- `/ws/community/` - Community chat rooms
- `/ws/battles/` - Real-time battles

## Design System

The UI follows a **Neon Glass** aesthetic with:
- Glass morphism effects with backdrop blur
- Cyan/teal to green gradients
- Dark mode first design
- Subtle neon glow effects

See the live styleguide at `/styleguide` in development.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `make test`
4. Run linting: `make lint`
5. Submit a pull request

## License

MIT
