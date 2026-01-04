# SMS Notification Implementation Plan

This document outlines the SMS notification system for AllThrive using AWS SNS.

## Current State (January 2026)

### What's Working
- **SMS Infrastructure**: Complete with AWS SNS provider, async Celery tasks, logging
- **Toll-Free Number**: +1 (866) 344-8034 (pending verification)
- **Battle Invitations via SMS**: Fully implemented and production-ready
- **Battle Results via SMS**: Implemented
- **Battle Reminders via SMS**: Implemented
- **Streak Alerts via SMS**: Implemented
- **Phone Number Storage**: User model has `phone_number`, `phone_verified`, `allow_sms_invitations` fields
- **SMS Logging**: Full audit trail via `SMSLog` model
- **SMS Preferences**: `SMSPreferences` model with TCPA consent tracking
- **Frontend UI**: NotificationsSettingsPage with SMS toggles
- **Opt-in Modal**: SmsOptInModal component with useSmsOptIn hook
- **Privacy/Terms**: Updated with SMS disclosure

### AWS Configuration
- **Provider**: AWS SNS (Pinpoint SMS Voice V2)
- **Origination Number**: +18663448034 (toll-free)
- **Registration Status**: Submitted for verification
- **Message Type**: Transactional
- **Monthly Spend Limit**: $1 (request increase via AWS Support)

### What's Pending
- **Toll-Free Verification**: Awaiting AWS approval (1-5 business days)
- **Phone Verification Flow**: Infrastructure exists but needs API endpoint to validate codes

---

## Architecture

### Provider Abstraction

```
core/sms/
├── provider.py      # SMSProvider abstract class + SNSProvider + ConsoleSMSProvider
├── services.py      # SMSService with send methods for each message type
├── tasks.py         # Celery task for async sending
├── models.py        # SMSLog model for audit trail
└── utils.py         # Phone number normalization
```

### SMS Flow

1. Code calls `SMSService.send_*()` method
2. Creates `SMSLog` record with status=PENDING
3. Queues `send_sms_task` via Celery
4. Task calls `SNSProvider.send()`
5. SNS sends via toll-free number
6. Updates `SMSLog` with result

### TCPA Compliance

- All promotional messages include "Reply STOP to unsubscribe" footer
- Consent tracked in `SMSPreferences` model (timestamp, method, IP)
- Phone verification required before sending
- Master switch (`allow_sms_invitations`) + category-specific toggles

---

## Environment Configuration

### Local Development
No configuration needed - uses `ConsoleSMSProvider` which logs to console.

### Production (AWS)
SMS uses the ECS task's IAM role - no secrets needed.

Required IAM permissions:
```json
{
  "Effect": "Allow",
  "Action": [
    "sns:Publish",
    "sms-voice:SendTextMessage"
  ],
  "Resource": "*"
}
```

Optional settings in Django:
```python
AWS_SNS_REGION = 'us-east-1'  # Default
AWS_SNS_MESSAGE_TYPE = 'Transactional'  # or 'Promotional'
AWS_SNS_SENDER_ID = 'AllThrive'  # For countries that support it
```

---

## Message Types

| Type | When Sent | TCPA Category |
|------|-----------|---------------|
| `battle_invitation` | Friend challenges user | Promotional |
| `battle_result` | Battle judging complete | Promotional |
| `battle_reminder` | Battle deadline approaching | Promotional |
| `streak_alert` | Streak at risk | Promotional |
| `phone_verification` | User requests verification | Transactional |

---

## Future Enhancements

### Phase 1: Phone Verification Flow
- Add verification code storage and validation
- Rate limit verification attempts
- Expire codes after 10 minutes

### Phase 2: Additional Message Types
- Direct message notifications (when offline)
- Achievement unlock notifications
- Security alerts (always send)

### Phase 3: Cost Optimization
- Request spend limit increase from AWS
- Implement per-user daily limits
- Cost tracking dashboard

---

## Key Files

| File | Purpose |
|------|---------|
| `core/sms/provider.py` | SNS provider implementation |
| `core/sms/services.py` | High-level SMS service methods |
| `core/sms/tasks.py` | Celery async task |
| `core/sms/models.py` | SMSLog model |
| `core/notifications/models.py` | SMSPreferences with consent tracking |
| `core/notifications/views.py` | SMS opt-in API endpoints |
| `frontend/src/pages/settings/NotificationsSettingsPage.tsx` | SMS settings UI |
| `frontend/src/components/notifications/SmsOptInModal.tsx` | Opt-in modal |
| `frontend/src/hooks/useSmsOptIn.ts` | Opt-in flow hook |

---

## Testing

### Local Testing
```bash
# SMS will be logged to console, not actually sent
make logs-backend
# Look for [CONSOLE SMS] entries
```

### Production Testing
After toll-free verification is approved:
```bash
# Test via Django shell
docker compose exec web python manage.py shell
>>> from core.sms.services import SMSService
>>> SMSService.send_sms('+15551234567', 'Test message', send_async=False)
```

---

## Costs

| Item | Cost |
|------|------|
| Toll-free number lease | $2.00/month |
| SMS to US numbers | ~$0.0075/message |
| Current spend limit | $1.00/month (~133 messages) |

To increase spend limit, open AWS Support case requesting higher SMS budget.
