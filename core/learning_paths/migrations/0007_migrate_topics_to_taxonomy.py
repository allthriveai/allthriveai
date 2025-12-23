"""
Data migration: Migrate text topics to taxonomy FK relationships.

This migration populates the new topic_taxonomy FK fields on
UserLearningPath, Concept, and ContentGap models.
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
            name = slug.replace('-', ' ').title()
            taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from learning path.')
            if taxonomy:
                topic_cache[slug] = taxonomy

        if slug in topic_cache:
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
            name = concept.topic.strip()[:100]
            taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from concept topics.')
            if taxonomy:
                topic_cache[slug] = taxonomy

        if slug in topic_cache:
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
            name = gap.topic.strip()[:100] if gap.topic else slug.replace('-', ' ').title()
            taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from content gap.')
            if taxonomy:
                topic_cache[slug] = taxonomy

        if slug in topic_cache:
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
