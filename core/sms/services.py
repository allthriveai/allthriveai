"""SMS service layer for sending messages."""

import logging
from typing import Optional

from django.contrib.auth import get_user_model

from core.sms.models import SMSLog
from core.sms.tasks import send_sms_task
from core.sms.utils import normalize_phone_number

User = get_user_model()
logger = logging.getLogger(__name__)


class SMSService:
    """Service for sending SMS messages with logging."""

    @staticmethod
    def send_sms(
        to_phone: str,
        body: str,
        message_type: str = SMSLog.MessageType.OTHER,
        user: Optional['User'] = None,
        related_object_type: str = '',
        related_object_id: int | None = None,
        send_async: bool = True,
    ) -> SMSLog:
        """
        Send an SMS message.

        Args:
            to_phone: Recipient phone number (will be normalized to E.164)
            body: Message body
            message_type: Type of message (for filtering/reporting)
            user: User who triggered this SMS (optional)
            related_object_type: Type of related object (e.g., 'BattleInvitation')
            related_object_id: ID of related object
            send_async: If True, send via Celery task (default). If False, send synchronously.

        Returns:
            SMSLog record
        """
        # Normalize phone number
        normalized_phone = normalize_phone_number(to_phone)

        # Create log record
        sms_log = SMSLog.objects.create(
            user=user,
            to_phone=normalized_phone,
            message_type=message_type,
            body=body,
            status=SMSLog.Status.PENDING,
            related_object_type=related_object_type,
            related_object_id=related_object_id,
        )

        logger.info(f'Created SMS log {sms_log.id} for {normalized_phone[:6]}***')

        if send_async:
            # Queue for async sending
            send_sms_task.delay(sms_log.id)
        else:
            # Send synchronously (for testing or urgent messages)
            from core.sms.provider import get_sms_provider

            provider = get_sms_provider()
            result = provider.send(to=normalized_phone, body=body)

            if result.success:
                from django.utils import timezone

                sms_log.status = SMSLog.Status.SENT
                sms_log.provider_sid = result.sid
                sms_log.sent_at = timezone.now()
            else:
                sms_log.status = SMSLog.Status.FAILED
                sms_log.error_code = result.error_code
                sms_log.error_message = result.error_message

            sms_log.save()

        return sms_log

    @staticmethod
    def send_battle_invitation(
        to_phone: str,
        inviter_name: str,
        battle_topic: str,
        invitation_link: str,
        user: Optional['User'] = None,
        invitation_id: int | None = None,
    ) -> SMSLog:
        """
        Send a battle invitation SMS.

        Args:
            to_phone: Recipient phone number
            inviter_name: Name of person sending the invitation
            battle_topic: Topic of the battle
            invitation_link: Link to accept the invitation
            user: User who sent the invitation
            invitation_id: ID of the BattleInvitation record

        Returns:
            SMSLog record
        """
        body = (
            f'{inviter_name} has challenged you to a battle on AllThrive!\n\n'
            f'Topic: {battle_topic}\n\n'
            f'Accept the challenge: {invitation_link}'
        )

        return SMSService.send_sms(
            to_phone=to_phone,
            body=body,
            message_type=SMSLog.MessageType.BATTLE_INVITATION,
            user=user,
            related_object_type='BattleInvitation',
            related_object_id=invitation_id,
        )

    @staticmethod
    def send_phone_verification(
        to_phone: str,
        verification_code: str,
        user: Optional['User'] = None,
    ) -> SMSLog:
        """
        Send a phone verification SMS.

        Args:
            to_phone: Phone number to verify
            verification_code: 6-digit verification code
            user: User verifying their phone

        Returns:
            SMSLog record
        """
        body = f'Your AllThrive verification code is: {verification_code}\n\nThis code expires in 10 minutes.'

        return SMSService.send_sms(
            to_phone=to_phone,
            body=body,
            message_type=SMSLog.MessageType.PHONE_VERIFICATION,
            user=user,
        )
