# Generated migration for DeletedRedditThread model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('integrations', '0004_rename_bot_to_agent'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DeletedRedditThread',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'reddit_post_id',
                    models.CharField(
                        db_index=True,
                        help_text='Reddit post ID (e.g., "t3_1pa4e7t") that was deleted',
                        max_length=50,
                        unique=True,
                    ),
                ),
                (
                    'subreddit',
                    models.CharField(
                        db_index=True,
                        help_text='Subreddit name for reference',
                        max_length=100,
                    ),
                ),
                (
                    'deleted_at',
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text='When the thread was deleted',
                    ),
                ),
                (
                    'deletion_reason',
                    models.TextField(
                        blank=True,
                        default='',
                        help_text='Optional reason for deletion',
                    ),
                ),
                (
                    'agent',
                    models.ForeignKey(
                        help_text='Agent that originally created this thread',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='deleted_threads',
                        to='integrations.redditcommunityagent',
                    ),
                ),
                (
                    'deleted_by',
                    models.ForeignKey(
                        blank=True,
                        help_text='Admin user who deleted the thread',
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'db_table': 'deleted_reddit_threads',
                'verbose_name': 'Deleted Reddit Thread',
                'verbose_name_plural': 'Deleted Reddit Threads',
                'ordering': ['-deleted_at'],
            },
        ),
        migrations.AddIndex(
            model_name='deletedredditthread',
            index=models.Index(fields=['reddit_post_id'], name='deleted_red_reddit__7f3e2e_idx'),
        ),
        migrations.AddIndex(
            model_name='deletedredditthread',
            index=models.Index(fields=['agent', '-deleted_at'], name='deleted_red_agent_i_5a8c9f_idx'),
        ),
    ]
