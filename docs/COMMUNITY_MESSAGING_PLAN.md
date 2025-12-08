# Discord-like Messaging & Forums for AllThrive AI

## Executive Summary

Build a community messaging system combining Discord's real-time feel with forum-style thread organization. Leverages existing Django Channels infrastructure, ThriveCircle community model, and established patterns. Target: 100K users with hybrid AI/human moderation.

## Third-Party Services

| Service | Purpose | Notes |
|---------|---------|-------|
| **Redis** | Real-time messaging, presence, rate limiting | Existing (DB 3) |
| **PostgreSQL** | Message storage, full-text search | Existing |
| **MinIO** | File/image attachments | Existing |
| **OpenAI API** | Content moderation | Existing (free endpoint) |
| **AWS SES** | Email notifications (digests, mentions) | Existing |
| **Twilio** | SMS for critical alerts (opt-in) | Existing |
| **Celery** | Async message processing | Existing |
| **Firebase FCM** | Browser & mobile push notifications | **NEW** - free tier |

### Firebase Cloud Messaging Setup

```
Push Notification Flow:
1. User opts in to push notifications in browser/app
2. Frontend requests FCM token, sends to backend
3. Backend stores FCM token per user device
4. On new message/mention → Celery task → FCM API → Push to device

Backend:
- pip install firebase-admin
- Store FCM tokens in User model or separate DeviceToken model
- Celery task to send push via FCM

Frontend:
- firebase SDK for token registration
- Service worker for background notifications
```

**When to send push notifications:**
- Direct messages (always, if enabled)
- @mentions in rooms
- Replies to your threads
- Mod actions on your content

**NOT for:**
- Every message in a room (too noisy)
- Typing indicators
- Presence changes

---

## Navigation & Naming

**Replace "MEMBERSHIP" with "COMMUNITY"** in top navigation:

```
COMMUNITY (nav dropdown)
├── The Lounge          → /lounge         (topic-based discussions, open to all)
├── Your Thrive Circle  → /thrive-circle  (intimate weekly cohort - KEEP AS-IS)
├── Messages            → /messages       (DMs)
├── Events              → (existing calendar)
└── Perks               → /perks          (KEEP AS-IS)
```

**Key naming decisions:**
- **The Lounge** = casual, open discussion rooms by topic (replaces "channels/spaces/hub")
- **Thrive Circle** = kept as-is, intimate weekly cohorts of ~20-30 users
- **Rooms** = topic areas within The Lounge (not "channels")

---

## Recommended Architecture

### UX Model: "The Lounge" + Embedded Chat

For a learning platform, we recommend **real-time chat with automatic threading** (hybrid Discord + Slack), plus **contextual embeds** throughout the platform:

- **Real-time messaging** for engagement and quick help
- **Persistent threads** for organized, searchable discussions
- **Help rooms auto-thread** - each question becomes its own thread to reduce noise
- **Embedded chat widgets** in projects, learning paths, and profile pages

```
THE LOUNGE (/lounge)
├── 🎨 AI Art & Design       (topic room)
├── 💻 Coding & Automation   (topic room)
├── ✍️ Prompt Engineering    (topic room)
├── 🆕 Newcomers Welcome     (topic room)
└── 💬 General Chat          (topic room)

Each room has:
  └── Main chat (real-time)
  └── Threads (for deeper discussions)
  └── Pinned resources

Embedded Chat Contexts:
  └── Project page → Project discussion thread
  └── Learning path → Path-specific help chat
  └── User profile → "Ask me" mini-chat (if enabled)
  └── Battle results → Post-battle discussion
```

### Voice/Video: Future Roadmap
Data models include `room_type: 'voice'` field for future implementation, but v1 is text-only.

### Community Structure

| Layer | Name | Description | Moderation |
|-------|------|-------------|------------|
| 1 | The Lounge | Admin-created topic rooms (AI Art, Coding, etc.) | Platform mods |
| 2 | Thrive Circle | Auto-generated private space per weekly cohort | Peer + platform |
| 3 | Project Chats | Project owners enable discussions | Owner + platform |

**Why not fully user-created communities:**
- Moderation burden scales poorly
- Spam/abuse vectors are harder to control
- Resource allocation simpler with known room counts

