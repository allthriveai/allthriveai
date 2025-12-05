"""
SMS provider abstraction layer.

Supports multiple SMS providers with a common interface:
- TwilioProvider: Production SMS via Twilio
- ConsoleSMSProvider: Development logging (no actual SMS sent)
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class SMSResult:
    """Result of an SMS send operation."""

    success: bool
    sid: str = ''
    status: str = ''
    error_code: str = ''
    error_message: str = ''


class SMSProvider(ABC):
    """Abstract base class for SMS providers."""

    @abstractmethod
    def send(self, to: str, body: str) -> SMSResult:
        """
        Send an SMS message.

        Args:
            to: Phone number in E.164 format (e.g., +14155551234)
            body: Message body (max 1600 characters for Twilio)

        Returns:
            SMSResult with send status
        """
        pass

    @abstractmethod
    def get_message_status(self, sid: str) -> str:
        """Get the current status of a message by SID."""
        pass


class TwilioProvider(SMSProvider):
    """
    Twilio SMS provider.

    Requires these settings:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_PHONE_NUMBER
    """

    def __init__(self):
        try:
            from twilio.rest import Client

            self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            self.from_number = settings.TWILIO_PHONE_NUMBER
            self._available = True
        except ImportError:
            logger.error('twilio package not installed. Run: pip install twilio')
            self._available = False
        except Exception as e:
            logger.error(f'Failed to initialize Twilio client: {e}')
            self._available = False

    def send(self, to: str, body: str) -> SMSResult:
        """Send SMS via Twilio."""
        if not self._available:
            return SMSResult(
                success=False,
                error_code='PROVIDER_UNAVAILABLE',
                error_message='Twilio client not available',
            )

        try:
            message = self.client.messages.create(body=body, from_=self.from_number, to=to)

            logger.info(f'SMS sent via Twilio: sid={message.sid}, to={to[:6]}***')

            return SMSResult(
                success=True,
                sid=message.sid,
                status=message.status,
            )

        except Exception as e:
            error_code = getattr(e, 'code', 'UNKNOWN')
            error_message = str(e)
            logger.error(f'Twilio SMS failed: {error_code} - {error_message}')

            return SMSResult(
                success=False,
                error_code=str(error_code),
                error_message=error_message,
            )

    def get_message_status(self, sid: str) -> str:
        """Get message status from Twilio."""
        if not self._available:
            return 'unknown'

        try:
            message = self.client.messages(sid).fetch()
            return message.status
        except Exception as e:
            logger.error(f'Failed to fetch message status: {e}')
            return 'unknown'


class ConsoleSMSProvider(SMSProvider):
    """
    Console SMS provider for development.

    Logs SMS messages to console instead of actually sending them.
    Useful for local development without Twilio credentials.
    """

    def __init__(self):
        self._message_counter = 0

    def send(self, to: str, body: str) -> SMSResult:
        """Log SMS to console instead of sending."""
        self._message_counter += 1
        fake_sid = f'CONSOLE_{self._message_counter}'

        logger.info(
            f'\n' f'{"=" * 50}\n' f'[CONSOLE SMS] Would send to: {to}\n' f'{"=" * 50}\n' f'{body}\n' f'{"=" * 50}\n'
        )

        return SMSResult(
            success=True,
            sid=fake_sid,
            status='sent',
        )

    def get_message_status(self, sid: str) -> str:
        """Always return 'delivered' for console provider."""
        return 'delivered'


def get_sms_provider() -> SMSProvider:
    """
    Get the configured SMS provider.

    Returns TwilioProvider if TWILIO_ACCOUNT_SID is configured,
    otherwise returns ConsoleSMSProvider for development.
    """
    twilio_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')

    if twilio_sid and twilio_sid != 'your-twilio-sid-here':
        logger.debug('Using Twilio SMS provider')
        return TwilioProvider()
    else:
        logger.debug('Using Console SMS provider (development mode)')
        return ConsoleSMSProvider()
