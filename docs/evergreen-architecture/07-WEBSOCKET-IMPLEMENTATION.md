# WebSocket Implementation Guide

**Last Updated**: 2025-11-30  
**Status**: Production-ready ✅

## Overview

This document provides a comprehensive guide to how WebSockets work in AllThrive AI, serving as a reference to prevent issues and facilitate debugging when problems arise.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Authentication Flow](#authentication-flow)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Configuration & Deployment](#configuration--deployment)
7. [Security Features](#security-features)
8. [Debugging & Troubleshooting](#debugging--troubleshooting)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Testing Guide](#testing-guide)

---

## Architecture Overview

### High-Level Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  React   │ HTTP    │  Django  │  Redis  │  Celery  │  Redis  │  Django  │
│ Frontend ├────────►│   REST   ├────────►│  Worker  ├────────►│ Channels │
│          │  Token  │   API    │  Queue  │          │  Pub/Sub│ Consumer │
└────┬─────┘         └──────────┘         └──────────┘         └─────┬────┘
     │                                                                 │
     │                WebSocket Connection                            │
     │ ws://backend/ws/chat/<conversation_id>/?connection_token=xxx  │
     └─────────────────────────────────────────────────────────────►│
                                                                       │
                              Streaming Response                      │
     ◄─────────────────────────────────────────────────────────────◄─┘
```

### Component Responsibilities

1. **React Frontend** (`useIntelligentChat` hook)
   - Requests short-lived connection token via HTTP
   - Establishes WebSocket connection with token
   - Sends user messages
   - Receives and displays streaming responses
   - Handles reconnection with exponential backoff

2. **Django REST API** (`views_token.py`)
   - Authenticates user via HTTP-only cookies (JWT)
   - Generates secure, single-use connection tokens
   - Stores tokens in Redis with 60-second TTL

3. **Django Channels** (`consumers.py`)
   - Validates connection token on WebSocket handshake
   - Authenticates user via custom JWT middleware
   - Queues messages to Celery for processing
   - Joins Redis Pub/Sub channel for conversation
   - Forwards streaming chunks to client

4. **Celery Worker** (`tasks.py`)
   - Processes chat messages asynchronously
   - Invokes LangGraph agents
   - Publishes streaming chunks to Redis Pub/Sub
   - Handles rate limiting and circuit breaking

5. **Redis**
   - **DB 0**: Celery broker and result backend
   - **DB 1**: LangGraph checkpointing
   - **DB 2**: Django cache (connection tokens, rate limiting)
   - **DB 3**: Django Channels layer (Pub/Sub)

---

## Technology Stack

### Backend Dependencies

From `requirements.txt`:
```txt
channels>=4.0.0              # Django Channels for WebSocket
channels-redis>=4.2.0        # Redis backend for Channels
daphne>=4.0.0               # ASGI server for Django Channels
websockets>=12.0            # WebSocket client for testing
djangorestframework-simplejwt>=5.3.0  # JWT authentication
redis>=5.0.1                # Redis client
celery>=5.3.4               # Task queue
```

### Frontend Dependencies

From `frontend/package.json`:
- Native browser `WebSocket` API (no library needed)
- React hooks for state management

---

## Authentication Flow

WebSocket authentication uses a **two-step token exchange** pattern for security:

### Step 1: HTTP Token Generation

**Frontend → Backend (HTTP)**

```typescript
// frontend/src/hooks/useIntelligentChat.ts
const response = await fetch('/api/v1/auth/ws-connection-token/', {
  method: 'POST',
  credentials: 'include',  // Sends HTTP-only JWT cookie
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': getCookie('csrftoken'),
  },
  body: JSON.stringify({
    connection_id: `chat-${conversationId}-${Date.now()}`,
  }),
});

const { connection_token } = await response.json();
```

**Backend generates token:**

```python
# core/auth/views_token.py
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_ws_connection_token(request):
    token_service = get_ws_token_service()
    connection_token = token_service.generate_token(
        user_id=request.user.id,
        username=request.user.username,
        connection_id=connection_id
    )
    return Response({
        'connection_token': connection_token,
        'expires_in': 60,  # seconds
    })
```

**Token stored in Redis:**

```python
# core/agents/ws_connection_tokens.py
cache_key = f'ws_conn_token:{token}'
token_data = {
    'user_id': user_id,
    'username': username,
    'connection_id': connection_id,
    'created_at': time.time(),
    'used': False,
}
cache.set(cache_key, token_data, timeout=60)  # 60 seconds
```

### Step 2: WebSocket Connection

**Frontend → Backend (WebSocket)**

```typescript
const wsUrl = `ws://localhost:8000/ws/chat/${conversationId}/?connection_token=${token}`;
const ws = new WebSocket(wsUrl);
```

**Backend validates and consumes token (single-use):**

```python
# core/agents/middleware.py
class JWTAuthMiddleware:
    async def __call__(self, scope, receive, send):
        # Extract connection_token from query string
        params = parse_qs(scope.get('query_string', b'').decode())
        connection_token = params.get('connection_token', [None])[0]
        
        if connection_token:
            # Validate and consume (deletes from Redis)
            scope['user'] = await get_user_from_connection_token(connection_token)
```

### Why This Two-Step Approach?

1. **Security**: Connection tokens are short-lived (60s) and single-use
2. **Separation of concerns**: WebSocket tokens can't be used for API access
3. **Cross-origin support**: Works with HTTP-only cookies + WebSocket query params
4. **Audit trail**: All token generation and usage is logged

---

## Backend Implementation

### File Structure

```
core/agents/
├── consumers.py              # WebSocket consumer (receives/sends messages)
├── routing.py                # WebSocket URL routing
├── middleware.py             # JWT authentication middleware
├── ws_connection_tokens.py   # Connection token service
├── tasks.py                  # Celery tasks for message processing
├── security.py               # Rate limiting
└── metrics.py                # Metrics collection

core/auth/
└── views_token.py            # HTTP endpoint for token generation

config/
├── asgi.py                   # ASGI application configuration
└── settings.py               # Django settings (Channels, Redis)
```

### ASGI Configuration

**`config/asgi.py`**

```python
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

# Initialize Django first
django_asgi_app = get_asgi_application()

from core.agents.middleware import JWTAuthMiddlewareStack
from core.agents.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
```

**Key points:**
- `ProtocolTypeRouter` handles both HTTP and WebSocket protocols
- `AllowedHostsOriginValidator` validates Origin header (CSRF protection)
- `JWTAuthMiddlewareStack` authenticates WebSocket connections
- `URLRouter` routes WebSocket URLs to consumers

### WebSocket Routing

**`core/agents/routing.py`**

```python
from django.urls import path
from .consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/chat/<str:conversation_id>/', ChatConsumer.as_asgi()),
]
```

URL pattern: `ws://backend/ws/chat/<conversation_id>/?connection_token=<token>`

### Consumer Implementation

**`core/agents/consumers.py`**

```python
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle WebSocket connection"""
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.user = self.scope.get('user')
        self.group_name = f'chat_{self.conversation_id}'
        
        # Validate origin (CSRF protection)
        headers = dict(self.scope.get('headers', []))
        origin = headers.get(b'origin', b'').decode()
        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin and origin not in allowed_origins:
            await self.close(code=4003)
            return
        
        # Reject unauthenticated users
        if not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        # Join Redis Pub/Sub channel
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'event': 'connected',
            'conversation_id': self.conversation_id,
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data: str):
        """Handle incoming messages from client"""
        data = json.loads(text_data)
        
        # Handle heartbeat
        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'event': 'pong'}))
            return
        
        message = data.get('message', '').strip()
        
        # Rate limiting
        rate_limiter = RateLimiter()
        is_allowed, retry_after = rate_limiter.check_message_rate_limit(self.user.id)
        if not is_allowed:
            await self.send_error(f'Rate limit exceeded. Try again in {retry_after//60} minutes.')
            return
        
        # Queue to Celery for processing
        task = process_chat_message_task.delay(
            conversation_id=self.conversation_id,
            message=message,
            user_id=self.user.id,
            channel_name=self.group_name,
        )
        
        # Confirm task queued
        await self.send(text_data=json.dumps({
            'event': 'task_queued',
            'task_id': str(task.id),
        }))

    async def chat_message(self, event: dict):
        """Receive message from Redis Pub/Sub (sent by Celery)"""
        await self.send(text_data=json.dumps(event))
```

**Key features:**
- Origin validation (CSRF protection)
- Authentication check
- Rate limiting
- Heartbeat (ping/pong)
- Celery task queuing
- Redis Pub/Sub for broadcasting

### Authentication Middleware

**`core/agents/middleware.py`**

```python
class JWTAuthMiddleware:
    """
    Authenticates WebSocket connections using connection tokens or JWT cookies.
    
    Priority:
    1. Connection token (preferred - short-lived, single-use)
    2. HTTP cookie (fallback for direct connections)
    3. Query parameter 'token' (fallback for API clients)
    """
    
    async def __call__(self, scope, receive, send):
        if scope['type'] != 'websocket':
            return await self.app(scope, receive, send)
        
        # Parse query string
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        
        # Priority 1: Connection token
        connection_token = params.get('connection_token', [None])[0]
        if connection_token:
            scope['user'] = await get_user_from_connection_token(connection_token)
            return await self.app(scope, receive, send)
        
        # Priority 2: HTTP-only cookie
        token = self._extract_jwt_from_cookies(scope)
        
        # Priority 3: Query parameter
        if not token:
            token = params.get('token', [None])[0]
        
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        return await self.app(scope, receive, send)
```

### Connection Token Service

**`core/agents/ws_connection_tokens.py`**

```python
class WebSocketConnectionTokenService:
    @staticmethod
    def generate_token(user_id: int, username: str, connection_id: str) -> str:
        """Generate secure connection token"""
        token = secrets.token_urlsafe(32)  # 256 bits of entropy
        
        cache_key = f'ws_conn_token:{token}'
        token_data = {
            'user_id': user_id,
            'username': username,
            'connection_id': connection_id,
            'created_at': time.time(),
            'used': False,
        }
        cache.set(cache_key, token_data, timeout=60)  # 60 seconds
        
        return token
    
    @staticmethod
    def validate_and_consume_token(token: str) -> int | None:
        """Validate and consume token (single-use)"""
        cache_key = f'ws_conn_token:{token}'
        token_data = cache.get(cache_key)
        
        if not token_data or token_data.get('used'):
            return None
        
        # Consume token (delete from Redis)
        cache.delete(cache_key)
        
        return token_data.get('user_id')
```

**Security features:**
- Cryptographically secure random tokens (256-bit entropy)
- 60-second TTL (short-lived)
- Single-use (deleted after first use)
- Full audit trail (all operations logged)

---

## Frontend Implementation

### React Hook: `useIntelligentChat`

**Location**: `frontend/src/hooks/useIntelligentChat.ts`

```typescript
export function useIntelligentChat({
  conversationId,
  onError,
  autoReconnect = true
}: UseIntelligentChatOptions) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const MAX_MESSAGES = 100;  // Message history limit
  
  // ... implementation
}
```

### Connection Flow

```typescript
const connect = useCallback(async () => {
  // Prevent race conditions
  if (isConnecting) return;
  if (!isAuthenticated) return;
  
  setIsConnecting(true);
  
  // Step 1: Get connection token
  const response = await fetch('/api/v1/auth/ws-connection-token/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken'),
    },
    body: JSON.stringify({
      connection_id: `chat-${conversationId}-${Date.now()}`,
    }),
  });
  
  const { connection_token } = await response.json();
  
  // Step 2: Connect to WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || 'localhost:8000';
  const wsUrl = `${protocol}//${wsHost}/ws/chat/${conversationId}/?connection_token=${connection_token}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    setIsConnected(true);
    setIsConnecting(false);
    setReconnectAttempts(0);
    startHeartbeat();
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  ws.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
  };
  
  ws.onclose = (event) => {
    setIsConnected(false);
    setIsConnecting(false);
    if (autoReconnect && !intentionalCloseRef.current) {
      scheduleReconnect();
    }
  };
  
  wsRef.current = ws;
}, [isAuthenticated, conversationId]);
```

### Message Handling

```typescript
const handleWebSocketMessage = (data: WebSocketMessage) => {
  switch (data.event) {
    case 'connected':
      // Connection confirmed
      break;
    
    case 'task_queued':
      setIsLoading(true);
      break;
    
    case 'processing_started':
      // Create new assistant message
      currentMessageIdRef.current = `msg-${Date.now()}`;
      currentMessageRef.current = '';
      break;
    
    case 'chunk':
      // Append chunk to current message
      currentMessageRef.current += data.chunk;
      setMessages((prev) => {
        const existingIndex = prev.findIndex(m => m.id === currentMessageIdRef.current);
        if (existingIndex >= 0) {
          // Update existing message
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: currentMessageRef.current,
          };
          return updated;
        } else {
          // Add new message
          const newMessages = [...prev, {
            id: currentMessageIdRef.current,
            content: currentMessageRef.current,
            sender: 'assistant',
            timestamp: new Date(),
          }];
          return newMessages.slice(-MAX_MESSAGES);  // Limit history
        }
      });
      break;
    
    case 'complete':
      setIsLoading(false);
      break;
    
    case 'error':
      onError?.(data.error);
      setIsLoading(false);
      break;
  }
};
```

### Reconnection Strategy

**Exponential backoff with max attempts:**

```typescript
const scheduleReconnect = useCallback(() => {
  if (!autoReconnect || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    onError?.('Max reconnection attempts reached');
    return;
  }
  
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),  // Exponential
    MAX_RECONNECT_DELAY
  );
  
  setTimeout(() => {
    setReconnectAttempts(prev => prev + 1);
    connect();
  }, delay);
}, [reconnectAttempts, autoReconnect]);
```

**Backoff schedule:**
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds
- Attempt 5: 16 seconds (capped at 30s max)

### Heartbeat (Keep-Alive)

```typescript
const startHeartbeat = useCallback(() => {
  heartbeatIntervalRef.current = setInterval(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, HEARTBEAT_INTERVAL);  // 30 seconds
}, []);
```

**Backend responds:**
```python
if data.get('type') == 'ping':
    await self.send(text_data=json.dumps({'event': 'pong'}))
    return
