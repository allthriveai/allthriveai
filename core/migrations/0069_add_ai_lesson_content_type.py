# Generated manually for data migration

from django.db import migrations


def add_ai_lesson_content_type(apps, schema_editor):
    """Add 'ai-lesson' content type taxonomy for AI-generated educational content."""
    Taxonomy = apps.get_model('core', 'Taxonomy')

    Taxonomy.objects.get_or_create(
        taxonomy_type='content_type',
        slug='ai-lesson',
        defaults={
            'name': 'AI Lesson',
            'description': 'AI-generated educational content for learning paths',
            'is_active': True,
        },
    )
    print('  Created/verified ai-lesson taxonomy')


def reverse_add_ai_lesson_content_type(apps, schema_editor):
    """Remove ai-lesson content type taxonomy."""
    Taxonomy = apps.get_model('core', 'Taxonomy')
    Taxonomy.objects.filter(taxonomy_type='content_type', slug='ai-lesson').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0068_add_project_dismissal'),
    ]

    operations = [
        migrations.RunPython(add_ai_lesson_content_type, reverse_add_ai_lesson_content_type),
    ]
