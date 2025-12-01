# Unified Intelligent Chat - Architecture Plan

**Vision:** Create ONE intelligent chat interface that handles both project creation and support seamlessly. Users interact with a single conversational AI that automatically detects their intent and switches between helping them create projects (from GitHub, YouTube, uploads, URLs) and providing support.

**Core Requirements:**
- **Single Chat Interface**: One conversation thread for all user needs
- **Automatic Mode Switching**: AI detects whether user wants to create a project or needs help
- **Project Creation**: Import from GitHub, YouTube, file uploads, or any URL
- **Support**: Answer questions, troubleshoot issues, guide users
- **ChatGPT-Style + Menu**: Quick access to integrations (GitHub, YouTube, Upload, URL)
- **No Context Loss**: Seamless transitions between project creation and support modes
- **Backend Agent Integration**: Connect to existing LangGraph streaming agent at `/api/v1/project/chat/stream/`

**Security & Scale Requirements:**
- **Security**: Prompt injection protection, content moderation, output validation
- **Scalability**: Handle 100,000 concurrent users
- **Content Moderation**: OpenAI Moderation API + profanity filter for all user input and AI output
- **Rate Limiting**: Per-user limits on agent calls, project creation, API usage
- **Auto-Scraping**: Extract content from URLs with proper security checks
- **AI Analysis**: Auto-tag projects with tools/topics, generate marketing copy
- **Future Integrations**: Extensible to 10+ integrations (Midjourney, Replit, Figma, etc.)

---

## Current State Analysis

### ✅ What We Have
- **Backend Agent**: LangGraph agent at `/api/v1/project/chat/stream/` with SSE streaming
- **GitHub Integration**: Working GitHub import with OAuth
- **YouTube Integration**: Working YouTube import with OAuth
- **Old Chat Components**: Separate panels for project creation and support (fragmented UX)

### ⚠️ What We Need

**MVP (Phase 1):**
- **Unified Chat Interface**: Single chat that handles both project creation AND support
- **Automatic Mode Detection**: AI that detects user intent and switches modes seamlessly
- **ChatGPT-Style UX**: + button with integration dropdown (GitHub, YouTube, Upload, URL)
- **Backend Integration**: Connect frontend chat to existing streaming agent via SSE
- **No Context Loss**: Keep conversation history when switching between modes

**Security & Scale (Phase 2):**
- **Content Moderation**: Validate all user input and AI-generated output
- **Prompt Injection Protection**: Filter malicious prompts before sending to agent
- **Rate Limiting**: Per-user limits on agent calls and project creation
- **PostgreSQL Checkpointer**: Replace in-memory state for production scale
- **Caching Layer**: Cache AI analysis results to reduce costs at scale

**Future Enhancements (Phase 3):**
- **Auto-Scraping Engine**: Extract content from any URL with proper security
- **AI Analysis Pipeline**: Auto-tag projects, generate marketing copy
- **10+ Integrations**: Midjourney, Replit, Figma, CodePen, Dribbble, etc.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              UNIFIED INTELLIGENT CHAT                       │
│  ┌────────────────────────────────────────────────┐        │
│  │  [+] Add Integration ▼  [Type message...]      │        │
│  │  │                                              │        │
│  │  ├─ Add from GitHub                            │        │
│  │  ├─ Add from YouTube                           │        │
│  │  ├─ Upload File                                │        │
│  │  └─ Paste URL                                  │        │
│  └────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  RouterAgent    │
                    │  (Intent        │
                    │   Detection)    │
                    └─────────────────┘
                              ↓
                   ┌──────────┴──────────┐
                   │                     │
          ┌────────▼────────┐   ┌───────▼────────┐
          │  SupportAgent   │   │ ProjectCreation│
          │                 │   │     Agent      │
          │  - Help         │   │  - GitHub      │
          │  - Questions    │   │  - YouTube     │
          │  - Troubleshoot │   │  - Upload      │
          └─────────────────┘   │  - URL         │
                                └────────┬───────┘
                                         │
                              ┌──────────▼──────────┐
                              │  Security Layer     │
                              │  - Prompt Injection │
                              │  - Content Mod      │
                              │  - Rate Limiting    │
                              └──────────┬──────────┘
                                         │
                              ┌──────────▼──────────┐
                              │  Backend Agent      │
                              │  (LangGraph +       │
                              │   SSE Stream)       │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
          ┌─────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
          │  Integration     │  │  Scraping      │  │  AI Analysis   │
          │  Framework       │  │  Engine        │  │  Pipeline      │
          │                  │  │                │  │                │
          │  - GitHub        │  │  - URL Extract │  │  - Auto-tag    │
          │  - YouTube       │  │  - Web Scrape  │  │  - Marketing   │
          │  - Upload/URL    │  │  - Security    │  │  - Summarize   │
          │  - Future: 10+   │  │    Checks      │  │  - Moderate    │
          └──────────────────┘  └────────────────┘  └────────────────┘
