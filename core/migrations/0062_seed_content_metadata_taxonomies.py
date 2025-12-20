# Generated manually for data migration

from django.db import migrations


def seed_content_metadata_taxonomies(apps, schema_editor):
    """Seed content_type, time_investment, and pricing taxonomies.

    These taxonomies are used by ContentMetadataMixin to classify content.
    """
    Taxonomy = apps.get_model('core', 'Taxonomy')

    # Content Type taxonomies - what format is the content?
    # Using prefixed slugs to avoid collisions with other taxonomy types
    content_types = [
        ('content-article', 'Article', 'Written content like blog posts, tutorials, guides'),
        ('content-video', 'Video', 'Video content like tutorials, walkthroughs, talks'),
        ('content-course', 'Course', 'Structured multi-part learning content'),
        ('content-code-repo', 'Code Repository', 'GitHub repos, code examples, templates'),
        ('content-tool', 'Tool', 'Interactive tools, apps, utilities'),
        ('content-podcast', 'Podcast', 'Audio content, interviews, discussions'),
        ('content-newsletter', 'Newsletter', 'Email-based content, digests'),
        ('content-dataset', 'Dataset', 'Data collections, training data, benchmarks'),
        ('content-paper', 'Research Paper', 'Academic papers, whitepapers, research'),
        ('content-quiz', 'Quiz', 'Interactive quizzes and assessments'),
    ]

    for slug, name, description in content_types:
        Taxonomy.objects.get_or_create(
            taxonomy_type='content_type',
            slug=slug,
            defaults={
                'name': name,
                'description': description,
                'is_active': True,
            },
        )
    print(f'  Created/verified {len(content_types)} content_type taxonomies')

    # Time Investment taxonomies - how long to consume?
    # Using prefixed slugs to avoid collisions
    time_investments = [
        ('time-quick', 'Quick', '< 5 minutes - quick reads, tips'),
        ('time-short', 'Short', '5-15 minutes - articles, short videos'),
        ('time-medium', 'Medium', '15-60 minutes - tutorials, deep dives'),
        ('time-deep-dive', 'Deep Dive', '1+ hours - courses, comprehensive guides'),
    ]

    for slug, name, description in time_investments:
        Taxonomy.objects.get_or_create(
            taxonomy_type='time_investment',
            slug=slug,
            defaults={
                'name': name,
                'description': description,
                'is_active': True,
            },
        )
    print(f'  Created/verified {len(time_investments)} time_investment taxonomies')

    # Pricing taxonomies - what's the cost?
    # Using prefixed slugs to avoid collisions
    pricing_tiers = [
        ('pricing-free', 'Free', 'Completely free content'),
        ('pricing-freemium', 'Freemium', 'Free with optional paid features'),
        ('pricing-paid', 'Paid', 'Requires payment to access'),
    ]

    for slug, name, description in pricing_tiers:
        Taxonomy.objects.get_or_create(
            taxonomy_type='pricing',
            slug=slug,
            defaults={
                'name': name,
                'description': description,
                'is_active': True,
            },
        )
    print(f'  Created/verified {len(pricing_tiers)} pricing taxonomies')


def reverse_seed(apps, schema_editor):
    """Remove seeded taxonomies."""
    Taxonomy = apps.get_model('core', 'Taxonomy')
    Taxonomy.objects.filter(taxonomy_type__in=['content_type', 'time_investment', 'pricing']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0061_add_quiz_taxonomy_fields'),
    ]

    operations = [
        migrations.RunPython(seed_content_metadata_taxonomies, reverse_seed),
    ]
