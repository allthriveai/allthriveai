"""Celery tasks for email notifications."""

import logging

from celery import shared_task

from core.billing.tasks import get_exponential_backoff
from core.notifications.utils import mask_email

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_email_task(
    self,
    user_id: int,
    email_type: str,
    subject: str,
    context: dict,
    force: bool = False,
):
    """Send email asynchronously with retry logic.

    Uses exponential backoff from billing tasks for retries.

    Args:
        user_id: ID of user to send to
        email_type: EmailType value (e.g., 'billing/low_balance')
        subject: Email subject line
        context: Template context dict
        force: Send even if user opted out (for transactional)

    Returns:
        Dict with success status and details
    """
    from django.contrib.auth import get_user_model

    from core.notifications.constants import EmailType
    from core.notifications.services import EmailService

    User = get_user_model()

    try:
        user = User.objects.select_related('email_preferences').get(id=user_id)
        email_type_enum = EmailType(email_type)

        log = EmailService.send(
            email_type=email_type_enum,
            user=user,
            subject=subject,
            context=context,
            force=force,
        )

        logger.info(
            f'Email task completed: type={email_type}, user_id={user_id}, '
            f'email={mask_email(user.email)}, status={log.status}'
        )
        return {
            'success': True,
            'user_id': user_id,
            'email_type': email_type,
            'log_id': log.id,
            'status': log.status,
        }

    except User.DoesNotExist:
        logger.warning(f'Email task failed: user_id={user_id} not found')
        return {'success': False, 'error': 'user_not_found', 'user_id': user_id}

    except ValueError as e:
        # Invalid email type - don't retry, this is a programming error
        logger.error(f'Email task failed: invalid email type {email_type!r}: {e}')
        return {'success': False, 'error': f'invalid_email_type: {email_type}'}

    except Exception as e:
        logger.error(
            f'Email task failed: type={email_type}, user_id={user_id}, '
            f'attempt={self.request.retries + 1}/{self.max_retries + 1}, error={e}',
            exc_info=True,
        )
        countdown = get_exponential_backoff(self.request.retries)
        logger.info(f'Retrying email task in {countdown}s (attempt {self.request.retries + 2})')
        raise self.retry(exc=e, countdown=countdown) from e


@shared_task(bind=True)
def send_bulk_email_task(
    self,
    user_ids: list[int],
    email_type: str,
    subject: str,
    context: dict,
    force: bool = False,
):
    """Send email to multiple users in batch.

    Spawns individual send_email_task for each user to handle
    retries and logging separately.

    Args:
        user_ids: List of user IDs to send to
        email_type: EmailType value
        subject: Email subject line
        context: Template context (same for all users)
        force: Send even if users opted out

    Returns:
        Dict with count of queued emails and any errors
    """
    from core.notifications.constants import EmailType

    # Validate email type upfront to fail fast
    try:
        EmailType(email_type)
    except ValueError:
        logger.error(f'Bulk email task failed: invalid email type {email_type!r}')
        return {
            'success': False,
            'error': f'invalid_email_type: {email_type}',
            'queued': 0,
        }

    if not user_ids:
        logger.warning('Bulk email task called with empty user_ids list')
        return {'success': True, 'queued': 0, 'email_type': email_type}

    queued = 0
    errors = []

    for user_id in user_ids:
        try:
            send_email_task.delay(
                user_id=user_id,
                email_type=email_type,
                subject=subject,
                context=context,
                force=force,
            )
            queued += 1
        except Exception as e:
            # Log but don't fail the whole batch
            logger.error(f'Failed to queue email for user_id={user_id}: {e}')
            errors.append({'user_id': user_id, 'error': str(e)})

    logger.info(
        f'Bulk email task completed: type={email_type}, ' f'queued={queued}/{len(user_ids)}, errors={len(errors)}'
    )

    return {
        'success': len(errors) == 0,
        'queued': queued,
        'email_type': email_type,
        'total_requested': len(user_ids),
        'errors': errors if errors else None,
    }
