# API Contracts

**Source of Truth** | **Last Updated**: 2025-11-29

This document defines the REST and WebSocket API contracts for AllThrive AI, including endpoints, request/response schemas, authentication, and error handling.

---

## API Versioning

**Current Version**: `v1`  
**Base URL**: `https://allthrive.ai/api/v1/`  
**Local Development**: `http://localhost:8000/api/v1/`

### Versioning Strategy

- **URL-based versioning**: `/api/v1/`, `/api/v2/` (future)
- **Backwards compatibility**: v1 will be maintained for 12 months after v2 release
- **Deprecation headers**: `X-API-Deprecation-Warning` header for deprecated endpoints

---

## Authentication

### Primary Methods

1. **Cookie-based (first-party cookies)**: Primary auth method for web app
2. **JWT Bearer tokens**: For API clients and mobile apps
3. **OAuth 2.0**: Google and GitHub for login/signup

### Headers

```http
# Cookie-based
Cookie: sessionid=abc123; csrftoken=xyz789

# JWT Bearer (for API clients)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# CSRF protection (required for state-changing operations)
X-CSRFToken: xyz789
```

### OAuth Providers

| Provider | Login URL | Scopes |
|----------|-----------|--------|
| Google | `/accounts/google/login/` | `profile`, `email` |
| GitHub | `/accounts/github/login/` | `user:email`, `read:user` |

---

## REST API Endpoints

### Authentication & Users

#### POST `/api/v1/auth/login/`

**Purpose**: Email/password login (alternative to OAuth).

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "user": {
    "id": 123,
    "username": "alice",
    "email": "user@example.com",
    "avatar_url": "https://...",
    "thrive_circle_tier": "sprout",
    "total_points": 250
  },
  "access": "eyJhbGci...",  // JWT (optional, for API clients)
  "refresh": "eyJhbGci..."  // Refresh token (optional)
}
```

**Sets cookies**: `sessionid`, `csrftoken`

---

#### POST `/api/v1/auth/signup/`

**Purpose**: Create new user account.

**Request**:
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securePassword123",
  "referral_code": "ABC123"  // Optional
}
```

**Response** (201):
```json
{
  "user": {
    "id": 456,
    "username": "alice",
    "email": "alice@example.com",
    "thrive_circle_tier": "seedling",
    "total_points": 0
  }
}
```

**Validation Errors** (400):
```json
{
  "username": ["A user with that username already exists."],
  "email": ["This email is already registered."]
}
```

---

#### GET `/api/v1/auth/me/`

**Purpose**: Get current authenticated user profile.

**Auth**: Required

**Response** (200):
```json
{
  "id": 123,
  "username": "alice",
  "email": "alice@example.com",
  "bio": "AI enthusiast and creator",
  "avatar_url": "https://...",
  "github_username": "alice-codes",
  "linkedin_url": "https://linkedin.com/in/alice",
  "website_url": "https://alice.dev",
  "thrive_circle_tier": "blossom",
  "total_points": 1250,
  "daily_streak": 7,
  "last_active_date": "2025-11-29",
  "notification_preferences": {...},
  "privacy_settings": {...},
  "date_joined": "2024-01-15T10:30:00Z"
}
```

---

#### POST `/api/v1/auth/logout/`

**Purpose**: Logout and invalidate session.

**Auth**: Required

**Response** (200):
```json
{
  "message": "Successfully logged out"
}
```

---

#### GET `/api/v1/auth/urls/`

**Purpose**: Get OAuth provider URLs for frontend.

**Response** (200):
```json
{
  "google": "/accounts/google/login/",
  "github": "/accounts/github/login/"
}
```

---

### Projects

#### GET `/api/v1/me/projects/`

**Purpose**: List current user's projects.

**Auth**: Required

**Query Parameters**:
- `is_showcase` (bool): Filter by showcase status
- `is_archived` (bool): Include archived projects
- `ordering` (str): `created_at`, `-created_at`, `title`
- `page` (int): Page number (default: 1)
- `page_size` (int): Results per page (default: 20, max: 100)

