# WebSocket Troubleshooting Guide

This guide documents common WebSocket issues and their solutions for the AllThrive AI platform.

## Quick Diagnostics

### 1. Check Service Health

```bash
# Check all services are running
docker compose ps

# Expected: All services should show "healthy" or "running"
# Key services: web, redis, celery
```

### 2. Check Backend Logs

```bash
# Watch WebSocket-related logs
docker compose logs web --tail=50 | grep -E "(WS_|WebSocket)"

# Look for:
# - [WS_TOKEN] Generated connection token: ✓
# - [WS_TOKEN] Successfully consumed: ✓
# - [WS_AUTH] Authenticated via connection token: ✓
# - WebSocket CONNECT: ✓
```

### 3. Check Browser Console

Look for these patterns:
- `[WebSocket] ws-connection-token failed with status 500` → Backend error
- `[WebSocket] Connection failed` → Network/proxy issue
- `[WebSocket] Auth failed (code 4001)` → Authentication issue

---

## Common Issues and Solutions

### Issue 1: "ws-connection-token failed with status 500"

**Symptoms:**
- Browser console shows 500 error on `/api/v1/auth/ws-connection-token/`
- WebSocket shows "Offline" status

**Common Causes:**

1. **Redis not available**
   ```bash
   # Check Redis
   docker compose exec redis redis-cli ping
   # Should return: PONG
   ```

2. **Backend container restarting**
   ```bash
   docker compose ps
   # Check if web container is restarting
   ```

3. **User not authenticated**
   - Check if you're logged in
   - Try logging out and back in
   - Clear cookies and refresh

**Solution:**
```bash
# Restart backend services
make restart-backend

# Or restart everything
make restart-all
```

---

### Issue 2: Docker Frontend vs Local Frontend Conflict

**Symptoms:**
- Intermittent 500 errors
- WebSocket connects but messages don't appear
- Port 3000 already in use errors

**Cause:** Docker frontend container and local Vite dev server competing for port 3000.

**Solution:**
```bash
# Option A: Use local frontend (recommended for development)
docker compose stop frontend
cd frontend && npm run dev -- --port 3000

# Option B: Use Docker frontend only
pkill -f vite  # Kill local frontend
docker compose up frontend -d
```

**Prevention:** Add to your workflow:
```bash
# Before starting local frontend
docker compose stop frontend
```

---

### Issue 3: Messages Not Displaying (Empty Chat)

**Symptoms:**
- WebSocket shows "Live" (connected)
- Chunks received in console (you can see `chunk` events)
- But no messages visible in UI

**Cause:** The `customContent` prop issue in ChatInterface.

**How to Verify:**
```javascript
// In browser console, look for:
// - chunk events being received ✓
// - But no visible messages in UI ✗
```

**Root Cause:** React fragments (`<></>`) are truthy even when containing only null children. If `customContent={<>{null}</>}` is passed, the messages never render.

**Solution:** Ensure `customContent` is `undefined` (not an empty fragment) when you want messages to display.

```tsx
// ❌ Wrong - empty fragment is truthy
customContent={
  <>
    {showA ? <ComponentA /> : null}
    {showB ? <ComponentB /> : null}
  </>
}

// ✅ Correct - return undefined when nothing to show
customContent={
  showA ? <ComponentA /> :
  showB ? <ComponentB /> :
  undefined
}
```

**Test Coverage:** `frontend/src/components/chat/ChatInterface.test.tsx`

---

### Issue 4: WebSocket Connection Timeout

**Symptoms:**
- Connection attempt times out after 10 seconds
- Reconnection attempts happen but fail

**Common Causes:**

1. **Vite proxy not configured**
   ```typescript
   // vite.config.ts - verify /ws proxy exists
   '/ws': {
     target: process.env.VITE_WS_PROXY_TARGET || 'ws://localhost:8000',
     ws: true,
     changeOrigin: true,
   }
   ```

2. **Wrong environment variables**
   ```bash
   # When running local frontend, set:
   VITE_API_PROXY_TARGET=http://localhost:8000
   VITE_WS_PROXY_TARGET=ws://localhost:8000
   ```

3. **Daphne (ASGI server) not running**
   ```bash
   docker compose logs web | grep -i daphne
   # Should see: "Starting ASGI/Daphne"
   ```

---

