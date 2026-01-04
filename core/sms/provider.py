"""
SMS provider abstraction layer.

Supports multiple SMS providers with a common interface:
- SNSProvider: Production SMS via AWS SNS
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
    message_id: str = ''
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
            body: Message body (max 140 characters per SMS segment)

        Returns:
            SMSResult with send status
        """
        pass


class SNSProvider(SMSProvider):
    """
    AWS SNS SMS provider.

    Requires AWS credentials configured via:
    - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    - IAM role (recommended for EC2/ECS)
    - Or Django settings (AWS_SNS_ACCESS_KEY_ID, AWS_SNS_SECRET_ACCESS_KEY)

    Optional settings:
    - AWS_SNS_REGION: AWS region (default: us-east-1)
    - AWS_SNS_SENDER_ID: Sender ID for countries that support it
    - AWS_SNS_MESSAGE_TYPE: 'Promotional' or 'Transactional' (default: Transactional)
    """

    def __init__(self):
        self._available = False
        self._client_error_class = None
        self._botocore_error_class = None

        try:
            import boto3
            from botocore.config import Config
            from botocore.exceptions import BotoCoreError, ClientError

            # Store exception classes for use in send()
            self._client_error_class = ClientError
            self._botocore_error_class = BotoCoreError

            # Get region from settings
            region = getattr(settings, 'AWS_SNS_REGION', 'us-east-1')

            # Configure retry behavior
            config = Config(
                region_name=region,
                retries={'max_attempts': 3, 'mode': 'adaptive'},
            )

            # Check for explicit credentials in settings
            access_key = getattr(settings, 'AWS_SNS_ACCESS_KEY_ID', None)
            secret_key = getattr(settings, 'AWS_SNS_SECRET_ACCESS_KEY', None)

            if access_key and secret_key:
                self.client = boto3.client(
                    'sns',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    config=config,
                )
            else:
                # Use default credential chain (env vars, IAM role, etc.)
                self.client = boto3.client('sns', config=config)

            self._available = True
            self._sender_id = getattr(settings, 'AWS_SNS_SENDER_ID', None)
            self._message_type = getattr(settings, 'AWS_SNS_MESSAGE_TYPE', 'Transactional')

        except ImportError:
            logger.error('boto3 package not installed. Run: pip install boto3')
        except Exception as e:
            logger.error(f'Failed to initialize AWS SNS client: {e}')

    def send(self, to: str, body: str) -> SMSResult:
        """Send SMS via AWS SNS."""
        if not self._available:
            return SMSResult(
                success=False,
                error_code='PROVIDER_UNAVAILABLE',
                error_message='AWS SNS client not available',
            )

        try:
            # Build message attributes
            message_attributes = {
                'AWS.SNS.SMS.SMSType': {
                    'DataType': 'String',
                    'StringValue': self._message_type,
                }
            }

            # Add sender ID if configured (supported in some countries)
            if self._sender_id:
                message_attributes['AWS.SNS.SMS.SenderID'] = {
                    'DataType': 'String',
                    'StringValue': self._sender_id,
                }

            response = self.client.publish(
                PhoneNumber=to,
                Message=body,
                MessageAttributes=message_attributes,
            )

            message_id = response.get('MessageId', '')
            logger.info(f'SMS sent via AWS SNS: message_id={message_id}, to={to[:6]}***')

            return SMSResult(
                success=True,
                message_id=message_id,
                status='sent',
            )

        except Exception as e:
            # Handle AWS-specific exceptions
            if self._client_error_class and isinstance(e, self._client_error_class):
                error_code = e.response.get('Error', {}).get('Code', 'UNKNOWN')
                error_message = e.response.get('Error', {}).get('Message', str(e))
                logger.error(f'AWS SNS SMS failed: {error_code} - {error_message}')

                return SMSResult(
                    success=False,
                    error_code=error_code,
                    error_message=error_message,
                )

            if self._botocore_error_class and isinstance(e, self._botocore_error_class):
                logger.error(f'AWS SNS SMS failed with BotoCoreError: {e}')

                return SMSResult(
                    success=False,
                    error_code='BOTO_ERROR',
                    error_message=str(e),
                )

            # Unknown error
            logger.error(f'AWS SNS SMS failed with unexpected error: {e}')

            return SMSResult(
                success=False,
                error_code='UNKNOWN',
                error_message=str(e),
            )


class ConsoleSMSProvider(SMSProvider):
    """
    Console SMS provider for development.

    Logs SMS messages to console instead of actually sending them.
    Useful for local development without AWS credentials.
    """

    def __init__(self):
        self._message_counter = 0

    def send(self, to: str, body: str) -> SMSResult:
        """Log SMS to console instead of sending."""
        self._message_counter += 1
        fake_message_id = f'CONSOLE_{self._message_counter}'

        logger.info(f'\n{"=" * 50}\n[CONSOLE SMS] Would send to: {to}\n{"=" * 50}\n{body}\n{"=" * 50}\n')

        return SMSResult(
            success=True,
            message_id=fake_message_id,
            status='sent',
        )


def get_sms_provider() -> SMSProvider:
    """
    Get the configured SMS provider.

    Returns SNSProvider if AWS credentials are configured,
    otherwise returns ConsoleSMSProvider for development.
    """
    # Check for explicit SNS credentials
    sns_access_key = getattr(settings, 'AWS_SNS_ACCESS_KEY_ID', None)

    # Also check for default AWS credentials via environment
    import os

    aws_access_key = os.environ.get('AWS_ACCESS_KEY_ID')

    if sns_access_key or aws_access_key:
        logger.debug('Using AWS SNS SMS provider')
        return SNSProvider()
    else:
        logger.debug('Using Console SMS provider (development mode)')
        return ConsoleSMSProvider()
