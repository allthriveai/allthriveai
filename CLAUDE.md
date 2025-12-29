# AllThrive AI - Project Instructions

## Development Environment

**IMPORTANT: Always use Docker for backend development. Never create a Python virtual environment.**

### Quick Start
```bash
make up              # Start all services (Docker)
make frontend        # Run frontend locally (or cd frontend && npm run dev -- --port 3000)
```

### Fresh Database Setup
After first `make up` or `make reset-db`, seed the database:
```bash
make seed-all        # Required once for initial data
```

## Make Commands (Preferred)

### Service Management
| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make restart` | Restart all services |
| `make restart-all` | Shut down and restart all services |
| `make restart-backend` | Restart backend only |
| `make build` | Build all services |
| `make rebuild` | Rebuild all services (no cache) |
| `make ps` | Show running containers |

### Logs
| Command | Description |
|---------|-------------|
| `make logs` | View all logs (follow) |
| `make logs-backend` | View backend logs |
| `make logs-celery` | View Celery worker logs |
| `make logs-redis` | View Redis logs |
| `make logs-db` | View PostgreSQL logs |

### Shells
| Command | Description |
|---------|-------------|
| `make shell-backend` | Open shell in backend container |
| `make shell-db` | Open PostgreSQL shell |
| `make shell-redis` | Open Redis CLI |
| `make django-shell` | Open Django shell |
| `make dbshell` | Open Django dbshell |

### Database & Migrations
| Command | Description |
|---------|-------------|
| `make migrate` | Run Django migrations |
| `make makemigrations` | Create new Django migrations |
| `make createsuperuser` | Create Django superuser |
| `make collectstatic` | Collect static files |

### Data Management
| Command | Description |
|---------|-------------|
| `make seed-all` | Seed all initial data (see full list below) |
| `make seed-core-team` | Seed Core Team (Ember, Pip, Sage, Haven) |
| `make recreate-core-team` | Recreate Core Team with latest data |
| `make seed-quizzes` | Seed initial quiz data |
| `make seed-quests` | Seed Thrive Circle side quests |
| `make seed-rooms` | Seed community rooms (The Lounge) |
| `make seed-curation-agents` | Seed Reddit, YouTube, RSS curation agents |
| `make export-tools` | Export tools from database to YAML |
| `make load-tools` | Load tools from YAML into database |
| `make export-tasks` | Export tasks from database to YAML |
| `make load-tasks` | Load tasks from YAML into database |
| `make create-youtube-agent` | Create YouTube feed agent (see below) |
| `make reset-db` | DANGER: Flush database and reseed |

#### What `seed-all` Includes
The `seed-all` command runs these seeders in order:
- `seed_topics` - Project topics (Chatbots, Images, Video, etc.)
- `seed_taxonomies` - User interests & skills
- `seed_categories` - Project categories
- `seed_tools` - AI tools directory
- `seed_technologies` - Programming languages (Python, TypeScript, etc.)
- `seed_quizzes` - Quiz content
- `seed_concepts` - Learning concepts
- `seed_battle_prompts` - Prompt battle challenges
- `seed_billing` - Billing/subscription plans
- `seed_credit_packs` - Credit pack options
- `seed_ai_pricing` - AI provider cost tracking
- `seed_achievements` - Gamification achievements
- `seed_quests` - Thrive Circle side quests
- `seed_tasks` - Task options (statuses, types, priorities)
- `seed_uat_scenarios` - UAT testing scenarios
- `seed_rooms` - Community rooms (The Lounge: General, Showcase, Help, etc.)
- `seed_core_team` - Ember, Pip, Sage, Haven
- `seed_curation_agents` - Reddit, YouTube, RSS agents
- `seed_games` - Game metadata for Weaviate search
- `seed_game_projects` - Game promo cards for explore feed (Context Snake, Ethics Defender, Prompt Battle)
- `create_test_users` - Test users for impersonation (local only)

#### Creating YouTube Feed Agents
Create automated agents that sync videos from YouTube channels:

```bash
# Basic usage (required params)
make create-youtube-agent \
  CHANNEL_URL="https://www.youtube.com/@ChannelName" \
  SOURCE_NAME="Channel Name"

