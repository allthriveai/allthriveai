# AllThrive AI - AWS Infrastructure

This directory contains CloudFormation templates for deploying AllThrive AI to AWS.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
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

## Templates

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

## Prerequisites

1. **AWS CLI** installed and configured
2. **AWS Account** with appropriate permissions
3. **Domain name** (optional, for custom domain)
4. **ACM Certificate** (optional, for HTTPS)
   - ALB certificate: Any region
   - CloudFront certificate: Must be in `us-east-1`

## Quick Start

### 1. Deploy Infrastructure

```bash
# Set environment
export ENVIRONMENT=production
export AWS_REGION=us-east-1

# Deploy all stacks
cd infrastructure/cloudformation
./deploy.sh all
```

### 2. Update Secrets

After deployment, update the secrets in AWS Secrets Manager with real values:

```bash
# Update AI API keys
aws secretsmanager update-secret \
  --secret-id production/allthrive/ai/api-keys \
  --secret-string '{
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "GOOGLE_API_KEY": "...",
    "AZURE_OPENAI_API_KEY": "..."
  }'

# Update OAuth credentials
aws secretsmanager update-secret \
  --secret-id production/allthrive/oauth/credentials \
  --secret-string '{
    "GOOGLE_CLIENT_ID": "...",
    "GOOGLE_CLIENT_SECRET": "...",
    "GITHUB_CLIENT_ID": "...",
    "GITHUB_CLIENT_SECRET": "..."
  }'

# Update Stripe credentials
aws secretsmanager update-secret \
  --secret-id production/allthrive/stripe/credentials \
  --secret-string '{
    "STRIPE_PUBLIC_KEY": "pk_live_...",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "STRIPE_WEBHOOK_SECRET": "whsec_..."
  }'
```

### 3. Build and Push Docker Image

```bash
# Get ECR repository URI
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name production-allthrive-ecr \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendRepositoryUri`].OutputValue' \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -f Dockerfile.prod -t $ECR_URI:latest .
docker push $ECR_URI:latest
```

### 4. Deploy ECS Services

```bash
./deploy.sh ecs
```

### 5. Build and Deploy Frontend

```bash
cd frontend

# Build with production environment
VITE_API_URL=https://your-domain.com npm run build

# Get S3 bucket name
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name production-allthrive-s3 \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

# Upload to S3
aws s3 sync dist/ s3://$BUCKET/ --delete
```

### 6. Deploy CloudFront

```bash
# Without custom domain
./deploy.sh cloudfront

# With custom domain
DOMAIN_NAME=allthrive.ai \
CERTIFICATE_ARN=arn:aws:acm:us-east-1:... \
./deploy.sh cloudfront
```

### 7. Run Migrations

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster production-allthrive-cluster \
  --service-name production-allthrive-web \
  --query 'taskArns[0]' --output text)

# Run migrations via ECS Exec
aws ecs execute-command \
  --cluster production-allthrive-cluster \
  --task $TASK_ARN \
  --container web \
  --interactive \
  --command "python manage.py migrate"

# Create initial data
aws ecs execute-command \
  --cluster production-allthrive-cluster \
  --task $TASK_ARN \
  --container web \
  --interactive \
  --command "python manage.py create_pip && python manage.py seed_categories"
```

## GitHub Actions Setup

### Required Secrets

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | Your AWS account ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for frontend |
| `VITE_POSTHOG_KEY` | PostHog API key (optional) |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) |

### Required Variables

Add these variables to your GitHub repository:

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | Environment name (`production` or `staging`) |
| `API_URL` | Backend API URL (e.g., `https://api.allthrive.ai`) |
| `WS_URL` | WebSocket URL (e.g., `wss://ws.allthrive.ai`) - direct to ALB |

### OIDC Provider Setup

Create the GitHub OIDC provider in your AWS account:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## Cost Optimization

### Estimated Monthly Costs

| Service | Configuration | Cost |
|---------|--------------|------|
| ECS Fargate | Web (2x), Celery (2x), Beat (1x) | ~$150-200 |
| RDS PostgreSQL | db.t4g.medium, Multi-AZ | ~$120-150 |
| ElastiCache Redis | cache.t4g.small (2 nodes) | ~$70-90 |
| ALB | 1 load balancer | ~$25-30 |
| S3 | 100GB storage | ~$10-20 |
| CloudFront | 1TB transfer | ~$85-100 |
| NAT Gateway | 2 gateways | ~$60-90 |
| Others | Secrets, CloudWatch, etc. | ~$40-60 |
| **Total** | | **~$560-740/month** |

### Cost Reduction Tips

1. **Use Reserved Instances** for RDS and ElastiCache (30-50% savings)
2. **Use Fargate Spot** for Celery workers (70% savings)
3. **Reduce NAT Gateway** costs with VPC endpoints
4. **Use S3 Intelligent-Tiering** for media bucket
5. **Scale down** during off-hours with scheduled scaling

## Monitoring

### CloudWatch Dashboards

Access dashboards at: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:`

### Key Metrics to Monitor

- **ECS**: CPU, Memory, Running Tasks
- **RDS**: CPU, Connections, Storage
- **ElastiCache**: CPU, Memory, Cache Hits
- **ALB**: Request Count, Latency, 5XX Errors
- **CloudFront**: Requests, Cache Hit Rate

### Alarms

Pre-configured alarms for:
- RDS high CPU (>80%)
- RDS low storage (<5GB)
- RDS high connections (>100)
- ElastiCache high CPU (>75%)
- ElastiCache high memory (>80%)

## Troubleshooting

### Common Issues

1. **ECS tasks failing to start**
   - Check CloudWatch logs: `/ecs/production-allthrive-*`
   - Verify secrets are populated
   - Check security group rules

2. **Database connection errors**
   - Verify RDS security group allows ECS tasks
   - Check DATABASE_URL secret format

3. **WebSocket connection failures**
   - Ensure `ws.allthrive.ai` is in Django ALLOWED_HOSTS (set in `10-ecs.yaml`)
   - Verify DNS record `ws.allthrive.ai` points to ALB (not CloudFront)
   - Check that SSL certificate covers `ws.allthrive.ai`
   - Ensure ALB idle timeout is sufficient (120s)

4. **Static assets not loading**
   - Verify S3 bucket policy allows CloudFront
   - Check CloudFront OAC configuration

### Useful Commands

```bash
# View all stack outputs
./deploy.sh outputs

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
```

## Cleanup

To delete all resources:

```bash
./deploy.sh delete
```

**Warning**: This will delete all data including databases and S3 buckets. RDS and S3 have deletion protection enabled by default.

## Support

For issues or questions, please open an issue in the repository.
