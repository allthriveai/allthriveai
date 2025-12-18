"""
Data migration for LinkedIn OAuth setup.

NOTE: This migration is now a no-op. LinkedIn OAuth is configured via OpenID Connect
in settings.py (SOCIALACCOUNT_PROVIDERS['openid_connect']), which doesn't require
a SocialApp database entry. The configuration is handled entirely in settings.

The old linkedin_oauth2 provider is deprecated in favor of OIDC.
See: https://docs.allauth.org/en/dev/socialaccount/providers/linkedin.html

This migration is kept for migration history consistency.
"""

from django.db import migrations


def setup_linkedin_oauth(apps, schema_editor):
    """No-op: LinkedIn OAuth is now configured via OIDC in settings.py."""
    print('LinkedIn OAuth is configured via OpenID Connect in settings.py - no database setup needed')


def reverse_linkedin_oauth(apps, schema_editor):
    """No-op: Nothing to reverse."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0046_alter_taxonomy_taxonomy_type'),
        ('socialaccount', '0001_initial'),
        ('sites', '0002_alter_domain_unique'),
    ]

    operations = [
        migrations.RunPython(setup_linkedin_oauth, reverse_linkedin_oauth),
    ]
