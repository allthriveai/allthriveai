# Auth Chat API Documentation

## Overview

The Auth Chat API provides a conversational, AI-powered authentication experience using LangGraph and Server-Sent Events (SSE) streaming.

---

## Endpoints

### 1. Start/Continue Chat Session

**Endpoint**: `POST /api/auth/chat/stream/`

**Description**: Streaming endpoint for auth chat. Sends AI responses via Server-Sent Events (SSE).

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "session_id": "uuid-v4",  // Optional on first call, required for subsequent
  "action": "start",  // See actions below
  "data": {}  // Depends on action
}
```

**Response**: Server-Sent Events (SSE) stream

**SSE Event Types**:
- `token` - Word-by-word AI response
- `complete` - Message complete with next step info
- `error` - Error occurred

---

### 2. Get Chat State

**Endpoint**: `GET /api/auth/chat/state/?session_id=<uuid>`

**Description**: Get current state of auth chat session.

**Response**:
```json
{
  "session_id": "uuid",
  "step": "welcome",
  "mode": "signup",
  "messages": [...],
  "has_email": false,
  "has_name": false,
  "has_password": false,
  "has_interests": false,
  "agreed_to_values": false
}
```

---

## Actions

### `start`

**Description**: Initialize chat and get welcome message

**Request**:
```json
{
  "action": "start"
}
```

**Response Stream**:
```
data: {"type": "token", "content": "Hey "}
data: {"type": "token", "content": "there! "}
data: {"type": "token", "content": "👋 "}
data: {"type": "complete", "step": "welcome", "mode": "signup", "session_id": "uuid"}
```

---

### `submit_email`

**Description**: Submit email address

**Request**:
```json
{
  "session_id": "uuid",
  "action": "submit_email",
  "data": {
    "email": "john@example.com"
  }
}
```

**Response Stream** (new user):
```
data: {"type": "token", "content": "Awesome! "}
data: {"type": "token", "content": "Let's "}
data: {"type": "token", "content": "create "}
data: {"type": "token", "content": "your "}
data: {"type": "token", "content": "account! "}
data: {"type": "complete", "step": "name", "mode": "signup", "session_id": "uuid"}
```

**Response Stream** (existing user):
```
data: {"type": "token", "content": "Welcome "}
data: {"type": "token", "content": "back, "}
data: {"type": "token", "content": "John! "}
data: {"type": "complete", "step": "password", "mode": "login", "session_id": "uuid"}
```

**Validation Errors**:
```
data: {"type": "error", "message": "Please enter a valid email address"}
```

---

### `submit_name`

**Description**: Submit first and last name (signup only)

**Request**:
```json
{
  "session_id": "uuid",
  "action": "submit_name",
  "data": {
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Response Stream**:
```
data: {"type": "token", "content": "Great! "}
data: {"type": "token", "content": "Now "}
data: {"type": "token", "content": "let's "}
data: {"type": "token", "content": "secure "}
data: {"type": "token", "content": "your "}
data: {"type": "token", "content": "account "}
data: {"type": "complete", "step": "password", "mode": "signup", "session_id": "uuid"}
```

---

### `submit_password`

**Description**: Submit password (login or signup)

**Request**:
```json
{
  "session_id": "uuid",
  "action": "submit_password",
  "data": {
    "password": "securepass123"
  }
}
```

**Response Stream** (login - success):
```
data: {"type": "token", "content": "Welcome "}
data: {"type": "token", "content": "back! "}
data: {"type": "token", "content": "🎉 "}
data: {"type": "complete", "step": "complete", "mode": "login", "session_id": "uuid"}
```

**Response Stream** (signup):
```
data: {"type": "token", "content": "Nice! "}
data: {"type": "token", "content": "What "}
data: {"type": "token", "content": "brings "}
data: {"type": "token", "content": "you "}
data: {"type": "token", "content": "to "}
data: {"type": "token", "content": "AllThrive? "}
data: {"type": "complete", "step": "interests", "mode": "signup", "session_id": "uuid"}
```

**Validation Errors**:
```
data: {"type": "error", "message": "Password must be at least 8 characters"}
data: {"type": "error", "message": "Invalid password"}  // Login failed
```

---

### `submit_interests`

**Description**: Submit interests (multi-select, signup only)

**Request**:
```json
{
  "session_id": "uuid",
  "action": "submit_interests",
  "data": {
    "interests": ["explore", "mentor"]
  }
}
```

**Valid Interest Values**:
- `explore` - Explore
- `share_skills` - Share my skills
- `invest` - Invest in AI projects
- `mentor` - Mentor others

**Response Stream**:
```
data: {"type": "token", "content": "Love "}
data: {"type": "token", "content": "it! "}
data: {"type": "token", "content": "Here "}
data: {"type": "token", "content": "are "}
data: {"type": "token", "content": "our "}
data: {"type": "token", "content": "values... "}
data: {"type": "complete", "step": "values", "mode": "signup", "session_id": "uuid"}
```

---

### `agree_values`

**Description**: Agree to core values (signup only)

**Request**:
```json
{
  "session_id": "uuid",
  "action": "agree_values"
}
```

**Response Stream**:
```
data: {"type": "token", "content": "🎉 "}
data: {"type": "token", "content": "Welcome "}
data: {"type": "token", "content": "to "}
data: {"type": "token", "content": "AllThrive! "}
data: {"type": "complete", "step": "complete", "mode": "signup", "session_id": "uuid"}
```

**Side Effect**: User account is created and user is automatically logged in

---

## User Flow

### New User Signup

```
1. start → "Welcome to AllThrive! 👋"
2. submit_email → "Awesome! Let's create your account!"
3. submit_name → "Great! Now let's secure your account"
4. submit_password → "Nice! What brings you to AllThrive?"
5. submit_interests → "Love it! Here are our values..."
6. agree_values → "🎉 Welcome to AllThrive!"
   → Account created, auto-logged in
```

### Returning User Login

```
1. start → "Welcome to AllThrive! 👋"
2. submit_email → "Welcome back, John! 👋"
3. submit_password → "Welcome back! 🎉"
   → Logged in
```

### OAuth User (First Time)

```
1. OAuth redirect → Account created with email/name from provider
2. Redirected to /auth?setup=true
3. submit_interests → "What brings you to AllThrive?"
4. agree_values → "🎉 Welcome to AllThrive!"
   → Profile completed, auto-logged in
```

---

## Frontend Integration

### Using EventSource (SSE)

```javascript
const sessionId = generateUUID(); // Or retrieve from state

// Make POST request
fetch('/api/auth/chat/stream/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionId,
    action: 'start'
  })
}).then(response => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  function readStream() {
    reader.read().then(({ done, value }) => {
      if (done) return;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'token') {
            // Append token to current message
            appendToken(data.content);
          } else if (data.type === 'complete') {
            // Message complete
            handleComplete(data.step, data.mode);
          } else if (data.type === 'error') {
            // Show error
            showError(data.message);
          }
        }
      });

      readStream();
    });
  }

  readStream();
});
```

### Submit User Input

```javascript
function submitEmail(email) {
  fetch('/api/auth/chat/stream/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      action: 'submit_email',
      data: { email }
    })
  }).then(/* handle stream */);
}

function submitInterests(interests) {
  fetch('/api/auth/chat/stream/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      action: 'submit_interests',
      data: { interests: ['explore', 'mentor'] }
    })
  }).then(/* handle stream */);
}
```

---

## State Persistence

- Sessions are stored in Redis with 30-minute TTL
- State includes: messages, step, mode, collected data
- Use `session_id` consistently across requests
- Check state with `/api/auth/chat/state/` to resume

---

## Error Handling

### Validation Errors

Returned immediately as error events:
```
data: {"type": "error", "message": "Email is required"}
```

### System Errors

```
data: {"type": "error", "message": "Internal error message"}
```

### Common Errors

- Invalid email format
- Password too short (< 8 chars)
- Password missing letter or number
- No interests selected
- Invalid session_id

---

## Testing

### Using curl

**Start chat**:
```bash
curl -X POST http://localhost:8000/api/auth/chat/stream/ \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

**Submit email**:
```bash
curl -X POST http://localhost:8000/api/auth/chat/stream/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "your-session-id",
    "action": "submit_email",
    "data": {"email": "test@example.com"}
  }'
```

**Check state**:
```bash
curl "http://localhost:8000/api/auth/chat/state/?session_id=your-session-id"
```

---

## Configuration

### Environment Variables

```bash
# Redis URL (default: redis://localhost:6379)
REDIS_URL=redis://localhost:6379

# Session TTL in seconds (default: 1800 = 30 min)
AUTH_CHAT_SESSION_TTL=1800

# AI Provider (default: azure)
DEFAULT_AI_PROVIDER=azure
```

---

## Security

- Sessions expire after 30 minutes
- Passwords are never logged or exposed in responses
- User messages show "••••••••" for password inputs
- CSRF exempt for SSE streaming (consider token-based auth)
- Email normalization (lowercase, trimmed)

---

## Monitoring

### Key Metrics

- Session creation rate
- Completion rate (reached "complete" step)
- Drop-off by step
- Login vs signup ratio
- Average time to completion
- Error rate by validation type

---

## Troubleshooting

### Stream not working

- Check CORS headers
- Verify SSE is not buffered by proxy (X-Accel-Buffering: no)
- Ensure EventSource polyfill for older browsers

### State not persisting

- Check Redis connection
- Verify session_id is being passed correctly
- Check TTL hasn't expired

### AI responses not streaming

- Verify AIProvider is configured
- Check AI API keys are set
- Review temperature and max_tokens settings
