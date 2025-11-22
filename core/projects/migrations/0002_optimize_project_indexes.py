# Generated migration for optimizing project indexes

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('projects', '0001_initial'),  # Adjust based on your last migration
    ]

    operations = [
        # Add composite index for user showcase queries (most common query pattern)
        migrations.AddIndex(
            model_name='project',
            index=models.Index(
                fields=['user', 'is_showcase', '-created_at'],
                name='proj_user_showcase_created_idx',
            ),
        ),
        # Add composite index for published public projects (explore page)
        migrations.AddIndex(
            model_name='project',
            index=models.Index(
                fields=['is_published', 'is_archived', '-published_at'],
                name='proj_published_archived_date_idx',
            ),
        ),
        # Add composite index for highlighted projects query
        migrations.AddIndex(
            model_name='project',
            index=models.Index(
                fields=['user', 'is_highlighted'],
                name='proj_user_highlighted_idx',
            ),
        ),
    ]
