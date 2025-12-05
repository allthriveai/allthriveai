# Email Notification System Plan

## Overview

Implement a comprehensive email notification system using **Django templates** (server-side rendered) with **AWS SES** (Simple Email Service). The system will cover billing, welcome, battles, achievements, social, and quest notifications.

**Decision: Django Templates** because:
- Only developers will edit templates → version control is preferred
- Full Python logic available in templates
- Easy to unit test with existing pytest setup

**Decision: AWS SES** (instead of SendGrid) because:
- Cost-effective at scale ($0.10 per 1,000 emails)
- Already using AWS infrastructure
- No vendor lock-in to email-specific provider
- Native boto3 integration

---

## Current State

- **SendGrid SMTP configured** in `config/settings.py:534-545` (to be replaced with SES)
- **Placeholder functions** exist in `core/billing/tasks.py:331-408` (just logging, not sending)
- **No email templates** exist yet
- **Celery** is set up for async task processing

---

## AWS SES Setup

### 1. Install django-ses

Add to `requirements.txt`:
```
django-ses>=3.5.0
```

### 2. Update `config/settings.py`

```python
# AWS SES Configuration
if DEBUG:
    # Development: log emails to console
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    # Production: use AWS SES
    EMAIL_BACKEND = 'django_ses.SESBackend'

AWS_SES_REGION_NAME = config('AWS_SES_REGION', default='us-east-1')
AWS_SES_REGION_ENDPOINT = f'email.{AWS_SES_REGION_NAME}.amazonaws.com'
AWS_SES_ACCESS_KEY_ID = config('AWS_SES_ACCESS_KEY_ID', default='')
AWS_SES_SECRET_ACCESS_KEY = config('AWS_SES_SECRET_ACCESS_KEY', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@allthrive.ai')

# Rate limiting (SES sandbox: 1/sec, production: 14/sec default)
AWS_SES_AUTO_THROTTLE = 0.5  # seconds between emails
```

### 3. Environment Variables

Add to `.env`:
```
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your-access-key
AWS_SES_SECRET_ACCESS_KEY=your-secret-key
DEFAULT_FROM_EMAIL=noreply@allthrive.ai
```

### 4. Verify Domain in AWS SES Console

1. Go to AWS SES Console → Verified Identities
2. Add domain `allthrive.ai`
3. Add DNS records (DKIM, SPF, DMARC)
4. Request production access (to send to non-verified emails)

---

## Architecture

### New Module Structure

```
core/notifications/
├── __init__.py
├── services.py        # EmailService class
├── tasks.py           # Celery tasks
├── preferences.py     # Preference checking
├── constants.py       # EmailType enum
├── models.py          # EmailLog model
├── views.py           # Unsubscribe endpoint
├── urls.py            # URL routing
└── tests/
    ├── __init__.py
    ├── test_services.py
    └── test_tasks.py
```

### Template Structure

```
templates/emails/
├── base.html              # Base template (header, footer, branding)
├── base.txt               # Plain text base
├── billing/
│   ├── low_balance.html/.txt
│   └── quota_warning.html/.txt
├── welcome/
│   └── registration.html/.txt
├── battles/
│   ├── invitation.html/.txt
│   └── results.html/.txt
├── achievements/
│   └── unlocked.html/.txt
├── social/
│   ├── new_follower.html/.txt
│   └── project_comment.html/.txt
└── quests/
    ├── assigned.html/.txt
    └── streak_reminder.html/.txt
```

---

## Core Components

### 1. EmailType Enum (`core/notifications/constants.py`)

```python
from enum import Enum

class EmailType(Enum):
    BILLING_LOW_BALANCE = "billing/low_balance"
    BILLING_QUOTA_WARNING = "billing/quota_warning"
    WELCOME_REGISTRATION = "welcome/registration"
    BATTLE_INVITATION = "battles/invitation"
    BATTLE_RESULTS = "battles/results"
    ACHIEVEMENT_UNLOCKED = "achievements/unlocked"
    SOCIAL_NEW_FOLLOWER = "social/new_follower"
    SOCIAL_PROJECT_COMMENT = "social/project_comment"
    QUEST_ASSIGNED = "quests/assigned"
    QUEST_STREAK_REMINDER = "quests/streak_reminder"

    @property
    def category(self) -> str:
        """Get preference category for this email type."""
        return self.value.split('/')[0]
```

