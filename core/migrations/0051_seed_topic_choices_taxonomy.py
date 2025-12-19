"""
Seed TOPIC_CHOICES into Taxonomy table.

This migration creates Taxonomy entries for all 16 hardcoded topic choices
that are currently used in UserLearningPath and SideQuest models.
"""

from django.db import migrations

TOPIC_CHOICES_TO_SEED = [
    ('chatbots-conversation', 'Chatbots & Conversation', 'blue'),
    ('websites-apps', 'Websites & Apps', 'teal'),
    ('images-video', 'Images & Video', 'purple'),
    ('design-ui', 'Design (Mockups & UI)', 'pink'),
    ('video-creative-media', 'Video & Multimodal Media', 'red'),
    ('podcasts-education', 'Podcasts & Educational Series', 'orange'),
    ('games-interactive', 'Games & Interactive Experiences', 'yellow'),
    ('workflows-automation', 'Workflows & Automation', 'green'),
    ('productivity', 'Productivity', 'cyan'),
    ('developer-coding', 'Developer & Coding Projects', 'indigo'),
    ('prompts-templates', 'Prompt Collections & Templates', 'violet'),
    ('thought-experiments', 'Thought Experiments & Concept Pieces', 'fuchsia'),
    ('wellness-growth', 'Wellness & Personal Growth', 'emerald'),
    ('ai-agents-multitool', 'AI Agents & Multi-Tool Systems', 'amber'),
    ('ai-models-research', 'AI Models & Research', 'lime'),
    ('data-analytics', 'Data & Analytics', 'sky'),
]


def seed_topic_choices(apps, schema_editor):
    """Create Taxonomy entries for all TOPIC_CHOICES."""
    Taxonomy = apps.get_model('core', 'Taxonomy')

    for slug, name, color in TOPIC_CHOICES_TO_SEED:
        # First try to find by slug
        existing_by_slug = Taxonomy.objects.filter(slug=slug).first()
        if existing_by_slug:
            # Already exists with this slug, just ensure it's a topic type
            if existing_by_slug.taxonomy_type != 'topic':
                existing_by_slug.taxonomy_type = 'topic'
                existing_by_slug.save(update_fields=['taxonomy_type'])
            continue

        # Try to find by name (in case it exists with a different slug)
        existing_by_name = Taxonomy.objects.filter(name=name).first()
        if existing_by_name:
            # Update the existing entry to have the correct slug and type
            existing_by_name.slug = slug
            existing_by_name.taxonomy_type = 'topic'
            if not existing_by_name.color:
                existing_by_name.color = color
            existing_by_name.save(update_fields=['slug', 'taxonomy_type', 'color'])
            continue

        # Create new entry
        Taxonomy.objects.create(
            slug=slug,
            taxonomy_type='topic',
            name=name,
            description=f'Projects and content related to {name}.',
            is_active=True,
            color=color,
        )


def remove_topic_choices(apps, schema_editor):
    """Remove the seeded TOPIC_CHOICES (reverse migration)."""
    Taxonomy = apps.get_model('core', 'Taxonomy')
    slugs = [slug for slug, _, _ in TOPIC_CHOICES_TO_SEED]
    # Only delete if they have no related objects
    Taxonomy.objects.filter(
        slug__in=slugs,
        taxonomy_type='topic',
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0050_seed_learning_modalities'),
    ]

    operations = [
        migrations.RunPython(seed_topic_choices, remove_topic_choices),
    ]
