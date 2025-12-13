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
app.autodiscover_tasks(
    [
        'core.projects',
        'core.integrations',
        'core.integrations.youtube',
        'core.agents',
        'core.battles',  # Prompt battles tasks
        'core.billing',  # Billing and token management tasks
        'core.notifications',  # Email notification tasks
        'core.sms',  # SMS notification tasks
        'core.ai_usage',  # Admin analytics tasks
        'services.weaviate',  # Weaviate sync tasks
    ]
)

# Explicitly register task modules that don't follow the standard tasks.py naming
# (Celery autodiscover only looks for tasks.py files)
app.conf.imports = [
    'core.integrations.reddit_tasks',
    'core.integrations.rss_tasks',  # Expert curation articles with AI-generated hero images
    'core.integrations.youtube_feed_tasks',
]

# Task execution settings for scalability
app.conf.task_default_rate_limit = '100/m'  # 100 tasks per minute per worker (prevents broker overload)
app.conf.task_acks_late = True  # Tasks acknowledged after execution (prevents loss on worker crash)
app.conf.worker_prefetch_multiplier = 1  # Fetch one task at a time (fair distribution across workers)
app.conf.task_time_limit = 300  # 5 minutes hard limit
app.conf.task_soft_time_limit = 240  # 4 minutes soft limit (task should handle gracefully)

# Configure task queues for priority handling
app.conf.task_queues = (
    Queue('celery', routing_key='celery'),  # Default Celery queue
    Queue('default', routing_key='default'),
    Queue('youtube_sync', routing_key='youtube.sync'),
    Queue('youtube_import', routing_key='youtube.import'),
    Queue('battles', routing_key='battles'),  # Prompt battles queue
)

# Route tasks to specific queues
app.conf.task_routes = {
    # WebSocket chat tasks
    'core.agents.tasks.process_chat_message_task': {'queue': 'default'},
    # YouTube tasks
    'core.integrations.youtube.tasks.sync_single_content_source': {'queue': 'youtube_sync'},
    'core.integrations.youtube.tasks.sync_content_sources': {'queue': 'youtube_sync'},
    'core.integrations.youtube.tasks.import_youtube_video_task': {'queue': 'youtube_import'},
    'core.integrations.youtube.tasks.import_youtube_channel_task': {'queue': 'youtube_import'},
    # Prompt battles tasks (using default queue for now)
    'core.battles.tasks.generate_submission_image_task': {'queue': 'default'},
    'core.battles.tasks.judge_battle_task': {'queue': 'default'},
    'core.battles.tasks.complete_battle_task': {'queue': 'default'},
    'core.battles.tasks.create_pip_submission_task': {'queue': 'default'},
    'core.battles.tasks.handle_battle_timeout_task': {'queue': 'default'},
    # Async battle tasks
    'core.battles.tasks.check_async_battle_deadlines': {'queue': 'default'},
    'core.battles.tasks.send_async_battle_reminders': {'queue': 'default'},
    'core.battles.tasks.start_async_turn_task': {'queue': 'default'},
    'core.battles.tasks.handle_async_turn_timeout_task': {'queue': 'default'},
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
    'sync-reddit-agents': {
        'task': 'core.integrations.reddit_tasks.sync_all_reddit_agents_task',
        'schedule': crontab(hour='*/4', minute=0),  # Every 4 hours at minute 0
        'options': {
            'expires': 3600,  # Task expires after 1 hour if not picked up
        },
    },
    # Expert curation articles - daily sync with AI-generated hero images
    'sync-rss-agents': {
        'task': 'core.integrations.rss_tasks.sync_all_rss_agents_task',
        'schedule': crontab(hour=4, minute=0),  # Daily at 4 AM UTC
        'options': {
            'expires': 7200,  # Task expires after 2 hours if not picked up
        },
    },
    'sync-youtube-feed-agents': {
        'task': 'core.integrations.youtube_feed_tasks.sync_all_youtube_feed_agents_task',
        'schedule': crontab(hour='*/2', minute=0),  # Every 2 hours at minute 0
        'options': {
            'expires': 3600,  # Task expires after 1 hour if not picked up
            'queue': 'youtube_sync',
        },
    },
    # Weaviate personalization tasks
    'weaviate-update-engagement-metrics': {
        'task': 'services.weaviate.tasks.update_engagement_metrics',
        'schedule': crontab(minute=0),  # Every hour at minute 0
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    'weaviate-full-reindex-projects': {
        'task': 'services.weaviate.tasks.full_reindex_projects',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
    },
    # Battle cleanup tasks
    'cleanup-expired-matchmaking-queue': {
        'task': 'core.battles.tasks.cleanup_expired_queue_entries',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
        'options': {
            'expires': 300,  # Expires after 5 minutes
        },
    },
    'cleanup-stale-battles': {
        'task': 'core.battles.tasks.cleanup_stale_battles',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
        'options': {
            'expires': 900,  # Expires after 15 minutes
        },
    },
    'cleanup-expired-guest-accounts': {
        'task': 'core.battles.tasks.cleanup_expired_guest_accounts',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
    },
    'cleanup-orphaned-invitation-battles': {
        'task': 'core.battles.tasks.cleanup_orphaned_invitation_battles',
        'schedule': crontab(minute=0),  # Every hour at minute 0
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    # Async battle tasks
    'check-async-battle-deadlines': {
        'task': 'core.battles.tasks.check_async_battle_deadlines',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
        'options': {
            'expires': 900,  # Expires after 15 minutes
        },
    },
    'send-async-battle-reminders': {
        'task': 'core.battles.tasks.send_async_battle_reminders',
        'schedule': crontab(hour='*/6'),  # Every 6 hours
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    # Billing tasks
    # DISABLED: Low balance notifications need more thought before enabling
    # TODO: Add cooldown period, better targeting, and user preferences
    # 'billing-check-low-token-balances': {
    #     'task': 'core.billing.tasks.check_low_token_balances_task',
    #     'schedule': crontab(hour='*/6'),  # Every 6 hours
    #     'options': {
    #         'expires': 3600,  # Expires after 1 hour
    #     },
    # },
    'billing-reset-monthly-ai-requests': {
        'task': 'core.billing.tasks.reset_monthly_ai_requests_task',
        'schedule': crontab(hour=0, minute=5),  # Daily at 00:05 AM
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    'billing-check-subscription-quotas': {
        'task': 'core.billing.tasks.check_subscription_quotas_task',
        'schedule': crontab(hour='*/12'),  # Twice daily
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    # Admin analytics tasks
    'analytics-aggregate-daily-stats': {
        'task': 'core.ai_usage.tasks.aggregate_platform_daily_stats',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1:00 AM (after midnight rollover)
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
    },
    # Thrive Circle weekly tasks
    'thrive-circle-create-weekly-goals': {
        'task': 'core.thrive_circle.tasks.create_weekly_goals',
        'schedule': crontab(hour=0, minute=0, day_of_week=1),  # Monday at 00:00
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    'thrive-circle-form-weekly-circles': {
        'task': 'core.thrive_circle.tasks.form_weekly_circles',
        'schedule': crontab(hour=0, minute=5, day_of_week=1),  # Monday at 00:05 (after goals)
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    'thrive-circle-update-activity-stats': {
        'task': 'core.thrive_circle.tasks.update_circle_activity_stats',
        'schedule': crontab(hour='*/6'),  # Every 6 hours
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
    'thrive-circle-check-challenge-completion': {
        'task': 'core.thrive_circle.tasks.check_circle_challenge_completion',
        'schedule': crontab(minute=0),  # Every hour at minute 0
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
    },
}
