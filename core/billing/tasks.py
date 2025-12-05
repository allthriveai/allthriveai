"""Celery tasks for billing operations.

This module contains background tasks for:
- Checking and notifying users with low token balances
- Resetting monthly AI request counters
- Token usage alerts and notifications
"""

import logging
import random

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    """Mask email address for safe logging (PII protection)."""
    if not email or '@' not in email:
        return '[invalid-email]'
    parts = email.split('@')
    username = parts[0]
    masked = username[:2] + '***' if len(username) > 2 else '***'
    return f'{masked}@{parts[1]}'


def get_exponential_backoff(retry_count: int, base_delay: int = 60, max_delay: int = 3600) -> int:
    """
    Calculate exponential backoff delay with jitter.

    Args:
        retry_count: Current retry attempt (0-indexed)
        base_delay: Base delay in seconds (default: 60s)
        max_delay: Maximum delay in seconds (default: 1 hour)

    Returns:
        Delay in seconds with some random jitter
    """
    # Exponential backoff: base_delay * 2^retry_count
    delay = min(base_delay * (2**retry_count), max_delay)
    # Add jitter (±20%) to prevent thundering herd
    jitter = delay * 0.2 * (random.random() * 2 - 1)  # noqa: S311 - not cryptographic
    return int(delay + jitter)


# Token balance thresholds for alerts
LOW_BALANCE_THRESHOLD = 5000  # Alert when balance drops below 5,000 tokens
CRITICAL_BALANCE_THRESHOLD = 1000  # Critical alert at 1,000 tokens
ZERO_BALANCE_THRESHOLD = 100  # Almost depleted at 100 tokens


@shared_task(bind=True, max_retries=3)
def check_low_token_balances_task(self):
    """
    Check for users with low token balances and send notifications.

    This task runs periodically to identify users who:
    1. Have exceeded their subscription quota
    2. Have low remaining token balances
    3. Are at risk of running out of tokens

    Notifications are sent via email and can trigger in-app alerts.
    """
    from core.billing.models import UserSubscription, UserTokenBalance

    try:
        # Find users with low balances who haven't been notified recently
        low_balance_users = UserTokenBalance.objects.filter(
            balance__lt=LOW_BALANCE_THRESHOLD,
            balance__gt=0,  # Still have some tokens
        ).select_related('user')

        notifications_sent = 0

        for balance in low_balance_users:
            user = balance.user

            # Check if user has exceeded subscription quota
            subscription = UserSubscription.objects.filter(user=user).first()
            quota_exceeded = False

            if subscription:
                quota_exceeded = (
                    subscription.tier.monthly_ai_requests > 0
                    and subscription.ai_requests_used_this_month >= subscription.tier.monthly_ai_requests
                )

            # Determine alert level
            if balance.balance <= ZERO_BALANCE_THRESHOLD:
                alert_level = 'critical'
                subject = 'Your AllThrive AI tokens are almost depleted'
            elif balance.balance <= CRITICAL_BALANCE_THRESHOLD:
                alert_level = 'warning'
                subject = 'Low token balance warning'
            else:
                alert_level = 'info'
                subject = 'Running low on tokens'

            # Send notification
            try:
                send_low_balance_notification(
                    user=user,
                    balance=balance.balance,
                    alert_level=alert_level,
                    quota_exceeded=quota_exceeded,
                    subject=subject,
                )
                notifications_sent += 1
                logger.info(
                    f'Sent {alert_level} notification to user_id={user.id} '
                    f'({_mask_email(user.email)}) (balance: {balance.balance})'
                )
            except Exception as e:
                logger.error(f'Failed to send notification to user_id={user.id}: {e}')

        # Also check for users at zero balance
        zero_balance_users = UserTokenBalance.objects.filter(
            balance__lte=0,
        ).select_related('user')

        for balance in zero_balance_users:
            user = balance.user
            try:
                send_low_balance_notification(
                    user=user,
                    balance=0,
                    alert_level='depleted',
                    quota_exceeded=True,
                    subject='Your AllThrive AI token balance is empty',
                )
                notifications_sent += 1
            except Exception as e:
                logger.error(f'Failed to send depleted notification to user_id={user.id}: {e}')

        logger.info(f'Low balance check complete. Sent {notifications_sent} notifications.')
        return {'notifications_sent': notifications_sent}

    except Exception as e:
        logger.error(f'Low balance check failed: {e}', exc_info=True)
        countdown = get_exponential_backoff(self.request.retries)
        logger.info(f'Retrying low balance check in {countdown}s (attempt {self.request.retries + 1})')
        raise self.retry(exc=e, countdown=countdown) from e


