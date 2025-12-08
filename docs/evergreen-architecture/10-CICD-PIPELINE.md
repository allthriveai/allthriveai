# CI/CD Pipeline Architecture

> Last updated: December 2024

## Overview

AllThrive AI uses a two-stage CI/CD pipeline with GitHub Actions for continuous integration and deployment to AWS.

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LOCAL (docker-compose.yml)                                         │
│  ├── PostgreSQL 18                                                  │
│  ├── Redis Stack                                                    │
│  ├── MinIO (S3-compatible)                                          │
│  └── Django/Daphne (ASGI)                                           │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │   Push to PR    │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CI.YML (Pull Request)                                       │   │
│  │  ✓ PostgreSQL + Redis services                               │   │
│  │  ✓ Django tests (python manage.py test)                      │   │
│  │  ✓ Security tests (bandit, pytest)                           │   │
│  │  ✓ Linting (ruff, eslint)                                    │   │
│  │  ✓ Type checking (TypeScript)                                │   │
│  │  ✓ Frontend tests (Vitest)                                   │   │
│  │  ✓ E2E tests (Playwright)                                    │   │
│  │  ✓ SEO validation (robots.txt, sitemap, ai-plugin.json)      │   │
│  └────────┬────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                                │
│  │   Merge to Main │                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  DEPLOY-AWS.YML (Push to main)                               │   │
│  │  ✓ Build Docker image → ECR                                  │   │
│  │  ✓ Build frontend → S3                                       │   │
│  │  ✓ Update ECS services (web, celery, beat)                   │   │
│  │  ✓ Wait for service stability                                │   │
│  │  ✓ Run migrations via ECS exec                               │   │
│  │  ✓ Invalidate CloudFront cache                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Environments

| Environment | Purpose | Database | Storage | URL |
|-------------|---------|----------|---------|-----|
| **Local** | Development | PostgreSQL (Docker) | MinIO | localhost:3000/8000 |
| **CI** | Testing | PostgreSQL (Service) | N/A | N/A |
| **Production** | Live | RDS PostgreSQL | S3 | allthrive.ai |

## Workflow Files

### 1. CI Workflow (`ci.yml`)

**Triggers:** Pull requests to main, pushes to main

**Purpose:** Run all tests and quality checks before merge

**Jobs:**

#### Test Job
- **Services:** PostgreSQL 18, Redis 7
- **Environment:**
  ```yaml
  DATABASE_URL: postgresql://allthrive:allthrive@localhost:5432/allthrive_ai
  SECRET_KEY: ci-secret-key
  DEBUG: "False"
  SECURE_SSL_REDIRECT: "False"
  ```

- **Steps:**
  1. Install Python dependencies
  2. Wait for PostgreSQL readiness
  3. Run Django checks and migrations
  4. Run backend code quality (ruff, bandit)
  5. Run Django tests
  6. Run security tests (pytest)
  7. Install frontend dependencies
  8. Run ESLint
  9. Run TypeScript type check
  10. Run frontend unit tests
  11. Validate SEO endpoints

#### E2E Job
- **Depends on:** Test job
- **Services:** PostgreSQL 18, Redis 7
- **Steps:**
  1. Set up backend with test data
  2. Start Django server
  3. Install Playwright
  4. Run E2E tests

### 2. Deploy Workflow (`deploy-aws.yml`)

**Triggers:** Push to main (after merge)

**Purpose:** Build and deploy to AWS

**Note:** Tests are NOT duplicated here. All testing happens in `ci.yml` before merge.

**Jobs:**

#### Build Backend
- Build Docker image with multi-stage Dockerfile
- Push to ECR with SHA and `latest` tags
- Uses GitHub Actions cache for Docker layers

#### Build Frontend
- Build Vite/React application
- Upload to S3 with proper cache headers
- `index.html` gets `no-cache` for instant updates

#### Deploy Backend
- Update ECS services (web, celery, celery-beat)
- Force new deployment to pull latest image
- Wait for service stability

#### Deploy Frontend
- Get CloudFront distribution ID from CloudFormation
- Invalidate cache for immediate propagation

#### Migrate
- Execute migrations via ECS exec command
- Runs after backend deployment is stable

## AWS Infrastructure

### Services Used

