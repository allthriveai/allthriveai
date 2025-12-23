# Community Messaging for AllThrive AI

## Executive Summary

Build a community messaging system for human-to-human communication, separate from Ember AI chat. Three core features:

1. **Forums (The Lounge)** - User-created topic-based discussion rooms, starting with a General forum
2. **Direct Messages** - 1:1 and group messaging between users
3. **Thrive Circle Chat** - Built-in messaging for weekly cohorts

Target: 100K users with hybrid AI/human moderation. Leverages existing Django Channels infrastructure and ThriveCircle model.

---

## Relationship to Ember AI Chat

The community messaging system is **separate from Ember AI chat**:

| System | Purpose | Participants | Infrastructure |
|--------|---------|--------------|----------------|
| **Ember Chat** | AI assistant for help, projects, learning | User ↔ AI | Celery for LLM processing |
| **Community Chat** | Human-to-human communication | User ↔ User(s) | Direct consumer (no Celery) |

See `/docs/evergreen-architecture/05-UNIFIED-CHAT-ARCHITECTURE.md` for Ember details.

---

## Third-Party Services

| Service | Purpose | Notes |
|---------|---------|-------|
| **Redis** | Real-time messaging, presence, rate limiting | Existing (DB 3) |
| **PostgreSQL** | Message storage, full-text search | Existing |
| **MinIO** | File/image attachments | Existing |
| **OpenAI API** | Content moderation | Existing (free endpoint) |
| **AWS SES** | Email notifications (digests, mentions) | Existing |
| **Celery** | Async notifications (NOT message processing) | Existing |
| **Firebase FCM** | Browser & mobile push notifications | **NEW** - free tier |

### Firebase Cloud Messaging Setup

```
Push Notification Flow:
1. User opts in to push notifications in browser/app
2. Frontend requests FCM token, sends to backend
3. Backend stores FCM token per user device
4. On new message/mention → Celery task → FCM API → Push to device
```

**When to send push notifications:**
- Direct messages (always, if enabled)
- @mentions in rooms
- Replies to your threads

**NOT for:**
- Every message in a room (too noisy)
- Typing indicators
- Presence changes

---

## Navigation & Naming

**Replace "MEMBERSHIP" with "COMMUNITY"** in top navigation:

```
COMMUNITY (nav dropdown)
├── The Lounge      → /lounge         (forums - start with General)
├── Thrive Circle   → /thrive-circle  (with built-in chat)
└── Messages        → /messages       (DMs)
```

**Key naming decisions:**
- **The Lounge** = forums for topic discussions (user-created after trust threshold)
- **Thrive Circle** = kept as-is with added chat functionality
- **Forums** = topic rooms within The Lounge
- **Rooms** = individual chat spaces (forum, circle, or DM)

---

## Architecture

### Community Structure

| Layer | Name | Description | Creation |
|-------|------|-------------|----------|
| 1 | Forums | Topic-based public/private rooms | Trust-gated (users) or admin |
| 2 | Thrive Circle | Weekly cohort chat rooms | Auto-created with circle |
| 3 | DMs | 1:1 or group direct messages | Any user |

### Forum Creation (Trust-Gated)

Users can create forums after reaching trust threshold:
- **Minimum requirements**: 10 messages sent, 7 days active on platform
- **Daily limit**: 3 forum creates per day
- **Visibility options**: `public` | `private` | `unlisted`

Admin-created forums (like "General") have no trust requirement to join.

### Message Flow (No Celery for Messages)

```
User sends message
    ↓
WebSocket Consumer receives
    ↓
[Async] AI Moderation (OpenAI Moderation API)
    ↓ (if passed)
[Sync] Save to PostgreSQL
    ↓
[Sync] Broadcast via Redis Pub/Sub
    ↓
Channel Layer delivers to connected clients
    ↓
[Async] Celery: mentions, notifications only (NOT message processing)
```

**Key difference from Ember**: Community messages are handled directly in the consumer without Celery queuing.

---

## Data Models

### Core Models (new `core/community` app)