```

**Key Concepts**:
- **One Chat, Two Modes**: RouterAgent detects intent (support vs project creation)
- **Security First**: All input/output passes through security filters
- **Scalable**: Ready for 100,000 users with proper rate limiting and caching

---

## 🚨 Critical Issues from Scalability Review

**Status:** These issues MUST be addressed to scale to 100,000 users.

### **Scalability Blockers:**
1. **SSE won't scale** - Each connection holds server resources; 100k SSE = server crash
   - **Solution:** Use WebSockets with Redis Pub/Sub for distributed message routing

2. **Synchronous LangGraph = blocking** - 1000 concurrent users = 50 minute queue time
   - **Solution:** Async task queue with Celery for non-blocking message processing

3. **PostgreSQL checkpointer = bottleneck** - 833 writes/second at 100k users (83% DB capacity)
   - **Solution:** Two-tier caching (Redis hot storage + PostgreSQL cold storage)

4. **No circuit breaker** - If OpenAI goes down, all 100k users see errors
   - **Solution:** Circuit breaker pattern with graceful degradation (cached FAQs)

5. **No gradual rollout** - "Big bang" deployment = high risk
   - **Solution:** Feature flags with 1% → 10% → 50% → 100% rollout

6. **No monitoring** - Can't detect issues before users complain
   - **Solution:** Prometheus + Grafana metrics, Sentry error tracking

7. **No load testing** - Testing with "100 requests" won't find 100k user issues
   - **Solution:** Load test at 1k, 10k, 100k users with Locust/k6

### **Architecture Issues:**
8. **Frontend agents doing backend work** - Move all business logic to backend LangGraph agent
9. **Missing backend integration** - Placeholder API calls that don't exist
10. **Keyword-based intent detection** - Too fragile, move to backend LLM-based detection

### **Security Issues:**
11. **No input validation** - Need max length, sanitization, profanity filter
12. **User ID from frontend** - NEVER trust frontend, extract from JWT on backend
13. **No rate limiting** - Need client-side checks + backend enforcement
14. **No prompt injection protection** - Need pattern matching + LLM-based detection

**Cost Analysis (100k users):**
- 8M messages/day × $0.03/1k tokens = **$3,600/month** (unoptimized)
- With caching + GPT-3.5-turbo: **$600/month** (optimized)
- Infrastructure (Redis, PostgreSQL, servers): **$1,100/month**
- **Total: $1,700/month for 100k users**

---

## Implementation Phases - REVISED FOR SCALE

### 🏗️ Phase 0: Infrastructure & Monitoring (Week 1)
**Goal:** Set up foundational infrastructure before building features

**Why First:** Can't test scalability without infrastructure. Monitoring catches issues early.

**Tasks:**

1. **Redis Setup**
   - Configure Redis for two-tier caching (hot storage)
   - Set up Redis connection pool (max 50 connections)
   - Add Redis health check endpoint
   - Configure eviction policy: `allkeys-lru` for cache

2. **Monitoring Stack**
   - Set up Prometheus for metrics collection
   - Configure Grafana dashboards:
     * WebSocket connections count
     * Message throughput (msg/sec)
     * LLM response latency (p50, p95, p99)
     * Redis cache hit rate
     * PostgreSQL query performance
     * Celery queue depth
   - Add Sentry for error tracking (if not already configured)
   - Create custom metrics for agent interactions

3. **Load Testing Setup**
   - Install Locust or k6
   - Write test scenarios:
     * 1k concurrent users sending messages
     * 10k concurrent users browsing
     * 100k total users over 1 hour
   - Set up CI/CD integration for automated load tests

**Testing Ladder:**
- ✅ 100 concurrent users (baseline)
- ⏳ 1,000 concurrent users (Phase 1 target)
- ⏳ 10,000 concurrent users (Phase 3 target)
- ⏳ 100,000 concurrent users (Phase 4 target)

---

### 🔒 Phase 1: Backend Security & LangGraph (Week 2-3)
**Goal:** Secure the backend and add proper persistence before scaling

**Why Second:** Security must be in place before exposing to users. LangGraph checkpointer needed for persistence.

**Backend Tasks:**

1. **Input Validation & Sanitization**
   - Add max message length (5000 chars) on backend endpoint
   - Implement prompt injection detection (pattern matching + LLM-based)
   - Add profanity filter using existing moderation service
   - Sanitize all user input before passing to LangGraph agent

2. **Authentication & Authorization**
   - Add `@login_required` to `/api/v1/project/chat/stream/`
   - Extract user ID from JWT token (NEVER trust frontend)
   - Validate user has permission to create projects
   - Add CSRF protection

3. **Rate Limiting with Circuit Breaker**
   - Per-user agent call limits: 50 messages/hour (Redis-backed)
   - Per-user project creation: 10 projects/hour
   - IP-based rate limiting for anonymous users
   - **Circuit breaker for OpenAI API:**
     ```python
     from circuitbreaker import circuit

     @circuit(failure_threshold=5, recovery_timeout=60)
     def call_openai_api(prompt):
         # If 5 failures, circuit opens for 60 seconds
         # Return cached FAQ responses during outage
     ```
   - Return clear error messages when limits hit

4. **Two-Tier Conversation Persistence**
   - **Hot Storage (Redis):**
     ```python
     # Cache recent conversation state in Redis (15 min TTL)
     def get_conversation_state(conversation_id):
         cached = redis.get(f'chat:{conversation_id}')
         if cached:
             return json.loads(cached)

         # Fallback to PostgreSQL
         state = PostgresSaver.get_state(conversation_id)
         redis.setex(f'chat:{conversation_id}', 900, json.dumps(state))
         return state
     ```
   - **Cold Storage (PostgreSQL via LangGraph):**
     ```python
     from langgraph.checkpoint.postgres import PostgresSaver

     # In graph.py
     checkpointer = PostgresSaver.from_conn_string(settings.DATABASE_URL)
     graph = graph.compile(checkpointer=checkpointer)
     ```
   - LangGraph automatically creates these tables:
     * `checkpoints` - Stores conversation state snapshots
     * `checkpoint_writes` - Stores pending writes
   - Add conversation retrieval endpoint: `GET /api/v1/chat/sessions/{conversation_id}/`
   - Auto-cleanup expired conversations (Celery task, query LangGraph checkpoints table + Redis)

5. **Backend Mode Detection (LLM-based)**
   - Move intent detection to backend LangGraph agent (use LLM reasoning, not keywords)
   - Add system prompt variations for support vs project-creation modes
   - Return mode in stream: `{"event": "mode_change", "mode": "support"}`
   - Cache mode detection results in Redis (5 min TTL)

**Testing:**
- Test rate limiting with 100 rapid requests
- Test prompt injection attempts (OWASP test suite)
- Test conversation persistence across server restarts
- Test authentication bypass attempts
- **Load test: 1,000 concurrent users** (target: <2s response time)

---

### 🎨 Phase 2: WebSocket Backend + Celery (Week 4-5)
**Goal:** Replace SSE with WebSockets and add async processing for scalability

**Why Now:** SSE won't scale to 100k users. Need async processing before building frontend.

**Backend Tasks:**

1. **WebSocket Implementation with Redis Pub/Sub**
   ```python
   # /core/agents/websocket_handler.py
   import asyncio
   from channels.generic.websocket import AsyncWebsocketConsumer
   import redis.asyncio as redis

   class ChatConsumer(AsyncWebsocketConsumer):
       async def connect(self):
           self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
           self.channel_name = f'chat_{self.conversation_id}'

           # Join Redis channel
           await self.channel_layer.group_add(
               self.channel_name,
               self.channel_name
           )
           await self.accept()

       async def receive(self, text_data):
           # Queue message for async processing
           task_id = send_message_task.delay(
               conversation_id=self.conversation_id,
               message=text_data,
               user_id=self.scope['user'].id
           )

           # Send task ID for tracking
           await self.send(json.dumps({
               'event': 'task_queued',
               'task_id': task_id
           }))

       async def chat_message(self, event):
           # Receive message from Redis Pub/Sub
           await self.send(text_data=json.dumps(event))
   ```

2. **Celery Task Queue for Async Processing**
   ```python
   # /core/agents/tasks.py
   from celery import shared_task
   from channels.layers import get_channel_layer
   from asgiref.sync import async_to_sync

   @shared_task(bind=True, max_retries=3)
   def send_message_task(self, conversation_id, message, user_id):
       """Process message asynchronously, stream results to WebSocket via Redis"""
       channel_layer = get_channel_layer()

       try:
           # Get conversation state from Redis → PostgreSQL
           state = get_conversation_state(conversation_id)

           # Stream LangGraph response
           for chunk in graph.stream({"message": message}, state):
               # Publish to Redis channel → WebSocket
               async_to_sync(channel_layer.group_send)(
                   f'chat_{conversation_id}',
                   {
                       'type': 'chat_message',
                       'event': 'agent_message',
                       'chunk': chunk
                   }
               )

           # Save state to Redis + PostgreSQL
           save_conversation_state(conversation_id, state)

       except OpenAIError as e:
           # Circuit breaker kicks in
           if circuit_open():
               fallback_response = get_cached_faq()
               async_to_sync(channel_layer.group_send)(
                   f'chat_{conversation_id}',
                   {'type': 'chat_message', 'event': 'fallback', 'response': fallback_response}
               )
   ```

3. **Django Channels Configuration**
   ```python
   # /config/asgi.py
   from channels.routing import ProtocolTypeRouter, URLRouter
   from channels.auth import AuthMiddlewareStack
   from core.agents.websocket_handler import ChatConsumer

   application = ProtocolTypeRouter({
       'http': get_asgi_application(),
       'websocket': AuthMiddlewareStack(
           URLRouter([
               path('ws/chat/<str:conversation_id>/', ChatConsumer.as_asgi()),
           ])
       ),
   })
   ```

4. **Redis Pub/Sub Layer**
   ```python
   # /config/settings.py
   CHANNEL_LAYERS = {
       'default': {
           'BACKEND': 'channels_redis.core.RedisChannelLayer',
           'CONFIG': {
               'hosts': [('redis', 6379)],
               'capacity': 1500,  # Max messages in queue
               'expiry': 60,  # Message expiry (seconds)
           },
       },
   }
   ```

**Testing:**
- Test WebSocket connection from frontend (dummy client)
- Test Redis Pub/Sub message routing
- Test Celery task execution and streaming
- Test circuit breaker during OpenAI outage (simulate with network block)
- **Load test: 10,000 concurrent WebSocket connections** (target: <3s response time)

---

### 🖥️ Phase 3: Frontend WebSocket Client (Week 6)
**Goal:** Build frontend with WebSocket streaming and proper error handling

**Strategy:** Delete old components, build new unified chat from scratch

**Files to Delete (FIRST):**
- ❌ `/frontend/src/components/projects/RightAddProjectChat.tsx`
- ❌ `/frontend/src/components/chat/RightChatPanel.tsx`
- ❌ `/frontend/src/services/agents/RouterAgent.ts` (keyword-based, replaced by backend LLM)
- ❌ `/frontend/src/services/agents/SupportAgent.ts` (placeholder, no real backend)
- ❌ `/frontend/src/services/agents/ProjectCreationAgent.ts` (contains business logic, should be backend)

**Files to Create:**
- `/frontend/src/components/chat/IntelligentChatPanel.tsx` - Main unified chat
- `/frontend/src/components/chat/ChatPlusMenu.tsx` - + button with integration dropdown
- `/frontend/src/hooks/useWebSocketChat.ts` - WebSocket state management
- `/frontend/src/services/websocketClient.ts` - WebSocket client

**Files to Modify:**
- `/frontend/src/types/chat.ts` - Add ChatMode, IntegrationType, WebSocket event types
- `/frontend/src/components/chat/ChatInterface.tsx` - Support streaming messages
- `/frontend/src/components/layouts/DashboardLayout.tsx` - Replace with IntelligentChatPanel

**Implementation Steps:**

1. **WebSocket Client (Day 1)**
   ```typescript
   // /frontend/src/services/websocketClient.ts
   export class WebSocketChatClient {
     private ws: WebSocket | null = null;
     private reconnectAttempts = 0;
     private maxReconnectAttempts = 5;

     connect(conversationId: string): Promise<WebSocket> {
       return new Promise((resolve, reject) => {
         const url = `wss://${window.location.host}/ws/chat/${conversationId}/`;
         this.ws = new WebSocket(url);

         this.ws.onopen = () => {
           this.reconnectAttempts = 0;
           resolve(this.ws!);
         };

         this.ws.onerror = (error) => {
           reject(error);
         };

         this.ws.onclose = () => {
           // Exponential backoff reconnection
           if (this.reconnectAttempts < this.maxReconnectAttempts) {
             const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
             setTimeout(() => {
               this.reconnectAttempts++;
               this.connect(conversationId);
             }, delay);
           }
         };
       });
     }

     sendMessage(message: string) {
       if (this.ws?.readyState === WebSocket.OPEN) {
         this.ws.send(JSON.stringify({ message }));
       }
     }

     onMessage(callback: (event: MessageEvent) => void) {
       if (this.ws) {
         this.ws.onmessage = callback;
       }
     }

     disconnect() {
       this.ws?.close();
       this.ws = null;
     }
   }
   ```

2. **Build Chat Components (Days 2-3)**
   - Create ChatPlusMenu with integration dropdown (GitHub, YouTube, Upload, URL)
   - Create IntelligentChatPanel with WebSocket streaming
   - Create useWebSocketChat hook (manages connection, reconnection, state)
   - Add mode indicator badge (receives mode from backend via WebSocket)
   - Support streaming message chunks (append in real-time)

3. **Input Validation & Security (Day 2)**
   - Add max length check (5000 chars) before sending
   - Client-side rate limit check (prevent spam)
   - Sanitize input with DOMPurify before display
   - Add loading states to prevent double-submission

4. **Conversation Persistence (Day 4)**
   - Store conversation ID in localStorage
   - Fetch conversation history on mount: `GET /api/v1/chat/sessions/{id}/`
   - Restore messages from backend (PostgreSQL → Redis → Frontend)
   - Handle expired conversations (show "Start new chat" button)

5. **Error Handling & Retry Logic (Day 4)**
   - Handle WebSocket disconnection (auto-reconnect with exponential backoff)
   - Handle network errors (show retry button)
   - Handle rate limit errors (show countdown timer: "Try again in 3:42")
   - Handle auth errors (redirect to login)
   - Handle circuit breaker fallback (show "Using cached responses due to API issues")
   - Use existing `errorMessages.ts` for user-friendly messages

6. **Integration & Testing (Day 5)**
   - Update DashboardLayout to use IntelligentChatPanel
   - Remove old chat components (already deleted in step 1)
   - Test full flows:
     * Paste GitHub URL → Backend detects → Imports → Project created
     * Paste YouTube URL → Backend detects → Imports → Project created
     * Ask support question → Backend answers
     * Mode switching → Backend handles seamlessly
   - Test edge cases:
     * Rapid message sending (rate limit kicks in)
     * Page refresh mid-conversation (restores from backend)
     * Network disconnection/reconnection (auto-reconnects)
     * OpenAI API outage (circuit breaker shows cached FAQs)

**Testing:**
- ✅ WebSocket connection established and maintained
- ✅ User pastes GitHub URL → Backend detects → Imports → Project created
- ✅ User asks "how do I add a project?" → Backend provides support
- ✅ User clicks + menu → Selects integration → Backend guides through
- ✅ Streaming works (chunks appear in real-time)
- ✅ Conversation persists across page refresh
- ✅ Rate limiting works (shows countdown timer)
- ✅ Auto-reconnects on disconnection (exponential backoff)
- ✅ Circuit breaker fallback works during API outage

---

### 🚀 Phase 4: Feature Flags & Gradual Rollout (Week 7-10)
**Goal:** Deploy to production with gradual rollout from 1% → 100%

**Why Now:** Never deploy "big bang" to 100k users. Gradual rollout catches issues early.

**Tasks:**

1. **Feature Flag System**
   ```python
   # /core/feature_flags/service.py
   from django.core.cache import cache
   import hashlib

   class FeatureFlagService:
       def is_enabled(self, flag_name: str, user_id: int) -> bool:
           """Check if feature is enabled for user via percentage rollout"""
           rollout_percentage = cache.get(f'flag:{flag_name}:percentage', 0)

           # Consistent hashing (same user always gets same result)
           user_hash = int(hashlib.md5(f'{flag_name}:{user_id}'.encode()).hexdigest(), 16)
           user_bucket = user_hash % 100

           return user_bucket < rollout_percentage

       def set_rollout(self, flag_name: str, percentage: int):
           """Set rollout percentage (0-100)"""
           cache.set(f'flag:{flag_name}:percentage', percentage, timeout=None)
   ```

2. **Backend Feature Toggle**
   ```python
   # /core/agents/views.py
   from core.feature_flags.service import FeatureFlagService

   flag_service = FeatureFlagService()

   def chat_endpoint(request):
       user_id = request.user.id

       # Feature flag: Use new WebSocket chat vs old SSE
       if flag_service.is_enabled('unified_chat_websocket', user_id):
           return redirect('/ws/chat/')  # New WebSocket endpoint
       else:
           return redirect('/api/v1/project/chat/stream/')  # Old SSE endpoint
   ```

3. **Frontend Feature Toggle**
   ```typescript
   // /frontend/src/hooks/useFeatureFlag.ts
   import { useAuth } from '@/context/AuthContext';

   export function useFeatureFlag(flagName: string): boolean {
     const { user } = useAuth();
     const [isEnabled, setIsEnabled] = useState(false);

     useEffect(() => {
       // Fetch from backend
       api.get(`/api/v1/feature-flags/${flagName}/`)
         .then(res => setIsEnabled(res.data.enabled));
     }, [flagName, user?.id]);

     return isEnabled;
   }

   // Usage in component
   function ChatPanel() {
     const useWebSocket = useFeatureFlag('unified_chat_websocket');

     return useWebSocket
       ? <IntelligentChatPanel />  // New unified chat
       : <RightChatPanel />;        // Old chat (fallback)
   }
   ```

4. **Gradual Rollout Schedule**
   - **Week 7: Internal Testing (0.1% - ~100 users)**
     * Deploy to production with 0.1% rollout
     * Monitor: Error rate, WebSocket connection stability, latency
     * Fix critical bugs before next phase
     * **Load test: 1,000 concurrent users**

   - **Week 8: Early Adopters (1% - ~1,000 users)**
     * Increase to 1% rollout
     * Monitor: Redis cache hit rate, PostgreSQL query performance
     * Collect user feedback via in-app survey
     * **Load test: 10,000 concurrent users**

   - **Week 9: Beta (10% - ~10,000 users)**
     * Increase to 10% rollout
     * Monitor: Celery queue depth, circuit breaker activations
     * Optimize slow queries identified in monitoring
     * **Load test: 50,000 concurrent users**

   - **Week 10: Full Rollout (100% - 100,000 users)**
     * Increase to 50% rollout for 48 hours (canary)
     * If stable, increase to 100%
     * Monitor for 7 days post-rollout
     * **Load test: 100,000 concurrent users**

5. **Rollback Plan**
   ```python
   # Emergency rollback (if errors > 5%)
   flag_service.set_rollout('unified_chat_websocket', 0)

   # All users instantly revert to old SSE chat
   ```

6. **Monitoring Dashboards (Grafana)**
   - **User Segmentation:**
     * Users on new WebSocket chat: X%
     * Users on old SSE chat: Y%
   - **Error Rate Comparison:**
     * New chat error rate: Z%
     * Old chat error rate: W%
   - **Performance Metrics:**
     * WebSocket: p95 latency
     * SSE: p95 latency
   - **Feature Flag Controls:**
     * Button to increase/decrease rollout %
     * Emergency "rollback to 0%" button

**Testing at Each Phase:**
- Monitor error rate (target: <1%)
- Monitor response time (target: <2s p95)
- Monitor Redis cache hit rate (target: >60%)
- Monitor PostgreSQL query time (target: <100ms p95)
- Monitor Celery queue depth (target: <50 tasks)
- Collect user feedback (NPS survey)

**Rollback Triggers:**
- Error rate > 5% for new chat
- Response time > 5s p95
- Circuit breaker activations > 10/hour
- User complaints > 20/day

---

### 🧩 Phase 5: Integration Framework - 10+ Platform Tools (Week 11+)
**Goal:** Expand from 4 tools to 10+ integrations with auto-detection

**MVP Priority (User Selected):**
1. ✅ **Generic Website** - Auto-scrape any URL, extract content, generate project pages

**Future Integrations:**
2. **Midjourney** - Image gallery scraping, prompt extraction
3. **Replit** - Code analysis, tech stack detection
4. **Loveable** - App demo embedding, feature extraction
5. **Figma** - Design file parsing, screenshot generation
6. **CodePen** - Live demo embedding
7. **Dribbble** - Design showcase
8. **Behance** - Portfolio import

**Integration Framework Pattern:**
```
core/integrations/
├── base/
│   ├── integration.py      # BaseIntegration interface
│   ├── registry.py          # Auto-discovery
│   ├── parser.py            # BaseParser for content extraction
├── midjourney/
│   ├── integration.py       # MidjourneyIntegration
│   ├── service.py           # API client
│   ├── ai_analyzer.py       # Prompt extraction, tagging
│   ├── tools.py             # import_midjourney_project tool
├── replit/
│   ├── integration.py
│   ├── service.py
│   ├── ai_analyzer.py
│   ├── tools.py
...
```

**Tool Registration:**
- Each integration's tools.py exports LangChain tools
- Registry auto-discovers and registers all tools at startup
- Agent gets full tool list dynamically

**Auto-Detection Logic:**
```python
def detect_platform_from_url(url: str) -> str:
    patterns = {
        'github.com': 'github',
        'youtube.com|youtu.be': 'youtube',
        'midjourney.com': 'midjourney',
        'replit.com': 'replit',
        'loveable.dev': 'loveable',
        'figma.com': 'figma',
        ...
    }
    # Return matched platform or 'generic_website'
