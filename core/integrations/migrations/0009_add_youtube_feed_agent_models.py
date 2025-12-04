# Generated manually for YouTube Feed Agent models

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0021_alter_project_type'),
        ('integrations', '0008_rssfeedagent_rssfeeditem_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='YouTubeFeedAgent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'name',
                    models.CharField(help_text='Display name (e.g., "AI Daily Brief Agent")', max_length=255),
                ),
                (
                    'channel_url',
                    models.URLField(
                        db_index=True,
                        help_text='YouTube channel URL (e.g., https://www.youtube.com/@AIDailyBrief)',
                        max_length=500,
                        unique=True,
                    ),
                ),
                (
                    'channel_id',
                    models.CharField(
                        db_index=True,
                        help_text='YouTube channel ID (e.g., UCxxxxxx)',
                        max_length=100,
                        unique=True,
                    ),
                ),
                (
                    'channel_name',
                    models.CharField(help_text='Human-readable channel name for attribution', max_length=255),
                ),
                (
                    'attribution_text',
                    models.TextField(
                        default=(
                            'All content is owned by the original creator. '
                            'Visit their YouTube channel to support them directly.'
                        ),
                        help_text='Attribution text displayed on video projects',
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[('active', 'Active'), ('paused', 'Paused'), ('error', 'Error')],
                        db_index=True,
                        default='active',
                        help_text='Agent status (active/paused/error)',
                        max_length=20,
                    ),
                ),
                (
                    'settings',
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='Agent configuration: sync_interval_minutes, max_videos, etc.',
                    ),
                ),
                (
                    'etag',
                    models.CharField(
                        blank=True,
                        default='',
                        help_text='ETag for conditional YouTube API requests',
                        max_length=255,
                    ),
                ),
                (
                    'last_synced_at',
                    models.DateTimeField(blank=True, help_text='Last successful sync timestamp', null=True),
                ),
                (
                    'last_sync_status',
                    models.CharField(blank=True, default='', help_text='Status message from last sync', max_length=100),
                ),
                (
                    'last_sync_error',
                    models.TextField(blank=True, default='', help_text='Error message from last failed sync'),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'agent_user',
                    models.OneToOneField(
                        help_text='Agent user account (role=AGENT) that owns the projects',
                        limit_choices_to={'role': 'agent'},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='youtube_feed_agent_config',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'YouTube Feed Agent',
                'verbose_name_plural': 'YouTube Feed Agents',
                'db_table': 'youtube_feed_agents',
            },
        ),
        migrations.CreateModel(
            name='YouTubeFeedVideo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'video_id',
                    models.CharField(
                        db_index=True,
                        help_text='YouTube video ID',
                        max_length=50,
                        unique=True,
                    ),
                ),
                (
                    'channel_id',
                    models.CharField(
                        db_index=True,
                        help_text='YouTube channel ID (denormalized for queries)',
                        max_length=100,
                    ),
                ),
                (
                    'channel_name',
                    models.CharField(help_text='Channel name (denormalized for queries)', max_length=255),
                ),
                ('permalink', models.URLField(help_text='Full YouTube video URL', max_length=500)),
                (
                    'thumbnail_url',
                    models.URLField(
                        blank=True,
                        default='',
                        help_text='Video thumbnail URL',
                        max_length=500,
                    ),
                ),
                ('duration', models.IntegerField(default=0, help_text='Video duration in seconds')),
                (
                    'duration_iso',
                    models.CharField(
                        blank=True,
                        default='',
                        help_text='ISO 8601 duration (e.g., PT12M34S)',
                        max_length=50,
                    ),
                ),
                ('view_count', models.PositiveIntegerField(default=0, help_text='View count at last sync')),
                ('like_count', models.PositiveIntegerField(default=0, help_text='Like count at last sync')),
                ('comment_count', models.PositiveIntegerField(default=0, help_text='Comment count at last sync')),
                (
                    'published_at',
                    models.DateTimeField(db_index=True, help_text='When the video was published on YouTube'),
                ),
                ('tags', models.JSONField(blank=True, default=list, help_text='Tags from YouTube video')),
                (
                    'category_id',
                    models.CharField(blank=True, default='', help_text='YouTube category ID', max_length=10),
                ),
                (
                    'youtube_metadata',
                    models.JSONField(blank=True, default=dict, help_text='Additional metadata from YouTube API'),
                ),
                (
                    'last_synced_at',
                    models.DateTimeField(auto_now=True, help_text='When we last fetched updates for this video'),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'agent',
                    models.ForeignKey(
                        help_text='Agent that created this video project',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='videos',
                        to='integrations.youtubefeedagent',
                    ),
                ),
                (
                    'project',
                    models.OneToOneField(
                        help_text='Associated Project (type=video)',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='youtube_feed_video',
                        to='core.project',
                    ),
                ),
            ],
            options={
                'verbose_name': 'YouTube Feed Video',
                'verbose_name_plural': 'YouTube Feed Videos',
                'db_table': 'youtube_feed_videos',
                'ordering': ['-published_at'],
            },
        ),
        migrations.AddIndex(
            model_name='youtubefeedagent',
            index=models.Index(fields=['status', 'last_synced_at'], name='youtube_fee_status_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='youtubefeedagent',
            index=models.Index(fields=['channel_id'], name='youtube_fee_channel_d4e5f6_idx'),
        ),
        migrations.AddIndex(
            model_name='youtubefeedvideo',
            index=models.Index(fields=['channel_id', '-published_at'], name='youtube_fee_channel_g7h8i9_idx'),
        ),
        migrations.AddIndex(
            model_name='youtubefeedvideo',
            index=models.Index(fields=['agent', '-published_at'], name='youtube_fee_agent_i_j0k1l2_idx'),
        ),
        migrations.AddIndex(
            model_name='youtubefeedvideo',
            index=models.Index(fields=['video_id'], name='youtube_fee_video_i_m3n4o5_idx'),
        ),
    ]
