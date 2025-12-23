"""
Data migration: Migrate text topics to taxonomy FK relationship.

This migration populates the new topic_taxonomy FK field on SideQuest model.
"""

from django.db import IntegrityError, migrations, transaction


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


def migrate_sidequest_topics(apps, schema_editor):
    """Migrate SideQuest.topic CharField to topic_taxonomy FK."""
    SideQuest = apps.get_model('thrive_circle', 'SideQuest')
    Taxonomy = apps.get_model('core', 'Taxonomy')

    topic_cache = {}  # slug -> Taxonomy instance

    for quest in SideQuest.objects.exclude(topic='').iterator(chunk_size=500):
        if not quest.topic:
            continue

        slug = quest.topic  # Already a slug from TOPIC_CHOICES

        if slug not in topic_cache:
            name = slug.replace('-', ' ').title()
            taxonomy = get_or_create_taxonomy(Taxonomy, slug, name, 'Auto-migrated from side quest.')
            if taxonomy:
                topic_cache[slug] = taxonomy

        if slug in topic_cache:
            quest.topic_taxonomy = topic_cache[slug]
            quest.save(update_fields=['topic_taxonomy'])


def reverse_migration(apps, schema_editor):
    """Reverse: Clear FK relationship."""
    SideQuest = apps.get_model('thrive_circle', 'SideQuest')
    SideQuest.objects.update(topic_taxonomy=None)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0053_migrate_topics_to_taxonomy'),
        ('thrive_circle', '0010_add_topic_taxonomy_to_sidequest'),
    ]

    operations = [
        migrations.RunPython(migrate_sidequest_topics, reverse_migration),
    ]
