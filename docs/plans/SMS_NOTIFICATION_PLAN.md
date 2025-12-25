# SMS Notification Implementation Plan

This document outlines where SMS notifications should be added throughout AllThrive once Twilio is fully configured and working.

## Current State

### What's Working
- **SMS Infrastructure**: Complete with Twilio provider, async Celery tasks, logging
- **Battle Invitations via SMS**: Fully implemented and production-ready
- **Phone Number Storage**: User model has `phone_number`, `phone_verified`, `allow_sms_invitations` fields
- **SMS Logging**: Full audit trail via `SMSLog` model

### What's Missing
- **Phone Verification Flow**: Infrastructure exists but no API endpoint to validate codes
- **User Preferences**: Only `allow_sms_invitations` exists - need per-category SMS preferences
- **Other SMS Notification Types**: Only battle invitations implemented

---

## Phase 1: Phone Verification (Prerequisites)

Before expanding SMS notifications, complete the phone verification flow:

### Backend Changes

**File: `core/users/views.py`** (new endpoints)
```python
POST /api/users/phone/request-verification/
  - Input: { phone_number: string }
  - Generates 6-digit code, stores with 10-min expiry
  - Calls SMSService.send_phone_verification()

POST /api/users/phone/verify/
  - Input: { code: string }
  - Validates code against stored value
  - Sets user.phone_verified = True, phone_verified_at = now()
```

**File: `core/users/models.py`** (add field)
```python
phone_verification_code = models.CharField(max_length=6, blank=True)
phone_verification_expires = models.DateTimeField(null=True, blank=True)
```

### Frontend Changes

**File: `frontend/src/pages/settings/NotificationsSettingsPage.tsx`**
- Add "Verify" button next to phone number input
- Show verification code input modal
- Update verification badge based on response

---

## Phase 2: Expand SMS Preferences

### New User Preference Fields

**File: `core/users/models.py`**
```python
# Per-category SMS opt-in (all default True)
allow_sms_dm_notifications = models.BooleanField(default=True)
allow_sms_battle_results = models.BooleanField(default=True)
allow_sms_achievement_unlocks = models.BooleanField(default=True)
allow_sms_challenge_reminders = models.BooleanField(default=True)
allow_sms_security_alerts = models.BooleanField(default=True)  # Always sent regardless
```

### New SMS Message Types

**File: `core/sms/models.py`**
```python
class MessageType(models.TextChoices):
    BATTLE_INVITATION = 'battle_invitation', 'Battle Invitation'
    PHONE_VERIFICATION = 'phone_verification', 'Phone Verification'
    # New types:
    DIRECT_MESSAGE = 'direct_message', 'Direct Message'
    BATTLE_RESULT = 'battle_result', 'Battle Result'
    ACHIEVEMENT_UNLOCK = 'achievement_unlock', 'Achievement Unlock'
    CHALLENGE_REMINDER = 'challenge_reminder', 'Challenge Reminder'
    SECURITY_ALERT = 'security_alert', 'Security Alert'
    OTHER = 'other', 'Other'
```

---

## Phase 3: SMS Notification Touchpoints

### Priority 1: Direct Messages (High Impact)

**When to Send**: New DM received while user is offline (no active WebSocket)

**Files to Modify**:
- `core/community/consumers.py` - Track online status
- `core/community/tasks.py` (new) - Async SMS task
- `core/sms/services.py` - Add `send_dm_notification()`

**Implementation**:
```python
# core/sms/services.py
@staticmethod
def send_dm_notification(
    to_phone: str,
    sender_name: str,
    message_preview: str,
    thread_url: str,
    user=None,
    thread_id=None
) -> SMSLog:
    """Send DM notification SMS."""
    # Truncate message to 50 chars
    preview = message_preview[:50] + '...' if len(message_preview) > 50 else message_preview
    body = f"{sender_name} sent you a message: \"{preview}\"\n\nReply: {thread_url}"
    return SMSService.send_sms(
        to_phone=to_phone,
        body=body,
        message_type=SMSLog.MessageType.DIRECT_MESSAGE,
        user=user,
        related_object_type='DirectMessageThread',
        related_object_id=thread_id,
    )
```

**Logic**:
1. When DM created via WebSocket consumer
2. Check if recipient has active WebSocket connection (Redis presence)
3. If offline AND `allow_sms_dm_notifications=True` AND `phone_verified=True`
4. Debounce: Don't send if SMS sent for same thread in last 5 minutes
5. Queue SMS via Celery

### Priority 2: Battle Results

**When to Send**: Battle judging complete

**Files to Modify**:
- `core/battles/tasks.py` - In `judge_battle_task()`
- `core/sms/services.py` - Add `send_battle_result()`

