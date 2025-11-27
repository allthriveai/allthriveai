# Generated manually on 2025-11-27 21:20

from django.db import migrations


def migrate_tier_names(apps, schema_editor):
    """Convert old tier names to new tier names."""
    User = apps.get_model('users', 'User')

    # Mapping from old tier names to new tier names
    tier_mapping = {
        'ember': 'seedling',
        'spark': 'sprout',
        'blaze': 'blossom',
        'beacon': 'bloom',
        'phoenix': 'evergreen',
    }

    for old_tier, new_tier in tier_mapping.items():
        User.objects.filter(tier=old_tier).update(tier=new_tier)


def reverse_migrate_tier_names(apps, schema_editor):
    """Reverse migration: Convert new tier names back to old tier names."""
    User = apps.get_model('users', 'User')

    # Reverse mapping
    tier_mapping = {
        'seedling': 'ember',
        'sprout': 'spark',
        'blossom': 'blaze',
        'bloom': 'beacon',
        'evergreen': 'phoenix',
    }

    for new_tier, old_tier in tier_mapping.items():
        User.objects.filter(tier=new_tier).update(tier=old_tier)


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0002_user_allow_llm_training_user_gamification_is_public_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_tier_names, reverse_migrate_tier_names),
    ]
