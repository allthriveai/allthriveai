import os

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('allthrive_ai')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Manually discover tasks from modules not in INSTALLED_APPS
# These apps have models under 'core' app but tasks need explicit discovery
app.autodiscover_tasks(['core.projects', 'core.integrations', 'core.integrations.youtube'])

# Configure task queues for priority handling (YouTube integration)
app.conf.task_queues = (
    Queue('default', routing_key='default'),
    Queue('youtube_sync', routing_key='youtube.sync'),
    Queue('youtube_import', routing_key='youtube.import'),
)

# Route YouTube tasks to specific queues
app.conf.task_routes = {
    'core.integrations.youtube.tasks.sync_single_content_source': {'queue': 'youtube_sync'},
    'core.integrations.youtube.tasks.sync_content_sources': {'queue': 'youtube_sync'},
    'core.integrations.youtube.tasks.import_youtube_video_task': {'queue': 'youtube_import'},
    'core.integrations.youtube.tasks.import_youtube_channel_task': {'queue': 'youtube_import'},
}

# Periodic tasks schedule (Celery Beat)
app.conf.beat_schedule = {
    'sync-youtube-content-sources': {
        'task': 'core.integrations.youtube.tasks.sync_content_sources',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes (SCALABLE)
        'options': {
            'expires': 900,  # Task expires after 15min if not picked up
            'queue': 'youtube_sync',
        },
    },
}