```python
# Room - A forum, circle chat, or DM thread
- id (UUID), name, slug, description, emoji
- room_type: 'forum' | 'circle' | 'dm'
- visibility: 'public' | 'private' | 'unlisted'
- creator (FK User, nullable for system-created)
- circle (FK ThriveCircle, nullable)
- auto_thread (bool), position, is_default
- slow_mode_seconds, last_message_at, online_count
- min_trust_to_join (int, default 0)

# Thread - Attached to room or message
- id (UUID), room (FK), parent_message (FK Message)
- title, creator (FK User)
- is_locked, is_pinned, is_resolved
- message_count, last_message_at
- auto_archive_after_hours

# Message - In room or thread
- id (UUID), room (FK), thread (FK)
- author (FK User), content (max 4000 chars)
- message_type: 'text' | 'image' | 'file' | 'embed' | 'system' | 'deleted'
- attachments (JSON), embeds (JSON), mentions (JSON)
- reply_to (FK self), reaction_counts (JSON)
- is_edited, is_flagged, is_hidden, is_pinned

# MessageReaction
- message (FK), user (FK), emoji

# RoomMembership
- room (FK), user (FK)
- role: 'owner' | 'admin' | 'moderator' | 'trusted' | 'member' | 'muted' | 'banned'
- trust_score, messages_sent, warnings_count

# DirectMessageThread
- id (UUID), participants (M2M User), is_group
- last_message_at, created_by (FK User)

# ModerationAction + ModerationQueue
- Track all mod actions with source: 'ai' | 'community' | 'admin' | 'system'
- Queue flagged content for human review

# UserBlock
- blocker (FK), blocked (FK)
```

---

## WebSocket Implementation

### Two-Step Token Exchange (REQUIRED)

Follow existing pattern from `07-WEBSOCKET-IMPLEMENTATION.md`:

1. **Frontend**: POST `/api/v1/auth/ws-connection-token/` with HTTP-only cookie
2. **Backend**: Generate 60s TTL single-use token, store in Redis DB 2
3. **Frontend**: Connect to `ws://host/ws/community/room/{id}/?connection_token={token}`
4. **Backend**: Validate token in JWTAuthMiddleware, consume (delete) on use

### WebSocket URL Routes

Add to `core/community/routing.py`:

| Consumer | Path | Purpose |
|----------|------|---------|
| `CommunityRoomConsumer` | `ws/community/room/<uuid:room_id>/` | Forums, circle chat |
| `DirectMessageConsumer` | `ws/community/dm/<uuid:thread_id>/` | Private messaging |
| `CommunityPresenceConsumer` | `ws/community/presence/` | Online status across rooms |

### Redis Structure (DB 3 - existing Channels DB)

