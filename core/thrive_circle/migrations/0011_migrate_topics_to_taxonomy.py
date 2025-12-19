"""
Data migration: Migrate text topics to taxonomy FK relationship.

This migration populates the new topic_taxonomy FK field on SideQuest model.
"""

from django.db import migrations


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
            # Look up the seeded topic from Taxonomy
            taxonomy = Taxonomy.objects.filter(
                slug=slug,
                taxonomy_type='topic',
            ).first()

            if not taxonomy:
                # Create if missing (shouldn't happen with seeded data)
                taxonomy = Taxonomy.objects.create(
                    slug=slug,
                    taxonomy_type='topic',
                    name=slug.replace('-', ' ').title(),
                    description='Auto-migrated from side quest.',
                    is_active=True,
                )

            topic_cache[slug] = taxonomy

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
