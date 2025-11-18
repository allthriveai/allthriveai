"""
Management command to setup Google OAuth social application.
Run with: python manage.py setup_google_oauth
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp


class Command(BaseCommand):
    help = 'Setup Google OAuth social application'

    def handle(self, *args, **options):
        # Get the current site
        site = Site.objects.get(id=1)
        self.stdout.write(f'Using site: {site.domain}')

        # Get credentials from environment
        google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        google_client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')

        if not google_client_id or not google_client_secret:
            self.stdout.write(
                self.style.ERROR(
                    'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment'
                )
            )
            return

        # Create or update Google social app
        google_app, created = SocialApp.objects.get_or_create(
            provider='google',
            defaults={
                'name': 'Google OAuth',
                'client_id': google_client_id,
                'secret': google_client_secret,
            }
        )

        if not created:
            # Update existing app
            google_app.client_id = google_client_id
            google_app.secret = google_client_secret
            google_app.save()
            self.stdout.write(self.style.SUCCESS('✅ Updated existing Google OAuth app'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ Created new Google OAuth app'))

        # Add site to the social app if not already added
        if site not in google_app.sites.all():
            google_app.sites.add(site)
            self.stdout.write(self.style.SUCCESS(f'✅ Added site {site.domain} to Google OAuth app'))
        else:
            self.stdout.write(f'✅ Site {site.domain} already linked to Google OAuth app')

        self.stdout.write(self.style.SUCCESS('\n🎉 Google OAuth setup complete!'))
        self.stdout.write(f'\nCallback URL: http://{site.domain}/accounts/google/login/callback/')
        self.stdout.write('\nMake sure this URL is added in your Google Cloud Console:')
        self.stdout.write('https://console.cloud.google.com/\n')