@shared_task(bind=True, max_retries=3)
def reset_monthly_ai_requests_task(self):
    """
    Reset monthly AI request counters for all subscriptions.

    This task runs daily and resets counters for subscriptions where:
    1. The reset date has passed
    2. The subscription is active

    The reset date is typically the 1st of each month or the anniversary
    of the subscription start date.
    """
    from core.billing.models import UserSubscription

    try:
        today = timezone.now().date()

        # Find subscriptions that need reset
        # Reset if: reset_date is in the past OR reset_date is null
        subscriptions_to_reset = UserSubscription.objects.filter(
            status__in=['active', 'trialing'],
        ).filter(
            # Reset date is before today or not set
            ai_requests_reset_date__lt=today,
        ) | UserSubscription.objects.filter(
            status__in=['active', 'trialing'],
            ai_requests_reset_date__isnull=True,
        )

        reset_count = 0

        with transaction.atomic():
            for subscription in subscriptions_to_reset:
                old_count = subscription.ai_requests_used_this_month
                subscription.ai_requests_used_this_month = 0
                subscription.ai_requests_reset_date = today
                subscription.save(update_fields=['ai_requests_used_this_month', 'ai_requests_reset_date'])

                if old_count > 0:
                    logger.info(
                        f'Reset AI requests for user_id={subscription.user.id}: {old_count} -> 0 (next reset: {today})'
                    )
                reset_count += 1

        logger.info(f'Monthly reset complete. Reset {reset_count} subscriptions.')
        return {'subscriptions_reset': reset_count}

    except Exception as e:
        logger.error(f'Monthly reset failed: {e}', exc_info=True)
        countdown = get_exponential_backoff(self.request.retries)
        logger.info(f'Retrying monthly reset in {countdown}s (attempt {self.request.retries + 1})')
        raise self.retry(exc=e, countdown=countdown) from e