### 2. EmailLog Model (`core/notifications/models.py`)

```python
class EmailLog(models.Model):
    """Track all sent emails for debugging and analytics."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
        BOUNCED = 'bounced', 'Bounced'
        COMPLAINED = 'complained', 'Complained'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_logs'
    )
    email_type = models.CharField(max_length=50)
    subject = models.CharField(max_length=200)
    recipient_email = models.EmailField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error_message = models.TextField(blank=True)
    ses_message_id = models.CharField(max_length=100, blank=True)  # For tracking bounces
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['ses_message_id']),
        ]
```

### 3. EmailPreferences Model (`core/notifications/models.py`)

```python
import secrets

class EmailPreferences(models.Model):
    """User email notification preferences."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_preferences'
    )

    # Category preferences
    email_billing = models.BooleanField(default=True)
    email_battles = models.BooleanField(default=True)
    email_achievements = models.BooleanField(default=True)
    email_social = models.BooleanField(default=True)
    email_quests = models.BooleanField(default=True)
    email_marketing = models.BooleanField(default=False)  # Opt-in only

    # Secure unsubscribe token
    unsubscribe_token = models.CharField(max_length=64, unique=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.unsubscribe_token:
            self.unsubscribe_token = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def is_category_enabled(self, category: str) -> bool:
        """Check if a category is enabled."""
        field_name = f'email_{category}'
        return getattr(self, field_name, True)
```

### 4. EmailService (`core/notifications/services.py`)

```python
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from core.notifications.constants import EmailType
from core.notifications.models import EmailLog, EmailPreferences

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email sending service."""

    @classmethod
    def send(
        cls,
        email_type: EmailType,
        user,
        subject: str,
        context: dict,
        force: bool = False,
    ) -> EmailLog:
        """
        Send templated email (HTML + text versions).

        Args:
            email_type: Type of email to send
            user: User to send to
            subject: Email subject line
            context: Template context
            force: Send even if user has opted out (for transactional)

        Returns:
            EmailLog instance with send status
        """
        # Create log entry
        log = EmailLog.objects.create(
            user=user,
            email_type=email_type.value,
            subject=subject,
            recipient_email=user.email,
            status=EmailLog.Status.PENDING,
        )

        # Check preferences (unless forced)
        if not force:
            prefs = cls._get_preferences(user)
            if not prefs.is_category_enabled(email_type.category):
                log.status = EmailLog.Status.FAILED
                log.error_message = 'User opted out'
                log.save()
                logger.info(f'Email {email_type.value} skipped for user {user.id} (opted out)')
                return log

        # Build context with defaults
        full_context = cls._build_context(user, email_type, context)

        try:
            # Render templates
            html_content = render_to_string(f'emails/{email_type.value}.html', full_context)
            text_content = render_to_string(f'emails/{email_type.value}.txt', full_context)

            # Send email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, 'text/html')

            # Add List-Unsubscribe header (RFC 8058)
            prefs = cls._get_preferences(user)
            unsubscribe_url = f'{settings.FRONTEND_URL}/unsubscribe?token={prefs.unsubscribe_token}'
            email.extra_headers = {
                'List-Unsubscribe': f'<{unsubscribe_url}>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }

            email.send(fail_silently=False)

            log.status = EmailLog.Status.SENT
            log.save()
            logger.info(f'Email sent: type={email_type.value}, user={user.id}')

        except Exception as e:
            log.status = EmailLog.Status.FAILED
            log.error_message = str(e)
            log.save()
            logger.error(f'Email failed: type={email_type.value}, user={user.id}, error={e}')
            raise

        return log

    @classmethod
    def _get_preferences(cls, user) -> EmailPreferences:
        """Get or create email preferences for user."""
        prefs, _ = EmailPreferences.objects.get_or_create(user=user)
        return prefs

    @classmethod
    def _build_context(cls, user, email_type: EmailType, extra_context: dict) -> dict:
        """Build full template context."""
        prefs = cls._get_preferences(user)
        return {
            'user': user,
            'frontend_url': settings.FRONTEND_URL,
            'unsubscribe_url': f'{settings.FRONTEND_URL}/unsubscribe?token={prefs.unsubscribe_token}',
            'current_year': timezone.now().year,
            **extra_context,
        }
```

