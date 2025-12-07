import os
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Configure Django Site for OAuth'

    def handle(self, *args, **options):
        # Get backend URL from settings
        backend_url = settings.BACKEND_URL
        parsed = urlparse(backend_url)
        domain = parsed.netloc or 'localhost:8000'
        protocol = parsed.scheme or 'http'

        # Determine environment
        is_production = os.environ.get('DEBUG', 'True').lower() in ('false', '0', 'no')
        site_name = 'AllThrive AI Production' if is_production else 'AllThrive AI Local'

        # Configure site
        site = Site.objects.get(id=1)
        site.domain = domain
        site.name = site_name
        site.save()

        self.stdout.write(self.style.SUCCESS(f'✅ Site configured: {site.domain}'))
        self.stdout.write(self.style.SUCCESS(f'✅ Site name: {site.name}'))
        self.stdout.write('')
        self.stdout.write('OAuth callback URLs will be:')
        self.stdout.write(f'   {protocol}://{site.domain}/accounts/google/login/callback/')
        self.stdout.write(f'   {protocol}://{site.domain}/accounts/github/login/callback/')
        self.stdout.write(f'   {protocol}://{site.domain}/accounts/linkedin_oauth2/login/callback/')
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('⚠️  Make sure these EXACT URLs are in your OAuth provider consoles!'))
        self.stdout.write(self.style.WARNING('⚠️  Under "Authorized redirect URIs" or "Callback URLs"'))