```

**Files to Create:**
- `/core/integrations/midjourney/` (full module)
- `/core/integrations/replit/` (full module)
- `/core/integrations/loveable/` (full module)
- ... (8 more)

**Files to Modify:**
- `/core/integrations/base/registry.py` - Auto-registration
- `/core/agents/project_chat/graph.py` - Dynamic tool loading

---

### 🌐 Phase 3: Scraping & Analysis Pipeline
**Goal:** Extract content, analyze with AI, generate marketing copy

**Components:**

#### 3.1 Web Scraping Engine
**File:** `/core/integrations/web_scraper/service.py`

```python
class WebScraperService:
    def scrape_url(self, url: str) -> dict:
        """Extract text, images, metadata from any URL"""
        # Use httpx + BeautifulSoup
        # Extract: title, description, og:image, content
        # Screenshot with Playwright (optional)

    def extract_images(self, html: str) -> list[str]:
        """Find all images, prioritize og:image, hero images"""

    def extract_metadata(self, html: str) -> dict:
        """Extract OpenGraph, JSON-LD, meta tags"""
```

**Tools:**
- `extract_url_info` (already exists) - Basic URL metadata
- `scrape_website` (NEW) - Full content extraction
- `analyze_website` (NEW) - AI analysis of scraped content

#### 3.2 AI Analysis Pipeline
**Expand existing ai_analyzer.py pattern:**

```python
class ProjectAnalyzer:
    def generate_marketing_copy(self, content: dict) -> dict:
        """Generate compelling project description"""
        # Prompt: "Write engaging marketing copy for..."
        # Return: tagline, description, key_features[]

    def auto_tag_tools(self, content: dict) -> list[str]:
        """Detect tech stack and tools used"""
        # Prompt: "Extract all tools and technologies from..."
        # Return: ['React', 'TypeScript', 'TailwindCSS']

    def auto_tag_categories(self, content: dict) -> list[str]:
        """Categorize project type"""
        # Prompt: "Categorize this project into..."
        # Return: ['Web App', 'AI/ML', 'Design']

    def generate_topics(self, content: dict) -> list[str]:
        """Extract key topics/themes"""
        # Prompt: "Extract main topics/themes..."
        # Return: ['Authentication', 'Real-time Chat', 'Dashboard']