**Response** (200):
```json
{
  "count": 42,
  "next": "https://api/v1/me/projects/?page=2",
  "previous": null,
  "results": [
    {
      "id": 101,
      "slug": "ai-chatbot-demo",
      "title": "AI Chatbot Demo",
      "description": "A conversational AI built with GPT-4",
      "type": "github_repo",
      "is_showcase": true,
      "is_private": false,
      "is_highlighted": true,
      "banner_url": "https://...",
      "featured_image_url": "https://...",
      "external_url": "https://github.com/alice/ai-chatbot",
      "tools": [
        {"id": 1, "name": "GPT-4", "slug": "gpt-4"},
        {"id": 5, "name": "LangChain", "slug": "langchain"}
      ],
      "categories": [
        {"id": 2, "name": "Chatbots", "slug": "chatbots"}
      ],
      "topics": ["conversational-ai", "gpt-4", "python"],
      "like_count": 45,
      "comment_count": 12,
      "view_count": 320,
      "created_at": "2024-11-15T14:22:00Z",
      "updated_at": "2024-11-28T09:15:00Z",
      "published_at": "2024-11-15T14:30:00Z",
      "user": {
        "id": 123,
        "username": "alice",
        "avatar_url": "https://..."
      }
    }
  ]
}
```

---

#### POST `/api/v1/me/projects/`

**Purpose**: Create a new project.

**Auth**: Required

**Request**:
```json
{
  "title": "My New AI Project",
  "description": "A cool AI experiment",
  "type": "prompt",
  "is_showcase": true,
  "is_private": false,
  "external_url": "https://github.com/alice/new-project",
  "banner_url": "https://...",
  "featured_image_url": "https://...",
  "tools": [1, 5],  // Tool IDs
  "categories": [2],  // Category IDs
  "topics": ["ai", "ml", "experiment"],
  "content": {
    "blocks": [
      {
        "type": "cover",
        "banner_url": "https://...",
        "title": "My Project"
      },
      {
        "type": "text",
        "content": "## Overview\nThis is my project..."
      }
    ]
  }
}
```

**Response** (201):
```json
{
  "id": 102,
  "slug": "my-new-ai-project",
  "title": "My New AI Project",
  // ... (same structure as GET response)
}
```

**Awards**: 50 Thrive Circle points automatically

---

#### PATCH `/api/v1/me/projects/{id}/`

**Purpose**: Update an existing project.

**Auth**: Required (must be project owner)

**Request** (partial update):
```json
{
  "title": "Updated Title",
  "is_showcase": false
}
```

**Response** (200): Updated project object

**Awards**: 10 Thrive Circle points on first update

---

#### DELETE `/api/v1/me/projects/{id}/`

**Purpose**: Soft-delete project (sets `is_archived=true`).

**Auth**: Required (must be project owner)

**Response** (204): No content

---

#### GET `/api/v1/projects/explore/`

**Purpose**: Explore public projects (public endpoint).

**Query Parameters**:
- `category` (str): Filter by category slug
- `tool` (str): Filter by tool slug
- `topic` (str): Filter by topic tag
- `ordering` (str): `-published_at`, `-like_count`, `title`
- `search` (str): Full-text search in title/description
- `page`, `page_size`

**Response** (200): Paginated project list (same structure as `/me/projects/`)

---

#### GET `/api/v1/users/{username}/projects/`

**Purpose**: Get public projects for a specific user.

**Response** (200): Paginated project list (only non-private projects)

---

#### GET `/api/v1/users/{username}/projects/{slug}/`

**Purpose**: Get project detail by username and slug.

**Response** (200):
```json
{
  "id": 101,
  "slug": "ai-chatbot-demo",
  "title": "AI Chatbot Demo",
  // ... full project object
  "content": {
    "blocks": [...]  // Full rich content
  },
  "user_has_liked": false,  // If authenticated
  "comments": {
    "count": 12,
    "recent": [...]  // Last 5 comments
  }
}
```

---

#### POST `/api/v1/projects/{id}/like/`

**Purpose**: Like/unlike a project (toggle).

**Auth**: Required

**Response** (200):
```json
{
  "liked": true,
  "like_count": 46
}
```

**Awards**: 5 points to liker, 10 points to project owner

---

### Comments

#### GET `/api/v1/projects/{project_pk}/comments/`

**Purpose**: Get comments for a project (threaded).

**Query Parameters**:
- `ordering` (str): `created_at`, `-created_at`, `-vote_count`
- `parent` (int): Filter by parent comment ID (for replies)

**Response** (200):
```json
{
  "count": 12,
  "results": [
    {
      "id": "uuid-1234",
      "user": {
        "id": 456,
        "username": "bob",
        "avatar_url": "https://..."
      },
      "content": "Great project! How did you approach...?",
      "parent": null,
      "replies_count": 2,
      "vote_count": 5,
      "user_vote": 1,  // -1, 0, or 1 (if authenticated)
      "is_edited": false,
      "created_at": "2024-11-28T10:15:00Z"
    }
  ]
}
```