# With optional social links and avatar
make create-youtube-agent \
  CHANNEL_URL="https://www.youtube.com/@AIDailyBrief" \
  SOURCE_NAME="AI Daily Brief" \
  AVATAR="https://example.com/avatar.jpg" \
  WEBSITE="https://aidailybrief.com" \
  TWITTER="https://twitter.com/aidailybrief" \
  INSTAGRAM="https://instagram.com/aidailybrief"
```

Optional parameters: `AVATAR`, `WEBSITE`, `TWITTER`, `INSTAGRAM`, `LINKEDIN`, `GITHUB`

### Testing
| Command | Description |
|---------|-------------|
| `make test` | Run all tests (backend + frontend) |
| `make test-backend` | Run backend tests |
| `make test-frontend` | Run frontend tests |
| `make test-coverage` | Run backend tests with coverage |

### Code Quality
| Command | Description |
|---------|-------------|
| `make lint` | Run linting for all code |
| `make lint-backend` | Run backend linting (ruff) |
| `make format` | Format all code |
| `make format-backend` | Format backend code (ruff) |
| `make type-check` | Run frontend type checking |
| `make security-check` | Run security checks (bandit) |
| `make pre-commit` | Run pre-commit hooks |

### Cleanup
| Command | Description |
|---------|-------------|
| `make clean` | Clean Python cache and build files |
| `make clean-cache` | Clean cache files only |
| `make clean-volumes` | DANGER: Remove Docker volumes |
| `make clean-all` | DANGER: Remove containers, volumes, and cache |

### AWS Deployment
| Command | Description |
|---------|-------------|
| `make aws-validate` | Validate AWS infrastructure (RDS, Redis, S3, Secrets, ECS, env vars) |
| `make cloudfront-clear-cache` | Invalidate CloudFront cache |

**Note**: AWS commands default to `ENVIRONMENT=production`. Use `ENVIRONMENT=staging` for staging:
```bash
make aws-validate ENVIRONMENT=staging
make cloudfront-clear-cache ENVIRONMENT=staging
```

## Frontend (Local Development)
```bash
cd frontend && npm run dev -- --port 3000   # Start dev server
cd frontend && npm install                   # Install deps
cd frontend && npm run build                 # Build
cd frontend && npm test                      # Run tests
```

## Environment
- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- Backend proxied through Vite with `VITE_API_PROXY_TARGET=http://localhost:8000`

## Tech Stack
- **Backend**: Django 5, Django REST Framework, Django Channels (WebSockets)
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Database**: PostgreSQL (via Docker)
- **Cache/Queue**: Redis (via Docker)
- **Design System**: Neon Glass aesthetic (see `/styleguide`)

## User Model Reference

**Key facts about the User model (`core/users/models.py`):**

