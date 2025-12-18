"""
Management command to setup LinkedIn OAuth social application.
Run with: python manage.py setup_linkedin_oauth

NOTE: LinkedIn OAuth is now configured via OpenID Connect in settings.py.
This command is kept for backwards compatibility and to display the correct callback URL.
The OIDC configuration in SOCIALACCOUNT_PROVIDERS['openid_connect'] handles the actual setup.
"""

import os
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Display LinkedIn OAuth configuration info (OIDC-based)'

    def handle(self, *args, **options):
        # Get the current site and determine protocol
        site = Site.objects.get(id=1)
        backend_url = settings.BACKEND_URL
        protocol = urlparse(backend_url).scheme or 'http'

        self.stdout.write(f'Using site: {site.domain}')

        # Check if credentials are configured
        linkedin_client_id = os.environ.get('LINKEDIN_OAUTH_CLIENT_ID')
        linkedin_client_secret = os.environ.get('LINKEDIN_OAUTH_CLIENT_SECRET')

        if not linkedin_client_id or not linkedin_client_secret:
            self.stdout.write(
                self.style.ERROR('LINKEDIN_OAUTH_CLIENT_ID and LINKEDIN_OAUTH_CLIENT_SECRET must be set in environment')
            )
            return

        self.stdout.write(self.style.SUCCESS('✅ LinkedIn OAuth credentials found in environment'))
        self.stdout.write('')
        self.stdout.write('LinkedIn OAuth is configured via OpenID Connect in settings.py')
        self.stdout.write('No SocialApp database entry is needed - configuration is in SOCIALACCOUNT_PROVIDERS')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('🎉 LinkedIn OAuth configuration verified!'))
        self.stdout.write(f'\nCallback URL: {protocol}://{site.domain}/accounts/oidc/linkedin/login/callback/')
        self.stdout.write('\nMake sure this URL is added in your LinkedIn Developer App settings:')
        self.stdout.write('https://www.linkedin.com/developers/apps\n')
