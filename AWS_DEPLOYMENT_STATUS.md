# AWS Deployment Status & Improvements Needed

## Current State

### Infrastructure ✅
- **S3 Bucket**: `allthrive-frontend-production-953072364000` (exists but EMPTY)
- **CloudFront**: `d3act4flifl35n.cloudfront.net` (deployed but serving nothing)
- **Backend**: ECS infrastructure defined but status unknown
- **Database**: RDS PostgreSQL 18 (assumed deployed)
- **Cache**: ElastiCache Redis with SSL (assumed deployed)

### Workflow Status ⚠️
- `deploy-aws.yml` exists only on feature branch (never merged to main)
- Workflow has NEVER executed (not on main branch)
- Frontend has NEVER been deployed to S3

## Issues Fixed (in aws-deployment-improvements branch)

### 1. Frontend Dependency Installation
**Problem**: React 19 + react-helmet-async incompatibility
**Fix**: Added `--legacy-peer-deps` to all `npm ci` commands in deploy-aws.yml

```yaml
# Lines 70 and 141
run: npm ci --legacy-peer-deps
```

### 2. Database Migration Command
**Problem**: Interactive migration command won't work in CI/CD
**Fix**: Added `--non-interactive` flag to ECS execute-command

```yaml
# Line 267
--non-interactive
```

### 3. Docker Local Development
**Problem**: Frontend container failing with peer dependency conflicts
**Fix**: Added `--legacy-peer-deps` to docker-compose.yml

```yaml
# docker-compose.yml line 184
command: sh -c "npm install --legacy-peer-deps && npm run dev -- --host 0.0.0.0 --port 3000"
```

## Remaining Work Needed

### 1. GitHub Secrets/Variables Setup
Frontend environment variables must be configured in GitHub repository settings:

**Required Secrets:**
- `VITE_STRIPE_PUBLISHABLE_KEY` - Production Stripe publishable key (currently using test key)
- `VITE_POSTHOG_KEY` - PostHog analytics key
- `VITE_SENTRY_DSN` - Sentry error tracking DSN
- `AWS_ACCOUNT_ID` - AWS account ID (for IAM role assumption)

**Required Variables:**
- `API_URL` - Backend API URL (ALB or custom domain)
- `ENVIRONMENT` - Set to "production"

**How to find these:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add Repository secrets for sensitive values (API keys)
3. Add Repository variables for non-sensitive values (URLs)

### 2. Determine Backend URL
The frontend needs to know where the backend API is located:

```bash
# Find the Application Load Balancer DNS name:
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`production-allthrive-alb`].DNSName' \
  --output text

# Or check ECS service for custom domain:
aws ecs describe-services \
  --cluster production-allthrive-cluster \
  --services production-allthrive-web \
  --query 'services[0].loadBalancers'
```

Set this URL as `API_URL` variable in GitHub → Settings → Variables

### 3. Verify Backend Deployment
Check if backend services are actually running:

```bash
# List ECS services
aws ecs list-services --cluster production-allthrive-cluster

# Check service status
aws ecs describe-services \
  --cluster production-allthrive-cluster \
  --services production-allthrive-web production-allthrive-celery production-allthrive-celery-beat
```

### 4. Test Production Build Locally
Before deploying, test the production build:

```bash
# Run the test script we created:
./test-production-build.sh

# This will:
# 1. Clean previous build
# 2. Build with production settings
# 3. Show build output size
# 4. Display deploy commands
```

### 5. Manual Frontend Deployment Test
Deploy frontend manually to validate S3/CloudFront setup:

```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://allthrive-frontend-production-953072364000/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id EKZ5JJZGFJQ33 --paths '/*'

# Visit: https://d3act4flifl35n.cloudfront.net
```

### 6. Merge Workflow to Main
The `deploy-aws.yml` workflow will only run when it's on the main branch:

```bash
# After testing and verification:
git checkout main
git merge aws-deployment-improvements
git push origin main
```

## Environment Variables Reference

### Local Development (.env)
```bash
VITE_API_URL=http://localhost:8000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SRHayBnAbDWmrzEEFXhnahaxEpUqImZcMmz6yCIVORqh1xgr58HI01jIzHndsXcIwWu27Tb32H5mdF3sF23f7SD00BQLvTjLE
VITE_POSTHOG_KEY=phc_ryUlcqRl3zDmGYzwAVZNcVhEokNBUbl0yY7maxSyAZL
VITE_SENTRY_DSN=
```

### Production (GitHub Actions)
```yaml
# In deploy-aws.yml, these come from GitHub Secrets/Variables:
env:
  VITE_API_URL: ${{ vars.API_URL || '' }}
  VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.VITE_STRIPE_PUBLISHABLE_KEY }}
  VITE_POSTHOG_KEY: ${{ secrets.VITE_POSTHOG_KEY }}
  VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
```

**IMPORTANT**: Vite embeds these at BUILD TIME. They are not runtime environment variables. The values get hardcoded into the JavaScript bundle during `npm run build`.

## Architecture Overview

```
┌─────────────┐
│   GitHub    │
│   Actions   │
└──────┬──────┘
       │
       ├─────────────────────┬──────────────────────┐
       │                     │                      │
       v                     v                      v
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Frontend  │      │   Backend   │      │  Database   │
│     Build   │      │    Build    │      │  Migration  │
└──────┬──────┘      └──────┬──────┘      └─────────────┘
       │                     │
       v                     v
┌─────────────┐      ┌─────────────┐
│  S3 Upload  │      │ ECS Deploy  │
└──────┬──────┘      └─────────────┘
       │
       v
┌─────────────┐
│ CloudFront  │
│ Invalidate  │
└─────────────┘
```

### User Flow
1. User visits `https://d3act4flifl35n.cloudfront.net`
2. CloudFront serves static files from S3
3. React app loads in browser
4. API calls go to `VITE_API_URL` (backend ALB)
5. Backend on ECS handles API requests
6. Backend connects to RDS PostgreSQL

## Next Steps for Coworker (Imnet)

1. ✅ Review fixes in `aws-deployment-improvements` branch
2. ⏳ Find or create backend ALB URL
3. ⏳ Configure GitHub Secrets and Variables
4. ⏳ Test production build locally
5. ⏳ Test manual S3 deployment
6. ⏳ Merge workflow to main branch
7. ⏳ Monitor first automated deployment
8. ⏳ Verify frontend and backend communication

## Helpful Commands

```bash
# Check if S3 bucket has content
aws s3 ls s3://allthrive-frontend-production-953072364000/

# Check CloudFront distribution config
aws cloudfront get-distribution --id EKZ5JJZGFJQ33

# View GitHub Actions workflow runs
gh run list --workflow=deploy-aws.yml

# Test local production build
./test-production-build.sh
```