### 5. Celery Tasks (`core/notifications/tasks.py`)

```python
import logging
from celery import shared_task
from core.billing.tasks import get_exponential_backoff  # Reuse existing

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_email_task(self, user_id: int, email_type: str, subject: str, context: dict, force: bool = False):
    """
    Send email asynchronously with retry logic.

    Uses exponential backoff from billing tasks.
    """
    from django.contrib.auth import get_user_model
    from core.notifications.constants import EmailType
    from core.notifications.services import EmailService

    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
        email_type_enum = EmailType(email_type)

        EmailService.send(
            email_type=email_type_enum,
            user=user,
            subject=subject,
            context=context,
            force=force,
        )

        return {'success': True, 'user_id': user_id, 'email_type': email_type}

    except User.DoesNotExist:
        logger.warning(f'User {user_id} not found for email')
        return {'success': False, 'error': 'user_not_found'}

    except Exception as e:
        logger.error(f'Email task failed: {e}', exc_info=True)
        countdown = get_exponential_backoff(self.request.retries)
        raise self.retry(exc=e, countdown=countdown) from e
```

### 6. Unsubscribe Endpoint (`core/notifications/views.py`)

```python
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from core.notifications.models import EmailPreferences


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def unsubscribe(request):
    """
    Handle email unsubscribe requests.

    GET: Show unsubscribe page (frontend handles this)
    POST: Process one-click unsubscribe (RFC 8058)
    """
    token = request.GET.get('token') or request.POST.get('token')
    category = request.GET.get('category')  # Optional: unsubscribe from specific category

    if not token:
        return JsonResponse({'error': 'Missing token'}, status=400)

    try:
        prefs = EmailPreferences.objects.get(unsubscribe_token=token)
    except EmailPreferences.DoesNotExist:
        return JsonResponse({'error': 'Invalid token'}, status=404)

    if request.method == 'POST':
        # One-click unsubscribe
        if category:
            field_name = f'email_{category}'
            if hasattr(prefs, field_name):
                setattr(prefs, field_name, False)
                prefs.save()
        else:
            # Unsubscribe from all non-transactional
            prefs.email_battles = False
            prefs.email_achievements = False
            prefs.email_social = False
            prefs.email_quests = False
            prefs.email_marketing = False
            prefs.save()

        return JsonResponse({'success': True})

    # GET: Return current preferences (frontend renders UI)
    return JsonResponse({
        'email_billing': prefs.email_billing,
        'email_battles': prefs.email_battles,
        'email_achievements': prefs.email_achievements,
        'email_social': prefs.email_social,
        'email_quests': prefs.email_quests,
        'email_marketing': prefs.email_marketing,
    })
```

### 7. URL Configuration (`core/notifications/urls.py`)

```python
from django.urls import path
from core.notifications import views

urlpatterns = [
    path('unsubscribe/', views.unsubscribe, name='email_unsubscribe'),
]
```

---

## Notification Types

| Category | Trigger | Template | Force Send |
|----------|---------|----------|------------|
| **Billing** | Token balance < threshold | `billing/low_balance` | Yes (transactional) |
| **Billing** | Quota > 80% | `billing/quota_warning` | Yes (transactional) |
| **Welcome** | User registration | `welcome/registration` | Yes (transactional) |
| **Battles** | Invitation received | `battles/invitation` | No |
| **Battles** | Battle completed | `battles/results` | No |
| **Achievements** | Achievement unlocked | `achievements/unlocked` | No |
| **Social** | New follower | `social/new_follower` | No |
| **Social** | Comment on project | `social/project_comment` | No |
| **Quests** | Quest assigned | `quests/assigned` | No |
| **Quests** | Streak at risk | `quests/streak_reminder` | No |