```

**Integration:**
- Each import tool calls analyzer after content extraction
- Results stored in Project model: marketing_copy, detected_tools, categories, topics
- Frontend displays auto-generated content in project page

#### 3.3 Image Analysis
**For uploaded images or scraped images:**

```python
class ImageAnalyzer:
    def analyze_image(self, image_url: str) -> dict:
        """Analyze image with Gemini Flash for vision tasks"""
        # Detect: type (screenshot, design, logo), colors, text
        # Generate: alt_text, description

    def generate_hero_image(self, project_data: dict) -> str:
        """Create marketing hero image with Gemini Flash 3.0"""
        # Using Google's Gemini Flash 3.0 (nano/banana) for image generation
        # Faster and more cost-effective than DALL-E
        # Fallback: Select best from uploaded/scraped images
```

**Files to Create:**
- `/core/integrations/web_scraper/service.py`
- `/core/integrations/web_scraper/ai_analyzer.py`
- `/core/integrations/image_analyzer.py`

---

### 🔒 Phase 4: Security & Moderation Layer
**Goal:** Protect against prompt injection, harmful content, abuse

#### 4.1 Prompt Injection Protection
**File:** `/core/agents/project_chat/security.py`

```python
class PromptInjectionFilter:
    SUSPICIOUS_PATTERNS = [
        r'ignore (previous|all) instructions',
        r'you are now',
        r'system:',
        r'<\|.*?\|>',  # Special tokens
        ...
    ]

    def check_input(self, user_message: str) -> tuple[bool, str]:
        """Detect malicious prompts"""
        # Pattern matching
        # LLM-based detection (optional)
        # Return: (is_safe, reason)

    def sanitize_input(self, message: str) -> str:
        """Remove suspicious patterns"""
```

**Integration:**
- Add filter to agent's input processing
- Reject messages with high injection risk
- Log attempts for monitoring

#### 4.2 Agent Output Validation
**Prevent agent from generating harmful content:**

```python
class OutputValidator:
    def validate_project_data(self, data: dict) -> tuple[bool, str]:
        """Check generated project data for issues"""
        # Check title, description for profanity
        # Validate URLs are legitimate
        # Check for PII exposure

    def moderate_generated_text(self, text: str) -> tuple[bool, list[str]]:
        """OpenAI Moderation API check"""
        # Already exists in moderation.py, reuse
```

#### 4.3 Agent Rate Limiting
**File:** `/core/agents/project_chat/middleware.py`

```python
def check_agent_rate_limit(user_id: int) -> bool:
    """Limit agent calls per user"""
    key = f'agent_calls:user:{user_id}'
    calls = cache.get(key, 0)

    if calls > 50:  # 50 agent calls per hour
        raise RateLimitExceeded('Too many agent requests')

    cache.incr(key)
    cache.expire(key, 3600)
```

**Limits:**
- 50 agent messages per hour per user
- 10 tool calls per agent session
- 5 projects created per hour

**Files to Create:**
- `/core/agents/project_chat/security.py`
- `/core/agents/project_chat/middleware.py`

**Files to Modify:**
- `/core/agents/project_chat/graph.py` - Add security filters

---

### 📊 Phase 5: Scale & Observability
**Goal:** Handle 100,000 users with monitoring

#### 5.1 Database Optimization
- **Indexes** (already reviewed in YouTube scalability):
  - `projects.external_url` (exists)
  - `projects.user_id, created_at` (for profile queries)
  - `project_tags.project_id` (for tag lookups)

- **Connection Pooling**:
  - PostgreSQL: max_connections=200, pool_size=20
  - Redis: connection pool for cache/rate limits

#### 5.2 Caching Strategy
```python
# Cache AI analysis results (expensive)
def get_or_analyze_url(url: str) -> dict:
    cache_key = f'url_analysis:{hashlib.md5(url.encode()).hexdigest()}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    result = analyze_url(url)
    cache.set(cache_key, result, timeout=86400)  # 24 hours
    return result
```

**Cache Layers:**
- URL analysis: 24 hours
- Platform API responses: 1 hour
- User tool connections: 5 minutes

#### 5.3 Async Task Queue
**All long-running operations → Celery:**
- Scraping websites (can take 5-10 seconds)
- AI analysis (GPT-4 calls)
- Image processing
- Bulk imports

**Pattern:**
```python
@shared_task(rate_limit='10/m')  # Already configured
def analyze_and_create_project_task(url: str, user_id: int):
    """Async project creation with progress updates"""
    # Scrape → Analyze → Tag → Create
    # Update progress in Redis for frontend polling