---

#### POST `/api/v1/projects/{project_pk}/comments/`

**Purpose**: Create a comment.

**Auth**: Required

**Request**:
```json
{
  "content": "This is amazing! Can you share more about...",
  "parent": "uuid-1234"  // Optional, for replies
}
```

**Response** (201): Comment object

**Awards**: 5 points to commenter, 5 points to project owner

**Constraints**: Max 3 levels of nesting

---

#### POST `/api/v1/projects/{project_pk}/comments/{pk}/vote/`

**Purpose**: Upvote/downvote a comment.

**Auth**: Required

**Request**:
```json
{
  "vote": 1  // 1 for upvote, -1 for downvote, 0 to remove vote
}
```

**Response** (200):
```json
{
  "vote_count": 6,
  "user_vote": 1
}
```

---

### Quizzes

#### GET `/api/v1/quizzes/`

**Purpose**: List all active quizzes.

**Query Parameters**:
- `difficulty` (str): `beginner`, `intermediate`, `advanced`
- `category` (str): Filter by category

**Response** (200):
```json
{
  "count": 25,
  "results": [
    {
      "id": 10,
      "slug": "intro-to-transformers",
      "title": "Introduction to Transformers",
      "description": "Test your knowledge of transformer architecture",
      "difficulty": "intermediate",
      "category": "machine-learning",
      "points_reward": 100,
      "xp_reward": 50,
      "question_count": 10,
      "attempt_count": 1250,  // Total attempts by all users
      "average_score": 7.2,
      "user_attempts": 2,  // If authenticated
      "user_best_score": 9  // If authenticated
    }
  ]
}
```

---

#### GET `/api/v1/quizzes/{slug}/`

**Purpose**: Get quiz detail with questions.

**Response** (200):
```json
{
  "id": 10,
  "slug": "intro-to-transformers",
  "title": "Introduction to Transformers",
  "difficulty": "intermediate",
  "points_reward": 100,
  "questions": [
    {
      "id": 101,
      "question_text": "What is the primary innovation of the Transformer architecture?",
      "question_type": "multiple_choice",
      "options": [
        {"id": "a", "text": "Recurrent connections"},
        {"id": "b", "text": "Self-attention mechanism"},
        {"id": "c", "text": "Convolutional layers"},
        {"id": "d", "text": "Pooling layers"}
      ],
      "order": 1
    }
    // ... more questions (correct_answer and explanation omitted)
  ]
}
```

---

#### POST `/api/v1/me/quiz-attempts/`

**Purpose**: Submit quiz answers.

**Auth**: Required

**Request**:
```json
{
  "quiz": 10,
  "answers": {
    "101": "b",  // question_id: answer_id
    "102": "a",
    "103": "true"
  },
  "time_taken_seconds": 320
}
```

**Response** (201):
```json
{
  "id": "uuid-5678",
  "quiz": 10,
  "score": 9,
  "total_questions": 10,
  "percentage": 90,
  "passed": true,
  "points_earned": 100,
  "xp_earned": 50,
  "answers": {
    "101": {
      "user_answer": "b",
      "correct_answer": "b",
      "is_correct": true,
      "explanation": "The self-attention mechanism..."
    }
    // ... all answers with explanations
  },
  "completed_at": "2024-11-29T15:45:00Z",
  "time_taken_seconds": 320
}
```

**Awards**: Points and XP as specified in quiz

---

### Tools

#### GET `/api/v1/tools/`

**Purpose**: Browse AI tools directory.

**Query Parameters**:
- `category` (str): Filter by category
- `pricing_model` (str): `free`, `freemium`, `paid`, `api`
- `is_featured` (bool): Featured tools only
- `search` (str): Search by name or description
- `ordering` (str): `-popularity_score`, `name`

**Response** (200):
```json
{
  "count": 150,
  "results": [
    {
      "id": 1,
      "slug": "gpt-4",
      "name": "GPT-4",
      "short_description": "OpenAI's most advanced language model",
      "category": "text",
      "pricing_model": "api",
      "logo_url": "https://...",
      "website_url": "https://openai.com/gpt-4",
      "popularity_score": 9500,
      "is_featured": true,
      "average_rating": 4.7,
      "review_count": 245,
      "project_count": 1230  // Projects using this tool
    }
  ]
}
```

