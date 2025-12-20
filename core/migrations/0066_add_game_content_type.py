# Generated manually for data migration

from django.db import migrations


def add_game_content_type(apps, schema_editor):
    """Add 'game' content type taxonomy."""
    Taxonomy = apps.get_model('core', 'Taxonomy')

    Taxonomy.objects.get_or_create(
        taxonomy_type='content_type',
        slug='content-game',
        defaults={
            'name': 'Game',
            'description': 'Interactive games like Context Snake, Ethics Defender, and other playable experiences',
            'is_active': True,
        },
    )
    print('  Created/verified content-game taxonomy')


def reverse_add_game_content_type(apps, schema_editor):
    """Remove game content type taxonomy."""
    Taxonomy = apps.get_model('core', 'Taxonomy')
    Taxonomy.objects.filter(taxonomy_type='content_type', slug='content-game').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0065_add_weaviate_sync_fields'),
    ]

    operations = [
        migrations.RunPython(add_game_content_type, reverse_add_game_content_type),
    ]