Key prefix: `community:` (distinct from Ember's `chat_` prefix)

```
community:room:{id}              # Room message channel group
community:thread:{id}            # Thread message channel group
community:presence:{room_id}     # ZSET of online users (TTL 60s)
community:typing:{room_id}       # HASH of user_id → timestamp (TTL 10s)
community:dm:{thread_id}         # DM message channel group
rate_limit:community:{user_id}   # Sliding window rate limiting
```

### Consumer Requirements

Each consumer MUST implement:

1. **Origin validation** - Check against CORS_ALLOWED_ORIGINS
2. **Authentication check** - Reject if not authenticated (code 4001)
3. **Heartbeat handling** - Respond to `{type: 'ping'}` with `{event: 'pong'}`
4. **Rate limiting** - Use RateLimiter from `core/agents/security.py`
5. **Group management** - Join/leave Redis channel groups

### Frontend Hook Requirements

New hooks must implement (per `useIntelligentChat` pattern):

1. **Connection token fetch** - Before WebSocket connect
2. **Heartbeat** - Send ping every 30s
3. **Reconnection** - Exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
4. **Message limit** - MAX_MESSAGES = 100 (prevent memory leak)
5. **Race condition guard** - `isConnecting` state to prevent duplicate connections
6. **Error logging** - Use `logError()` from errorHandler

---

## Scalability (100K Users)

### Database Optimizations

- **Cursor-based pagination** for message history (O(1) vs offset's O(n))
- **Composite indexes**: (room_id, created_at), (thread_id, created_at), (author_id, -created_at)
- **Partial indexes**: is_flagged=True, is_pinned=True
- **Connection pooling**: Use pgbouncer for PostgreSQL connections

### Rate Limits

| Action | Limit |
|--------|-------|
| Messages per minute | 10 |
| Messages per hour | 100 |
| Reactions per minute | 30 |
| Forum creates per day | 3 (trust-gated users) |

### Production Timeouts

Reference existing AWS config:
- ALB idle_timeout: 300s
- CloudFront OriginReadTimeout: 300s
- Daphne --websocket-timeout: 86400 (24h)
- Daphne --ping-interval: 30s

---

## UI Design Requirements

All community components MUST follow the Neon Glass design system.
Reference: `frontend/src/pages/NeonGlassStyleguide.tsx` (`/styleguide-neon`)

### Glass Surfaces

| Class | Use Case |
|-------|----------|
| `.glass-panel` | Main containers (room view, DM inbox) |
| `.glass-card` | Interactive cards (forum list items, user cards) |
| `.glass-subtle` | Secondary containers (message bubbles) |

### Message Styling

- **System messages**: `glass-subtle p-4 rounded-2xl rounded-tl-sm`
- **User messages**: `bg-gradient-to-r from-cyan-500 to-cyan-600 p-4 rounded-2xl rounded-tr-sm`
- **Avatar**: `w-8 h-8 rounded-full` with gradient or user image

### Buttons

| Class | Use Case |
|-------|----------|
| `.btn-primary` | Primary actions (Send, Create Forum) |
| `.btn-secondary` | Secondary actions (Cancel, Back) |
| `.btn-outline` | Tertiary actions |
| `.btn-ghost` | Icon-only buttons |

### Inputs & Indicators

- Use `.input-glass` for all text inputs
- Online status: `.luminous-dot` (cyan glow)
- Typing indicator: animated dots in slate-400
- Unread badge: cyan bg with white text

### Section Colors

Use "Connect" gradient for Community nav: `from-#EC4899 to-#DB2777` (pink)

---

## Code Standards

### API Case Conversion (Automatic)

The existing axios interceptors handle all case conversion:
- **Requests**: camelCase → snake_case (frontend → Django)
- **Responses**: snake_case → camelCase (Django → frontend)

Files:
- `frontend/src/utils/caseTransform.ts`
- `frontend/src/services/api.ts` (lines 84-125)

**Rule**: All TypeScript interfaces MUST use camelCase:

```typescript
// CORRECT
interface Message {
  id: string;
  roomId: string;
  authorId: string;
  createdAt: string;
  messageType: 'text' | 'image' | 'system';
}

// WRONG
interface Message {
  room_id: string;  // ❌
  created_at: string;  // ❌
}
```

### Error Handling

Use `errorHandler.ts` for all error handling:

```typescript
import { logError, handleError } from '@/utils/errorHandler';

// In service functions:
try {
  const response = await api.get(`/community/rooms/${roomId}/messages/`);
  return response.data;
} catch (error) {
  handleError('CommunityService.getRoomMessages', error, {
    metadata: { roomId },
    showAlert: false,
  });
  throw error;
}

// In WebSocket handlers:
socket.onerror = (error) => {
  logError('CommunityWebSocket.onError', error, { roomId });
};
```

---

## Moderation System

### Two-Layer Pipeline (OpenAI Moderation API - Free)

```
Layer 1: Pattern Matching (fast, no API, ~1ms)
├── Profanity wordlist (existing in core/projects/moderation.py)
├── Leetspeak normalization
├── Spam patterns (repetition, ALL CAPS)
└── Link validation (domain allowlist)

Layer 2: OpenAI Moderation API (free, ~100ms)
├── Categories: hate, harassment, violence, sexual, self-harm
├── Returns category scores 0-1
├── Free unlimited requests
└── No billing required

Decision Thresholds:
├── Score < 0.3 → Allow immediately
├── 0.3 ≤ Score < 0.7 → Flag for human review (post, don't block)
└── Score ≥ 0.7 → Block + queue for review
```

### Trust Levels

- `new`: Can't post links/images, 2x slow mode
- `member`: Full posting (after 10 msgs, 3 days)
- `trusted`: No slow mode, can create forums (after 50 msgs, 14 days)

### Community Moderator Tools

- **Review Queue**: See flagged content with AI explanation
- **Actions**: Approve, delete, warn, mute, ban, escalate

---

## Privacy & Safety

### DM Permissions (user-configurable)

- `everyone`: Anyone can DM
- `connections`: Shared spaces or follow relationship required
- `following`: Only people I follow
- `none`: No DMs

### Block/Mute

- **Block**: Complete separation (no DMs, hidden messages)
- **Mute**: Silent (no notifications but can still interact)

### GDPR

- Export all user community data on request
- Delete/anonymize on account deletion (preserve thread context)

---

## Implementation Phases

### Phase 1: Core Infrastructure
- Create `core/community` Django app with models
- Basic WebSocket consumer for room messaging
- General forum (admin-created)
- Frontend: LoungePage, RoomList, RoomView components

### Phase 2: Thrive Circle Chat
- Add Room FK to ThriveCircle model
- Auto-create chat room when circle forms
- Integrate chat UI into circle page

### Phase 3: Direct Messages
- DirectMessageThread model
- DM-specific WebSocket consumer
- DM inbox UI (/messages)

### Phase 4: User-Created Forums
- Forum creation UI (trust-gated)
- Forum discovery/browse page
- Forum moderation (owner + platform)

### Phase 5: Moderation & Polish
- OpenAI Moderation API integration
- Trust level progression
- Reporting and moderation queue
- Performance optimization

### Future Roadmap
- Voice/video (data models include `room_type: 'voice'` for future)
- Push notifications via Firebase FCM

---

## Files to Modify

| File | Change |
|------|--------|
| `config/settings.py` | Add `core.community` to INSTALLED_APPS |
| `config/asgi.py` | Add community WebSocket routing |
| `core/agents/routing.py` | Include community websocket_urlpatterns |
| `core/users/models.py` | Add DM preferences, notification settings |
| `core/thrive_circle/models.py` | Add Room FK for circle chat |
| `frontend/src/App.tsx` | Add community routes |
| `frontend/src/components/navigation/menuData.ts` | Replace MEMBERSHIP with COMMUNITY |

## New Files to Create

**Backend:**
```
core/community/
├── __init__.py
├── admin.py
├── apps.py
├── models.py           # All community models
├── consumers.py        # WebSocket consumers
├── routing.py          # WebSocket URL patterns
├── views.py            # REST API views
├── serializers.py      # DRF serializers
├── permissions.py      # Custom permissions
├── services.py         # Business logic
├── tasks.py            # Celery tasks (notifications only)
└── tests/

services/moderation/
├── __init__.py
├── content_moderator.py  # AI moderation service
└── trust_levels.py       # Trust progression

services/notifications/
├── __init__.py
├── fcm.py               # Firebase Cloud Messaging
└── push_notifications.py
```

**Frontend:**
```
frontend/src/
├── components/community/
│   ├── Lounge/
│   │   ├── LoungePage.tsx
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   ├── Room/
│   │   ├── RoomView.tsx
│   │   ├── Message.tsx
│   │   ├── MessageReactions.tsx
│   │   └── MessageAttachment.tsx
│   ├── Composer/
│   │   ├── MessageComposer.tsx
│   │   ├── EmojiPicker.tsx
│   │   └── MentionSuggester.tsx
│   ├── Thread/
│   ├── Presence/
│   ├── Moderation/
│   └── DirectMessages/
├── hooks/
│   ├── useCommunityRoom.ts
│   ├── useCommunityPresence.ts
│   └── useDirectMessages.ts
├── pages/community/
│   ├── LoungePage.tsx
│   ├── RoomPage.tsx
│   └── MessagesPage.tsx
├── services/community.ts
└── types/community.ts
```

---

## Critical Files to Read Before Implementation

1. `core/battles/consumers.py` - Pattern for WebSocket consumers (1,381 lines)
2. `core/agents/middleware.py` - JWT auth middleware for WebSockets
3. `core/agents/ws_connection_tokens.py` - Connection token pattern
4. `core/thrive_circle/models.py` - Existing Circle model to integrate with
5. `frontend/src/hooks/useIntelligentChat.ts` - Frontend WebSocket pattern
6. `frontend/src/utils/errorHandler.ts` - Global logger utility
7. `frontend/src/utils/caseTransform.ts` - Case conversion utilities
8. `frontend/src/services/api.ts` - Axios interceptors pattern
9. `frontend/src/pages/NeonGlassStyleguide.tsx` - UI design system
10. `docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md` - WebSocket architecture

---

## Related Documentation

- `/docs/evergreen-architecture/05-UNIFIED-CHAT-ARCHITECTURE.md` - Ember AI chat (separate system)
- `/docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md` - WebSocket patterns
- `/docs/evergreen-architecture/13-TAXONOMY-SYSTEM.md` - Could use for forum categorization later