---

#### GET `/api/v1/tools/{slug}/`

**Purpose**: Get tool detail.

**Response** (200):
```json
{
  "id": 1,
  "slug": "gpt-4",
  "name": "GPT-4",
  "short_description": "...",
  "long_description": "## Overview\nGPT-4 is...",
  "category": "text",
  "pricing_model": "api",
  "logo_url": "https://...",
  "banner_url": "https://...",
  "demo_video_url": "https://...",
  "website_url": "https://...",
  "docs_url": "https://...",
  "pricing_url": "https://...",
  "examples": [
    {
      "title": "Code generation example",
      "description": "...",
      "media_url": "https://..."
    }
  ],
  "tags": ["llm", "code-generation", "chat"],
  "user_bookmarked": false  // If authenticated
}
```

---

### Thrive Circle (Gamification)

#### GET `/api/v1/me/thrive-circle/`

**Purpose**: Get user's Thrive Circle status.

**Auth**: Required

**Response** (200):
```json
{
  "tier": "blossom",
  "total_points": 1250,
  "points_to_next_tier": 750,
  "next_tier": "bloom",
  "daily_streak": 7,
  "level": 12,
  "xp": 3450,
  "xp_to_next_level": 550,
  "achievements_earned": 23,
  "achievements_total": 50,
  "recent_activities": [
    {
      "id": "uuid-abc",
      "activity_type": "quiz_complete",
      "amount": 100,
      "description": "Completed 'Intro to Transformers' quiz",
      "tier_at_time": "sprout",
      "created_at": "2024-11-29T10:30:00Z"
    }
  ]
}
```

---

#### GET `/api/v1/me/point-activities/`

**Purpose**: Get user's point history.

**Auth**: Required

**Query Parameters**:
- `activity_type` (str): Filter by type
- `date_from` (date): Filter by date range
- `date_to` (date)

**Response** (200): Paginated list of PointActivity objects

---

#### GET `/api/v1/me/achievements/`

**Purpose**: Get user's achievements (earned + locked).

**Auth**: Required

**Response** (200):
```json
{
  "earned": [
    {
      "key": "first_project",
      "name": "First Steps",
      "description": "Create your first project",
      "icon": "fa-rocket",
      "color_from": "#00FFA3",
      "color_to": "#00F0FF",
      "category": "projects",
      "rarity": "common",
      "points": 50,
      "earned_at": "2024-11-15T10:00:00Z",
      "progress": {
        "current": 1,
        "target": 1,
        "percentage": 100
      }
    }
  ],
  "locked": [
    {
      "key": "project_master",
      "name": "Project Master",
      "description": "Create 10 projects",
      "icon": "fa-trophy",
      "category": "projects",
      "rarity": "rare",
      "points": 200,
      "is_secret": false,
      "progress": {
        "current": 5,
        "target": 10,
        "percentage": 50
      }
    }
  ]
}
```

---

### Integrations

#### GET `/api/v1/integrations/available/`

**Purpose**: Get list of available integrations.

**Auth**: Required

**Response** (200):
```json
{
  "integrations": [
    {
      "type": "github",
      "name": "GitHub",
      "description": "Import repositories as projects",
      "icon_url": "https://...",
      "is_connected": true,
      "connected_at": "2024-11-01T12:00:00Z"
    },
    {
      "type": "youtube",
      "name": "YouTube",
      "description": "Import videos as projects",
      "icon_url": "https://...",
      "is_connected": false
    }
  ]
}
```

---

#### POST `/api/v1/integrations/import-from-url/`

**Purpose**: Import content from external URL.

**Auth**: Required

**Request**:
```json
{
  "url": "https://github.com/alice/cool-repo",
  "auto_create_project": true
}
```

**Response** (202):
```json
{
  "task_id": "celery-task-uuid",
  "status": "pending",
  "message": "Import started"
}
```

---

#### GET `/api/v1/integrations/tasks/{task_id}/`

**Purpose**: Check status of async import task.

**Auth**: Required

**Response** (200):
```json
{
  "task_id": "celery-task-uuid",
  "status": "completed",  // pending, processing, completed, failed
  "progress": 100,
  "result": {
    "project_id": 102,
    "project_slug": "cool-repo",
    "url": "/alice/cool-repo"
  },
  "error": null
}
```

---

### Semantic Search