```

**Frontend ignores pong:**
```typescript
if (data.event === 'pong') {
  return;  // Silent acknowledgment
}
```

### Message History Limit

To prevent memory issues in long sessions:

```typescript
const MAX_MESSAGES = 100;

setMessages((prev) => {
  const newMessages = [...prev, userMessage];
  return newMessages.slice(-MAX_MESSAGES);  // Keep last 100
});
```

---

## Configuration & Deployment

### Django Settings

**`config/settings.py`**

```python
# ASGI application
ASGI_APPLICATION = 'config.asgi.application'

# Redis for Django Channels
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://redis:6379/3')],
            'capacity': 1500,  # Max messages per channel
            'expiry': 10,      # Message expiry (seconds)
        },
    },
}

# CORS (allow WebSocket origin)
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
```

### Docker Compose

**`docker-compose.yml`**

```yaml
services:
  redis:
    image: redis/redis-stack-server:latest
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379/3  # DB 3 for Channels
    depends_on:
      redis:
        condition: service_healthy
    command: sh /app/scripts/startup.sh

  celery:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379/3
    depends_on:
      - redis
    command: celery -A config worker --pool=solo --loglevel=info
```

### Startup Script

**`scripts/startup.sh`**

```bash
#!/bin/sh
python manage.py migrate
python manage.py collectstatic --noinput

