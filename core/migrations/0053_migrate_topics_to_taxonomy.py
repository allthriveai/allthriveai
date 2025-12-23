"""
Data migration: Migrate text topics to taxonomy relationships.

This migration populates the new topics_taxonomy M2M fields on Project and Quiz
by looking up or creating Taxonomy entries for each text topic.
"""

from django.db import IntegrityError, migrations, transaction
from django.utils.text import slugify


def get_or_create_taxonomy(Taxonomy, slug, name, description):
    """
    Get or create a taxonomy, handling unique constraint on name.

    The Taxonomy model has unique constraints on both slug and name (until
    migration 0057 removes the name constraint). This function handles the
    case where a taxonomy with the same name but different slug already exists.
    """
    # First try by slug
    taxonomy = Taxonomy.objects.filter(slug=slug, taxonomy_type='topic').first()
    if taxonomy:
        return taxonomy

    # Try by name (in case it exists with a different slug)
    taxonomy = Taxonomy.objects.filter(name=name, taxonomy_type='topic').first()
    if taxonomy:
        return taxonomy

    # Try to create, but handle race conditions
    try:
        with transaction.atomic():
            taxonomy = Taxonomy.objects.create(
                slug=slug,
                taxonomy_type='topic',
                name=name,
                description=description,
                is_active=True,
            )
            return taxonomy
    except IntegrityError:
        # Another process created it, or name/slug conflict - fetch existing
        taxonomy = Taxonomy.objects.filter(slug=slug, taxonomy_type='topic').first()
        if taxonomy:
            return taxonomy
        taxonomy = Taxonomy.objects.filter(name=name, taxonomy_type='topic').first()
        if taxonomy:
            return taxonomy
        # If still not found, there's a different slug with same name
        # Just return any topic taxonomy as fallback
        return Taxonomy.objects.filter(taxonomy_type='topic').first()


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
                name = raw_topic.strip()[:100]
                taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from project topics.')
                if taxonomy:
                    topic_cache[slug] = taxonomy

            if slug in topic_cache:
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
                name = raw_topic.strip()[:100]
                taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from quiz topics.')
                if taxonomy:
                    topic_cache[slug] = taxonomy

            if slug in topic_cache and topic_cache[slug] not in taxonomies_to_add:
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
