"""
Data migration: Migrate text topics to taxonomy relationships.

This migration populates the new topics_taxonomy M2M fields on Project and Quiz
by looking up or creating Taxonomy entries for each text topic.
"""

from django.db import migrations
from django.utils.text import slugify


def migrate_project_topics(apps, schema_editor):
    """Migrate Project.topics ArrayField to topics_taxonomy M2M."""
    Project = apps.get_model('core', 'Project')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    # Process in chunks to avoid memory issues
    for project in Project.objects.filter(topics__len__gt=0).iterator(chunk_size=500):
        taxonomies_to_add = []

        for raw_topic in project.topics:
            if not raw_topic:
                continue

            slug = slugify(raw_topic)[:120]
            if not slug:
                continue

            if slug not in topic_cache:
                taxonomy, created = Taxonomy.objects.get_or_create(
                    slug=slug,
                    defaults={
                        'taxonomy_type': 'topic',
                        'name': raw_topic.strip()[:100],
                        'description': 'Auto-migrated from project topics.',
                        'is_active': True,
                    },
                )
                topic_cache[slug] = taxonomy

            taxonomies_to_add.append(topic_cache[slug])

        if taxonomies_to_add:
            project.topics_taxonomy.add(*taxonomies_to_add)


def migrate_quiz_topics(apps, schema_editor):
    """Migrate Quiz.topic CharField and Quiz.topics ArrayField to topics_taxonomy M2M."""
    Quiz = apps.get_model('core', 'Quiz')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    for quiz in Quiz.objects.iterator(chunk_size=500):
        taxonomies_to_add = []
        topics_to_process = []

        # Add legacy topic CharField if present
        if quiz.topic:
            topics_to_process.append(quiz.topic)

        # Add topics from ArrayField
        if quiz.topics:
            topics_to_process.extend(quiz.topics)

        for raw_topic in topics_to_process:
            if not raw_topic:
                continue

            slug = slugify(raw_topic)[:120]
            if not slug:
                continue

            if slug not in topic_cache:
                taxonomy, created = Taxonomy.objects.get_or_create(
                    slug=slug,
                    defaults={
                        'taxonomy_type': 'topic',
                        'name': raw_topic.strip()[:100],
                        'description': 'Auto-migrated from quiz topics.',
                        'is_active': True,
                    },
                )
                topic_cache[slug] = taxonomy

            if topic_cache[slug] not in taxonomies_to_add:
                taxonomies_to_add.append(topic_cache[slug])

        if taxonomies_to_add:
            quiz.topics_taxonomy.add(*taxonomies_to_add)


def reverse_migration(apps, schema_editor):
    """Reverse: Clear M2M relationships (data preserved in text fields)."""
    Project = apps.get_model('core', 'Project')
    Quiz = apps.get_model('core', 'Quiz')

    # Clear M2M relationships
    Project.topics_taxonomy.through.objects.all().delete()
    Quiz.topics_taxonomy.through.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0052_add_topics_taxonomy_to_project'),
    ]

    operations = [
        migrations.RunPython(migrate_project_topics, reverse_migration),
        migrations.RunPython(migrate_quiz_topics, migrations.RunPython.noop),
    ]