# Start Django with runserver (uses ASGI via channels)
exec python manage.py runserver 0.0.0.0:8000
```

**Note**: `runserver` in Django with Channels automatically uses Daphne (ASGI server)

### Production Deployment

For production, replace `runserver` with Daphne:

```bash
# Dockerfile
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
```

Or use Gunicorn with Uvicorn workers:

```bash
CMD ["gunicorn", "config.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Environment Variables

**`.env.example`**

```bash
# Redis (multiple databases)
REDIS_URL=redis://redis:6379/3          # Channels (WebSocket)
CELERY_BROKER_URL=redis://redis:6379/0  # Celery
CELERY_RESULT_BACKEND=redis://redis:6379/0
CACHE_URL=redis://redis:6379/2          # Django cache (connection tokens)

# CORS (frontend origin)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# JWT (authentication)
SIMPLE_JWT_AUTH_COOKIE=access_token
SIMPLE_JWT_REFRESH_COOKIE=refresh_token
```

---

## Security Features

### 1. Connection Token Security

**Threat**: Unauthorized WebSocket connections

**Mitigation**:
- Short-lived tokens (60 seconds)
- Single-use tokens (deleted after first use)
- Separate from access tokens (limited scope)
- Full audit trail (all operations logged)

### 2. Origin Validation

**Threat**: Cross-Site WebSocket Hijacking (CSWSH)

**Mitigation**:
```python
# core/agents/consumers.py
headers = dict(self.scope.get('headers', []))
origin = headers.get(b'origin', b'').decode()
allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
if origin and origin not in allowed_origins:
    await self.close(code=4003)
    return
```

### 3. Authentication Check

**Threat**: Unauthenticated access

**Mitigation**:
```python
if not self.user.is_authenticated:
    await self.close(code=4001)
    return
```

### 4. Rate Limiting

**Threat**: Message flooding, abuse

**Mitigation**:
```python
# core/agents/security.py
rate_limiter = RateLimiter()
is_allowed, retry_after = rate_limiter.check_message_rate_limit(user_id)
if not is_allowed:
    await self.send_error(f'Rate limit exceeded')
    return
```

### 5. Input Sanitization

**Threat**: XSS, injection attacks

**Mitigation**:
- Message length limits (10,000 characters)
- Content sanitization in backend
- Stored in database (escaped on output)

### 6. TLS/SSL in Production

**Threat**: Man-in-the-middle attacks

**Mitigation**:
- Use `wss://` (WebSocket Secure) in production
- Enforce HTTPS for HTTP API calls

---

## Debugging & Troubleshooting

### Backend Logging

**Enable DEBUG logging:**

```python
# config/settings.py
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'core.agents': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'channels': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

**Key log messages:**

```
[WS_TOKEN] Generated connection token: user=john (id=1), ttl=60s
[WS_TOKEN] Successfully consumed connection token: user=john (id=1), age=2.34s
[WS_AUTH] Authenticated via connection token: user=john, path=/ws/chat/123/
WebSocket connected: user=1, conversation=123
WebSocket disconnected: user=1, code=1000
```

### Frontend Debugging

**Enable console logging:**

```typescript
// Set these to see detailed logs
console.log('[WebSocket] Attempting connection...', { isAuthenticated, conversationId });
console.log('[WebSocket] Fetching connection token...');
console.log('[WebSocket] Connection token received');
console.log('[WebSocket] Creating connection to:', wsUrl);
console.log('[WebSocket] Connection opened');
console.log('[WebSocket] Message received:', data);
```

**Monitor network in DevTools:**
1. Open Chrome DevTools → Network tab
2. Filter: WS (WebSocket)
3. Click WebSocket connection
4. View Messages tab

### Redis Debugging

**Check connection tokens:**

```bash
# Connect to Redis
docker exec -it allthriveai-redis-1 redis-cli

# List all connection tokens
127.0.0.1:6379> KEYS ws_conn_token:*

# Inspect token data
127.0.0.1:6379> GET ws_conn_token:abc123...

# Check TTL
127.0.0.1:6379> TTL ws_conn_token:abc123...
```

**Check Channels layer:**

```bash
# Switch to DB 3
127.0.0.1:6379> SELECT 3

# List channels
127.0.0.1:6379[3]> KEYS *

# Monitor real-time activity
127.0.0.1:6379[3]> MONITOR
```

### Test WebSocket Connection

**`scripts/test_websocket.py`**

```python
import asyncio
import json
import websockets

async def test_websocket():
    uri = "ws://localhost:8000/ws/chat/test-conversation/?connection_token=YOUR_TOKEN"
    
    async with websockets.connect(uri) as websocket:
        print("Connected!")
        
        # Send message
        await websocket.send(json.dumps({
            "message": "Hello, AI!"
        }))
        
        # Receive responses
        while True:
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Received: {data}")

asyncio.run(test_websocket())
```

---

## Common Issues & Solutions

### Issue 1: Connection Token Expired

**Symptoms:**
- WebSocket closes immediately with code 4001
- Backend logs: `[WS_TOKEN] Invalid or expired token`

**Cause**: Token expired (60-second TTL) before WebSocket connected

**Solution:**
1. Reduce time between token fetch and WebSocket connection
2. Implement retry logic (fetch new token)
3. Check for network latency issues

**Frontend fix:**
```typescript
try {
  const token = await fetchConnectionToken();
  // Connect immediately (don't delay)
  const ws = new WebSocket(buildWsUrl(token));
} catch (error) {
  // Retry with new token
  retry();
}
```

---

### Issue 2: Race Condition (Multiple Connections)

**Symptoms:**
- Multiple WebSocket connections created
- Messages received multiple times
- High memory usage

**Cause**: Async state updates allow concurrent connection attempts

**Solution:**
```typescript
const [isConnecting, setIsConnecting] = useState(false);

const connect = async () => {
  if (isConnecting) {
    console.warn('[WebSocket] Connection already in progress');
    return;  // Prevent race condition
  }
  setIsConnecting(true);
  // ... connection logic
  setIsConnecting(false);
};
```

**Verification:**
- Check console for "[WebSocket] Connection already in progress"
- Network tab should show single WebSocket connection

---

### Issue 3: Heartbeat Errors

**Symptoms:**
- Backend logs: `JSON decode error` for ping messages
- Connection drops after ~30 seconds

**Cause**: Backend doesn't handle `ping` message type

**Solution (Backend):**
```python
# core/agents/consumers.py
async def receive(self, text_data: str):
    data = json.loads(text_data)
    
    # Handle heartbeat ping
    if data.get('type') == 'ping':
        await self.send(text_data=json.dumps({'event': 'pong'}))
        return  # Don't process as chat message
```

**Solution (Frontend):**
```typescript
// Ignore pong responses
if (data.event === 'pong') {
  return;  // Silent acknowledgment
}
```

---

### Issue 4: Memory Leak (Message History)

**Symptoms:**
- Browser slows down after long chat sessions
- High memory usage
- Slow rendering

**Cause**: Unbounded message array growth

**Solution:**
```typescript
const MAX_MESSAGES = 100;

setMessages((prev) => {
  const newMessages = [...prev, userMessage];
  return newMessages.slice(-MAX_MESSAGES);  // Keep last 100 only
});
```

---

### Issue 5: Origin Validation Rejects Connection

**Symptoms:**
- WebSocket closes with code 4003
- Backend logs: `WebSocket connection from unauthorized origin: http://attacker.com`

**Cause**: Origin not in `CORS_ALLOWED_ORIGINS`

**Solution:**
```python
# config/settings.py
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://yourdomain.com',  # Add production origin
]
```

**Development workaround:**
```python
# ONLY for local development, NEVER in production
if DEBUG:
    CORS_ALLOWED_ORIGINS.append('http://localhost:3000')
```

---

### Issue 6: Connection Drops After Token Refresh

**Symptoms:**
- WebSocket disconnects after ~15 minutes (JWT expiration)
- User must reload page to reconnect

**Cause**: JWT access token expires, connection token service rejects new tokens

**Solution**: ⚠️ **Not yet implemented (P1 priority)**

Proposed solution:
1. Backend sends `token_expiring_soon` event 2 minutes before expiration
2. Frontend proactively refreshes JWT via HTTP
3. Frontend gracefully closes WebSocket and reconnects with new connection token

```typescript
// Proposed implementation
if (data.event === 'token_expiring_soon') {
  await refreshAccessToken();  // HTTP call
  await reconnect();           // Get new connection token
}
```

---

## Testing Guide

### Unit Tests

**Test connection token service:**

```python
# tests/test_ws_tokens.py
from core.agents.ws_connection_tokens import get_ws_token_service

def test_generate_token():
    service = get_ws_token_service()
    token = service.generate_token(user_id=1, username='test', connection_id='test-1')
    assert token
    assert len(token) > 20  # Sufficient entropy

def test_validate_and_consume_token():
    service = get_ws_token_service()
    token = service.generate_token(user_id=1, username='test', connection_id='test-1')
    
    # First use: valid
    user_id = service.validate_and_consume_token(token)
    assert user_id == 1
    
    # Second use: invalid (single-use)
    user_id = service.validate_and_consume_token(token)
    assert user_id is None

def test_token_expiration():
    import time
    service = get_ws_token_service()
    token = service.generate_token(user_id=1, username='test', connection_id='test-1')
    
    # Wait for expiration (61 seconds)
    time.sleep(61)
    
    user_id = service.validate_and_consume_token(token)
    assert user_id is None  # Expired
```

### Integration Tests

**Test WebSocket connection:**

```python
# tests/test_websocket.py
import pytest
from channels.testing import WebsocketCommunicator
from core.agents.consumers import ChatConsumer

@pytest.mark.asyncio
async def test_websocket_connection():
    communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/test/")
    connected, subprotocol = await communicator.connect()
    assert connected
    
    # Receive connection confirmation
    response = await communicator.receive_json_from()
    assert response['event'] == 'connected'
    
    await communicator.disconnect()

@pytest.mark.asyncio
async def test_message_flow():
    communicator = WebsocketCommunicator(ChatConsumer.as_asgi(), "/ws/chat/test/")
    await communicator.connect()
    
    # Send message
    await communicator.send_json_to({
        'message': 'Hello, AI!'
    })
    
    # Receive task_queued
    response = await communicator.receive_json_from()
    assert response['event'] == 'task_queued'
    
    await communicator.disconnect()
```

### Load Testing

See `load_testing/locustfile.py` for WebSocket load tests.

---

## Future Enhancements

### P1 - High Priority

- [ ] **Token Refresh Handling**: Graceful reconnection before JWT expires
- [ ] **Message Queue Persistence**: Store messages during offline periods
- [ ] **Connection State Machine**: Formal states (CONNECTING, OPEN, CLOSING, CLOSED)

### P2 - Medium Priority

- [ ] **Smart Heartbeat**: Only send pings when idle (reduce network traffic)
- [ ] **Message Deduplication**: Prevent duplicate messages after reconnection
- [ ] **Performance Metrics**: Connection time, round-trip latency, message throughput
- [ ] **Reconnection UI**: Show "Reconnecting... 2/5" to user

### P3 - Low Priority

- [ ] **Binary Message Support**: Send images, files via WebSocket
- [ ] **Compression**: Enable WebSocket compression (permessage-deflate)
- [ ] **Multi-Tab Sync**: Share WebSocket across browser tabs

---

## Rollback Plan

If WebSocket issues arise in production:

1. **Check logs** (backend and frontend) for error patterns
2. **Monitor Redis** for connection token issues
3. **Revert recent changes** to `consumers.py`, `middleware.py`, `useIntelligentChat.ts`
4. **Fallback to polling** (temporary):
   ```typescript
   // Fallback: poll for messages instead of WebSocket
   const pollMessages = async () => {
     const response = await fetch(`/api/v1/messages/${conversationId}/`);
     const messages = await response.json();
     setMessages(messages);
   };
   setInterval(pollMessages, 2000);  // Poll every 2 seconds
   ```

---

## References

- [Django Channels Documentation](https://channels.readthedocs.io/)
- [WebSocket Protocol (RFC 6455)](https://datatracker.ietf.org/doc/html/rfc6455)
- [OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Redis Pub/Sub Documentation](https://redis.io/topics/pubsub)
- [Previous WebSocket fixes](../archived/WEBSOCKET_FIXES.md)

---

## Changelog

| Date       | Change                                      | Author |
|------------|---------------------------------------------|--------|
| 2025-11-30 | Initial comprehensive documentation         | Warp AI|
| 2025-11-29 | Fixed P0 issues (race condition, heartbeat) | Team   |

---

**Maintainer**: Backend Team  
**Last Review**: 2025-11-30  
**Next Review**: 2026-02-28 (or when WebSocket issues arise)
