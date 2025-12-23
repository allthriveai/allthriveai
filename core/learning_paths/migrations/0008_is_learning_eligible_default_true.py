# Generated migration for is_learning_eligible default change
# This migration changes the default from False to True and updates existing records

from django.db import migrations, models


def set_all_projects_learning_eligible(apps, schema_editor):
    """Set all existing ProjectLearningMetadata records to is_learning_eligible=True."""
    ProjectLearningMetadata = apps.get_model('learning_paths', 'ProjectLearningMetadata')
    ProjectLearningMetadata.objects.update(is_learning_eligible=True)


def reverse_learning_eligible(apps, schema_editor):
    """Reverse operation - set back to False."""
    ProjectLearningMetadata = apps.get_model('learning_paths', 'ProjectLearningMetadata')
    ProjectLearningMetadata.objects.update(is_learning_eligible=False)


class Migration(migrations.Migration):
    dependencies = [
        ('learning_paths', '0007_migrate_topics_to_taxonomy'),
    ]

    operations = [
        migrations.AlterField(
            model_name='projectlearningmetadata',
            name='is_learning_eligible',
            field=models.BooleanField(
                db_index=True,
                default=True,
                help_text='Whether this project appears in learning content',
            ),
        ),
        # Data migration: Set all existing projects to learning-eligible
        migrations.RunPython(
            set_all_projects_learning_eligible,
            reverse_learning_eligible,
        ),
    ]
