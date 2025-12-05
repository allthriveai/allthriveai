"""Celery tasks for SMS operations."""

import logging

from celery import shared_task
from django.utils import timezone

from core.sms.models import SMSLog
from core.sms.provider import get_sms_provider

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_sms_task(self, sms_log_id: int) -> dict:
    """
    Send an SMS message asynchronously.

    Args:
        sms_log_id: ID of the SMSLog record to send

    Returns:
        dict with status and details
    """
    try:
        sms_log = SMSLog.objects.get(id=sms_log_id)
    except SMSLog.DoesNotExist:
        logger.error(f'SMSLog {sms_log_id} not found')
        return {'status': 'error', 'error': 'SMSLog not found'}

    # Skip if already sent
    if sms_log.status in [SMSLog.Status.SENT, SMSLog.Status.DELIVERED]:
        logger.info(f'SMS {sms_log_id} already sent, skipping')
        return {'status': 'skipped', 'reason': 'already_sent'}

    provider = get_sms_provider()
    result = provider.send(to=sms_log.to_phone, body=sms_log.body)

    if result.success:
        sms_log.status = SMSLog.Status.SENT
        sms_log.provider_sid = result.sid
        sms_log.sent_at = timezone.now()
        sms_log.save(update_fields=['status', 'provider_sid', 'sent_at'])

        logger.info(f'SMS {sms_log_id} sent successfully: sid={result.sid}')
        return {'status': 'sent', 'sid': result.sid}
    else:
        sms_log.status = SMSLog.Status.FAILED
        sms_log.error_code = result.error_code
        sms_log.error_message = result.error_message
        sms_log.save(update_fields=['status', 'error_code', 'error_message'])

        logger.error(f'SMS {sms_log_id} failed: {result.error_code} - {result.error_message}')

        # Retry on transient errors
        if result.error_code in ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED']:
            raise self.retry(exc=Exception(result.error_message))

        return {
            'status': 'failed',
            'error_code': result.error_code,
            'error_message': result.error_message,
        }


@shared_task
def update_sms_status_task(sms_log_id: int) -> dict:
    """
    Update SMS delivery status from provider.

    Args:
        sms_log_id: ID of the SMSLog record to check

    Returns:
        dict with current status
    """
    try:
        sms_log = SMSLog.objects.get(id=sms_log_id)
    except SMSLog.DoesNotExist:
        return {'status': 'error', 'error': 'SMSLog not found'}

    if not sms_log.provider_sid:
        return {'status': 'error', 'error': 'No provider SID'}

    provider = get_sms_provider()
    status = provider.get_message_status(sms_log.provider_sid)

    # Map provider status to our status
    status_map = {
        'queued': SMSLog.Status.PENDING,
        'sending': SMSLog.Status.PENDING,
        'sent': SMSLog.Status.SENT,
        'delivered': SMSLog.Status.DELIVERED,
        'failed': SMSLog.Status.FAILED,
        'undelivered': SMSLog.Status.UNDELIVERED,
    }

    new_status = status_map.get(status, sms_log.status)

    if new_status != sms_log.status:
        sms_log.status = new_status
        if new_status == SMSLog.Status.DELIVERED:
            sms_log.delivered_at = timezone.now()
        sms_log.save(update_fields=['status', 'delivered_at'])

    return {'status': new_status}
