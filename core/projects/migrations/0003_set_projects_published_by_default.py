# Generated manually for AllThrive AI

from django.db import migrations, models
from django.utils import timezone


def set_existing_projects_published(apps, schema_editor):
    """Set all existing projects to published and set published_at timestamp."""
    Project = apps.get_model('projects', 'Project')
    now = timezone.now()

    # Update all projects that don't have is_published set
    Project.objects.filter(is_published=False).update(is_published=True, published_at=now)


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0002_optimize_project_indexes'),
    ]

    operations = [
        # Change the default value for is_published to True
        migrations.AlterField(
            model_name='project',
            name='is_published',
            field=models.BooleanField(default=True, help_text='Whether project is publicly visible'),
        ),
        # Update existing projects to be published
        migrations.RunPython(set_existing_projects_published, reverse_code=migrations.RunPython.noop),
    ]
