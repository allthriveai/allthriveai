import os

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('allthrive_ai')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task(name='celery.health_check')
def health_check():
    """
    Simple health check task for CI verification.

    This task verifies that:
    1. Celery worker can connect to the broker
    2. Worker can pick up and execute tasks
    3. Task results can be returned

    Used by CI to catch Celery infrastructure issues before deployment.
    """
    return {'status': 'healthy', 'worker': 'ok'}


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
        'core.feedback',  # Haven auto-comment on feedback
        'services.weaviate',  # Weaviate sync tasks
        'services.tagging',  # AI tagging tasks
        'core.engagement',  # Engagement tracking tasks
    ]
)

# Explicitly register task modules that don't follow the standard tasks.py naming
# (Celery autodiscover only looks for tasks.py files)
app.conf.imports = [
    'core.integrations.rss_tasks',  # Expert curation articles with AI-generated hero images
    'core.integrations.youtube_feed_tasks',
]

# Task execution settings for scalability
app.conf.task_default_rate_limit = '100/m'  # 100 tasks per minute per worker (prevents broker overload)
app.conf.task_acks_late = True  # Tasks acknowledged after execution (prevents loss on worker crash)
app.conf.worker_prefetch_multiplier = 1  # Fetch one task at a time (fair distribution across workers)
app.conf.task_time_limit = 300  # 5 minutes hard limit
app.conf.task_soft_time_limit = 240  # 4 minutes soft limit (task should handle gracefully)

# Default task expiration - discard stale tasks that haven't been picked up
# This prevents queue backlog from causing wasted AI credits on abandoned sessions
# Individual tasks can override with apply_async(expires=...) for shorter timeouts
app.conf.task_default_expires = 3600  # 1 hour default (lenient for background tasks)

# Configure task queues - simplified: only Weaviate gets its own queue
# All other tasks go to the default 'celery' queue for simpler routing
app.conf.task_queues = (
    Queue('celery', routing_key='celery'),  # Default queue for all tasks
    Queue('weaviate', routing_key='weaviate'),  # Low-priority Weaviate sync (background)
)

# Route only Weaviate tasks to their own queue - everything else uses default 'celery' queue
app.conf.task_routes = {
    # Weaviate sync tasks (low priority - background, can be delayed)
    'services.weaviate.tasks.sync_project_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_user_profile_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_quiz_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_tool_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_micro_lesson_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_learning_path_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_concept_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.sync_knowledge_state_to_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.remove_project_from_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.remove_user_profile_from_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.remove_learning_path_from_weaviate': {'queue': 'weaviate'},
    'services.weaviate.tasks.update_engagement_metrics': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_projects': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_users': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_quizzes': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_tools': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_concepts': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_micro_lessons': {'queue': 'weaviate'},
    'services.weaviate.tasks.full_reindex_learning_paths': {'queue': 'weaviate'},
}

# Periodic tasks schedule (Celery Beat)
app.conf.beat_schedule = {
    'sync-youtube-content-sources': {
        'task': 'core.integrations.youtube.tasks.sync_content_sources',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes (SCALABLE)
        'options': {
            'expires': 900,  # Task expires after 15min if not picked up
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
    'analytics-aggregate-engagement-stats': {
        'task': 'core.ai_usage.tasks.aggregate_engagement_daily_stats',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM (after platform stats)
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
    # Engagement processing tasks
    'engagement-process-batch': {
        'task': 'core.engagement.tasks.process_engagement_batch',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
        'options': {
            'expires': 300,  # Expires after 5 minutes
        },
    },
    'engagement-apply-recency-decay': {
        'task': 'core.engagement.tasks.apply_recency_decay',
        'schedule': crontab(hour=4, minute=30),  # Daily at 4:30 AM
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
    },
    # AI Taxonomy Tagging tasks
    'tagging-backfill-untagged-content': {
        'task': 'services.tagging.tasks.backfill_tags',
        'schedule': crontab(hour=5, minute=0),  # Daily at 5:00 AM
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
        'kwargs': {
            'content_type': None,  # All types
            'tier': 'bulk',
            'limit': 100,
        },
    },
    'tagging-retag-stale-content': {
        'task': 'services.tagging.tasks.retag_stale_content',
        'schedule': crontab(hour=6, minute=0, day_of_week=0),  # Weekly on Sunday at 6:00 AM
        'options': {
            'expires': 7200,  # Expires after 2 hours
        },
        'kwargs': {
            'stale_days': 30,
            'limit': 50,
        },
    },
    'tagging-premium-high-engagement': {
        'task': 'services.tagging.tasks.tag_high_engagement_premium',
        'schedule': crontab(minute=30),  # Every hour at minute 30
        'options': {
            'expires': 3600,  # Expires after 1 hour
        },
        'kwargs': {
            'lookback_hours': 24,
            'engagement_threshold': 10,
            'limit': 10,
        },
    },
}