### Issue 5: Authentication Failures (Code 4001)

**Symptoms:**
- WebSocket closes with code 4001
- "Unauthenticated WebSocket connection attempt" in logs

**Causes:**

1. **Connection token expired** (60-second TTL)
   - Token was generated but WebSocket connection was slow

2. **Token already used** (single-use)
   - Duplicate connection attempts consumed the token

3. **Cookie not sent**
   - Cross-origin issues
   - Cookies blocked by browser

**Solution:**
1. Check CORS settings in Django settings.py
2. Ensure `credentials: 'include'` in fetch calls
3. Verify cookie domain settings

---

### Issue 6: Messages Received But Duplicated

**Symptoms:**
- Same message appears multiple times
- Happens especially after reconnection

**Cause:** React StrictMode causes double-mounting, or reconnection doesn't clear message state.

**Solution:** The hook includes message deduplication:
```typescript
// useIntelligentChat.ts uses seenMessageIds to prevent duplicates
const seenMessageIds = useRef<Set<string>>(new Set());
```

---

## Development Workflow

### Recommended Setup

```bash
# Terminal 1: Backend (Docker)
make up

# Terminal 2: Frontend (Local for hot reload)
docker compose stop frontend
cd frontend && npm run dev -- --port 3000

# Terminal 3: Watch logs
docker compose logs -f web celery
```

### Testing WebSocket Manually

```bash
# Run the WebSocket test script
cd /Users/allierays/Sites/allthriveai
python scripts/test_websocket.py
```

---

## Automated Tests

### Backend Tests
```bash
# Run WebSocket-specific tests
docker compose exec web python manage.py test core.agents.tests.test_websocket

# Tests cover:
# - Token generation and validation
# - Single-use token enforcement
# - API endpoint authentication
# - Redis cache integration
```

### Frontend Tests
```bash
cd frontend && npm test -- --run src/components/chat/ChatInterface.test.tsx

# Tests cover:
# - Message rendering with customContent prop
# - Empty fragment edge case
# - Loading and visibility states
```

---

## Monitoring

### Prometheus Metrics

Available at http://localhost:9090:

- `allthrive_chat_messages_total` - Total messages by type
- `allthrive_active_conversations` - Current WebSocket connections
- `allthrive_rate_limit_hits_total` - Rate limit violations

### Key Log Prefixes

| Prefix | Location | Meaning |
|--------|----------|---------|
| `[WS_TOKEN]` | Token service | Token generation/validation |
| `[WS_TOKEN_API]` | API endpoint | Token request handling |
| `[WS_AUTH]` | Middleware | WebSocket authentication |
| `[WS_SEND]` | Consumer | Message forwarding |

---

## Emergency Procedures

### Complete Reset

```bash
# Nuclear option - full restart
make restart-all

# Wait for all services to be healthy
docker compose ps
```

### Redis Issues

```bash
# Clear WebSocket tokens (they expire in 60s anyway)
docker compose exec redis redis-cli KEYS "ws_conn_token:*"
docker compose exec redis redis-cli FLUSHDB  # Careful: clears all cache

# Restart Redis only
docker compose restart redis
```

### Check Channel Layer

```python
# In Django shell
docker compose exec web python manage.py shell

from channels.layers import get_channel_layer
channel_layer = get_channel_layer()
print(channel_layer)  # Should show RedisChannelLayer
```

---

## Architecture Reference

```
Browser                    Vite Proxy                 Django/Daphne
   |                          |                            |
   |-- GET /api/v1/auth/ws-connection-token/ ------------->|
   |<------------------- { connection_token } -------------|
   |                          |                            |
   |-- WS /ws/chat/{id}/?connection_token=xxx ------------>|
   |                          |                            |
   |                     JWTAuthMiddleware                 |
   |                          |                            |
   |                     ChatConsumer.connect()            |
   |<------------------- { event: 'connected' } ---------- |
   |                          |                            |
   |-- { message: 'Hello' } ------------------------------>|
   |                          |                            |
   |                     Celery Task                       |
   |                          |                            |
   |<-- { event: 'chunk', content: '...' } via Redis ------|
```

---

## Contact

If issues persist after following this guide:
1. Check recent commits for WebSocket-related changes
2. Review the test files for expected behavior
3. Check Sentry/error tracking for backend exceptions
