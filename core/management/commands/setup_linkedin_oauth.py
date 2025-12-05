"""
Management command to setup LinkedIn OAuth social application.
Run with: python manage.py setup_linkedin_oauth
"""

import os

from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Setup LinkedIn OAuth social application'

    def handle(self, *args, **options):
        # Get the current site
        site = Site.objects.get(id=1)
        self.stdout.write(f'Using site: {site.domain}')

        # Get credentials from environment
        linkedin_client_id = os.environ.get('LINKEDIN_OAUTH_CLIENT_ID')
        linkedin_client_secret = os.environ.get('LINKEDIN_OAUTH_CLIENT_SECRET')

        if not linkedin_client_id or not linkedin_client_secret:
            self.stdout.write(
                self.style.ERROR('LINKEDIN_OAUTH_CLIENT_ID and LINKEDIN_OAUTH_CLIENT_SECRET must be set in environment')
            )
            return

        # Create or update LinkedIn social app
        linkedin_app, created = SocialApp.objects.get_or_create(
            provider='linkedin_oauth2',
            defaults={
                'name': 'LinkedIn OAuth',
                'client_id': linkedin_client_id,
                'secret': linkedin_client_secret,
            },
        )

        if not created:
            # Update existing app
            linkedin_app.client_id = linkedin_client_id
            linkedin_app.secret = linkedin_client_secret
            linkedin_app.save()
            self.stdout.write(self.style.SUCCESS('✅ Updated existing LinkedIn OAuth app'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ Created new LinkedIn OAuth app'))

        # Add site to the social app if not already added
        if site not in linkedin_app.sites.all():
            linkedin_app.sites.add(site)
            self.stdout.write(self.style.SUCCESS(f'✅ Added site {site.domain} to LinkedIn OAuth app'))
        else:
            self.stdout.write(f'✅ Site {site.domain} already linked to LinkedIn OAuth app')

        self.stdout.write(self.style.SUCCESS('\n🎉 LinkedIn OAuth setup complete!'))
        self.stdout.write(f'\nCallback URL: http://{site.domain}/accounts/linkedin_oauth2/login/callback/')
        self.stdout.write('\nMake sure this URL is added in your LinkedIn Developer App settings:')
        self.stdout.write('https://www.linkedin.com/developers/apps\n')
