"""Data migration to fix agent user tiers from 'seedling' to 'curation'."""

from django.db import migrations


def fix_agent_tiers(apps, schema_editor):
    """Update all agent users to have 'curation' tier."""
    User = apps.get_model('users', 'User')
    # Update all users with role='agent' to have tier='curation'
    updated = User.objects.filter(role='agent').update(tier='curation')
    if updated:
        print(f'  Updated {updated} agent users to curation tier')


def reverse_fix_agent_tiers(apps, schema_editor):
    """Reverse is a no-op since we don't know the original tiers."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0016_add_guest_user_support'),
    ]

    operations = [
        migrations.RunPython(fix_agent_tiers, reverse_fix_agent_tiers),
    ]
