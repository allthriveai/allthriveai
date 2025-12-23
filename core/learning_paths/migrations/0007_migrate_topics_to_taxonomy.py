"""
Data migration: Migrate text topics to taxonomy FK relationships.

This migration populates the new topic_taxonomy FK fields on
UserLearningPath, Concept, and ContentGap models.
"""

from django.db import migrations
from django.utils.text import slugify


def migrate_userlearningpath_topics(apps, schema_editor):
    """Migrate UserLearningPath.topic CharField to topic_taxonomy FK."""
    UserLearningPath = apps.get_model('learning_paths', 'UserLearningPath')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    for path in UserLearningPath.objects.exclude(topic='').iterator(chunk_size=500):
        if not path.topic:
            continue

        slug = path.topic  # Already a slug from TOPIC_CHOICES

        if slug not in topic_cache:
            # Look up the seeded topic from Taxonomy
            taxonomy = Taxonomy.objects.filter(
                slug=slug,
                taxonomy_type='topic',
            ).first()

            if not taxonomy:
                # Create if missing (shouldn't happen with seeded data)
                # Use get_or_create to handle case where name already exists
                taxonomy, _ = Taxonomy.objects.get_or_create(
                    slug=slug,
                    defaults={
                        'taxonomy_type': 'topic',
                        'name': slug.replace('-', ' ').title(),
                        'description': 'Auto-migrated from learning path.',
                        'is_active': True,
                    },
                )

            topic_cache[slug] = taxonomy

        path.topic_taxonomy = topic_cache[slug]
        path.save(update_fields=['topic_taxonomy'])


def migrate_concept_topics(apps, schema_editor):
    """Migrate Concept.topic CharField to topic_taxonomy FK."""
    Concept = apps.get_model('learning_paths', 'Concept')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    for concept in Concept.objects.exclude(topic='').iterator(chunk_size=500):
        if not concept.topic:
            continue

        slug = slugify(concept.topic)[:120]
        if not slug:
            continue

        if slug not in topic_cache:
            taxonomy, created = Taxonomy.objects.get_or_create(
                slug=slug,
                defaults={
                    'taxonomy_type': 'topic',
                    'name': concept.topic.strip()[:100],
                    'description': 'Auto-migrated from concept topics.',
                    'is_active': True,
                },
            )
            topic_cache[slug] = taxonomy

        concept.topic_taxonomy = topic_cache[slug]
        concept.save(update_fields=['topic_taxonomy'])


def migrate_contentgap_topics(apps, schema_editor):
    """Migrate ContentGap.topic to topic_taxonomy FK."""
    ContentGap = apps.get_model('learning_paths', 'ContentGap')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    for gap in ContentGap.objects.exclude(topic_normalized='').iterator(chunk_size=500):
        slug = gap.topic_normalized

        if not slug:
            continue

        if slug not in topic_cache:
            taxonomy, created = Taxonomy.objects.get_or_create(
                slug=slug,
                defaults={
                    'taxonomy_type': 'topic',
                    'name': gap.topic.strip()[:100] if gap.topic else slug.replace('-', ' ').title(),
                    'description': 'Auto-migrated from content gap.',
                    'is_active': True,
                },
            )
            topic_cache[slug] = taxonomy

        gap.topic_taxonomy = topic_cache[slug]
        gap.save(update_fields=['topic_taxonomy'])


def reverse_migration(apps, schema_editor):
    """Reverse: Clear FK relationships."""
    UserLearningPath = apps.get_model('learning_paths', 'UserLearningPath')
    Concept = apps.get_model('learning_paths', 'Concept')
    ContentGap = apps.get_model('learning_paths', 'ContentGap')

    UserLearningPath.objects.update(topic_taxonomy=None)
    Concept.objects.update(topic_taxonomy=None)
    ContentGap.objects.update(topic_taxonomy=None)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0053_migrate_topics_to_taxonomy'),
        ('learning_paths', '0006_add_topic_taxonomy_fields'),
    ]

    operations = [
        migrations.RunPython(migrate_userlearningpath_topics, reverse_migration),
        migrations.RunPython(migrate_concept_topics, migrations.RunPython.noop),
        migrations.RunPython(migrate_contentgap_topics, migrations.RunPython.noop),
    ]
