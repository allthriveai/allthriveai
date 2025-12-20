# Generated manually for data migration

from django.db import migrations


def populate_difficulty_taxonomy(apps, schema_editor):
    """Populate difficulty_taxonomy from existing difficulty_level values.

    This migration:
    1. Creates difficulty taxonomy entries if they don't exist
    2. Maps existing difficulty_level values to the new difficulty_taxonomy FK
    """
    Taxonomy = apps.get_model('core', 'Taxonomy')
    Project = apps.get_model('core', 'Project')

    # Define difficulty levels with their display names
    difficulty_levels = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    # Create or get difficulty taxonomy entries
    difficulty_map = {}
    for slug, name in difficulty_levels:
        taxonomy, created = Taxonomy.objects.get_or_create(
            taxonomy_type='difficulty',
            slug=slug,
            defaults={
                'name': name,
                'is_active': True,
            },
        )
        difficulty_map[slug] = taxonomy
        if created:
            print(f'  Created difficulty taxonomy: {name}')

    # Update projects with existing difficulty_level
    updated_count = 0
    for level_slug, taxonomy in difficulty_map.items():
        count = Project.objects.filter(
            difficulty_level=level_slug,
            difficulty_taxonomy__isnull=True,
        ).update(difficulty_taxonomy=taxonomy)
        updated_count += count
        if count:
            print(f'  Updated {count} projects with difficulty_level={level_slug}')

    print(f'  Total projects updated: {updated_count}')


def reverse_populate(apps, schema_editor):
    """Reverse migration - clear difficulty_taxonomy values."""
    Project = apps.get_model('core', 'Project')
    Project.objects.filter(difficulty_taxonomy__isnull=False).update(difficulty_taxonomy=None)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0059_add_project_taxonomy_fields'),
    ]

    operations = [
        migrations.RunPython(populate_difficulty_taxonomy, reverse_populate),
    ]