```

#### 5.4 Monitoring & Logging
**Metrics to Track:**
- Agent call latency (p50, p95, p99)
- Tool call success rates
- Integration API errors
- Rate limit hits
- Prompt injection attempts
- Project creation funnel (URL → scraped → analyzed → created)

**Logging:**
- Structured JSON logs for all agent interactions
- Log user_id, conversation_id, tool_calls, duration
- Error tracking with Sentry (if configured)

**Files to Modify:**
- `/core/agents/project_chat/graph.py` - Add metrics
- `/core/integrations/base/integration.py` - Add logging

---

## User Experience Flow

### Happy Path: Paste YouTube URL
1. User opens "+add project" chat
2. Types: "https://youtube.com/watch?v=abc123"
3. **Agent streams response:**
   - "I found a YouTube video! Let me analyze it..."
   - [Tool: extract_url_info] → Detects YouTube
   - [Tool: import_youtube_video] → Fetches metadata, transcript
   - [Tool: analyze_video_content] → Generates marketing copy, tags
   - "I've created your project: 'Building AI Agents with LangGraph'"
4. **Project created with:**
   - Hero: Video thumbnail + embedded player
   - Title: Auto-generated or from video title
   - Description: AI-generated marketing copy
   - Tools: Auto-tagged (Python, LangChain, AI)
   - Category: Tutorial
   - Topics: AI Agents, LangGraph, Automation
5. User redirected to project page

### Happy Path: Upload File
1. User uploads `my-app.zip` (frontend code)
2. **Agent streams:**
   - "Analyzing your uploaded file..."
   - [Tool: extract_file_content] → Unzips, reads package.json
   - [Tool: analyze_code] → Detects React + TypeScript
   - [Tool: generate_project_copy] → Creates description
   - "Created 'React Dashboard App'"
3. **Project page:**
   - Hero: Auto-generated from screenshot (if included) or logo
   - Tools: React, TypeScript, TailwindCSS
   - Category: Web App

### Happy Path: Describe Project
1. User types: "I built a meditation app with daily prompts and voice recording"
2. **Agent streams:**
   - "That sounds great! Let me create your project page..."
   - [Tool: create_project_from_description] → Structured data extraction
   - [Tool: generate_hero_image] → DALL-E image (optional)
   - "Your project 'Meditation Companion' is ready!"
3. **Project page:**
   - Hero: Generated image or placeholder
   - Description: Polished version of user input
   - Tools: Mobile App, Audio
   - Category: Health & Wellness

---

## Implementation Priority

### Must Have (MVP) - User Priorities
1. ✅ Connect frontend to backend agent with full conversation history (Phase 1)
2. ✅ Generic Website integration - auto-scrape any URL (Phase 2)
3. ✅ Web scraping + AI analysis pipeline (Phase 3)
4. ✅ MinIO file upload and storage (Phase 1)
5. ✅ Prompt injection protection (Phase 4)
6. ✅ Agent rate limiting (Phase 4)

### Should Have
7. ⏳ Add more integrations: Midjourney, Replit, Loveable, Figma, etc. (Phase 2)
8. ⏳ Image analysis with Gemini Flash (Phase 3)
9. ⏳ Output validation for all generated content (Phase 4)
10. ⏳ Comprehensive monitoring (Phase 5)

### Nice to Have
11. 🔮 Auto-generated hero images with Gemini Flash 3.0
12. 🔮 Project preview before creation
13. 🔮 Bulk import from channel/profile
14. 🔮 Suggested edits to AI-generated content

---

## Database Schema Changes

### New Tables

#### project_chat_conversations
```sql
CREATE TABLE project_chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL UNIQUE,
    state JSONB NOT NULL,  -- LangGraph state
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_conversations_user_id ON project_chat_conversations(user_id, created_at DESC);
CREATE INDEX idx_conversations_expires_at ON project_chat_conversations(expires_at);
```

#### project_ai_metadata (optional - store AI-generated data separately)
```sql
CREATE TABLE project_ai_metadata (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    marketing_tagline TEXT,
    ai_generated_description TEXT,
    detected_tools JSONB,  -- ['React', 'TypeScript']
    auto_categories JSONB,  -- ['Web App', 'Dashboard']
    auto_topics JSONB,  -- ['Authentication', 'Analytics']
    analysis_version TEXT,  -- Track AI model version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Modified Tables

#### projects
Add columns for AI-generated content:
```sql
ALTER TABLE projects ADD COLUMN marketing_tagline TEXT;
ALTER TABLE projects ADD COLUMN ai_description TEXT;
ALTER TABLE projects ADD COLUMN hero_image_url TEXT;
ALTER TABLE projects ADD COLUMN detected_tools JSONB;
```

---

## API Endpoints

### New Endpoints

#### Project Chat (SSE)
- `POST /api/v1/project/chat/stream/` - Already exists, no changes needed
  - Body: `{message: str, conversation_id?: str}`
  - Returns: SSE stream with agent_message, tool_call, project_created events

#### File Upload
- `POST /api/v1/project/upload/` - NEW
  - Accepts: multipart/form-data (zip, images, etc.)
  - Returns: `{file_id: str, size: int, type: str, minio_url: str}`
  - Max size: 50MB
  - Stores in MinIO (S3-compatible object storage)
  - TTL: 1 hour for temporary uploads (cleanup job)
  - Permanent storage for project assets

#### Integration Status (Generic)
- `GET /api/v1/integrations/status/` - NEW
  - Returns: `{youtube: {connected: bool}, github: {connected: bool}, ...}`
  - Replaces individual `/social/status/google/` calls

---

## Testing Strategy

### Unit Tests
- Each integration's tools (import, analyze, tag)
- Security filters (prompt injection detection)
- AI analyzers (mocked LLM responses)

### Integration Tests
- Full agent flow: URL → scrape → analyze → create
- SSE streaming
- Conversation persistence
- Rate limiting

### E2E Tests
- Paste GitHub URL → verify project created
- Paste YouTube URL → verify project created
- Upload file → verify project created
- Type description → verify project created
- Test all 10+ integrations

### Load Testing
- Simulate 1000 concurrent agent sessions
- 10,000 projects created per hour
- Redis cache hit rates
- PostgreSQL query performance

---

## Risks & Mitigations

### Risk 1: AI Analysis Cost
- **Impact:** GPT-4 calls expensive at scale
- **Mitigation:**
  - Cache analysis results (24 hours)
  - Use GPT-3.5-Turbo for simple tasks
  - Rate limit to 50 agent calls/hour/user

### Risk 2: Scraping Blocked
- **Impact:** Some sites block scrapers (Cloudflare, etc.)
- **Mitigation:**
  - Retry with different user agents
  - Use Playwright for JavaScript-heavy sites
  - Fallback to user manual input if scraping fails

### Risk 3: Prompt Injection
- **Impact:** Users trick agent into harmful actions
- **Mitigation:**
  - Input filtering (Phase 4.1)
  - Structured tool calls (can't execute arbitrary code)
  - Output validation
  - Human-in-the-loop for suspicious requests

### Risk 4: State Management at Scale
- **Impact:** In-memory state doesn't scale
- **Mitigation:**
  - PostgreSQL checkpointer (Phase 1)
  - 24-hour TTL on conversations
  - Auto-cleanup job

---

## Success Metrics

### Performance
- **Agent response time:** < 2 seconds for first token
- **Project creation time:** < 10 seconds end-to-end
- **Cache hit rate:** > 60% for URL analysis
- **Uptime:** 99.9%

### Engagement
- **Adoption rate:** 70% of new projects created via chat
- **Multi-modal usage:** 40% URLs, 30% files, 30% descriptions
- **Integration diversity:** All 10+ integrations used weekly
- **Completion rate:** 80% of started chats → project created

### Quality
- **Auto-tag accuracy:** > 80% (user edits < 20% of tags)
- **Marketing copy quality:** User satisfaction > 4/5
- **Security:** 0 successful prompt injection attacks
- **Moderation:** < 0.1% harmful content published

---

## Development Timeline

### Week 1-2: Foundation (Phase 1)
- Connect frontend to backend agent
- PostgreSQL conversation persistence
- SSE streaming UI

### Week 3-4: Core Integrations (Phase 2)
- Midjourney integration
- Replit integration
- Generic website scraper

### Week 5-6: AI Pipeline (Phase 3)
- Web scraping engine
- AI analysis for marketing copy
- Auto-tagging system

### Week 7: Security (Phase 4)
- Prompt injection filters
- Output validation
- Agent rate limiting

### Week 8: Polish & Scale (Phase 5)
- Monitoring dashboard
- Load testing
- Performance optimization

### Week 9-10: Extended Integrations (Phase 2)
- Loveable, Figma, CodePen, Dribbble, Behance

---

## File Organization & Architecture

### Recommended Structure (Single Intelligent Chat)

```
/frontend/src/
├── components/
│   ├── chat/
│   │   ├── IntelligentChatPanel.tsx       # ✅ CREATED: Main unified chat component
│   │   ├── ChatPlusMenu.tsx               # ✅ CREATED: + button with integration dropdown
│   │   ├── ChatInterface.tsx              # ✅ UPDATED: Reusable chat UI (supports custom input prefix)
│   │   ├── RightChatPanel.tsx             # ❌ TO DELETE: Old multi-panel approach
│   │   └── RightAddProjectChat.tsx        # ❌ TO DELETE: Old project-specific chat
│   │
│   └── projects/
│       # (no chat components here anymore)
│
├── hooks/
│   ├── useIntelligentChat.ts              # ✅ CREATED: Mode-aware chat state
│   ├── useChatSession.ts                  # KEEP: Backend for mode-specific logic
│   └── useAuthChatStream.ts               # KEEP: Auth flow (separate concern)
│
├── services/
│   ├── agents/
│   │   ├── RouterAgent.ts                 # ✅ CREATED: Intent detection & routing
│   │   ├── SupportAgent.ts                # ✅ CREATED: Support mode agent
│   │   ├── ProjectCreationAgent.ts        # ✅ CREATED: Project mode agent
│   │   ├── DiscoveryAgent.ts              # KEEP: Discovery mode (existing)
│   │   └── BaseAgent.ts                   # KEEP: Abstract base (existing)
│   │
│   └── api.ts                             # TODO: Add SSE streaming client
│
├── types/
│   └── chat.ts                            # ✅ UPDATED: Added ChatMode, IntegrationType, IntelligentChatContext
│
└── layouts/
    └── DashboardLayout.tsx                # TODO: Replace old chat with IntelligentChatPanel
```

---

### Backend Structure (No Major Changes)

```
/core/
├── agents/
│   └── project_chat/                      # Existing LangGraph agent
│       ├── graph.py                       # MODIFY: Add mode awareness
│       ├── tools.py                       # MODIFY: Tool registration
│       ├── views.py                       # KEEP: SSE streaming endpoint
│       ├── checkpointer.py                # NEW: PostgreSQL state persistence
│       ├── security.py                    # NEW: Prompt injection filter
│       └── middleware.py                  # NEW: Rate limiting
│
├── integrations/
│   ├── base/
│   │   ├── integration.py                 # KEEP: BaseIntegration
│   │   ├── registry.py                    # KEEP: Auto-discovery
│   │   └── parser.py                      # KEEP: Content extraction
│   │
│   ├── youtube/                           # KEEP: Existing
│   ├── github/                            # KEEP: Existing
│   │
│   └── web_scraper/                       # NEW: Generic website scraping
│       ├── integration.py
│       ├── service.py                     # Web scraping logic
│       ├── ai_analyzer.py                 # Content analysis
│       └── tools.py                       # Agent tools
│
├── moderation/
│   └── services.py                        # KEEP: Content moderation
│
└── migrations/                            # NEW: Schema changes
    └── XXXX_add_chat_conversations.py     # Conversation persistence table
```

---

### Key Changes from Original Plan

#### ❌ **NOT Creating (Simpler Approach):**
- Tabs/multi-context UI → Single conversation thread
- Gradual migration → Clean replacement (local dev only)
- Quick action buttons → + menu instead (ChatGPT-style)

#### ✅ **Creating:**
- `IntelligentChatPanel.tsx` - Main unified chat
- `ChatPlusMenu.tsx` - + button with integration dropdown (GitHub, YouTube, more...)
- `RouterAgent.ts` - Intelligent intent detection
- `ModeRenderer.tsx` - Renders UI based on current mode
- `ChatContextIndicator.tsx` - Subtle mode badge

#### 🗑️ **Removing (Clean Slate):**
- `RightAddProjectChat.tsx` → Logic moves to `ProjectCreationAgent.ts`
- `RightChatPanel.tsx` → Logic moves to `IntelligentChatPanel.tsx`
- `ExampleAgents.ts` → Agents split into individual files

---

### Implementation Strategy (No Migration - Clean Replacement)

**Phase 1: Build New Chat (Week 1)**
```
1. Create IntelligentChatPanel.tsx
2. Create ChatPlusMenu.tsx (+ button with integrations)
3. Create RouterAgent.ts and mode-specific agents
4. Build useIntelligentChat.ts hook
5. Test in isolation
```

**Phase 2: Replace in DashboardLayout (Week 1)**
```
1. Replace RightAddProjectChat with IntelligentChatPanel in DashboardLayout
2. Delete old files immediately (no parallel maintenance)
3. Test full flow
```

**Phase 3: Polish (Week 2)**
```
1. Add animations and transitions
2. Test edge cases
3. Clean up any remaining references
```

**No feature flags, no gradual rollout - just build and replace.**

---

### Critical Files Reference

#### Backend Files

**Agent Core:**
- `/core/agents/project_chat/graph.py` - MODIFY: Add mode awareness to LangGraph
- `/core/agents/project_chat/tools.py` - MODIFY: Register all integration tools
- `/core/agents/project_chat/views.py` - KEEP: SSE streaming endpoint (no changes)
- `/core/agents/project_chat/checkpointer.py` - NEW: PostgreSQL conversation persistence
- `/core/agents/project_chat/security.py` - NEW: Prompt injection protection
- `/core/agents/project_chat/middleware.py` - NEW: Agent rate limiting

**Integrations:**
- `/core/integrations/base/integration.py` - KEEP: BaseIntegration interface
- `/core/integrations/base/registry.py` - KEEP: Auto-discovery pattern
- `/core/integrations/youtube/integration.py` - KEEP: Reference implementation
- `/core/integrations/github/integration.py` - KEEP: Reference implementation
- `/core/integrations/web_scraper/service.py` - NEW: Generic website scraping
- `/core/integrations/web_scraper/ai_analyzer.py` - NEW: AI content analysis
- `/core/integrations/image_analyzer.py` - NEW: Image analysis with Gemini

**Security & Moderation:**
- `/core/moderation/services.py` - KEEP: OpenAI moderation (already exists)

**Database:**
- `/core/migrations/XXXX_chat_conversations.py` - NEW: Conversation persistence

#### Frontend Files

**Chat Components:**
- `/frontend/src/components/chat/IntelligentChatPanel.tsx` - NEW: Main chat interface
- `/frontend/src/components/chat/ChatPlusMenu.tsx` - NEW: + button with integration dropdown
- `/frontend/src/components/chat/ChatContextIndicator.tsx` - NEW: Mode badge
- `/frontend/src/components/chat/ModeRenderer.tsx` - NEW: Mode-specific UI rendering
- `/frontend/src/components/chat/ChatInterface.tsx` - KEEP: Generic chat UI (reuse)

**Hooks:**
- `/frontend/src/hooks/useIntelligentChat.ts` - NEW: Mode-aware state management
- `/frontend/src/hooks/useChatSession.ts` - KEEP: Reuse for backend communication

**Agents:**
- `/frontend/src/services/agents/RouterAgent.ts` - NEW: Intent detection & routing
- `/frontend/src/services/agents/SupportAgent.ts` - NEW: Support mode
- `/frontend/src/services/agents/ProjectCreationAgent.ts` - NEW: Project mode
- `/frontend/src/services/agents/DiscoveryAgent.ts` - KEEP: Discovery mode
- `/frontend/src/services/agents/BaseAgent.ts` - KEEP: Abstract base class

**Layouts:**
- `/frontend/src/components/layouts/DashboardLayout.tsx` - MODIFY: Single chat state

**Types:**
- `/frontend/src/types/chat.ts` - MODIFY: Add ChatMode, mode metadata

**API:**
- `/frontend/src/services/api.ts` - MODIFY: Add SSE client for project chat

**Utilities:**
- `/frontend/src/utils/errorMessages.ts` - KEEP: Error translation (already exists)

#### Infrastructure

- `/config/celery.py` - KEEP: Async task configuration (already configured)
- `/config/settings.py` - MODIFY: Add conversation persistence settings
- `docker-compose.yml` - KEEP: MinIO already configured

---

### Files to Remove (Immediately After Building New Chat)

**Delete these files - no parallel maintenance:**
- `/frontend/src/components/projects/RightAddProjectChat.tsx` - Logic moved to agents
- `/frontend/src/components/chat/RightChatPanel.tsx` - Replaced by IntelligentChatPanel
- `/frontend/src/services/agents/ExampleAgents.ts` - Split into individual agent files

**No technical debt - clean slate approach.**

---

## Multi-Chat Architecture & UX Strategy

### Current Chat Landscape

**Old Chat Interfaces (Being Replaced):**
1. **Support Chat** - Help, knowledge base (menu item exists, basic implementation)
2. **Add Project Chat** - Project creation flow (old component with limited functionality)
3. **Generic Agent Chats** - Discovery, Network, Learning agents (separate panels)

**Old Behavior (Problems):**
- **Mutually Exclusive**: Only one panel open at a time
- **State Isolated**: Each chat manages its own state independently
- **No Context Transfer**: Switching chats loses conversation history
- **No Backend Agent**: Not connected to LangGraph streaming agent
- **Limited to GitHub**: Project chat only supports GitHub import

**New Unified Chat (IntelligentChatPanel):**
- Single conversation thread across all modes
- Automatic intent detection and routing
- Full backend agent integration with SSE streaming
- ChatGPT-style + menu for all integrations
- No context loss when switching modes

### The Multi-Chat Challenge

**User Scenario (Problem):**
```
1. User opens Support Chat → asks "How do I add a project?"
2. Support suggests: "Click Add Project to import from GitHub"
3. User clicks Add Project button
4. ❌ Support Chat closes, loses conversation history
5. ❌ User can't reference support conversation while creating project
6. ❌ No way to return to support conversation
```

**Another Scenario:**
```
1. User in Add Project Chat → uploading a file
2. Encounters error, wants help
3. Clicks Support Chat
4. ❌ Add Project Chat closes, loses upload state
5. ❌ Has to start over after getting help
```

### Proposed Solution: Single Intelligent Chat (Recommended)

#### Approach 1: One Chat, Multiple Modes (Simplest)

**Architecture (ChatGPT-Style UI):**
```
┌─────────────────────────────────────────────────────┐
│           SINGLE INTELLIGENT CHAT                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  💬 Chat with AllThrive  [Currently: Support]│   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                              │   │
│  │     Unified Conversation                     │   │
│  │                                              │   │
│  │     • Agent auto-detects intent              │   │
│  │     • Seamless mode transitions              │   │
│  │     • All history in one stream              │   │
│  │     • Visual indicators for mode changes     │   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [+]  Type a message...                      │   │
│  │   ↓                                          │   │
│  │   Dropdown menu when clicked:                │   │
│  │   • Add from GitHub                          │   │
│  │   • Add from YouTube                         │   │
│  │   • Upload File                              │   │
│  │   • More integrations coming soon...         │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**+ Button Behavior (ChatGPT-style):**
- **Position**: Left side of input box (like ChatGPT)
- **Click**: Opens dropdown with integration options
- **Options**:
  - 📁 Add from GitHub
  - 🎥 Add from YouTube
  - 📄 Upload File
  - 🌐 Paste URL
  - 💬 Get Support
  - 🔍 Discover Tools
  - _More integrations coming soon..._

**Key Insight:** The chat itself IS the interface. No tabs needed.

**How It Works:**

```
User: "How do I add a project?"
  ↓
Agent (Support Mode): "I can help! You can import from GitHub,
                       upload a file, or paste a URL."
  ↓
User: "Let's import from GitHub"
  ↓
Agent (Auto-switches to Project Creation Mode):
      "Great! Let me check your GitHub connection..."
      [Shows GitHub repos inline]
  ↓
User selects repo → Import starts
  ↓
Error occurs
  ↓
User: "I got an error, help!"
  ↓
Agent (Auto-switches back to Support Mode):
      "I see you're having trouble with the import.
       Let me help troubleshoot..."
```

**Mode Indicator:**
- Subtle badge in header: "Currently helping with: Project Creation"
- Changes automatically based on conversation flow
- User can manually switch via quick actions

**No Context Loss:**
- All messages stay in one conversation thread
- Mode transitions shown as system messages:
  ```
  💬 Support → 📁 Switching to project creation mode...
  ```

**Key Features:**

1. **Intelligent Intent Detection**
   - Agent analyzes user input to determine mode
   - Patterns: URLs → project creation, "help"/"error" → support
   - Seamless mode switching without user intervention

2. **Contextual UI Rendering**
   - Support mode: FAQ suggestions, knowledge base search
   - Project mode: GitHub repos, file upload, URL input
   - Discovery mode: Featured tools, trending projects
   - UI adapts to current mode automatically

3. **Single Conversation Thread**
   - All messages in chronological order
   - Mode transitions marked with system messages
   - No separate histories to manage
   - Simpler mental model for users

4. **+ Menu Integration Selector**
   - ChatGPT-style + button on left of input
   - Dropdown shows available integrations
   - One-click to start GitHub import, YouTube import, file upload, etc.
   - Clear visual hierarchy with icons
   - "More coming soon..." teaser for future integrations

**Implementation:**

```typescript
// Simplified unified chat state
interface UnifiedChatState {
  messages: ChatMessage[];           // Single conversation thread
  currentMode: ChatMode;             // Current agent mode
  modeHistory: ChatMode[];           // Track mode changes
  contextData: Record<string, any>;  // Mode-specific state (repos, uploads, etc.)
  isOpen: boolean;
}

type ChatMode =
  | 'support'           // Help, knowledge base
  | 'project-creation'  // Import projects
  | 'discovery'         // Explore tools
  | 'idle';             // No specific mode

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  mode: ChatMode;                    // Which mode was active
  metadata?: {
    modeTransition?: {               // If this message caused mode change
      from: ChatMode;
      to: ChatMode;
      reason: string;
    };
    quickActions?: Action[];         // Context-specific actions
    attachments?: Attachment[];      // Files, links, etc.
  };
}
```

**Files to Modify:**
- `/frontend/src/components/layouts/DashboardLayout.tsx` - Single chat state
- `/frontend/src/components/chat/IntelligentChatPanel.tsx` - NEW: Mode-aware chat
- `/frontend/src/hooks/useIntelligentChat.ts` - NEW: Mode detection & routing
- `/frontend/src/services/agents/RouterAgent.ts` - NEW: Intent detection and routing

**User Flow Example:**

```
1. User clicks "Support" menu item
   → Opens chat panel
   → Header shows: "💬 Chat with AllThrive"

2. User: "How do I import my GitHub repos?"
   → Agent (Support mode): "I can help! You can import projects
                            from GitHub, YouTube, or any website."
   → [Start Project Import] quick action appears

3. User: "Let's do GitHub"
   → Agent auto-detects project creation intent
   → System message: "💬→📁 Switching to project creation..."
   → Agent (Project mode): "Great! Let me check your GitHub..."
   → Shows GitHub repos inline in chat

4. User selects repos → Import starts
   → Encounters error: "Rate limit exceeded"

5. User: "I got an error, help!"
   → Agent auto-detects support request
   → System message: "📁→💬 Switching to support..."
   → Agent (Support mode): "I see a rate limit error. This means..."
   → Provides solution

6. User: "Got it, let me try again"
   → Agent: "Ready to continue importing?"
   → [Resume Import] quick action
   → User clicks → returns to project creation mode
   → Previous GitHub selection still available
```

**Benefits:**
- ✅ No separate conversations to manage
- ✅ Natural conversation flow
- ✅ All context in one place
- ✅ Simpler UI (no tabs)
- ✅ Agent handles complexity, not user

---

#### Approach 2: Multi-Tab Chat (Alternative - More Complex)

**Architecture:**
- Tabbed interface with separate conversations
- [Support] [Add Project] [Discovery] tabs
- Each tab maintains independent conversation

**Pros:**
- Clear separation of concerns
- Can have multiple conversations in parallel
- Familiar browser-tab metaphor

**Cons:**
- More complex UI and state management
- Users need to manually manage tabs
- Harder to transfer context between tabs
- Adds cognitive load

**When to Consider:**
- If users frequently need parallel conversations
- If mode transitions are rare
- If conversations are long and complex

**Current Recommendation:** Start with Approach 1 (single chat), only add tabs if user research shows need

---

### Specific Chat Behaviors (Single Chat Approach)

#### Intent Detection & Mode Switching

**Scenario:** User asks about adding a project

**Solution:**
```typescript
// Router agent detects intent and switches mode
class RouterAgent extends BaseAgent {
  private detectIntent(userInput: string): ChatMode {
    const input = userInput.toLowerCase();

    // Project creation patterns
    if (input.match(/import|add project|github|youtube|upload/)) {
      return 'project-creation';
    }

    // Support patterns
    if (input.match(/help|error|problem|how do i|what is/)) {
      return 'support';
    }

    // Discovery patterns
    if (input.match(/explore|discover|browse|show me/)) {
      return 'discovery';
    }

    return 'idle';
  }

  async handleMessage(userInput: string, currentMode: ChatMode): Promise<ChatMessage> {
    const newMode = this.detectIntent(userInput);

    // Mode transition needed?
    if (newMode !== currentMode && newMode !== 'idle') {
      return {
        sender: 'system',
        content: `Switching to ${newMode} mode...`,
        metadata: {
          modeTransition: {
            from: currentMode,
            to: newMode,
            reason: 'Intent detected from user message'
          }
        }
      };
    }

    // Route to appropriate agent
    return this.routeToAgent(newMode).handleMessage(userInput);
  }
}
```

**UI Rendering:**
- System message shows mode change with subtle animation
- Header updates: "Currently: Project Creation"
- UI components appear/disappear based on mode (GitHub repos, file upload, etc.)

---

#### Error Handling with Mode Awareness

**Scenario:** User encounters error during project creation

**Solution:**
```typescript
// Error triggers support mode with context
class ProjectCreationAgent extends BaseAgent {
  async handleError(error: Error, context: any): Promise<ChatMessage> {
    // Auto-inject error context into conversation
    return {
      sender: 'agent',
      content: `I see you encountered an error: "${error.message}". Let me help troubleshoot this.`,
      mode: 'support',  // Auto-switch to support mode
      metadata: {
        modeTransition: {
          from: 'project-creation',
          to: 'support',
          reason: 'Error during project import'
        },
        errorContext: {
          error: error.message,
          stack: error.stack,
          userAction: context.currentAction,
          timestamp: new Date()
        },
        quickActions: [
          {
            label: "Try Again",
            action: "retry_import",
            params: context.lastAttempt
          },
          {
            label: "Choose Different Project",
            action: "restart_selection"
          }
        ]
      }
    };
  }
}
```

**UI Behavior:**
- Error appears in conversation naturally
- Mode indicator changes to Support
- Quick actions for recovery appear inline
- User can continue conversation without losing project selection state

---

#### File Upload & Smart Routing

**Scenario:** User uploads file

**Solution:**
```typescript
// File upload auto-switches to project mode
const handleFileUpload = (file: File, currentMode: ChatMode) => {
  // Auto-switch to project creation mode
  if (currentMode !== 'project-creation') {
    addSystemMessage({
      content: "I'll help you create a project from this file...",
      metadata: {
        modeTransition: {
          from: currentMode,
          to: 'project-creation',
          reason: 'File upload detected'
        }
      }
    });
  }

  // Process upload
  return {
    sender: 'agent',
    content: `Analyzing ${file.name}... This looks like a ${detectProjectType(file)} project.`,
    mode: 'project-creation',
    metadata: {
      attachments: [{ file, status: 'uploading' }],
      quickActions: [
        { label: "Continue with upload", action: "confirm_upload" },
        { label: "Choose different file", action: "cancel_upload" }
      ]
    }
  };
};
```

**No notification needed** - the mode switch is seamless and conversational

---

### Conversation Persistence Strategy

**LocalStorage Schema (Simplified):**
```typescript
interface PersistedChatState {
  messages: ChatMessage[];        // Single conversation thread
  currentMode: ChatMode;
  contextData: Record<string, any>;  // Mode-specific data
  timestamp: Date;
}

// Save to localStorage on every message
const saveChatState = (state: UnifiedChatState) => {
  localStorage.setItem('allthriveai_chat_session', JSON.stringify({
    messages: state.messages,
    currentMode: state.currentMode,
    contextData: state.contextData,
    timestamp: new Date()
  }));
};

// Restore on page load (with TTL - expire after 24 hours)
const restoreChatState = (): UnifiedChatState | null => {
  const saved = localStorage.getItem('allthriveai_chat_session');
  if (!saved) return null;

  const parsed = JSON.parse(saved);
  const age = Date.now() - new Date(parsed.timestamp).getTime();

  if (age < 86400000) { // 24 hours
    return {
      messages: parsed.messages,
      currentMode: parsed.currentMode,
      contextData: parsed.contextData,
      isOpen: false  // Don't auto-open
    };
  }

  return null;
};
```

**Backend Sync (Future Enhancement):**
- Store conversation history in `chat_sessions` table
- Associate with user_id and context_id
- Sync across devices
- Enable "resume conversation" from any device

---

### Visual Design

**Mode Indicator (Minimal):**
```css
/* Subtle header badge */
.mode-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.mode-support {
  background: blue-100;
  color: blue-700;
}

.mode-project-creation {
  background: green-100;
  color: green-700;
}

.mode-discovery {
  background: purple-100;
  color: purple-700;
}
```

**Mode Transition Animation:**
```css
/* System message for mode changes */
.mode-transition-message {
  text-align: center;
  padding: 8px;
  margin: 12px 0;
  background: slate-100;
  border-radius: 8px;
  font-size: 13px;
  color: slate-600;
  font-style: italic;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**ChatPlusMenu Component (ChatGPT-style):**
```tsx
// ChatPlusMenu.tsx - + button with integration dropdown
interface ChatPlusMenuProps {
  onSelectIntegration: (integration: Integration) => void;
}

export function ChatPlusMenu({ onSelectIntegration }: ChatPlusMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* + Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600
                   flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700
                   transition-colors"
        aria-label="Add integration"
      >
        <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800
                        rounded-lg shadow-lg border border-slate-200 dark:border-slate-700
                        py-2 z-50">
          {/* GitHub */}
          <button
            onClick={() => {
              onSelectIntegration('github');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-100
                       dark:hover:bg-slate-700 transition-colors text-left"
          >
            <FontAwesomeIcon icon={faGithub} className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <div>
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                Add from GitHub
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Import your repositories
              </div>
            </div>
          </button>

          {/* YouTube */}
          <button
            onClick={() => {
              onSelectIntegration('youtube');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-100
                       dark:hover:bg-slate-700 transition-colors text-left"
          >
            <FontAwesomeIcon icon={faYoutube} className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                Add from YouTube
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Import your videos
              </div>
            </div>
          </button>

          {/* Upload File */}
          <button
            onClick={() => {
              onSelectIntegration('upload');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-100
                       dark:hover:bg-slate-700 transition-colors text-left"
          >
            <FontAwesomeIcon icon={faUpload} className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <div>
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                Upload File
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Upload code, images, or documents
              </div>
            </div>
          </button>

          {/* Paste URL */}
          <button
            onClick={() => {
              onSelectIntegration('url');
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-100
                       dark:hover:bg-slate-700 transition-colors text-left"
          >
            <FontAwesomeIcon icon={faLink} className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <div>
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                Paste URL
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Any website or project
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

          {/* Coming Soon Section */}
          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic">
            More integrations coming soon...
          </div>
          <div className="px-4 py-1 flex items-center gap-2 opacity-50 cursor-not-allowed">
            <FontAwesomeIcon icon={faImage} className="w-4 h-4" />
            <span className="text-xs">Midjourney</span>
          </div>
          <div className="px-4 py-1 flex items-center gap-2 opacity-50 cursor-not-allowed">
            <FontAwesomeIcon icon={faCode} className="w-4 h-4" />
            <span className="text-xs">Replit</span>
          </div>
          <div className="px-4 py-1 flex items-center gap-2 opacity-50 cursor-not-allowed">
            <FontAwesomeIcon icon={faPalette} className="w-4 h-4" />
            <span className="text-xs">Figma</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS Styling:**
```css
/* + Button */
.plus-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--slate-300);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.plus-button:hover {
  background: var(--slate-100);
  transform: scale(1.05);
}

/* Dropdown Menu */
.plus-menu-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  width: 256px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--slate-200);
  animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Menu Items */