---

## Integration Points

### 1. Update `core/billing/tasks.py`

Replace placeholder functions (lines 331-408):

```python
def send_low_balance_notification(user, balance, alert_level, quota_exceeded, subject):
    from core.notifications.tasks import send_email_task
    send_email_task.delay(
        user_id=user.id,
        email_type='billing/low_balance',
        subject=subject,
        context={
            'balance': balance,
            'alert_level': alert_level,
            'quota_exceeded': quota_exceeded,
            'purchase_url': f'{settings.FRONTEND_URL}/settings/billing',
        },
        force=True,  # Transactional - always send
    )
```

### 2. Add to `config/settings.py`

```python
INSTALLED_APPS = [
    # ... existing apps ...
    'core.notifications',  # Add after core.billing
]
```

### 3. Add to `config/celery.py`

```python
app.autodiscover_tasks(['core.notifications'])
```

### 4. Add to `core/urls.py`

```python
urlpatterns = [
    # ... existing urls ...
    path('api/v1/notifications/', include('core.notifications.urls')),
]
```

### 5. Create EmailPreferences on User Creation

In `core/users/signals.py`:

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from core.notifications.models import EmailPreferences


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_email_preferences(sender, instance, created, **kwargs):
    if created:
        EmailPreferences.objects.create(user=instance)
```

---

## Base Template Design

Use **Neon Glass** design system colors to match frontend:
- Background: `#0f172a` (slate-900)
- Card: `rgba(30, 41, 59, 0.8)` (glass effect)
- Primary accent: `#22d3ee` (cyan-400)
- Secondary accent: `#a855f7` (purple-500)

---

## Testing Strategy

### Development
- `EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'` (already configured for DEBUG)
- Emails print to console instead of sending

### Staging
- Use SES sandbox mode (can only send to verified emails)
- Verify test email addresses in SES console

### Production
- Request SES production access
- Monitor bounce/complaint rates in AWS console

### Unit Tests

```python
# core/notifications/tests/test_services.py
from unittest.mock import patch
from django.test import TestCase, override_settings

class EmailServiceTestCase(TestCase):
    def test_send_email_success(self):
        ...

    def test_respects_user_preferences(self):
        ...

    def test_force_bypasses_preferences(self):
        ...

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_email_content_rendered(self):
        ...
```

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `requirements.txt` | Add `django-ses>=3.5.0` |
| `core/notifications/__init__.py` | Create |
| `core/notifications/models.py` | Create (EmailLog, EmailPreferences) |
| `core/notifications/services.py` | Create |
| `core/notifications/tasks.py` | Create |
| `core/notifications/constants.py` | Create |
| `core/notifications/views.py` | Create (unsubscribe endpoint) |
| `core/notifications/urls.py` | Create |
| `core/notifications/admin.py` | Create |
| `core/users/signals.py` | Add EmailPreferences creation |
| `core/billing/tasks.py` | Update placeholder functions |
| `config/celery.py` | Add autodiscover |
| `config/settings.py` | Update EMAIL_BACKEND, add to INSTALLED_APPS |
| `core/urls.py` | Add notifications URLs |
| `templates/emails/*.html` | Create all templates |

---

## Implementation Order

1. **Foundation** - Create `core/notifications` module, models, run migrations
2. **Service** - EmailService with logging and preference checking
3. **Tasks** - Celery tasks with retry logic
4. **Unsubscribe** - Endpoint and URL routing
5. **Templates** - Base template, then billing templates
6. **Billing Integration** - Wire up existing billing task placeholders
7. **Signal** - Create EmailPreferences on user registration
8. **Remaining Emails** - Welcome, battles, achievements, social, quests
9. **Testing** - Unit tests for all components
10. **AWS Setup** - Verify domain, request production access

---

## Scalability Strategy (100K+ Users)

### Current Architecture (MVP)
- Single Celery queue for all emails
- Synchronous preference checks per email
- EmailLog in PostgreSQL

### Phase 1: Foundation (Now)
Build with scalability in mind:

```python
# Use select_related to avoid N+1 queries
user = User.objects.select_related('email_preferences').get(id=user_id)

# Batch preference creation for existing users (migration)
EmailPreferences.objects.bulk_create([
    EmailPreferences(user_id=uid) for uid in user_ids_without_prefs
], ignore_conflicts=True)
```

### Phase 2: Queue Separation (10K+ users)
Split email types into priority queues:

```python
# config/celery.py
app.conf.task_routes = {
    'core.notifications.tasks.send_transactional_email': {'queue': 'email_high'},
    'core.notifications.tasks.send_marketing_email': {'queue': 'email_low'},
    'core.notifications.tasks.send_batch_email': {'queue': 'email_batch'},
}

# Run separate workers
# celery -A config worker -Q email_high --concurrency=4
# celery -A config worker -Q email_low --concurrency=2
# celery -A config worker -Q email_batch --concurrency=1
```

### Phase 3: Batch Processing (50K+ users)
For mass notifications (e.g., streak reminders to all users):

```python
@shared_task
def send_streak_reminders_batch():
    """Send streak reminders in batches of 100."""
    from django.db.models import F

    # Get users at risk of losing streak (haven't logged in today)
    users = User.objects.filter(
        email_preferences__email_quests=True,
        last_login__lt=timezone.now() - timedelta(hours=20),
        streak_count__gte=3,  # Only if they have a streak worth saving
    ).values_list('id', flat=True)

    # Chunk into batches
    batch_size = 100
    for i in range(0, len(users), batch_size):
        batch = users[i:i + batch_size]
        send_streak_reminder_batch.delay(list(batch))

@shared_task(rate_limit='10/s')  # SES rate limit
def send_streak_reminder_batch(user_ids: list[int]):
    """Send to a batch of users."""
    users = User.objects.filter(id__in=user_ids).select_related('email_preferences')
    for user in users:
        # Send individually (for personalization + logging)
        send_email_task.delay(user.id, 'quests/streak_reminder', ...)
```

### Phase 4: Infrastructure (100K+ users)

**SES Configuration:**
```python
# Request SES sending limit increase (default 50K/day)
# Set up dedicated IP for sender reputation
# Enable Configuration Sets for detailed tracking

AWS_SES_CONFIGURATION_SET = 'allthrive-production'
```

**Database Optimization:**
```python
# EmailLog table will grow fast - add partitioning or archival
class EmailLog(models.Model):
    # ... existing fields ...

    class Meta:
        indexes = [
            models.Index(fields=['created_at']),  # For cleanup jobs
        ]

# Celery beat task to archive old logs
@shared_task
def archive_old_email_logs():
    """Move logs older than 90 days to cold storage."""
    cutoff = timezone.now() - timedelta(days=90)
    old_logs = EmailLog.objects.filter(created_at__lt=cutoff)
    # Export to S3 or delete
    old_logs.delete()
```

**Redis for Rate Limiting:**
```python
# Prevent duplicate emails (user clicks button twice)
from django.core.cache import cache

def send_email_with_dedup(user_id, email_type, ...):
    cache_key = f'email:{user_id}:{email_type}'
    if cache.get(cache_key):
        return  # Already sent recently

    cache.set(cache_key, True, timeout=300)  # 5 min dedup window
    send_email_task.delay(...)
```

### Scaling Checklist

| Users | Action Required |
|-------|-----------------|
| 1K | MVP implementation ✓ |
| 10K | Add queue separation, monitor SES limits |
| 25K | Request SES limit increase, add batch processing |
| 50K | Add dedicated IP, implement log archival |
| 100K | Consider SES Configuration Sets, add Redis dedup |

### Cost Estimates (AWS SES)

| Monthly Emails | Cost |
|---------------|------|
| 10,000 | $1 |
| 100,000 | $10 |
| 1,000,000 | $100 |

*Plus $0/month for first 62K emails if sent from EC2*

---

## Future Enhancements (Out of Scope)

- SNS webhook for bounce/complaint handling
- Email analytics dashboard
- A/B testing for subject lines
- Digest emails (daily/weekly summary)