#### GET `/api/v1/search/semantic/`

**Purpose**: Semantic search across projects, tools, and users.

**Query Parameters**:
- `q` (str, required): Search query
- `type` (str): `projects`, `tools`, `users`, `all` (default)
- `limit` (int): Max results per type (default: 10)

**Response** (200):
```json
{
  "query": "chatbot with gpt-4",
  "results": {
    "projects": [
      {
        "id": 101,
        "title": "AI Chatbot Demo",
        "score": 0.92,
        "highlight": "...conversational <em>chatbot</em> built with <em>GPT-4</em>...",
        "url": "/alice/ai-chatbot-demo"
      }
    ],
    "tools": [
      {
        "id": 1,
        "name": "GPT-4",
        "score": 0.88,
        "url": "/tools/gpt-4"
      }
    ],
    "users": []
  }
}
```

---

### Health & Monitoring

#### GET `/api/v1/db/health/`

**Purpose**: Database health check (unauthenticated).

**Response** (200):
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "celery": "healthy",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

## WebSocket API

### Connection

**URL**: `wss://allthrive.ai/ws/chat/{conversation_id}/`  
**Protocol**: WebSocket (RFC 6455)

**Authentication**: JWT token via query parameter or cookie

**Connection Example**:
```javascript
const ws = new WebSocket(
  `wss://allthrive.ai/ws/chat/${conversationId}/`,
  [], 
  { headers: { 'Cookie': `sessionid=${sessionId}` } }
);
```

---

### Client → Server Messages

#### Send Message

```json
{
  "message": "How do I create a chatbot with GPT-4?"
}
```

#### Heartbeat Ping

```json
{
  "type": "ping"
}
```

---

### Server → Client Messages

#### Connection Confirmed

```json
{
  "event": "connected",
  "conversation_id": "uuid-1234",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

#### Task Queued

```json
{
  "event": "task_queued",
  "task_id": "celery-task-uuid",
  "timestamp": "2024-11-29T12:00:01Z"
}
```

---

#### Streaming Chunk

```json
{
  "event": "stream_chunk",
  "content": "To create a chatbot with GPT-4, you'll need to...",
  "chunk_index": 5,
  "timestamp": "2024-11-29T12:00:02Z"
}
```

---

#### Complete Response

```json
{
  "event": "message_complete",
  "message_id": "msg-uuid",
  "full_content": "...",
  "metadata": {
    "model": "gpt-4",
    "tokens_used": 450,
    "response_time_ms": 1200
  },
  "timestamp": "2024-11-29T12:00:05Z"
}
```

---

#### Error

```json
{
  "event": "error",
  "error": "Rate limit exceeded. Try again in 5 minutes.",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

#### Heartbeat Pong

```json
{
  "event": "pong",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

### Connection Lifecycle

1. **Connect**: Client opens WebSocket connection
2. **Authenticate**: Server validates JWT/cookie
3. **Confirm**: Server sends `connected` event
4. **Message Loop**:
   - Client sends message
   - Server queues task (sends `task_queued`)
   - AI agent processes (streams `stream_chunk` events)
   - Server sends `message_complete`
5. **Heartbeat**: Client sends `ping` every 30s, server responds with `pong`
6. **Disconnect**: Either side closes connection

---

### Error Codes

| Code | Reason | Description |
|------|--------|-------------|
| 4001 | Unauthorized | Authentication failed |
| 4003 | Forbidden | Origin not allowed (CSRF) |
| 4004 | Not Found | Conversation not found |
| 4008 | Policy Violation | Rate limit exceeded |
| 1000 | Normal Closure | Clean disconnect |

---

## Error Handling

### Standard Error Response

All REST API errors follow this structure:

```json
{
  "error": "Validation failed",
  "details": {
    "title": ["This field is required."],
    "external_url": ["Enter a valid URL."]
  },
  "code": "validation_error",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |
| 202 | Accepted | Async task started |
| 204 | No Content | Successful DELETE (no response body) |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Authenticated but not permitted |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (e.g., duplicate project) |
| 422 | Unprocessable Entity | Semantic validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Temporary outage or maintenance |

---

### Rate Limiting

**Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1701264000
```

**Limits**:
- **Anonymous**: 60 requests/hour
- **Authenticated**: 1000 requests/hour
- **WebSocket messages**: 20 messages/minute
- **Project creation**: 10 projects/hour
- **Quiz attempts**: 5 attempts/hour per quiz

**Rate Limit Error** (429):
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 300,
  "limit": 1000,
  "window": "hour",
  "timestamp": "2024-11-29T12:00:00Z"
}
```

---

## Pagination

All list endpoints support cursor-based pagination:

**Request**:
```http
GET /api/v1/projects/explore/?page=2&page_size=20
```

**Response**:
```json
{
  "count": 500,
  "next": "https://api/v1/projects/explore/?page=3&page_size=20",
  "previous": "https://api/v1/projects/explore/?page=1&page_size=20",
  "results": [...]
}
```

**Limits**:
- Default `page_size`: 20
- Max `page_size`: 100

---

## Filtering & Sorting

### Common Query Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `search` | string | `?search=chatbot` | Full-text search |
| `ordering` | string | `?ordering=-created_at` | Sort order (prefix `-` for descending) |
| `page` | int | `?page=2` | Page number |
| `page_size` | int | `?page_size=50` | Results per page |

### Model-Specific Filters

**Projects**:
- `?category=chatbots`
- `?tool=gpt-4`
- `?topic=ml`
- `?is_showcase=true`

**Tools**:
- `?pricing_model=free`
- `?is_featured=true`

**Quizzes**:
- `?difficulty=beginner`
- `?category=machine-learning`

---

## Webhooks (Future)

### Webhook Events

- `project.created`
- `project.updated`
- `project.liked`
- `achievement.earned`
- `quiz.completed`

### Webhook Payload

```json
{
  "event": "project.created",
  "timestamp": "2024-11-29T12:00:00Z",
  "data": {
    "project_id": 102,
    "user_id": 123,
    "slug": "my-new-project"
  }
}
```

---

## CORS Policy

**Allowed Origins** (production):
- `https://allthrive.ai`
- `https://www.allthrive.ai`

**Allowed Methods**: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`  
**Allowed Headers**: `Authorization`, `Content-Type`, `X-CSRFToken`  
**Credentials**: `true` (cookies allowed)

**Development**:
- `http://localhost:3000`
- `http://localhost:8000`

---

## Content Security Policy

**CSP Header**:
```http
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; 
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.allthrive.ai wss://allthrive.ai;
```

---

## API Usage Examples

### Create Project (cURL)

```bash
curl -X POST https://allthrive.ai/api/v1/me/projects/ \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF_TOKEN" \
  -d '{
    "title": "My AI Project",
    "description": "A cool experiment",
    "type": "prompt",
    "is_showcase": true,
    "tools": [1, 5],
    "topics": ["ai", "ml"]
  }'
```

---

### WebSocket Chat (JavaScript)

```javascript
const ws = new WebSocket(`wss://allthrive.ai/ws/chat/${conversationId}/`);

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ message: 'Hello, AI!' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.event === 'stream_chunk') {
    console.log('Chunk:', data.content);
  } else if (data.event === 'message_complete') {
    console.log('Done:', data.full_content);
  }
};
```

---

### Pagination (Python)

```python
import requests