**Implementation**:
```python
# core/sms/services.py
@staticmethod
def send_battle_result(
    to_phone: str,
    outcome: str,  # 'won', 'lost', 'tie'
    opponent_name: str,
    battle_topic: str,
    battle_url: str,
    user=None,
    battle_id=None
) -> SMSLog:
    """Send battle result SMS."""
    outcomes = {
        'won': f"You WON your battle against {opponent_name}!",
        'lost': f"You lost your battle against {opponent_name}.",
        'tie': f"Your battle against {opponent_name} was a tie!",
    }
    body = f"{outcomes[outcome]}\n\nTopic: {battle_topic}\nView results: {battle_url}"
    return SMSService.send_sms(
        to_phone=to_phone,
        body=body,
        message_type=SMSLog.MessageType.BATTLE_RESULT,
        user=user,
        related_object_type='PromptBattle',
        related_object_id=battle_id,
    )
```

**Add to `judge_battle_task()`** after judging completes:
```python
# Send SMS notifications if enabled
for participant in [battle.challenger, battle.opponent]:
    if (participant.phone_verified and
        participant.allow_sms_battle_results and
        participant.phone_number):
        outcome = 'won' if participant == winner else ('tie' if tie else 'lost')
        SMSService.send_battle_result(
            to_phone=participant.phone_number,
            outcome=outcome,
            opponent_name=opponent.username,
            battle_topic=battle.prompt_text[:50],
            battle_url=f"{settings.FRONTEND_URL}/battles/{battle.id}",
            user=participant,
            battle_id=battle.id
        )
```

### Priority 3: Achievement Unlocks

**When to Send**: Achievement unlocked

**Files to Modify**:
- `services/gamification/achievements/service.py` - In `unlock_achievement()`
- `core/sms/services.py` - Add `send_achievement_unlock()`

**Implementation**:
```python
# core/sms/services.py
@staticmethod
def send_achievement_unlock(
    to_phone: str,
    achievement_name: str,
    points_earned: int,
    user=None,
    achievement_id=None
) -> SMSLog:
    """Send achievement unlock SMS."""
    body = f"Achievement Unlocked: {achievement_name}! +{points_earned} points\n\nView all achievements: {settings.FRONTEND_URL}/achievements"
    return SMSService.send_sms(
        to_phone=to_phone,
        body=body,
        message_type=SMSLog.MessageType.ACHIEVEMENT_UNLOCK,
        user=user,
        related_object_type='UserAchievement',
        related_object_id=achievement_id,
    )
```

### Priority 4: Challenge/Deadline Reminders

**When to Send**: 24 hours and 1 hour before challenge deadline

**Files to Modify**:
- `core/challenges/tasks.py` - In `send_deadline_reminders()`
- `core/sms/services.py` - Add `send_challenge_reminder()`

**Implementation**:
```python
# core/sms/services.py
@staticmethod
def send_challenge_reminder(
    to_phone: str,
    challenge_title: str,
    time_remaining: str,  # "24 hours" or "1 hour"
    challenge_url: str,
    user=None,
    challenge_id=None
) -> SMSLog:
    """Send challenge deadline reminder SMS."""
    body = f"Reminder: {time_remaining} left to complete \"{challenge_title}\"\n\nSubmit now: {challenge_url}"
    return SMSService.send_sms(
        to_phone=to_phone,
        body=body,
        message_type=SMSLog.MessageType.CHALLENGE_REMINDER,
        user=user,
        related_object_type='Challenge',
        related_object_id=challenge_id,
    )
```

### Priority 5: Security Alerts (Always Send)

**When to Send**: Password changed, email changed, suspicious login

**Files to Modify**:
- `core/auth/views.py` or signal handlers
- `core/sms/services.py` - Add `send_security_alert()`

**Implementation**:
```python
# core/sms/services.py
@staticmethod
def send_security_alert(
    to_phone: str,
    alert_type: str,  # 'password_changed', 'email_changed', 'new_login'
    details: str,
    user=None
) -> SMSLog:
    """Send security alert SMS. Always sent regardless of preferences."""
    alerts = {
        'password_changed': "Your AllThrive password was changed.",
        'email_changed': "Your AllThrive email was changed.",
        'new_login': f"New login to your AllThrive account from {details}.",
    }
    body = f"Security Alert: {alerts[alert_type]}\n\nIf this wasn't you, secure your account immediately."
    return SMSService.send_sms(
        to_phone=to_phone,
        body=body,
        message_type=SMSLog.MessageType.SECURITY_ALERT,
        user=user,
    )
```

---

## Phase 4: Frontend Updates

### Notifications Settings Page