| Service | Purpose |
|---------|---------|
| **ECR** | Docker image registry |
| **ECS Fargate** | Container orchestration |
| **RDS PostgreSQL** | Primary database |
| **ElastiCache Redis** | Caching, Celery broker, WebSockets |
| **S3** | Frontend hosting, media storage |
| **CloudFront** | CDN for frontend and API |
| **Secrets Manager** | Database credentials, API keys |
| **IAM** | OIDC-based GitHub Actions auth |

### ECS Services

| Service | Purpose | Instances |
|---------|---------|-----------|
| `web` | Django/Daphne (API + WebSockets) | 2 |
| `celery` | Background task workers | 2 |
| `celery-beat` | Scheduled task scheduler | 1 |

## Docker Configuration

### Production Dockerfile (`Dockerfile.prod`)

```dockerfile
# Multi-stage build
FROM python:3.11-slim AS builder
# Install build dependencies, create wheels

FROM python:3.11-slim AS production
# Install runtime dependencies only
# Copy wheels from builder
# Create non-root user
# Collect static files
# Health check configured
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
```

**Key Features:**
- Multi-stage build (smaller image)
- Non-root user for security
- Health checks for ECS
- RDS CA certificate for SSL connections

## Environment Variables

### Required for Production

| Variable | Source | Description |
|----------|--------|-------------|
| `SECRET_KEY` | Secrets Manager | Django secret key |
| `DATABASE_URL` | Secrets Manager | RDS connection string |
| `REDIS_HOST` | CloudFormation | ElastiCache endpoint |
| `REDIS_AUTH_TOKEN` | Secrets Manager | ElastiCache auth |
| `AWS_STORAGE_BUCKET_NAME` | CloudFormation | Media S3 bucket |

### CI-Only Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `SECRET_KEY` | `ci-secret-key` | Placeholder for tests |
| `DATABASE_URL` | PostgreSQL service | CI database |
| `DEBUG` | `False` (tests), `True` (E2E) | Debug mode |

## Security

### Authentication
- GitHub Actions uses OIDC to assume IAM role
- No long-lived AWS credentials stored
- Role: `{environment}-allthrive-github-actions-role`

### Permissions
```yaml
permissions:
  id-token: write   # For OIDC
  contents: read    # For checkout
```

### Secrets Management
- Production secrets in AWS Secrets Manager
- CI secrets in GitHub Secrets
- Never hardcode production values

## Deployment Commands

### Manual Deployment
```bash
# Trigger deployment workflow manually
gh workflow run deploy-aws.yml
```

### Check Deployment Status
```bash
aws ecs describe-services \
  --cluster production-allthrive-cluster \
  --services production-allthrive-web \
  --query 'services[0].deployments'
```

### Run Commands on ECS
```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster production-allthrive-cluster \
  --service-name production-allthrive-web \
  --query 'taskArns[0]' --output text)

# Run management command
aws ecs execute-command \
  --cluster production-allthrive-cluster \
  --task $TASK_ARN \
  --container web \
  --command "python manage.py <command>" \
  --interactive
```

### Seed Data on AWS
```bash
# Run all seed commands
for cmd in seed_topics seed_taxonomies seed_categories seed_tools seed_quizzes; do
  aws ecs execute-command \
    --cluster production-allthrive-cluster \
    --task $TASK_ARN \
    --container web \
    --command "python manage.py $cmd" \
    --interactive
done
```

## Troubleshooting

### CI Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| PostgreSQL timeout | Service not ready | Check health check in workflow |
| Import errors | Missing module | Verify requirements.txt |
| Test failures | Code issues | Run tests locally first |

### Deploy Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| ECR push failed | IAM permissions | Check role trust policy |
| ECS not stable | Health check failing | Check container logs |
| Migration failed | Database connection | Verify secrets, security groups |

### View Logs
```bash
# ECS logs
aws logs tail /ecs/production-allthrive-web --follow

# CloudWatch insights
aws logs filter-log-events \
  --log-group-name /ecs/production-allthrive-web \
  --filter-pattern "ERROR"
```

## Best Practices

1. **Always create PRs** - Never push directly to main
2. **Wait for CI** - Don't merge until all checks pass
3. **Monitor deployments** - Watch ECS console during deploy
4. **Test locally first** - Use `make test-backend` before pushing
5. **Check logs** - If deployment fails, check CloudWatch immediately

## Future Improvements

- [ ] Add deployment rollback with ECS circuit breaker
- [ ] Add staging environment
- [ ] Add Slack/Discord notifications
- [ ] Add deployment approval gates
- [ ] Add performance testing in CI
