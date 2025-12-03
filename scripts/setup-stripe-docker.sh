#!/bin/bash
# Stripe Docker Setup Script
# This script helps you set up Stripe integration in Docker

set -e  # Exit on error

echo "🔧 AllThrive Stripe Docker Setup"
echo "================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  Please update .env with your Stripe keys:"
    echo "   - STRIPE_PUBLIC_KEY=pk_test_..."
    echo "   - STRIPE_SECRET_KEY=sk_test_..."
    echo ""
    echo "Get your keys from: https://dashboard.stripe.com/test/apikeys"
    echo ""
    read -p "Press Enter when you've updated the .env file..."
fi

# Check if Stripe keys are set
if ! grep -q "^STRIPE_SECRET_KEY=sk_test_" .env; then
    echo "⚠️  STRIPE_SECRET_KEY not set in .env file"
    echo "   Please add your secret key from: https://dashboard.stripe.com/test/apikeys"
    exit 1
fi

echo "✅ Stripe keys found in .env"
echo ""

# Build and start services
echo "📦 Building and starting Docker services..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Run migrations
echo "🔄 Running database migrations..."
docker-compose exec -T web python manage.py migrate

# Seed billing data
echo "🌱 Seeding billing data and syncing to Stripe..."
docker-compose exec -T web python manage.py seed_billing --with-stripe

# Test Stripe connection
echo "🧪 Testing Stripe connection..."
docker-compose exec -T web python test_stripe.py

echo ""
echo "✅ Stripe setup complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Set up webhook forwarding:"
echo "   docker-compose --profile stripe-webhooks up stripe-cli"
echo ""
echo "2. Copy the webhook secret (whsec_...) from the logs and add to .env:"
echo "   docker-compose logs stripe-cli | grep 'whsec_'"
echo ""
echo "3. Restart web service after adding webhook secret:"
echo "   docker-compose restart web"
echo ""
echo "4. Test the billing API:"
echo "   curl http://localhost:8000/api/v1/billing/tiers/"
echo ""
echo "5. Access Django admin:"
echo "   http://localhost:8000/admin"
echo ""
echo "   Create a superuser with:"
echo "   docker-compose exec web python manage.py createsuperuser"
echo ""
echo "📚 Documentation:"
echo "   - docs/STRIPE_DOCKER_SETUP.md"
echo "   - docs/STRIPE_SETUP.md"
echo ""
