from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Configure Django Site for OAuth"

    def handle(self, *args, **options):
        site = Site.objects.get(id=1)
        site.domain = "localhost:8000"
        site.name = "AllThrive AI Local"
        site.save()

        self.stdout.write(self.style.SUCCESS(f"✅ Site configured: {site.domain}"))
        self.stdout.write(self.style.SUCCESS(f"✅ Site name: {site.name}"))
        self.stdout.write("")
        self.stdout.write("OAuth callback URL will be:")
        self.stdout.write(f"   http://{site.domain}/accounts/google/login/callback/")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("⚠️  Make sure this EXACT URL is in your Google Cloud Console!"))
        self.stdout.write(self.style.WARNING('⚠️  Under "Authorized redirect URIs"'))
