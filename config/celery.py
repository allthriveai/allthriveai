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

# Task execution settings for scalability
app.conf.task_default_rate_limit = '100/m'  # 100 tasks per minute per worker (prevents broker overload)
app.conf.task_acks_late = True  # Tasks acknowledged after execution (prevents loss on worker crash)
app.conf.worker_prefetch_multiplier = 1  # Fetch one task at a time (fair distribution across workers)
app.conf.task_time_limit = 300  # 5 minutes hard limit
app.conf.task_soft_time_limit = 240  # 4 minutes soft limit (task should handle gracefully)

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
