"""Celery tasks for messaging."""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def expire_pending_connection_requests():
    """Expire pending connection requests that have passed their expiration date.

    This task should run hourly to keep the connection request queue clean.
    """
    from .models import ConnectionRequest

    now = timezone.now()

    # Find and update expired pending requests
    expired_count = ConnectionRequest.objects.filter(
        status=ConnectionRequest.Status.PENDING,
        expires_at__lt=now,
    ).update(
        status=ConnectionRequest.Status.EXPIRED,
        updated_at=now,
    )

    if expired_count > 0:
        logger.info(
            f'Expired {expired_count} pending connection requests',
            extra={'expired_count': expired_count},
        )

    return {'expired_count': expired_count}


@shared_task(bind=True, max_retries=3)
def send_connection_request_notification(self, request_id: int):
    """Send email notification to recipient about a new connection request.

    Args:
        request_id: ID of the ConnectionRequest
    """
    from .models import ConnectionRequest

    try:
        connection_request = ConnectionRequest.objects.select_related('requester', 'recipient', 'project').get(
            id=request_id
        )

        # Only send notification for pending requests
        if connection_request.status != ConnectionRequest.Status.PENDING:
            logger.info(f'Skipping notification for request {request_id}: status is {connection_request.status}')
            return {'success': False, 'reason': 'not_pending'}

        # Send email notification
        from core.notifications.constants import EmailType
        from core.notifications.services import EmailService

        # Check if EmailType.MESSAGING_CONNECTION_REQUEST exists
        # If not, this task will fail gracefully until the email type is added
        try:
            email_type = EmailType.MESSAGING_CONNECTION_REQUEST
        except AttributeError:
            logger.warning('EmailType.MESSAGING_CONNECTION_REQUEST not defined yet. ' 'Skipping notification.')
            return {'success': False, 'reason': 'email_type_not_defined'}

        EmailService.send(
            email_type=email_type,
            user=connection_request.recipient,
            subject=f'{connection_request.requester.username} wants to connect',
            context={
                'requester_username': connection_request.requester.username,
                'requester_avatar': connection_request.requester.avatar_url,
                'project_title': connection_request.project.title,
                'project_slug': connection_request.project.slug,
                'intro_message': connection_request.intro_message,
                'request_id': connection_request.id,
            },
        )

        logger.info(
            f'Sent connection request notification for request {request_id}',
            extra={
                'request_id': request_id,
                'recipient': connection_request.recipient.username,
            },
        )
        return {'success': True, 'request_id': request_id}

    except ConnectionRequest.DoesNotExist:
        logger.warning(f'Connection request {request_id} not found')
        return {'success': False, 'reason': 'not_found'}

    except Exception as e:
        logger.error(
            f'Failed to send connection request notification: {e}',
            exc_info=True,
            extra={'request_id': request_id},
        )
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries)) from e


@shared_task(bind=True, max_retries=3)
def send_new_message_notification(self, message_id: int):
    """Send email notification about a new message (when user is offline).

    This should be called with a delay to batch notifications.

    Args:
        message_id: ID of the DirectMessage
    """
    from .models import DirectMessage

    try:
        message = (
            DirectMessage.objects.select_related('thread', 'sender')
            .prefetch_related('thread__participants')
            .get(id=message_id)
        )

        # Get the recipient (other participant)
        recipient = message.thread.get_other_participant(message.sender)
        if not recipient:
            logger.warning(f'No recipient found for message {message_id}')
            return {'success': False, 'reason': 'no_recipient'}

        # Only send notification if message is still unread
        if message.read_at is not None:
            logger.info(f'Message {message_id} already read, skipping notification')
            return {'success': False, 'reason': 'already_read'}

        # Send email notification
        from core.notifications.constants import EmailType
        from core.notifications.services import EmailService

        try:
            email_type = EmailType.MESSAGING_NEW_MESSAGE
        except AttributeError:
            logger.warning('EmailType.MESSAGING_NEW_MESSAGE not defined yet. ' 'Skipping notification.')
            return {'success': False, 'reason': 'email_type_not_defined'}

        EmailService.send(
            email_type=email_type,
            user=recipient,
            subject=f'New message from {message.sender.username}',
            context={
                'sender_username': message.sender.username,
                'sender_avatar': message.sender.avatar_url,
                'message_preview': message.content[:100],
                'thread_id': message.thread.id,
            },
        )

        logger.info(
            f'Sent new message notification for message {message_id}',
            extra={
                'message_id': message_id,
                'recipient': recipient.username,
            },
        )
        return {'success': True, 'message_id': message_id}

    except DirectMessage.DoesNotExist:
        logger.warning(f'Message {message_id} not found')
        return {'success': False, 'reason': 'not_found'}

    except Exception as e:
        logger.error(
            f'Failed to send new message notification: {e}',
            exc_info=True,
            extra={'message_id': message_id},
        )
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries)) from e