.plus-menu-item {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.plus-menu-item:hover {
  background: var(--slate-100);
}

.plus-menu-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### Migration Path

**Phase 1: Intelligent Router (Week 1)**
- Create `RouterAgent` for intent detection
- Build mode detection logic (support, project, discovery)
- Test automatic mode switching

**Phase 2: Single Chat Panel (Week 1-2)**
- Refactor DashboardLayout to single chat state
- Create `IntelligentChatPanel` component
- Add mode indicator UI
- Implement mode transition animations

**Phase 3: Mode Integration (Week 2-3)**
- Migrate project creation flow to project mode
- Implement SupportAgent with knowledge base
- Add discovery mode for tool exploration
- Build quick action shortcuts

**Phase 4: State Persistence & Polish (Week 3-4)**
- LocalStorage conversation persistence
- Error handling with auto mode-switching
- File upload detection and routing
- Mobile optimization

---

### Implementation Priority

**Must Have (MVP):**
1. ✅ Single chat with mode detection
2. ✅ Intent-based routing (support, project, discovery)
3. ✅ Seamless mode transitions
4. ✅ LocalStorage persistence

**Should Have:**
5. ⏳ Quick action shortcuts
6. ⏳ File upload detection
7. ⏳ Error auto-escalation to support

**Nice to Have:**
8. 🔮 Backend conversation sync
9. 🔮 Advanced intent detection (ML-based)
10. 🔮 Voice input support

---

## Design Decisions (Confirmed)

✅ **Integration Priority**: Generic Website scraper for MVP
✅ **Hero Images**: Gemini Flash 3.0 (nano/banana) for AI generation
✅ **File Storage**: MinIO (S3-compatible, already in use)
✅ **Chat UX**: Full conversation history with multi-turn dialogue
✅ **Multi-Chat Strategy**: Single intelligent chat with mode-based routing (no tabs - simpler!)

---

## Current Status (November 29, 2025)

### ✅ COMPLETED: Phases 0-3 - Real-Time WebSocket Chat with LangGraph

**What We Built:**
- ✅ **Phase 0: Infrastructure** - Redis, Prometheus metrics, monitoring setup
- ✅ **Phase 1: Backend Security & LangGraph** - PostgreSQL checkpointer, security filters, rate limiting
- ✅ **Phase 2: WebSocket Backend + Celery** - Django Channels, Redis Pub/Sub, async processing
- ✅ **Phase 3: Frontend WebSocket Client** - `useWebSocketChat.ts` hook, `WebSocketChatPanel.tsx`, auto-reconnection

**System Architecture (LIVE):**
```
Frontend (WebSocketChatPanel) → WebSocket → Django Channels → Celery → LangGraph → Redis Pub/Sub → Frontend
```

**Performance Benchmarks:**
- WebSocket latency: 50-150ms
- Message throughput: 150 msg/sec
- LangGraph streaming: 2.2s to first chunk
- **Production-ready for 100k+ users**

**Holistic Code Review:** **A (94/100)** - See `docs/HOLISTIC_PHASES_1-3_REVIEW.md`

---

## 🎯 CURRENT TASK: Phase 4 - Replace Add Project Chat

### Goal
Replace the old Add Project chat with the new unified WebSocket intelligent chat. No gradual rollout needed since this is a new feature on a local branch with throwaway test data.

### Current State
- ✅ **WebSocket Backend**: Fully functional at `/ws/chat/{conversation_id}/`
- ✅ **LangGraph Agent**: `project_graph` streaming with tools
- ⏳ **Frontend**: Old `RightAddProjectChat.tsx` still used when clicking "+ Add Project"

### What Needs to Change
1. **Replace Add Project Chat** - Use `WebSocketChatPanel` instead of old component
2. **Connect to LangGraph Tools** - Ensure project creation tools work via WebSocket
3. **Add ChatGPT-style + Menu** - GitHub, YouTube, Upload, URL options
4. **Test End-to-End** - Verify project creation flow works

---

## Implementation Plan

### Task 1: Replace Add Project Chat Component (1 hour)

**Files to Modify:**
- `/frontend/src/components/layouts/DashboardLayout.tsx`
  - Replace `RightAddProjectChat` with `WebSocketChatPanel`
  - Update state management for unified chat

**Files to Delete:**
- `/frontend/src/components/projects/RightAddProjectChat.tsx` (old component)
- `/frontend/src/services/agents/ExampleAgents.ts` (old agent logic)

### Task 2: Add Integration Menu to WebSocket Chat (2 hours)

**Files to Create:**
- `/frontend/src/components/chat/ChatPlusMenu.tsx`
  - + button with dropdown (GitHub, YouTube, Upload, URL)
  - ChatGPT-style UI

**Files to Modify:**
- `/frontend/src/components/chat/WebSocketChatPanel.tsx`
  - Add `ChatPlusMenu` as `customInputPrefix`
  - Handle integration selection

### Task 3: Verify LangGraph Tools Work (1 hour)

**Backend Verification:**
- Test `import_github_project` tool via WebSocket
- Test `import_youtube_video` tool via WebSocket
- Test `create_project` tool via WebSocket

**Frontend Testing:**
- User clicks "+ Add Project" → Opens WebSocket chat
- User pastes GitHub URL → LangGraph detects → Imports → Project created
- User pastes YouTube URL → LangGraph detects → Imports → Project created

### Task 4: Polish & Deploy (1 hour)

**UI Improvements:**
- Add empty state with welcome message
- Add connection status indicator
- Add error handling with retry button

**Testing:**
- Test full project creation flow
- Test conversation persistence
- Test error recovery

---

## Next Steps (Immediate)

1. **Update DashboardLayout** - Replace old chat with WebSocket chat
2. **Create ChatPlusMenu** - + button with integrations
3. **Test Project Creation** - Verify LangGraph tools work
4. **Clean Up** - Delete old files
