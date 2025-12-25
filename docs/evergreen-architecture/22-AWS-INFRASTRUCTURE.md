# AWS Infrastructure Checklist

Quick reference for all AWS services powering AllThrive.

## AWS Console Links

| What | URL | What It Is | Why We Care |
|------|-----|------------|-------------|
| **CloudFront** | [console.aws.amazon.com/cloudfront](https://console.aws.amazon.com/cloudfront) | CDN distribution for frontend + API caching | Cache invalidation, edge locations, SSL, compression settings |
| **ECS** | [console.aws.amazon.com/ecs](https://console.aws.amazon.com/ecs) | Container orchestration for Django + Celery | Deployments, task counts, service health, CPU/memory |
| **RDS** | [console.aws.amazon.com/rds](https://console.aws.amazon.com/rds) | PostgreSQL database | Connections, storage, backups, performance insights |
| **ElastiCache** | [console.aws.amazon.com/elasticache](https://console.aws.amazon.com/elasticache) | Redis for Celery queue + Django cache | Memory usage, evictions, connection count |
| **S3** | [console.aws.amazon.com/s3](https://console.aws.amazon.com/s3) | Object storage (avatars, media, static files) | Storage costs, bucket policies, CORS settings |
| **ALB** | [console.aws.amazon.com/ec2/home#LoadBalancers](https://console.aws.amazon.com/ec2/home#LoadBalancers) | Application Load Balancer for HTTP + WebSocket | Target health, routing rules, SSL termination |
| **Route53** | [console.aws.amazon.com/route53](https://console.aws.amazon.com/route53) | DNS management | Domain records, health checks, routing policies |
| **ACM** | [console.aws.amazon.com/acm](https://console.aws.amazon.com/acm) | SSL/TLS certificates | Certificate expiration, domain validation |
| **Secrets Manager** | [console.aws.amazon.com/secretsmanager](https://console.aws.amazon.com/secretsmanager) | Environment secrets (API keys, DB creds) | Secret rotation, access policies |
| **CloudWatch Logs** | [console.aws.amazon.com/cloudwatch/home#logsV2:log-groups](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups) | Application logs (Django, Celery, nginx) | Error debugging, performance analysis |
| **CloudWatch Metrics** | [console.aws.amazon.com/cloudwatch/home#metricsV2](https://console.aws.amazon.com/cloudwatch/home#metricsV2) | Infrastructure metrics | CPU, memory, latency, error rates |
| **CloudWatch Alarms** | [console.aws.amazon.com/cloudwatch/home#alarmsV2](https://console.aws.amazon.com/cloudwatch/home#alarmsV2) | Automated alerting | Get notified of issues before users do |
| **ECR** | [console.aws.amazon.com/ecr](https://console.aws.amazon.com/ecr) | Docker container registry | Image versions, vulnerability scanning |
| **IAM** | [console.aws.amazon.com/iam](https://console.aws.amazon.com/iam) | Identity & access management | Service roles, OIDC for GitHub Actions |
| **VPC** | [console.aws.amazon.com/vpc](https://console.aws.amazon.com/vpc) | Virtual network configuration | Security groups, subnets, NAT gateways |
| **CloudFormation** | [console.aws.amazon.com/cloudformation](https://console.aws.amazon.com/cloudformation) | Infrastructure as Code stacks | Stack status, drift detection, resource inventory |

## Application URLs

| What | URL | Why We Care |
|------|-----|-------------|
| **Production Site** | [allthrive.ai](https://allthrive.ai) | User-facing frontend |
| **API Endpoint** | [api.allthrive.ai](https://api.allthrive.ai) | REST API (through CloudFront) |
| **WebSocket Endpoint** | wss://ws.allthrive.ai | Real-time connections (direct to ALB) |
| **Health Check** | [api.allthrive.ai/api/health/](https://api.allthrive.ai/api/health/) | Quick API status check |

## Traffic Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │ allthrive.ai│   │api.allthrive│   │ws.allthrive │
     │  (frontend) │   │    .ai      │   │    .ai      │
     └─────────────┘   └─────────────┘   └─────────────┘
            │                 │                 │
            ▼                 ▼                 │
     ┌─────────────────────────────┐            │
     │        CloudFront           │            │
     │  (CDN + caching + SSL)      │            │
     └─────────────────────────────┘            │
                    │                           │
                    ▼                           ▼
              ┌─────────────────────────────────────┐
              │              ALB                     │
              │   (Application Load Balancer)       │
              └─────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │  ECS Web    │   │ ECS Celery  │   │ ECS Celery  │
     │  (Django)   │   │  (Worker)   │   │   (Beat)    │
     └─────────────┘   └─────────────┘   └─────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │     RDS     │   │ ElastiCache │   │     S3      │
     │ (PostgreSQL)│   │   (Redis)   │   │  (Storage)  │
     └─────────────┘   └─────────────┘   └─────────────┘
```

## Quick Validation

Run `make aws-validate` to check:
- RDS connectivity and connections
- Redis memory usage
- S3 bucket accessibility
- Secrets Manager configuration
- ECS service health
- Environment variables
- WebSocket URL in frontend bundle
- API health endpoint
- SSL certificate expiration
- Recent errors in CloudWatch
- Last deployment timestamp

## Common Tasks

| Task | Command/Action |
|------|----------------|
| Check infrastructure | `make aws-validate` |
| Clear CDN cache | `make cloudfront-clear-cache` |
| View logs | CloudWatch Logs → `/ecs/allthriveai-production` |
| Check deployments | ECS → Clusters → allthriveai-production |
| Database metrics | RDS → Performance Insights |
| SSL expiration | ACM → Certificates |

## ECS Resources & Costs

| Service | CPU | Memory | Tasks | Concurrency | Monthly Cost |
|---------|-----|--------|-------|-------------|--------------|
| Web (Django) | 512 | 1024 MB | 1 | - | ~$18 |
| Celery Worker | 512 | 1024 MB | 1 | 4 | ~$18 |
| Celery Beat | 256 | 512 MB | 1 | - | ~$9 |
| Weaviate | 512 | 1024 MB | 1 | - | ~$18 |
| **ECS Subtotal** | | | | | **~$63** |
| RDS (db.t3.micro) | - | - | - | - | ~$15 |
| ElastiCache | - | - | - | - | ~$12 |
| ALB | - | - | - | - | ~$20 |
| NAT Gateway | - | - | - | - | ~$35 |
| CloudFront + S3 | - | - | - | - | ~$15 |
| **Total** | | | | | **~$160** |

**Scaling**: To add Celery capacity, increase `CeleryDesiredCount` in CloudFormation (~$18/worker/month).
