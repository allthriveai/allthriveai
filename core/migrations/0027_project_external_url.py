# Generated migration for adding external_url field to Project model

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0026_add_project_visibility_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='external_url',
            field=models.URLField(
                blank=True,
                default='',
                max_length=500,
                help_text='External URL for this project (e.g., live demo, GitHub repo)',
            ),
        ),
    ]
