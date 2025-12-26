# AWS Infrastructure

**Source of Truth** | **Last Updated**: 2025-12-25

Quick reference for all AWS services powering AllThrive. For detailed deployment instructions, see `infrastructure/cloudformation/README.md`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CloudFront Distribution                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│   │  Frontend   │    │    API      │    │  WebSocket  │                     │
│   │  (S3)       │    │  (/api/*)   │    │  (/ws/*)    │                     │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
└──────────┼──────────────────┼──────────────────┼────────────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐  ┌─────────────────────────────────────────────────────┐
│   S3 Bucket      │  │           Application Load Balancer                  │
│   (Static)       │  │                                                      │
└──────────────────┘  └──────────────────────┬──────────────────────────────┘
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      ▼                      ▼                      ▼
              ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
              │  ECS Fargate  │      │  ECS Fargate  │      │  ECS Fargate  │
              │  Web Service  │      │    Celery     │      │  Celery Beat  │
              │  (Daphne)     │      │   Workers     │      │  (Scheduler)  │
              └───────┬───────┘      └───────┬───────┘      └───────┬───────┘
                      │                      │                      │
                      └──────────────────────┼──────────────────────┘
                                             │
           ┌─────────────────┬───────────────┼───────────────┬─────────────────┐
           ▼                 ▼               ▼               ▼                 ▼
    ┌─────────────┐   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   ┌─────────────┐
    │    RDS      │   │ ElastiCache │ │   Weaviate  │ │     S3      │   │  Secrets    │
    │ PostgreSQL  │   │    Redis    │ │ (Vector DB) │ │   (Media)   │   │  Manager    │
    └─────────────┘   └─────────────┘ └─────────────┘ └─────────────┘   └─────────────┘
```

---

## AWS Console Links

| Service | URL | Purpose |
|---------|-----|---------|
| **CloudFront** | [console.aws.amazon.com/cloudfront](https://console.aws.amazon.com/cloudfront) | CDN distribution, cache invalidation, SSL |
| **ECS** | [console.aws.amazon.com/ecs](https://console.aws.amazon.com/ecs) | Container orchestration (Django, Celery, Weaviate) |
| **RDS** | [console.aws.amazon.com/rds](https://console.aws.amazon.com/rds) | PostgreSQL database |
| **ElastiCache** | [console.aws.amazon.com/elasticache](https://console.aws.amazon.com/elasticache) | Redis (Celery queue + Django cache) |
| **S3** | [console.aws.amazon.com/s3](https://console.aws.amazon.com/s3) | Object storage (avatars, media, static) |
| **ALB** | [console.aws.amazon.com/ec2/home#LoadBalancers](https://console.aws.amazon.com/ec2/home#LoadBalancers) | Load balancer (HTTP + WebSocket) |
| **Route53** | [console.aws.amazon.com/route53](https://console.aws.amazon.com/route53) | DNS management |
| **ACM** | [console.aws.amazon.com/acm](https://console.aws.amazon.com/acm) | SSL/TLS certificates |
| **Secrets Manager** | [console.aws.amazon.com/secretsmanager](https://console.aws.amazon.com/secretsmanager) | Environment secrets (API keys, DB creds) |
| **CloudWatch Logs** | [console.aws.amazon.com/cloudwatch/home#logsV2:log-groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups) | Application logs |
| **CloudWatch Alarms** | [console.aws.amazon.com/cloudwatch/home#alarmsV2](https://console.aws.amazon.com/cloudwatch/home#alarmsV2) | Automated alerting |
| **ECR** | [console.aws.amazon.com/ecr](https://console.aws.amazon.com/ecr) | Docker container registry |
| **IAM** | [console.aws.amazon.com/iam](https://console.aws.amazon.com/iam) | Identity & access management, OIDC |
| **VPC** | [console.aws.amazon.com/vpc](https://console.aws.amazon.com/vpc) | Network config, security groups |
| **CloudFormation** | [console.aws.amazon.com/cloudformation](https://console.aws.amazon.com/cloudformation) | Infrastructure as Code stacks |

---

## Application URLs

| Endpoint | URL | Purpose |
|----------|-----|---------|
| **Production Site** | [allthrive.ai](https://allthrive.ai) | User-facing frontend |
| **API** | [api.allthrive.ai](https://api.allthrive.ai) | REST API (through CloudFront) |
| **WebSocket** | wss://ws.allthrive.ai | Real-time connections (direct to ALB) |
| **Health Check** | [api.allthrive.ai/api/health/](https://api.allthrive.ai/api/health/) | Quick API status check |

---

## CloudFormation Templates

Infrastructure is defined in `infrastructure/cloudformation/`:

| Template | Description |
|----------|-------------|
| `01-vpc.yaml` | VPC, subnets, NAT gateways, route tables |
| `02-security-groups.yaml` | Security groups for all services |
| `03-rds.yaml` | RDS PostgreSQL with Multi-AZ |
| `04-elasticache.yaml` | ElastiCache Redis cluster |
| `05-s3.yaml` | S3 buckets for frontend, media, backups |
| `06-ecr.yaml` | ECR repositories for Docker images |
| `07-iam.yaml` | IAM roles for ECS, GitHub Actions |
| `08-secrets.yaml` | Secrets Manager secrets |
| `09-alb.yaml` | Application Load Balancer |
| `10-ecs.yaml` | ECS cluster, services, auto-scaling |
| `11-cloudfront.yaml` | CloudFront CDN distribution |

---

## ECS Services

| Service | Container | CPU | Memory | Tasks | Purpose |
|---------|-----------|-----|--------|-------|---------|
| **Web** | Daphne (ASGI) | 512 | 1024 MB | 1 | Django + WebSockets |
| **Celery Worker** | celery | 512 | 1024 MB | 1 | Async task processing |
| **Celery Beat** | celery | 256 | 512 MB | 1 | Scheduled tasks |
| **Weaviate** | weaviate | 512 | 1024 MB | 1 | Vector database for AI search |

---

## Weaviate (Vector Database)

Weaviate provides semantic search and RAG capabilities for Ember.

**What it stores:**
- Project embeddings (for similarity search)
- User interest vectors (for recommendations)
- Game metadata (for AI game search)
- Learning content embeddings

**Key endpoints (internal):**
- REST API: `http://weaviate:8080`
- gRPC: `weaviate:50051`

**Local development:** Runs via Docker Compose (`weaviate` service)

**Production:** Runs as ECS Fargate service in private subnet

---

## Secrets Manager Structure

| Secret Path | Contents |
|-------------|----------|
| `production/allthrive/ai/api-keys` | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` |
| `production/allthrive/oauth/credentials` | `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` |
| `production/allthrive/stripe/credentials` | `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `production/allthrive/database` | `DATABASE_URL` |
| `production/allthrive/app` | `SECRET_KEY`, `SENTRY_DSN` |

---

## GitHub Actions OIDC

Deployments use OIDC federation (no stored AWS credentials).

**Required GitHub Secrets:**
| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_POSTHOG_KEY` | PostHog API key (optional) |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) |

**Required GitHub Variables:**
| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `production` or `staging` |
| `API_URL` | Backend API URL |

---

## Quick Validation

```bash
make aws-validate           # Check all infrastructure
make aws-validate ENVIRONMENT=staging  # Check staging
```

Validates: RDS, Redis, S3, Secrets, ECS services, env vars, SSL certs, CloudWatch errors.

---

## Common Tasks

| Task | Command |
|------|---------|
| Validate infrastructure | `make aws-validate` |
| Clear CDN cache | `make cloudfront-clear-cache` |
| View logs | CloudWatch → `/ecs/allthriveai-production` |
| Check deployments | ECS → Clusters → allthriveai-production |
| Database metrics | RDS → Performance Insights |
| SSL expiration | ACM → Certificates |

---

## Troubleshooting

### ECS Tasks Failing to Start
- Check CloudWatch logs: `/ecs/production-allthrive-*`
- Verify secrets are populated in Secrets Manager
- Check security group rules allow outbound traffic

### Database Connection Errors
- Verify RDS security group allows ECS tasks
- Check `DATABASE_URL` secret format

### WebSocket Connection Failures
- ALB idle timeout must be ≥120s
- Check CloudFront WebSocket behavior configuration

### Weaviate Not Responding
- Check ECS task is running
- Verify security group allows port 8080 from ECS tasks
- Check CloudWatch logs for `/ecs/production-allthrive-weaviate`

### Static Assets Not Loading
- Verify S3 bucket policy allows CloudFront
- Check CloudFront OAC configuration

---

## Useful Commands

```bash
# View all stack outputs
cd infrastructure/cloudformation && ./deploy.sh outputs

# Check ECS service status
aws ecs describe-services \
  --cluster production-allthrive-cluster \
  --services production-allthrive-web

# View recent logs
aws logs tail /ecs/production-allthrive-web --follow

# Connect to container
aws ecs execute-command \
  --cluster production-allthrive-cluster \
  --task <task-arn> \
  --container web \
  --interactive \
  --command "/bin/bash"

# Run migrations
aws ecs execute-command \
  --cluster production-allthrive-cluster \
  --task <task-arn> \
  --container web \
  --interactive \
  --command "python manage.py migrate"
```

---

## Cost Estimate

| Service | Monthly Cost |
|---------|--------------|
| ECS Fargate (Web + Celery + Beat + Weaviate) | ~$65 |
| RDS PostgreSQL (db.t3.micro) | ~$15 |
| ElastiCache Redis | ~$12 |
| ALB | ~$20 |
| NAT Gateway | ~$35 |
| CloudFront + S3 | ~$15 |
| **Total** | **~$160** |

**Cost Reduction Tips:**
- Use Reserved Instances for RDS/ElastiCache (30-50% savings)
- Use Fargate Spot for Celery workers (70% savings)
- Add VPC endpoints to reduce NAT Gateway costs
- Use S3 Intelligent-Tiering for media bucket

---

## Related Docs

- `infrastructure/cloudformation/README.md` - Detailed deployment guide
- `docs/evergreen-architecture/21-OBSERVABILITY.md` - Monitoring & logging
- `docs/evergreen-architecture/20-DEPLOYMENT.md` - CI/CD pipeline

---

**Version**: 1.1
**Status**: Active
**Maintainer**: Engineering Team
