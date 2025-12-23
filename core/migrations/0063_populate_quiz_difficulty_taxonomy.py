# Generated manually for data migration

from django.db import migrations


def populate_quiz_difficulty_taxonomy(apps, schema_editor):
    """Populate difficulty_taxonomy from existing difficulty values for Quiz.

    Maps existing difficulty CharField values to the new difficulty_taxonomy FK.
    """
    Taxonomy = apps.get_model('core', 'Taxonomy')
    Quiz = apps.get_model('core', 'Quiz')

    # Get difficulty taxonomy entries (created in migration 0060)
    difficulty_map = {}
    for taxonomy in Taxonomy.objects.filter(taxonomy_type='difficulty', is_active=True):
        difficulty_map[taxonomy.slug] = taxonomy

    if not difficulty_map:
        print('  No difficulty taxonomies found - skipping')
        return

    # Update quizzes with existing difficulty values
    updated_count = 0
    for level_slug, taxonomy in difficulty_map.items():
        count = Quiz.objects.filter(
            difficulty=level_slug,
            difficulty_taxonomy__isnull=True,
        ).update(difficulty_taxonomy=taxonomy)
        updated_count += count
        if count:
            print(f'  Updated {count} quizzes with difficulty={level_slug}')

    print(f'  Total quizzes updated: {updated_count}')


def reverse_populate(apps, schema_editor):
    """Reverse migration - clear difficulty_taxonomy values."""
    Quiz = apps.get_model('core', 'Quiz')
    Quiz.objects.filter(difficulty_taxonomy__isnull=False).update(difficulty_taxonomy=None)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0062_seed_content_metadata_taxonomies'),
    ]

    operations = [
        migrations.RunPython(populate_quiz_difficulty_taxonomy, reverse_populate),
    ]