url = 'https://allthrive.ai/api/v1/projects/explore/'
headers = {'Authorization': f'Bearer {jwt_token}'}
params = {'page_size': 50, 'ordering': '-like_count'}

response = requests.get(url, headers=headers, params=params)
data = response.json()

print(f"Total projects: {data['count']}")
for project in data['results']:
    print(f"- {project['title']} ({project['like_count']} likes)")
```

---

## Deprecation Policy

### Deprecation Process

1. **Announcement** (T-0): Add `X-API-Deprecation-Warning` header
2. **Documentation** (T-0): Update docs with migration guide
3. **Grace Period** (12 months): Maintain backwards compatibility
4. **Removal** (T+12 months): Remove deprecated endpoint

### Migration Headers

```http
X-API-Deprecation-Warning: This endpoint will be removed on 2025-12-31. 
  Use /api/v2/projects/ instead.
X-API-Deprecation-Date: 2025-12-31
X-API-Alternative: /api/v2/projects/
```

---

## Future Enhancements

### Planned API Additions

1. **GraphQL endpoint** (`/api/graphql/`) for flexible querying
2. **Batch operations** (bulk project updates)
3. **Real-time notifications** via Server-Sent Events (SSE)
4. **API key management** for third-party integrations
5. **Webhooks** for event-driven integrations
6. **API usage analytics dashboard**

---

**Version**: 1.0  
**Status**: Stable  
**Review Cadence**: Quarterly
