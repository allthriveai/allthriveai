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

# Configure site
site, created = Site.objects.get_or_create(id=1)
site.domain = 'localhost:8000'
site.name = 'AllThrive AI Local'
site.save()
print(f'✅ Site configured: {site.domain}')

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

echo "🎯 Creating initial data..."
python manage.py create_pip || echo "⚠️  create_pip command not found or failed"
python manage.py seed_categories || echo "⚠️  seed_categories command not found or failed"

echo "🌐 Starting Django server..."
exec python manage.py runserver 0.0.0.0:8000
