"""
Script to configure Django site and OAuth providers
Run this with: python manage.py shell < scripts/setup_oauth.py
"""

import os

from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site

# Get or update site
site = Site.objects.get(id=1)
site.domain = 'localhost:8000'
site.name = 'AllThrive AI Local'
site.save()

print(f'✅ Site configured: {site.domain}')
print(f'✅ Site name: {site.name}')

# Create or update Google OAuth app
google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
google_client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')

if google_client_id and google_client_secret:
    google_app, created = SocialApp.objects.update_or_create(
        provider='google',
        defaults={
            'name': 'Google OAuth',
            'client_id': google_client_id,
            'secret': google_client_secret,
        },
    )
    google_app.sites.add(site)
    print(f"✅ Google OAuth app {'created' if created else 'updated'}: {google_app.client_id}")
else:
    print('⚠️  Google OAuth credentials not found in environment')

# Create or update GitHub OAuth app
github_client_id = os.environ.get('GITHUB_CLIENT_ID')
github_client_secret = os.environ.get('GITHUB_CLIENT_SECRET')

if github_client_id and github_client_secret:
    github_app, created = SocialApp.objects.update_or_create(
        provider='github',
        defaults={
            'name': 'GitHub OAuth',
            'client_id': github_client_id,
            'secret': github_client_secret,
        },
    )
    github_app.sites.add(site)
    print(f"✅ GitHub OAuth app {'created' if created else 'updated'}: {github_app.client_id}")
else:
    print('⚠️  GitHub OAuth credentials not found in environment')

print('\nOAuth callback URLs:')
print(f'   Google: http://{site.domain}/accounts/google/login/callback/')
print(f'   GitHub: http://{site.domain}/accounts/github/login/callback/')
print('\nMake sure these EXACT URLs are in your OAuth provider consoles!')
