#!/bin/sh
set -e

echo "🚀 Starting AllThrive AI backend..."

echo "📦 Running migrations..."
python manage.py migrate --noinput

echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

echo "🔐 Setting up OAuth providers..."
python manage.py shell -c "
import os
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp
from urllib.parse import urlparse

# Configure site domain from BACKEND_URL or SITE_URL
backend_url = os.environ.get('BACKEND_URL', 'http://localhost:8000')
site_url = os.environ.get('SITE_URL', backend_url)

# Parse URL to get domain (strip protocol and path)
parsed = urlparse(backend_url)
domain = parsed.netloc or 'localhost:8000'

# Set site name based on environment
is_production = os.environ.get('DEBUG', 'True').lower() in ('false', '0', 'no')
site_name = 'AllThrive AI Production' if is_production else 'AllThrive AI Local'

# Configure site
site, created = Site.objects.get_or_create(id=1)
site.domain = domain
site.name = site_name
site.save()
print(f'✅ Site configured: {site.domain} ({site.name})')

# Setup Google OAuth
google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
google_client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
if google_client_id and google_client_secret:
    google_app, created = SocialApp.objects.update_or_create(
        provider='google',
        defaults={
            'name': 'Google OAuth',
            'client_id': google_client_id,
            'secret': google_client_secret,
        }
    )
    google_app.sites.add(site)
    print(f'✅ Google OAuth: {\"created\" if created else \"updated\"}')
else:
    print('⚠️  Google OAuth: No credentials in environment')

# Setup GitHub OAuth
github_client_id = os.environ.get('GITHUB_CLIENT_ID')
github_client_secret = os.environ.get('GITHUB_CLIENT_SECRET')
if github_client_id and github_client_secret:
    github_app, created = SocialApp.objects.update_or_create(
        provider='github',
        defaults={
            'name': 'GitHub OAuth',
            'client_id': github_client_id,
            'secret': github_client_secret,
        }
    )
    github_app.sites.add(site)
    print(f'✅ GitHub OAuth: {\"created\" if created else \"updated\"}')
else:
    print('⚠️  GitHub OAuth: No credentials in environment')
"

echo "🎯 Seeding initial data (idempotent - creates only if not exists)..."
python manage.py seed_topics || echo "⚠️  seed_topics failed"
python manage.py seed_taxonomies || echo "⚠️  seed_taxonomies failed"
python manage.py seed_categories || echo "⚠️  seed_categories failed"
python manage.py seed_tools || echo "⚠️  seed_tools failed"
python manage.py seed_quizzes || echo "⚠️  seed_quizzes failed"
python manage.py seed_battle_prompts || echo "⚠️  seed_battle_prompts failed"
python manage.py seed_billing || echo "⚠️  seed_billing failed"
python manage.py seed_credit_packs || echo "⚠️  seed_credit_packs failed"
python manage.py seed_ai_pricing || echo "⚠️  seed_ai_pricing failed"
python manage.py seed_achievements || echo "⚠️  seed_achievements failed"
python manage.py create_pip || echo "⚠️  create_pip failed"

echo "🌐 Starting Django server..."
if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "true" ]; then
    echo "🔧 Development mode: Starting with uvicorn (hot-reload + WebSocket support)..."
    exec uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload --reload-dir /app
else
    echo "🚀 Production mode: Starting with daphne (ASGI)..."
    exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
fi
