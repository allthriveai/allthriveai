"""SMS service layer for sending messages."""

import logging
from typing import TYPE_CHECKING, Optional

from core.sms.models import SMSLog
from core.sms.tasks import send_sms_task
from core.sms.utils import normalize_phone_number

if TYPE_CHECKING:
    from core.users.models import User as UserType

logger = logging.getLogger(__name__)

# TCPA compliance: STOP instruction for promotional messages
STOP_FOOTER = '\n\nReply STOP to unsubscribe.'


def add_stop_footer(body: str, is_promotional: bool = True) -> str:
    """Add STOP unsubscribe footer to promotional SMS.

    Args:
        body: Original message body
        is_promotional: Whether this is a promotional message (default True)

    Returns:
        Message with STOP footer appended if promotional
    """
    if is_promotional and STOP_FOOTER not in body:
        return body + STOP_FOOTER
    return body


class SMSService:
    """Service for sending SMS messages with logging."""

    @staticmethod
    def send_sms(
        to_phone: str,
        body: str,
        message_type: str = SMSLog.MessageType.OTHER,
        user: Optional['UserType'] = None,
        related_object_type: str = '',
        related_object_id: int | None = None,
        send_async: bool = True,
        is_promotional: bool = True,
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
            is_promotional: If True, add STOP footer for TCPA compliance (default True)

        Returns:
            SMSLog record
        """
        # Normalize phone number
        normalized_phone = normalize_phone_number(to_phone)

        # Add STOP footer for promotional messages (TCPA compliance)
        final_body = add_stop_footer(body, is_promotional)

        # Create log record
        sms_log = SMSLog.objects.create(
            user=user,
            to_phone=normalized_phone,
            message_type=message_type,
            body=final_body,
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
            result = provider.send(to=normalized_phone, body=final_body)

            if result.success:
                from django.utils import timezone

                sms_log.status = SMSLog.Status.SENT
                sms_log.provider_message_id = result.message_id
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
        user: Optional['UserType'] = None,
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
            is_promotional=True,  # Battle invitations are promotional
        )

    @staticmethod
    def send_battle_result(
        to_phone: str,
        battle_topic: str,
        result_summary: str,
        result_link: str,
        user: Optional['UserType'] = None,
        battle_id: int | None = None,
    ) -> SMSLog:
        """
        Send a battle result notification SMS.

        Args:
            to_phone: Recipient phone number
            battle_topic: Topic of the battle
            result_summary: Brief summary (e.g., "You won!" or "Battle completed")
            result_link: Link to view full results
            user: User receiving the notification
            battle_id: ID of the Battle record

        Returns:
            SMSLog record
        """
        body = f'Battle Update: {battle_topic}\n\n' f'{result_summary}\n\n' f'View results: {result_link}'

        return SMSService.send_sms(
            to_phone=to_phone,
            body=body,
            message_type=SMSLog.MessageType.BATTLE_RESULT,
            user=user,
            related_object_type='Battle',
            related_object_id=battle_id,
            is_promotional=True,
        )

    @staticmethod
    def send_battle_reminder(
        to_phone: str,
        battle_topic: str,
        time_remaining: str,
        battle_link: str,
        user: Optional['UserType'] = None,
        battle_id: int | None = None,
    ) -> SMSLog:
        """
        Send a battle reminder SMS.

        Args:
            to_phone: Recipient phone number
            battle_topic: Topic of the battle
            time_remaining: How much time is left (e.g., "1 hour", "30 minutes")
            battle_link: Link to the battle
            user: User receiving the reminder
            battle_id: ID of the Battle record

        Returns:
            SMSLog record
        """
        body = (
            f'Battle Reminder: {battle_topic}\n\n' f'Time remaining: {time_remaining}\n\n' f'Submit now: {battle_link}'
        )

        return SMSService.send_sms(
            to_phone=to_phone,
            body=body,
            message_type=SMSLog.MessageType.BATTLE_REMINDER,
            user=user,
            related_object_type='Battle',
            related_object_id=battle_id,
            is_promotional=True,
        )

    @staticmethod
    def send_streak_alert(
        to_phone: str,
        streak_count: int,
        action_link: str,
        user: Optional['UserType'] = None,
    ) -> SMSLog:
        """
        Send a streak at risk alert SMS.

        Args:
            to_phone: Recipient phone number
            streak_count: Current streak count
            action_link: Link to maintain streak
            user: User receiving the alert

        Returns:
            SMSLog record
        """
        body = (
            f'Your {streak_count}-day streak is at risk!\n\n'
            f'Complete an activity today to keep it going.\n\n'
            f'Go: {action_link}'
        )

        return SMSService.send_sms(
            to_phone=to_phone,
            body=body,
            message_type=SMSLog.MessageType.STREAK_ALERT,
            user=user,
            is_promotional=True,
        )

    @staticmethod
    def send_phone_verification(
        to_phone: str,
        verification_code: str,
        user: Optional['UserType'] = None,
    ) -> SMSLog:
        """
        Send a phone verification SMS.

        Note: Verification codes are transactional, not promotional,
        so no STOP footer is added.

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
            is_promotional=False,  # Verification codes are transactional
        )

    @staticmethod
    def can_send_to_user(user: 'UserType', category: str = 'battle_invitations') -> bool:
        """
        Check if we can send SMS to a user for a given category.

        Args:
            user: User to check
            category: SMS category (battle_invitations, battle_results, etc.)

        Returns:
            True if SMS can be sent, False otherwise
        """
        # Must have phone number and be verified
        if not user.phone_number or not user.phone_verified:
            return False

        # Master switch must be enabled
        if not user.allow_sms_invitations:
            return False

        # Check category-specific preference if SMSPreferences exists
        try:
            sms_prefs = user.sms_preferences
            if not sms_prefs.has_valid_consent:
                return False
            return sms_prefs.is_category_enabled(category)
        except AttributeError:
            # No SMSPreferences record means default to master switch
            return True
