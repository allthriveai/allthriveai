# Stripe Setup for Docker

This guide walks you through setting up Stripe integration when running AllThrive in Docker.

## Prerequisites

- Docker and Docker Compose installed
- Stripe test account created (see [STRIPE_SETUP.md](./STRIPE_SETUP.md))
- Stripe API keys added to `.env` file

## Environment Setup

Your `.env` file should already have these Stripe variables from Phase 0:

```bash
STRIPE_PUBLIC_KEY=pk_test_51SRHay...
STRIPE_SECRET_KEY=sk_test_51SRHay...
STRIPE_WEBHOOK_SECRET=whsec_... # Will be set after webhook setup
```

## Running with Docker

### Step 1: Build and Start Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d
```

This will start:
- `db` - PostgreSQL database
- `redis` - Redis for caching and Celery
- `minio` - S3-compatible object storage
- `weaviate` - Vector database
- `web` - Django backend (port 8000)
- `celery` - Background task worker
- `frontend` - React frontend (port 3000)
- `prometheus` - Metrics (port 9090)
- `grafana` - Monitoring (port 3001)

### Step 2: Run Migrations

```bash
# Run migrations
docker-compose exec web python manage.py migrate

# Seed billing data
docker-compose exec web python manage.py seed_billing --with-stripe
```

This will:
- Create all billing database tables
- Create 4 subscription tiers
- Create 3 token packages
- Sync products and prices to Stripe

### Step 3: Create a Superuser (Optional)

```bash
docker-compose exec web python manage.py createsuperuser
```

Then visit http://localhost:8000/admin to view billing data.

## Webhook Testing with Stripe CLI

For local development, you need to forward Stripe webhook events to your Docker container.

### Option 1: Use Stripe CLI Service (Recommended)

We've added a `stripe-cli` service that runs inside Docker:

```bash
# Start the webhook forwarder
docker-compose --profile stripe-webhooks up stripe-cli
```

When you start this service, watch the logs to get your webhook signing secret:

```bash
docker-compose logs stripe-cli
```

You'll see output like:
```
Ready! You are using Stripe API Version [2024-10-28.acacia]. Your webhook signing secret is whsec_xxx
```

**Important:** Copy the `whsec_xxx` value and add it to your `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Then restart the web service to load the new secret:

```bash
docker-compose restart web
```

### Option 2: Use Stripe CLI on Host Machine

Alternatively, install Stripe CLI on your host machine:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to Docker container
stripe listen --forward-to http://localhost:8000/api/v1/billing/webhooks/stripe/
```

This will output a webhook signing secret - add it to `.env` as shown above.

## Testing the Integration

### 1. Test Stripe Connection

```bash
docker-compose exec web python test_stripe.py
```

Expected output:
```
✅ Stripe connection successful!
Account Balance: $0.00 USD
```

### 2. Test API Endpoints

```bash
# List subscription tiers (public)
curl http://localhost:8000/api/v1/billing/tiers/

# List token packages (public)
curl http://localhost:8000/api/v1/billing/packages/
```

### 3. Test Webhooks

Trigger a test webhook event:

```bash
# Using Stripe CLI on host
stripe trigger payment_intent.succeeded

# Or using Docker service
docker-compose exec stripe-cli trigger payment_intent.succeeded
```

Check the web container logs to see the webhook being processed:

```bash
docker-compose logs -f web
```

You should see:
```
INFO Received Stripe webhook: payment_intent.succeeded
```

## Viewing Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f web
docker-compose logs -f stripe-cli
docker-compose logs -f celery
```

## Common Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild a service
docker-compose up --build web

# Run Django management commands
docker-compose exec web python manage.py <command>

# Access Django shell
docker-compose exec web python manage.py shell

# Access database
docker-compose exec db psql -U allthrive -d allthrive_ai

# View running containers
docker-compose ps

# Restart a service
docker-compose restart web
```

## Troubleshooting

### Webhooks not working

1. Check that `STRIPE_WEBHOOK_SECRET` is set in `.env`
2. Restart web service: `docker-compose restart web`
3. Check stripe-cli logs: `docker-compose logs stripe-cli`
4. Verify webhook endpoint is accessible from stripe-cli container

### Database issues

```bash
# Reset database
docker-compose down -v
docker-compose up -d db
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py seed_billing --with-stripe
```

### Stripe connection fails

1. Verify keys in `.env` file
2. Restart web service: `docker-compose restart web`
3. Test connection: `docker-compose exec web python test_stripe.py`

## Production Considerations

For production deployment:

1. **Use live Stripe keys** in production `.env`
2. **Set up real webhook endpoint** at https://dashboard.stripe.com/webhooks
   - Webhook URL: `https://your-domain.com/api/v1/billing/webhooks/stripe/`
   - Select events to listen to (see Phase 3 docs)
3. **Disable DEBUG mode** in production
4. **Use proper secrets management** (not plain .env files)
5. **Enable HTTPS** for all webhook traffic
6. **Scale services** as needed with Docker Swarm or Kubernetes

## Next Steps

Now that Docker is configured:

1. Continue with Phase 6: Permission checking and tier enforcement
2. Test the full subscription flow
3. Implement frontend components (Phases 7-10)

## Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