---

## Data Models

### Core Models (new `core/community` app)

```python
# Lounge - The main community space (singleton for now, extensible later)
- id (UUID), name, slug, description
- is_active, member_count, message_count

# Room - A topic room within The Lounge (or private in Circle/Project)
- id (UUID), name, slug, description, emoji
- room_type: 'lounge' | 'circle' | 'project' | 'dm'
- context_type: 'text' | 'announcement' | 'help' | 'showcase' | 'voice' (future)
- lounge (FK Lounge, nullable), circle (FK ThriveCircle, nullable), project (FK Project, nullable)
- auto_thread (bool), position, is_default
- read_permission_level, write_permission_level
- slow_mode_seconds, last_message_at, online_count

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

# DirectMessageThread + DirectMessage
- participants (M2M User), is_group
- Similar message structure but simpler

# ModerationAction + ModerationQueue
- Track all mod actions with source: 'ai' | 'community' | 'admin' | 'system'
- Queue flagged content for human review

# UserBlock
- blocker (FK), blocked (FK)
```

---

## Real-Time Architecture

### New WebSocket Consumers

| Consumer | Path | Purpose |
|----------|------|---------|
| `LoungeRoomConsumer` | `ws/lounge/room/<uuid>/` | Messages, typing, reactions |
| `LoungePresenceConsumer` | `ws/lounge/presence/` | Online status across rooms |
| `DirectMessageConsumer` | `ws/dm/<uuid>/` | Private messaging |

### Redis Structure (DB 3 - existing Channels DB)

```
lounge:room:{id}                 # Room message group
lounge:thread:{id}               # Thread message group
lounge:presence:{room_id}        # SET of online user_ids (TTL 60s)
lounge:typing:{room_id}          # HASH of user_id -> timestamp
dm:thread:{id}                   # DM message group
rate_limit:room:{user_id}        # Rate limiting counters
```

### Message Flow

```
User sends message
    ↓
WebSocket Consumer receives
    ↓
[Async] AI Moderation (OpenAI Moderation API)
    ↓ (if passed)
[Sync] Save to PostgreSQL
    ↓
[Async] Broadcast via Redis Pub/Sub
    ↓
Channel Layer delivers to connected clients
    ↓
[Async] Celery: mentions, notifications, search indexing
```

---

## Moderation System (Hybrid - Free Tier)

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

**Cost: $0** - OpenAI Moderation API is free with no rate limits for reasonable use.

### Community Moderator Tools

- **Review Queue**: See flagged content with AI explanation
- **Actions**: Approve, delete, warn, mute, ban, escalate
- **Trust Levels**: Automatic progression based on behavior
  - `new`: Can't post links/images, 2x slow mode
  - `member`: Full posting (after 10 msgs, 3 days)
  - `trusted`: No slow mode, can pin (after 50 msgs, 14 days)

---

## Scalability (100K Users)

### Database

