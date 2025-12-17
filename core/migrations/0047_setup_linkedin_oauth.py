"""
Data migration to setup LinkedIn OAuth SocialApp.

This ensures the LinkedIn OAuth configuration exists in the database,
reading credentials from environment variables.
"""

import os

from django.db import migrations


def setup_linkedin_oauth(apps, schema_editor):
    """Create or update LinkedIn OAuth SocialApp."""
    SocialApp = apps.get_model('socialaccount', 'SocialApp')
    Site = apps.get_model('sites', 'Site')

    # Get credentials from environment
    client_id = os.environ.get('LINKEDIN_OAUTH_CLIENT_ID', '')
    client_secret = os.environ.get('LINKEDIN_OAUTH_CLIENT_SECRET', '')

    if not client_id or not client_secret:
        print('LINKEDIN_OAUTH_CLIENT_ID or LINKEDIN_OAUTH_CLIENT_SECRET not set, skipping LinkedIn OAuth setup')
        return

    # Get or create the LinkedIn app
    linkedin_app, created = SocialApp.objects.get_or_create(
        provider='linkedin_oauth2',
        defaults={
            'name': 'LinkedIn OAuth',
            'client_id': client_id,
            'secret': client_secret,
        },
    )

    if not created:
        # Update existing app with current credentials
        linkedin_app.client_id = client_id
        linkedin_app.secret = client_secret
        linkedin_app.save()
        print('Updated existing LinkedIn OAuth app')
    else:
        print('Created new LinkedIn OAuth app')

    # Link to site (SITE_ID=1)
    try:
        site = Site.objects.get(id=1)
        if site not in linkedin_app.sites.all():
            linkedin_app.sites.add(site)
            print(f'Added site {site.domain} to LinkedIn OAuth app')
    except Site.DoesNotExist:
        print('Warning: Site with id=1 does not exist')


def reverse_linkedin_oauth(apps, schema_editor):
    """Remove LinkedIn OAuth SocialApp."""
    SocialApp = apps.get_model('socialaccount', 'SocialApp')
    SocialApp.objects.filter(provider='linkedin_oauth2').delete()
    print('Removed LinkedIn OAuth app')


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0046_alter_taxonomy_taxonomy_type'),
        ('socialaccount', '0001_initial'),
        ('sites', '0002_alter_domain_unique'),
    ]

    operations = [
        migrations.RunPython(setup_linkedin_oauth, reverse_linkedin_oauth),
    ]
