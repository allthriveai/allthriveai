# Generated migration for featured_image_url field

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0028_projectlike'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='featured_image_url',
            field=models.CharField(
                blank=True, default='', help_text='Featured image for project cards', max_length=500
            ),
        ),
    ]