@shared_task
def send_token_usage_notification_task(user_id: int, tokens_used: int, balance_after: int):
    """
    Send notification after significant token usage.

    Triggered when:
    1. A large amount of tokens is used in one operation
    2. Balance drops below a threshold after usage

    Args:
        user_id: ID of the user
        tokens_used: Number of tokens used in the operation
        balance_after: Token balance after the operation
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)

        # Determine if notification is warranted
        should_notify = False
        alert_level = 'info'

        if balance_after <= ZERO_BALANCE_THRESHOLD:
            should_notify = True
            alert_level = 'critical'
        elif balance_after <= CRITICAL_BALANCE_THRESHOLD:
            should_notify = True
            alert_level = 'warning'
        elif balance_after <= LOW_BALANCE_THRESHOLD:
            should_notify = True
            alert_level = 'info'

        if should_notify:
            send_low_balance_notification(
                user=user,
                balance=balance_after,
                alert_level=alert_level,
                quota_exceeded=True,
                subject=f'Token usage update - {tokens_used:,} tokens used',
            )
            logger.info(f'Sent usage notification to user_id={user_id}: used {tokens_used}, remaining {balance_after}')

        return {'notified': should_notify, 'alert_level': alert_level if should_notify else None}

    except User.DoesNotExist:
        logger.warning(f'User {user_id} not found for token usage notification')
        return {'notified': False, 'error': 'user_not_found'}
    except Exception as e:
        logger.error(f'Failed to send token usage notification: {e}', exc_info=True)
        return {'notified': False, 'error': str(e)}


@shared_task
def check_subscription_quotas_task():
    """
    Check for users approaching or exceeding their subscription quotas.

    This task identifies users who:
    1. Have used 80% or more of their monthly AI requests
    2. Have exceeded their limit and are now using tokens

    Sends proactive notifications to encourage token purchases.
    """
    from core.billing.models import UserSubscription, UserTokenBalance

    try:
        notifications_sent = 0

        # Find subscriptions approaching quota (80%+ used)
        subscriptions = (
            UserSubscription.objects.filter(
                status__in=['active', 'trialing'],
            )
            .select_related('user', 'tier')
            .filter(
                tier__monthly_ai_requests__gt=0,  # Has a limit
            )
        )

        for subscription in subscriptions:
            limit = subscription.tier.monthly_ai_requests
            used = subscription.ai_requests_used_this_month
            percentage_used = (used / limit * 100) if limit > 0 else 0

            if percentage_used >= 100:
                # User has exceeded quota
                alert_level = 'exceeded'
                subject = "You've reached your monthly AI request limit"
            elif percentage_used >= 90:
                alert_level = 'critical'
                subject = "You're almost out of AI requests"
            elif percentage_used >= 80:
                alert_level = 'warning'
                subject = 'Running low on AI requests'
            else:
                continue  # No notification needed

            # Check token balance
            try:
                token_balance = UserTokenBalance.objects.get(user=subscription.user)
                has_tokens = token_balance.balance > 0
            except UserTokenBalance.DoesNotExist:
                has_tokens = False

            try:
                send_quota_notification(
                    user=subscription.user,
                    used=used,
                    limit=limit,
                    alert_level=alert_level,
                    has_tokens=has_tokens,
                    subject=subject,
                )
                notifications_sent += 1
            except Exception as e:
                logger.error(f'Failed to send quota notification to user_id={subscription.user.id}: {e}')

        logger.info(f'Quota check complete. Sent {notifications_sent} notifications.')
        return {'notifications_sent': notifications_sent}

    except Exception as e:
        logger.error(f'Quota check failed: {e}', exc_info=True)
        return {'error': str(e)}


def send_low_balance_notification(user, balance: int, alert_level: str, quota_exceeded: bool, subject: str):
    """
    Send email notification about low token balance.

    Args:
        user: User object
        balance: Current token balance
        alert_level: 'info', 'warning', 'critical', or 'depleted'
        quota_exceeded: Whether subscription quota has been exceeded
        subject: Email subject
    """
    from core.notifications.tasks import send_email_task

    # Queue email task asynchronously
    send_email_task.delay(
        user_id=user.id,
        email_type='billing/low_balance',
        subject=subject,
        context={
            'balance': balance,
            'alert_level': alert_level,
            'quota_exceeded': quota_exceeded,
            'purchase_url': f'{settings.FRONTEND_URL}/settings/billing',
            'low_threshold': LOW_BALANCE_THRESHOLD,
            'critical_threshold': CRITICAL_BALANCE_THRESHOLD,
        },
        force=True,  # Transactional - always send
    )

    # Log notification (with masked PII)
    logger.info(
        f'LOW BALANCE NOTIFICATION: user_id={user.id} ({_mask_email(user.email)}) '
        f'balance={balance:,} level={alert_level} quota_exceeded={quota_exceeded}'
    )


def send_quota_notification(user, used: int, limit: int, alert_level: str, has_tokens: bool, subject: str):
    """
    Send email notification about subscription quota usage.

    Args:
        user: User object
        used: Requests used this month
        limit: Monthly limit
        alert_level: 'warning', 'critical', or 'exceeded'
        has_tokens: Whether user has token balance
        subject: Email subject
    """
    from core.notifications.tasks import send_email_task

    remaining = max(0, limit - used)
    percentage = int((used / limit * 100) if limit > 0 else 100)

    # Queue email task asynchronously
    send_email_task.delay(
        user_id=user.id,
        email_type='billing/quota_warning',
        subject=subject,
        context={
            'used': used,
            'limit': limit,
            'remaining': remaining,
            'percentage': percentage,
            'alert_level': alert_level,
            'has_tokens': has_tokens,
            'purchase_url': f'{settings.FRONTEND_URL}/settings/billing',
            'upgrade_url': f'{settings.FRONTEND_URL}/settings/billing',
        },
        force=True,  # Transactional - always send
    )

    # Log notification (with masked PII)
    logger.info(
        f'QUOTA NOTIFICATION: user_id={user.id} ({_mask_email(user.email)}) '
        f'usage={used}/{limit} ({percentage}%) level={alert_level} has_tokens={has_tokens}'
    )
