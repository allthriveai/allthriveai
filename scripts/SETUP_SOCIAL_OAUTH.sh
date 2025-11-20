#!/bin/bash
# Quick setup script for Social OAuth feature

echo "🔧 Setting up Social OAuth Connections..."
echo ""

# Check if running in Docker
if [ -f "docker-compose.yml" ]; then
    echo "📦 Docker environment detected"
    echo "Run these commands:"
    echo ""
    echo "  make shell-backend"
    echo "  python manage.py makemigrations"
    echo "  python manage.py migrate"
    echo "  exit"
    echo ""
else
    echo "🐍 Running migrations directly..."
    python manage.py makemigrations
    python manage.py migrate
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Configure OAuth credentials in .env (see .env.example)"
echo "  2. Read docs/SOCIAL_OAUTH_SETUP.md for detailed setup"
echo "  3. Visit http://localhost:3000/account/settings/social to test"
echo ""
