# Database Seeding Quick Reference

This guide provides quick commands for seeding and resetting your AllThrive AI database.

## Quick Commands

### Reset Database with All Initial Data

```bash
make reset-db
```

**What it does:**
1. Prompts for confirmation (⚠️ **DELETES ALL DATA**)
2. Flushes the database
3. Runs migrations
4. Seeds all initial data:
   - Topics
   - Taxonomies
   - Categories
   - AI Tools
   - Quizzes

### Seed All Data (Without Reset)

```bash
make seed-all
```

**Use when:** You want to add/update seed data without clearing the database.

### Seed Individual Data Types

```bash
# Seed only quizzes
make seed-quizzes

# Seed only topics
docker compose exec web python manage.py seed_topics

# Seed only taxonomies
docker compose exec web python manage.py seed_taxonomies

# Seed only categories
docker compose exec web python manage.py seed_categories

# Seed only tools
docker compose exec web python manage.py seed_tools
```

## Initial Data Included

### Quizzes (2 total, 11 questions)

1. **AI Agent Frameworks Showdown** (5 questions)
   - Covers LangChain, LangGraph, CrewAI, AutoGen
   - Difficulty: Beginner
   - Time: ~5 minutes
   - Categories: AI Agents & Multi-Tool Systems, Developer & Coding, Podcasts & Education
   - Tags: AI Frameworks, LangChain, LangGraph, CrewAI, AutoGen, Multi-Agent Systems
   - Tools: ChatGPT, Claude

2. **Prompt Engineering Essentials** (6 questions)
   - Covers few-shot learning, chain-of-thought, role prompting
   - Difficulty: Beginner
   - Time: ~4 minutes
   - Categories: Prompt Collections & Templates, Podcasts & Education, Developer & Coding
   - Tags: Prompt Engineering, Few-shot Learning, Chain-of-Thought, AI Best Practices, LLM
   - Tools: ChatGPT, Claude, Notion AI

### Other Data

- **Topics**: 15 project categories (Chatbots, Websites, Images, etc.)
- **Taxonomies**: Core taxonomy structures
- **Categories**: Tool categories
- **AI Tools**: ChatGPT, Claude, Midjourney, GitHub Copilot, etc.

## When to Use Each Command

| Scenario | Command | Notes |
|----------|---------|-------|
| Fresh database setup | `make reset-db` | Complete reset + seed |
| After pulling new seed code | `make seed-all` | Updates existing data |
| Just need quiz data | `make seed-quizzes` | Idempotent, safe to re-run |
| Testing with clean slate | `make reset-db` | Ensures consistent state |
| Production initial setup | `make seed-all` | Never use `reset-db` in prod! |

## Idempotent Operations

All seed commands are **idempotent** - safe to run multiple times:
- Creates records if they don't exist
- Updates records if they already exist (based on slug/name)
- Never duplicates data

## Common Workflows

### Starting a new feature branch

```bash
git checkout -b feature/my-feature
make reset-db  # Start with clean, seeded data
```

### After database schema changes

```bash
make down
# Edit models
docker compose up -d
docker compose exec web python manage.py makemigrations
docker compose exec web python manage.py migrate
make seed-all  # Re-seed data
```

### Refreshing quiz data

```bash
# Edit core/management/commands/seed_quizzes.py
make seed-quizzes  # Updates quizzes in place
```

## Troubleshooting

**Command not found: make**
- You're not in the project root directory
- Run: `cd /Users/allierays/Sites/allthriveai`

**Docker containers not running**
- Start them first: `make up`
- Wait a few seconds, then try again

**Database connection errors**
- Check PostgreSQL is running: `docker compose ps`
- Restart services: `make restart`

**Seed data not appearing**
- Check `is_published=True` for quizzes
- Verify migrations ran: `docker compose exec web python manage.py showmigrations`
- Check logs: `make logs`

## Related Documentation

- [Quiz Seeding Details](./QUIZ_SEEDING.md) - In-depth quiz seeding documentation
- [Makefile Commands](../Makefile) - All available make commands
- [Database Setup](../README.md) - Initial database configuration

## Manual Database Operations

If you need more control:

```bash
# Django shell
docker compose exec web python manage.py shell

# Create superuser
docker compose exec web python manage.py createsuperuser

# Run specific migration
docker compose exec web python manage.py migrate core 0042

# Show migrations status
docker compose exec web python manage.py showmigrations

# Access PostgreSQL directly
docker compose exec db psql -U postgres -d allthriveai
```

## System User

The seed commands automatically create a `system` user to own seeded content:
- **Username**: `system`
- **Email**: `system@allthrive.ai`
- **Type**: Staff user
- **Purpose**: Owns quizzes, tools, and other seed data

This ensures seed data always has a valid creator, even on fresh databases.
