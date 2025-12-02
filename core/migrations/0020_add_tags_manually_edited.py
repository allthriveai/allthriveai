# Generated migration for tags_manually_edited field

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0019_rename_is_showcase_remove_is_published'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='tags_manually_edited',
            field=models.BooleanField(
                default=False,
                help_text='If True, tools/categories/topics were manually edited by admin and should not be auto-updated during resync',
            ),
        ),
    ]