- **Cursor-based pagination** for message history (O(1) vs offset's O(n))
- **Composite indexes** on (room, created_at), (thread, created_at), (author, -created_at)
- **Partial indexes** for is_flagged=True, is_pinned=True

### Redis

- **Presence**: ZSET with timestamp scores, cleanup stale entries every 60s
- **Typing**: HASH with 10s TTL per user
- **Rate limiting**: Sliding window (10/min, 100/hour per user)

### Rate Limits

| Action | Limit |
|--------|-------|
| Messages per minute | 10 |
| Messages per hour | 100 |
| Reactions per minute | 30 |
| Thread creates per hour | 5 |

---

## Frontend Components

```
frontend/src/components/community/
├── Lounge/             # The Lounge main view
│   ├── LoungePage.tsx        # Full lounge layout
│   ├── RoomList.tsx          # Left sidebar with topic rooms
│   └── RoomListItem.tsx      # Individual room with online count
├── Room/               # Room view (messages + threads)
│   ├── RoomView.tsx
│   ├── Message.tsx
│   ├── MessageReactions.tsx
│   └── MessageAttachment.tsx
├── Composer/           # Rich text input
│   ├── MessageComposer.tsx
│   ├── EmojiPicker.tsx
│   └── MentionSuggester.tsx
├── Thread/             # Side panel for threads
├── Presence/           # Online users, typing
├── Moderation/         # Mod dashboard
├── DirectMessages/     # DM UI
└── Embeds/             # Contextual chat embeds
    ├── ProjectChatEmbed.tsx      # Chat widget for project pages
    ├── LearningPathChat.tsx      # Help chat for learning paths
    ├── ProfileAskMe.tsx          # "Ask me" on user profiles
    └── MinimalChatWidget.tsx     # Collapsible chat component
```

### Embedded Chat Strategy

Embeds use the same WebSocket infrastructure but with a minimal UI:

| Context | Room Type | Features |
|---------|-----------|----------|
| Project Page | Auto-created project room | Comments, Q&A, reactions |
| Learning Path | Shared help room per path | Quick questions, peer help |
| User Profile | DM-like "Ask me" (opt-in) | Direct questions to creator |
| Battle Results | Post-battle thread | Discussion, rematch |

Embeds share components with full community view but in collapsed/minimal mode.

### Key Hooks

- `useLoungeRoom(roomId)` - WebSocket for room messaging
- `useLoungePresence()` - Track online users across rooms
- `useDirectMessages(threadId)` - DM WebSocket
- `useEmbeddedChat(contextType, contextId)` - For embedded widgets (resolves to room)

---

## Privacy & Safety

### DM Permissions (user-configurable)

- `everyone`: Anyone can DM
- `connections`: Shared spaces or follow relationship required
- `following`: Only people I follow
- `none`: No DMs

### Block/Mute

- **Block**: Complete separation (no DMs, hidden messages, no mutual private spaces)
- **Mute**: Silent (no notifications but can still interact)

### GDPR

- Export all user community data on request
- Delete/anonymize on account deletion (preserve thread context)

---

## Implementation Phases

### Phase 1: Foundation (2-3 weeks)
- Create `core/community` Django app with models
- Basic WebSocket consumer for messaging
- Frontend: LoungePage, RoomList, RoomView components
- Integrate with existing auth

### Phase 2: Real-Time (2 weeks)
- Presence tracking
- Typing indicators
- Reactions
- Threads
- Cursor pagination

### Phase 3: Moderation (2-3 weeks)
- OpenAI Moderation API integration
- Moderation queue backend
- Moderator dashboard UI
- Trust levels
- User reporting

### Phase 4: Advanced (2 weeks)
- Direct messages
- Mentions and notifications
- File/image attachments
- Search integration

### Phase 5: Integration (1-2 weeks)
- Auto-create Circle Spaces
- Project Space feature
- Performance optimization
- Load testing

---

## Files to Modify

| File | Change |
|------|--------|
| `config/settings.py` | Add `core.community` to INSTALLED_APPS |
| `config/asgi.py` | Add community WebSocket routing |
| `core/agents/routing.py` | Include community websocket_urlpatterns |
| `core/users/models.py` | Add DM preferences, notification settings |
| `core/thrive_circle/models.py` | Add OneToOne to Room |
| `core/projects/models.py` | Add OneToOne to Room |
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
├── tasks.py            # Celery tasks (notifications, FCM)
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
├── components/community/   # All components above
├── hooks/
│   ├── useLoungeRoom.ts
│   ├── useLoungePresence.ts
│   ├── useDirectMessages.ts
│   └── useEmbeddedChat.ts
├── pages/community/
│   ├── LoungePage.tsx
│   ├── RoomPage.tsx
│   └── MessagesPage.tsx
├── services/community.ts
└── types/community.ts
```

---

## Critical Files to Read Before Implementation

1. `core/battles/consumers.py` - Pattern for WebSocket consumers (1,381 lines, well-structured)
2. `core/agents/middleware.py` - JWT auth middleware for WebSockets
3. `core/agents/ws_connection_tokens.py` - Connection token pattern
4. `core/thrive_circle/models.py` - Existing Circle model to integrate with
5. `frontend/src/hooks/useBattleWebSocket.ts` - Frontend WebSocket pattern
6. `core/projects/moderation.py` - Existing profanity filter to extend
7. `frontend/src/components/navigation/menuData.ts` - Navigation structure to modify
