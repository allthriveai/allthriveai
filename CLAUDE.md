# AllThrive AI - Project Instructions

## Development Environment

**IMPORTANT: Always use Docker for backend development. Never create a Python virtual environment.**

### Quick Start
```bash
make up              # Start all services (Docker)
make frontend        # Run frontend locally (or cd frontend && npm run dev -- --port 3000)
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
| `make create-pip` | Create Pip bot user |
| `make recreate-pip` | Delete and recreate Pip with latest data |
| `make seed-quizzes` | Seed initial quiz data |
| `make seed-all` | Seed all initial data |
| `make export-tools` | Export tools from database to YAML |
| `make load-tools` | Load tools from YAML into database |
| `make export-tasks` | Export tasks from database to YAML |
| `make load-tasks` | Load tasks from YAML into database |
| `make create-youtube-agent` | Create YouTube feed agent (see below) |
| `make reset-db` | DANGER: Flush database and reseed |

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
- **Design System**: Neon Glass aesthetic (see `/styleguide-neon`)

## Notes
- Run `make help` to see all available commands
- The web container is named `web` (not `backend`) in docker-compose
