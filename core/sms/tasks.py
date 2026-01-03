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
        sms_log.provider_message_id = result.message_id
        sms_log.sent_at = timezone.now()
        sms_log.save(update_fields=['status', 'provider_message_id', 'sent_at'])

        logger.info(f'SMS {sms_log_id} sent successfully: message_id={result.message_id}')
        return {'status': 'sent', 'message_id': result.message_id}
    else:
        sms_log.status = SMSLog.Status.FAILED
        sms_log.error_code = result.error_code
        sms_log.error_message = result.error_message
        sms_log.save(update_fields=['status', 'error_code', 'error_message'])

        logger.error(f'SMS {sms_log_id} failed: {result.error_code} - {result.error_message}')

        # Retry on transient errors (AWS SNS error codes)
        if result.error_code in ['Throttling', 'ServiceUnavailable', 'InternalError', 'BOTO_ERROR']:
            raise self.retry(exc=Exception(result.error_message))

        return {
            'status': 'failed',
            'error_code': result.error_code,
            'error_message': result.error_message,
        }
