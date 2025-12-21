# Community Messaging System

**Source of Truth** | **Last Updated**: 2025-12-20

This document describes AllThrive's real-time community messaging system powering The Lounge (forums), Circle chats, and direct messages.

---

## 1. Overview

The community system provides human-to-human messaging with:
- **Forums** (The Lounge): Public discussion rooms
- **Circle Chats**: Private group conversations
- **Direct Messages**: 1:1 and group DMs
- **Real-time**: WebSocket-based with Redis pub/sub

**Tech Stack:**
- Backend: Django + Django Channels (WebSockets)
- Real-time: Redis pub/sub via Channels Layer
- Frontend: React with `useCommunityRoom` hook
- UI: Neon Glass design system

---

## 2. Data Models

### 2.1 Room

Container for all messages (forum, circle, or DM).

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `name` | str | Display name |
| `slug` | str | URL-friendly identifier |
| `room_type` | choice | `'forum'`, `'circle'`, `'dm'` |
| `visibility` | choice | `'public'`, `'private'`, `'unlisted'` |
| `creator` | FK User | Room creator |
| `slow_mode_seconds` | int | Rate limiting |
| `min_trust_to_join/post` | int | Trust gates |
| `member_count` | int | Cached count |

### 2.2 Message

| Field | Type | Purpose |
|-------|------|---------|
| `room` | FK Room | Container |
| `thread` | FK Thread | Optional thread |
| `author` | FK User | Message author |
| `content` | str | Max 4000 chars |
| `message_type` | choice | `'text'`, `'image'`, `'file'`, `'system'` |
| `attachments` | JSON | `[{url, name, size, type}]` |
| `mentions` | JSON | Mentioned user IDs |
| `reply_to` | FK Message | Reply context |
| `reaction_counts` | JSON | `{emoji: count}` |

### 2.3 RoomMembership

| Role | Permissions |
|------|-------------|
| `owner` | Full control |
| `admin` | Manage members/settings |
| `moderator` | Moderate messages |
| `trusted` | Bypasses slow mode |
| `member` | Normal user |
| `muted` | Cannot send messages |
| `banned` | Cannot access room |

### 2.4 Supporting Models

- **Thread**: Conversation threads within rooms
- **MessageReaction**: Emoji reactions (unique per user/emoji)
- **DirectMessageThread**: 1:1 and group DM containers
- **ModerationAction**: Audit trail of moderation
- **ModerationQueue**: Flagged content awaiting review
- **UserBlock**: Block relationships

---

## 3. WebSocket Architecture

### 3.1 Consumers

| Consumer | URL | Purpose |
|----------|-----|---------|
| `CommunityRoomConsumer` | `ws/community/room/<room_id>/` | Forum/circle chat |
| `DirectMessageConsumer` | `ws/community/dm/<thread_id>/` | Direct messages |

### 3.2 Connection Flow

```
1. Get token: POST /auth/ws-connection-token/
2. Connect: ws://host/ws/community/room/{room_id}/?connection_token={token}
3. Receive: room_state event (initial 50 messages, online users)
4. Send: {type: 'send_message', content: '...'}
5. Receive: {event: 'new_message', message: {...}}
```

### 3.3 Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `ping` | → Server | Heartbeat |
| `pong` | ← Server | Heartbeat response |
| `send_message` | → Server | Create message |
| `new_message` | ← Server | Broadcast new message |
| `typing` | → Server | Typing indicator |
| `typing` | ← Server | Broadcast typing |
| `request_history` | → Server | Load older messages |
| `message_history` | ← Server | Paginated messages |
| `user_joined` | ← Server | Presence update |
| `user_left` | ← Server | Presence update |

### 3.4 Presence Tracking

```python
# Redis key: community:presence:{room_id}
# Value: {user_id: {username, timestamp}, ...}
# TTL: 120 seconds (auto-cleanup)
```

### 3.5 Rate Limiting

```python
# Redis key: rate_limit:community:{user_id}
# Limit: 10 messages/minute
# TTL: 60 seconds
```

---

## 4. Permissions

### 4.1 Permission Classes

| Class | Purpose |
|-------|---------|
| `IsRoomMember` | Can access room |
| `CanPostInRoom` | Can send messages |
| `IsRoomModerator` | Can moderate content |
| `IsRoomOwnerOrAdmin` | Can manage room |
| `CanCreateRoom` | Trust-gated room creation |
| `IsDMParticipant` | Can access DM thread |
| `IsMessageAuthor` | Can edit/delete own message |

### 4.2 Trust-Gated Room Creation

Requirements:
- Account age ≥ 7 days
- Total messages sent ≥ 10

---

## 5. Real-Time Message Flow

### 5.1 Forum/Circle Message

