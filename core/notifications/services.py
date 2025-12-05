"""Centralized email sending service."""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from core.notifications.constants import EmailType
from core.notifications.models import EmailLog, EmailPreferences
from core.notifications.utils import mask_email

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email sending service.

    Handles:
    - Template rendering (HTML + plain text)
    - User preference checking
    - Email logging for debugging/analytics
    - List-Unsubscribe headers for RFC 8058 compliance
    """

    @classmethod
    def send(
        cls,
        email_type: EmailType,
        user,
        subject: str,
        context: dict,
        force: bool = False,
    ) -> EmailLog:
        """Send templated email (HTML + text versions).

        Args:
            email_type: Type of email to send (determines template)
            user: User to send to
            subject: Email subject line
            context: Additional template context
            force: Send even if user has opted out (for transactional emails)

        Returns:
            EmailLog instance with send status

        Raises:
            Exception: If email sending fails (after logging)
        """
        # Create log entry
        log = EmailLog.objects.create(
            user=user,
            email_type=email_type.value,
            subject=subject,
            recipient_email=user.email,
            status=EmailLog.Status.PENDING,
        )

        # Get preferences once (used for checking and unsubscribe URL)
        prefs = cls._get_preferences(user)

        # Check preferences (unless forced for transactional emails)
        if not force:
            if not prefs.is_category_enabled(email_type.category):
                log.status = EmailLog.Status.FAILED
                log.error_message = 'User opted out of this email category'
                log.save(update_fields=['status', 'error_message'])
                logger.info(
                    f'Email {email_type.value} skipped for user_id={user.id} '
                    f'({mask_email(user.email)}) - opted out of {email_type.category}'
                )
                return log

        # Build context with defaults
        full_context = cls._build_context(user, email_type, context, prefs)

        try:
            # Render templates
            html_content = render_to_string(f'{email_type.template_path}.html', full_context)
            text_content = render_to_string(f'{email_type.template_path}.txt', full_context)

            # Create email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, 'text/html')

            # Add List-Unsubscribe header (RFC 8058)
            unsubscribe_url = f'{settings.FRONTEND_URL}/unsubscribe?token={prefs.unsubscribe_token}'
            email.extra_headers = {
                'List-Unsubscribe': f'<{unsubscribe_url}>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }

            # Send and capture message ID
            # django-ses stores the SES message ID in extra_headers after send
            email.send(fail_silently=False)

            # Capture SES message ID if available (django-ses adds it after send)
            ses_message_id = getattr(email, 'extra_headers', {}).get('X-SES-Message-ID', '')
            if not ses_message_id:
                # Alternative: check the message object
                ses_message_id = getattr(email, 'ses_message_id', '')

            log.status = EmailLog.Status.SENT
            log.ses_message_id = ses_message_id
            log.save(update_fields=['status', 'ses_message_id'])
            logger.info(
                f'Email sent: type={email_type.value}, user_id={user.id}, '
                f'email={mask_email(user.email)}, ses_id={ses_message_id}'
            )

        except Exception as e:
            log.status = EmailLog.Status.FAILED
            log.error_message = str(e)[:1000]  # Truncate long error messages
            log.save(update_fields=['status', 'error_message'])
            logger.error(
                f'Email failed: type={email_type.value}, user_id={user.id}, email={mask_email(user.email)}, error={e}'
            )
            raise

        return log

    @classmethod
    def _get_preferences(cls, user) -> EmailPreferences:
        """Get or create email preferences for user.

        Uses prefetched relation if available to avoid extra DB query.

        Args:
            user: User to get preferences for

        Returns:
            EmailPreferences instance
        """
        # Check if preferences were prefetched (via select_related)
        try:
            # This won't hit the DB if already prefetched
            prefs = user.email_preferences
            if prefs is not None:
                return prefs
        except EmailPreferences.DoesNotExist:
            pass

        # Fall back to get_or_create if not prefetched or doesn't exist
        prefs, _ = EmailPreferences.objects.get_or_create(user=user)
        return prefs

    @classmethod
    def _build_context(cls, user, email_type: EmailType, extra_context: dict, prefs: EmailPreferences) -> dict:
        """Build full template context with common variables.

        Args:
            user: User receiving the email
            email_type: Type of email being sent
            extra_context: Additional context from caller
            prefs: User's email preferences (passed to avoid extra DB query)

        Returns:
            Complete context dict for template rendering
        """
        return {
            'user': user,
            'frontend_url': settings.FRONTEND_URL,
            'unsubscribe_url': f'{settings.FRONTEND_URL}/unsubscribe?token={prefs.unsubscribe_token}',
            'settings_url': f'{settings.FRONTEND_URL}/settings/notifications',
            'current_year': timezone.now().year,
            'email_category': email_type.category,
            **extra_context,
        }
