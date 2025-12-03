# Generated migration for deletion_type field

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('integrations', '0005_add_deleted_reddit_threads'),
    ]

    operations = [
        migrations.AddField(
            model_name='deletedredditthread',
            name='deletion_type',
            field=models.CharField(
                choices=[
                    ('admin_deleted', 'Admin Deleted'),
                    ('moderation_failed', 'Moderation Failed'),
                ],
                db_index=True,
                default='admin_deleted',
                help_text='Type of deletion: admin or moderation failure',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='deletedredditthread',
            name='reddit_post_id',
            field=models.CharField(
                db_index=True,
                help_text='Reddit post ID (e.g., "t3_1pa4e7t") that was deleted or rejected',
                max_length=50,
                unique=True,
            ),
        ),
        migrations.AlterModelOptions(
            name='deletedredditthread',
            options={
                'verbose_name': 'Deleted Reddit Thread',
                'verbose_name_plural': 'Deleted Reddit Threads',
                'ordering': ['-deleted_at'],
            },
        ),
    ]