```
User A types message
    ↓
sendMessage(content, replyToId)
    ↓
WebSocket: {type: 'send_message', content, reply_to_id}
    ↓
CommunityRoomConsumer._handle_send_message()
    ↓
Validate (length, rate limit, permissions)
    ↓
Create Message in PostgreSQL
    ↓
Update Room stats (message_count, last_message_at)
    ↓
Broadcast to channel group: community:room:{room_id}
    ↓
All connected users receive: {event: 'new_message', message: {...}}
```

### 5.2 Typing Indicators

```
User starts typing
    ↓
WebSocket: {type: 'typing', is_typing: true}
    ↓
Broadcast to room group
    ↓
All users see: "username is typing..."
    ↓
Auto-clear after 3s of no activity
```

---

## 6. The Lounge UI

### 6.1 Route

`/lounge/:roomId`

### 6.2 Layout

```
┌─────────────────────────────────────────────┐
│ The Lounge                                   │
├──────────┬──────────────────────────────────┤
│          │                                   │
│ RoomList │ RoomView                          │
│          │ ├── RoomHeader                   │
│ #general │ ├── MessageList                  │
│ #help    │ │   └── MessageItem (per msg)    │
│ #random  │ ├── TypingIndicator              │
│          │ └── MessageInput                 │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

### 6.3 Hook Usage

```typescript
const {
  messages,
  sendMessage,
  onlineUsers,
  isConnected
} = useCommunityRoom(roomId);
```

---

## 7. REST API Endpoints

### 7.1 Rooms

```
GET    /community/rooms/           List accessible rooms
POST   /community/rooms/           Create room (trust-gated)
GET    /community/rooms/{id}/      Get room details
PATCH  /community/rooms/{id}/      Update room
POST   /community/rooms/{id}/join/ Join room
POST   /community/rooms/{id}/leave/ Leave room
```

### 7.2 Messages

```
GET    /community/rooms/{id}/messages/              List (cursor pagination)
POST   /community/rooms/{id}/messages/              Send message
PATCH  /community/rooms/{id}/messages/{id}/         Edit (author only)
DELETE /community/rooms/{id}/messages/{id}/         Delete (author/mod)
POST   /community/rooms/{id}/messages/{id}/react/   Add reaction
POST   /community/rooms/{id}/messages/{id}/report/  Report message
```

### 7.3 Direct Messages

```
GET    /community/dm/      List DM threads
POST   /community/dm/      Create DM thread
GET    /community/dm/{id}/ Get thread details
```

### 7.4 Blocking

```
GET    /community/block/   List blocked users
POST   /community/block/   Block user
DELETE /community/block/   Unblock user
```

---

## 8. Moderation

### 8.1 AI Moderation (Future)

Content checked via OpenAI Moderation API before storage.

### 8.2 Community Reports

- 3+ reports auto-flag message
- Creates ModerationQueue entry for human review

### 8.3 Moderation Actions

| Action | Effect |
|--------|--------|
| `warn` | Warning recorded |
| `mute` | User cannot send messages |
| `ban` | User cannot access room |
| `hide` | Message hidden from view |
| `delete` | Message marked deleted |
| `lock` | Thread locked |

### 8.4 Audit Trail

All moderation actions logged in `ModerationAction` with:
- Action type and source (ai/community/admin/system)
- Reason and moderator
- Target user/message/room
- Expiration (for temporary actions)

---

## 9. Database Indexes

**Optimized for:**
- Room message history: `(room, -created_at, id)`
- Thread messages: `(thread, created_at)`
- User message history: `(author, -created_at)`
- Flagged content: `(is_flagged, -created_at)`
- Membership lookup: `(room, user)`
- Presence: `(room, role, is_active)`

---

## 10. Security

| Concern | Protection |
|---------|------------|
| CORS | Origin validation in consumer |
| Auth | JWT required before WebSocket accept |
| Authorization | Membership + role checks per action |
| Content | 4000 char limit + moderation |
| Blocking | Prevents messages and DMs |
| Rate Limiting | 10 msgs/minute per user |
| Audit | Full moderation trail |

---

## 11. File Structure

```
core/community/
├── models.py         # 8 core models
├── consumers.py      # WebSocket consumers
├── views.py          # REST ViewSets
├── serializers.py    # DRF serializers
├── services.py       # Business logic
├── permissions.py    # Permission classes
├── routing.py        # WebSocket URLs
└── urls.py           # REST URLs

frontend/src/
├── pages/community/LoungePage.tsx
├── components/community/
│   ├── Lounge/RoomList.tsx
│   └── Room/RoomView.tsx
├── hooks/useCommunityRoom.ts
├── services/community.ts
└── types/community.ts
```

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
