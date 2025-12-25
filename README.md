# All Thrive

**Explore AI Together - Learn, Share, Play**

All Thrive is a community platform for AI enthusiasts. Consolidate your AI portfolio, learn through interactive games and personalized paths, compete in Prompt Battles, and connect with fellow builders.

## Features

- **Discover** - Personalized feed, AI tool directory, smart search
- **Portfolio** - Showcase projects at `/{username}`, import from GitHub/YouTube
- **Learn** - AI-generated learning paths, quizzes, concept mastery with Ember
- **Play** - Context Snake, Ethics Defender, Prompt Battles
- **Community** - Thrive Circles tiers, The Lounge chat, follows, achievements

See [Core Features](docs/evergreen-architecture/01-CORE-FEATURES.md) for full documentation.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Django 5, DRF, Channels, Celery |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| AI | OpenAI, Gemini, LangChain, LangGraph |
| Data | PostgreSQL, Redis, Weaviate, MinIO |

## Quick Start

```bash
# 1. Configure
cp .env.example .env

# 2. Start services
make up              # Backend (Docker)
make frontend        # Frontend (separate terminal)

# 3. Seed data (choose one)
make seed-all        # Fresh seed data
make pull-prod-db    # Pull production database (anonymizes PII)
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Commands

```bash
make up / down / restart   # Service management
make logs-backend          # View logs
make shell-backend         # Open shell
make migrate               # Run migrations
make test                  # Run tests
```

Run `make help` for all commands.

## Documentation

- [Architecture Overview](docs/evergreen-architecture/README.md)
- [Core Features](docs/evergreen-architecture/01-CORE-FEATURES.md)
- [Data Models](docs/evergreen-architecture/02-DATA-MODELS.md)
- [API Contracts](docs/evergreen-architecture/03-API-CONTRACTS.md)
- [AI Architecture](docs/evergreen-architecture/04-AI-ARCHITECTURE.md)

## License

MIT