**File: `frontend/src/pages/settings/NotificationsSettingsPage.tsx`**

Add SMS toggles for each category:

```typescript
// New SMS preferences section
<SettingsSection title="SMS Notifications" description="Receive text messages for important updates">
  <NotificationToggle
    label="Direct Messages"
    description="Get notified when you receive a new message"
    enabled={prefs.allowSmsDmNotifications}
    onChange={(v) => updatePrefs({ allowSmsDmNotifications: v })}
    disabled={!prefs.phoneVerified}
  />
  <NotificationToggle
    label="Battle Results"
    description="Get notified when a battle is judged"
    enabled={prefs.allowSmsBattleResults}
    onChange={(v) => updatePrefs({ allowSmsBattleResults: v })}
    disabled={!prefs.phoneVerified}
  />
  <NotificationToggle
    label="Achievements"
    description="Get notified when you unlock achievements"
    enabled={prefs.allowSmsAchievementUnlocks}
    onChange={(v) => updatePrefs({ allowSmsAchievementUnlocks: v })}
    disabled={!prefs.phoneVerified}
  />
  <NotificationToggle
    label="Challenge Reminders"
    description="Get reminded before challenge deadlines"
    enabled={prefs.allowSmsChallengeReminders}
    onChange={(v) => updatePrefs({ allowSmsChallengeReminders: v })}
    disabled={!prefs.phoneVerified}
  />
  <div className="text-sm text-slate-400 mt-4">
    Security alerts are always sent to verified phone numbers.
  </div>
</SettingsSection>
```

---

## Phase 5: Rate Limiting & Cost Control

### SMS Rate Limits

**File: `core/sms/services.py`**

Add rate limiting to prevent SMS abuse:

```python
from django.core.cache import cache

MAX_SMS_PER_USER_PER_HOUR = 10
MAX_SMS_PER_USER_PER_DAY = 30

@staticmethod
def _check_rate_limit(user_id: int) -> bool:
    """Check if user has exceeded SMS rate limits."""
    hour_key = f"sms_rate_hour:{user_id}"
    day_key = f"sms_rate_day:{user_id}"

    hour_count = cache.get(hour_key, 0)
    day_count = cache.get(day_key, 0)

    if hour_count >= MAX_SMS_PER_USER_PER_HOUR:
        return False
    if day_count >= MAX_SMS_PER_USER_PER_DAY:
        return False

    # Increment counters
    cache.set(hour_key, hour_count + 1, timeout=3600)
    cache.set(day_key, day_count + 1, timeout=86400)
    return True
```

### Cost Tracking

The `SMSLog.cost_cents` field already exists. Consider:
- Daily cost report task
- Per-user cost tracking
- Cost alerts when thresholds exceeded

---

## Implementation Order

| Phase | Feature | Priority | Effort |
|-------|---------|----------|--------|
| 1 | Phone Verification Flow | Critical | Medium |
| 2 | SMS Preference Fields | High | Low |
| 3a | DM Notifications | High | Medium |
| 3b | Battle Results | High | Low |
| 3c | Achievement Unlocks | Medium | Low |
| 3d | Challenge Reminders | Medium | Low |
| 3e | Security Alerts | High | Low |
| 4 | Frontend Settings UI | High | Medium |
| 5 | Rate Limiting | Medium | Low |

---

## Key Files Summary

| File | Changes |
|------|---------|
| `core/users/models.py` | Add SMS preference fields, verification fields |
| `core/users/views.py` | Add phone verification endpoints |
| `core/sms/models.py` | Add new MessageType choices |
| `core/sms/services.py` | Add service methods for each SMS type |
| `core/community/tasks.py` | DM notification task (new file) |
| `core/battles/tasks.py` | Add battle result SMS |
| `services/gamification/achievements/service.py` | Add achievement SMS |
| `core/challenges/tasks.py` | Add challenge reminder SMS |
| `core/notifications/views.py` | Expose new SMS preferences via API |
| `frontend/src/services/notifications.ts` | Add SMS preference types |
| `frontend/src/pages/settings/NotificationsSettingsPage.tsx` | Add SMS toggles |

---

## Environment Variables Required

```bash
# Twilio Configuration (add to .env.example)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+14155551234
```

---

## Testing Checklist

- [ ] Phone verification flow works end-to-end
- [ ] SMS preferences persist correctly
- [ ] Each SMS type sends with correct content
- [ ] Rate limiting prevents abuse
- [ ] Users without verified phones don't receive SMS
- [ ] Users who opt-out don't receive SMS (except security)
- [ ] Security alerts always send regardless of preferences
- [ ] SMS costs are tracked in SMSLog
- [ ] ConsoleSMSProvider works for local development