- **IDs are integers** (auto-increment), not UUIDs
- **Display name**: Use `user.get_full_name()` method, NOT `user.display_name` (doesn't exist)
- **Username**: Always lowercase, used in URL paths
- **Tiers**: `seedling`, `sprout`, `blossom`, `bloom`, `evergreen`, `curation` (AI agents)
- **Roles**: `explorer`, `learner`, `expert`, `creator`, `mentor`, `patron`, `admin`, `agent`, `vendor`

```python
# ✅ CORRECT
display_name = user.get_full_name() or user.username

# ❌ WRONG - attribute doesn't exist
display_name = user.display_name
```

**Points/Gamification:**
```python
# ✅ CORRECT - Use the method (handles race conditions)
user.add_points(amount=10, activity_type='project_like', description='Liked a project')

# ❌ WRONG - Never update directly
user.total_points += 10
user.save()
```

## Serializer Patterns

**Common patterns in DRF serializers:**

```python
# Use minimal serializers for nested relationships
class ProjectSerializer(serializers.ModelSerializer):
    creator = UserMinimalSerializer(read_only=True)  # Not full UserSerializer

    # Write with ID, read with nested object
    category_id = serializers.PrimaryKeyRelatedField(write_only=True)
    category = CategorySerializer(read_only=True)

    # M2M: *_ids for write, * for read
    tag_ids = serializers.ListField(write_only=True)
    tags = TagSerializer(many=True, read_only=True)
```

**N+1 Prevention:**
```python
# In ViewSet.get_queryset()
def get_queryset(self):
    return Project.objects.select_related('creator', 'category').prefetch_related('tags')
```

## API Conventions: snake_case vs camelCase

**CRITICAL: The frontend expects camelCase, the backend uses snake_case.**

### REST API (Automatic Conversion)
- Django serializers use `snake_case` field names
- Axios interceptors automatically convert between formats:
  - Request: `camelCase` → `snake_case`
  - Response: `snake_case` → `camelCase`
- **No manual conversion needed** for REST endpoints

### WebSocket Messages (Manual Conversion Required)
- WebSocket messages **bypass axios interceptors**
- You **must manually use camelCase** in WebSocket consumer responses
- This applies to all `consumers.py` files

**Correct WebSocket serialization:**
```python
# ✅ CORRECT - Use camelCase for WebSocket responses
{
    'userId': str(user.id),
    'avatarUrl': user.avatar_url,
    'createdAt': message.created_at.isoformat(),
    'messageType': message.message_type,
    'isTyping': is_typing,
    'roomId': str(room.id),
    'memberCount': room.member_count,
    'onlineUsers': online_users,
    'hasMore': has_more,
    'reactionCounts': reaction_counts,
    'isEdited': is_edited,
    'isPinned': is_pinned,
    'replyToId': str(reply_to_id) if reply_to_id else None,
}

# ❌ WRONG - snake_case will break frontend
{
    'user_id': str(user.id),
    'avatar_url': user.avatar_url,
    'created_at': message.created_at.isoformat(),
}
```

**Common fields that need conversion:**
| Backend (snake_case) | Frontend (camelCase) |
|---------------------|---------------------|
| `user_id` | `userId` |
| `avatar_url` | `avatarUrl` |
| `created_at` | `createdAt` |
| `message_type` | `messageType` |
| `is_typing` | `isTyping` |
| `room_id` | `roomId` |
| `member_count` | `memberCount` |
| `online_users` | `onlineUsers` |
| `has_more` | `hasMore` |
| `reaction_counts` | `reactionCounts` |
| `is_edited` | `isEdited` |
| `is_pinned` | `isPinned` |
| `reply_to_id` | `replyToId` |
| `room_type` | `roomType` |
| `display_name` | `displayName` |

### Django Channels Group Names
- Group names must use alphanumerics, hyphens, underscores, or periods only
- **No colons allowed** in group names
- Use dots as namespace separators: `community.room.{id}` not `community:room:{id}`

## Frontend TypeScript Conventions

**Type definitions location:** `frontend/src/types/`
- `models.ts` - Main types (User, Project, Taxonomy, etc.)
- `community.ts` - Community/messaging types
- `api.ts` - API response wrappers

**Type naming:**
```typescript
// Interfaces use PascalCase
interface User { ... }
interface ProjectDetail { ... }

// Union types for enums
type UserRole = 'explorer' | 'learner' | 'expert' | 'creator' | 'mentor';
type UserTier = 'seedling' | 'sprout' | 'blossom' | 'bloom' | 'evergreen' | 'curation';

// API responses
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

## Common Gotchas

### Curation Tier Users
AI agents and curators have `tier='curation'`. Always exclude them from user lists:
```python
User.objects.filter(is_active=True).exclude(tier='curation')
```

### Avatar URLs
Only whitelisted domains allowed. Check `ALLOWED_AVATAR_DOMAINS` in settings.

### Username Changes
Usernames are tracked in `UsernameHistory` for redirects. Old URLs auto-redirect.

### Content Moderation
User bios are sanitized with `bleach`. Only allowed HTML tags: `p, br, strong, em, a, ul, ol, li`

### Taxonomy Filtering
Always filter by `taxonomy_type` and `is_active`:
```python
Taxonomy.objects.filter(taxonomy_type='interest', is_active=True)
```

## Key File Locations

| What | Where |
|------|-------|
| User model | `core/users/models.py` |
| User serializers | `core/users/serializers.py` |
| Permissions | `core/permissions.py` |
| API case transform | `frontend/src/services/api.ts` |
| TypeScript types | `frontend/src/types/models.ts` |
| WebSocket consumers | `core/*/consumers.py` |
| Django settings | `config/settings.py` |

## Notes
- Run `make help` to see all available commands
- The web container is named `web` (not `backend`) in docker-compose
