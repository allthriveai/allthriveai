"""
Script to configure Django site for OAuth
Run this with: python manage.py shell < setup_oauth.py
"""

from django.contrib.sites.models import Site

# Get or update site
site = Site.objects.get(id=1)
site.domain = "localhost:8000"
site.name = "AllThrive AI Local"
site.save()

print(f"✅ Site configured: {site.domain}")
print(f"✅ Site name: {site.name}")
print("\nOAuth callback URL will be:")
print(f"   http://{site.domain}/accounts/google/login/callback/")
print("\nMake sure this EXACT URL is in your Google Cloud Console!")
