# Unified Chat Architecture

**Last Updated:** 2025-12-20
**Status:** Active - Unified ChatCore + Ember Agent
**Purpose:** Document the intelligent chat system with unified frontend and backend

---

## Executive Summary

AllThrive AI's intelligent chat system uses a **unified architecture** on both frontend and backend:

- **Frontend**: Single `ChatCore` component with render props pattern, consumed by two layouts
- **Backend**: Unified Ember agent with access to all 31 tools

### Key Design Principles
- **One backend, two UIs**: Same WebSocket connection, different visual presentations
- **Render props pattern**: `ChatCore` exposes state, layouts decide presentation
- **Feature parity**: Both layouts support all features (integrations, games, onboarding, orchestration)
- **Clean separation**: Core logic separated from UI components

### Key Stats
- **Total Tools:** 31 across 5 categories
- **Architecture:** Single unified Ember agent (no supervisor routing)
- **Token Tracking:** Full usage tracking via `AIUsageTracker`
- **Frontend:** ChatCore + 2 layouts (EmbeddedChatLayout, SidebarChatLayout)
- **Scalability Settings:** Max 50 context messages, 30s tool timeout, 10 max iterations

---

## Frontend Architecture

```
frontend/src/components/chat/
├── core/                          # Core chat logic (render props)
│   ├── types.ts                   # Type definitions
│   ├── ChatCore.tsx               # Render props component (composes all hooks)
│   ├── ChatMessageList.tsx        # Scrollable message container
│   ├── ChatInputArea.tsx          # Input field with prefix slot
│   └── index.ts                   # Barrel exports
│
├── messages/                      # Message type components
│   ├── LoadingMessage.tsx         # Loading indicator with tool status
│   ├── UserMessage.tsx            # User message bubble
│   ├── AssistantMessage.tsx       # AI message with markdown
│   ├── OrchestrationPrompt.tsx    # Navigation confirmation
│   ├── QuotaExceededBanner.tsx    # Usage limit notification
│   ├── GameMessage.tsx            # Inline game renderer
│   ├── OnboardingMessage.tsx      # Onboarding step router
│   ├── GeneratingImageMessage.tsx # Image generation progress
│   ├── LearningContentMessage.tsx # Learning content (videos, quizzes, projects)
│   └── index.ts
│
├── integrations/                  # Integration flow components
│   ├── useIntegrationFlow.ts      # State machine hook
│   ├── GitHubFlow.tsx             # GitHub repo picker
│   ├── GitLabFlow.tsx             # GitLab project picker
│   ├── FigmaFlow.tsx              # Figma URL import
│   ├── IntegrationPicker.tsx      # Integration selection modal
│   └── index.ts
│
├── layouts/                       # Layout wrappers
│   ├── EmbeddedChatLayout.tsx     # Full-page chat (/home)
│   ├── SidebarChatLayout.tsx      # Sliding panel (header chat icon)
│   └── index.ts
│
├── onboarding/                    # Onboarding UI components
│   ├── OnboardingIntroMessage.tsx # Welcome message with typewriter
│   ├── AvatarTemplateSelector.tsx # Avatar template picker
│   ├── AvatarPreviewMessage.tsx   # Generated avatar preview
│   ├── PathSelectionMessage.tsx   # User path selection
│   ├── LearningGoalSelectionMessage.tsx # Learning goals picker
│   └── index.ts
│
├── games/                         # Inline game components
│   ├── MiniSnakeGame.tsx          # Snake game implementation
│   ├── QuickQuiz.tsx              # Quick quiz implementation
│   ├── ChatGameCard.tsx           # Game card wrapper
│   └── index.ts
│
├── cards/                         # Content cards
│   ├── LearningTeaserCard.tsx     # Learning content teaser
│   └── index.ts
│
├── ChatSidebar.tsx                # Public sidebar component
├── ChatPlusMenu.tsx               # Plus menu for integrations
├── ChatErrorBoundary.tsx          # Error boundary wrapper
├── ChatInterface.tsx              # Legacy chat interface
├── GeneratedImageMessage.tsx      # Generated image display (root level)
└── index.ts                       # Public exports
```

### Component Hierarchy

```
EmberHomePage / DashboardLayout
    │
    ├── EmbeddedChatLayout           ← /home (full-page)
    │   └── ChatCore
    │       ├── useIntelligentChat   (WebSocket + messages)
    │       ├── useOnboardingChat    (onboarding flow)
    │       ├── useOrchestrationActions (navigation/highlight)
    │       └── useIntegrationFlow   (GitHub/GitLab/Figma)
    │
    └── ChatSidebar                  ← Header chat icon (sliding panel)
        └── SidebarChatLayout
            └── ChatCore
                └── (same hooks)
```

### ChatCore (Render Props Pattern)

**File:** `frontend/src/components/chat/core/ChatCore.tsx`

The central component that composes all chat functionality:

```tsx
export function ChatCore({
  conversationId,
  context = 'default',
  enableOnboarding = false,
  onProjectCreated,
  onClose,
  children,  // Render prop function
}: ChatCoreProps) {
  // Compose hooks
  const chat = useIntelligentChat({ conversationId, ... });
  const onboarding = useOnboardingChat({ ... });
  const orchestration = useOrchestrationActions();
  const integrations = useIntegrationFlow({ ... });

  // Build state object
  const state: ChatCoreState = {
    isConnected, isLoading, messages, sendMessage,
    onboarding, integrationState, pendingAction,
    quotaExceeded, error, ...
  };

  return <>{children(state)}</>;
}
```

**Usage:**
```tsx
<ChatCore conversationId={id} enableOnboarding={true}>
  {(state) => (
    <div>
      <ChatMessageList messages={state.messages} ... />
      <ChatInputArea onSendMessage={state.sendMessage} ... />
    </div>
  )}
</ChatCore>
```

### Layout Wrappers

#### EmbeddedChatLayout (Full-Page)

**File:** `frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx`

Used by `/home` (EmberHomePage). Features:
- Typewriter greeting animation
- Feeling pills based on user's signup interests
- Full-page embedded design
- Neon Glass aesthetic

#### SidebarChatLayout (Sliding Panel)

**File:** `frontend/src/components/chat/layouts/SidebarChatLayout.tsx`

Used when clicking chat icon in header. Features:
- Sliding panel from right side
- Ember header with connection status
- Context-aware quick actions
- Integration flows (GitHub/GitLab/Figma)

### Integration Flow State Machine

**File:** `frontend/src/components/chat/integrations/useIntegrationFlow.ts`

Manages GitHub, GitLab, Figma, and YouTube integration states:

```
idle → loading → connect/install → select → importing
```

Each integration follows this flow:
1. **idle**: No active integration
2. **loading**: Checking connection status
3. **connect**: Need OAuth connection
4. **install**: Need GitHub App installation (GitHub only)
5. **select**: Choose repo/project/file
6. **importing**: Sending to chat for processing

### Context-Aware Quick Actions

**File:** `frontend/src/components/chat/layouts/SidebarChatLayout.tsx`

| Context | Quick Actions |
|---------|---------------|
| `learn` | Learn AI Basics, Quiz Me, My Progress, What Next? |
| `explore` | Trending Projects, Find Projects, Recommend For Me, Similar Projects |
| `project` | Paste a URL, Make Infographic, From GitHub, Upload Media |
| `default` | I need help, I don't know what to do next, I want to do something fun |

---

## Backend Architecture

```
Backend (Django Channels + Celery)
├── ChatConsumer                   # WebSocket handling
├── process_chat_message_task      # Celery async processing
│
└── Unified Ember Agent            # Single agent with all tools
    ├── services/agents/ember/
    │   ├── agent.py               # LangGraph agent + streaming
    │   ├── prompts.py             # System prompts
    │   └── tools.py               # Unified tool registry (31 tools)
    │
    └── Tool Categories:
        ├── Discovery (9 tools)    # Search, recommendations, challenges, connections
        ├── Learning (3 tools)     # Simplified: find content, create path, update profile
        ├── Project (9 tools)      # Create, import projects
        ├── Orchestration (7 tools)# Navigation, UI control, games
        └── Profile (3 tools)      # Profile generation
```

### Scalability Configuration

| Setting | Default | Location |
|---------|---------|----------|
| `EMBER_MAX_TOOL_ITERATIONS` | 10 | Django settings |
| `EMBER_MAX_CONTEXT_MESSAGES` | 50 | Django settings |
| `EMBER_TOOL_EXECUTION_TIMEOUT` | 30s | Django settings |
| `EMBER_DEFAULT_MODEL` | gpt-4o-mini | AI gateway config |

### WebSocket Protocol

**Connection:**
```
ws://backend:8000/ws/chat/{conversation_id}/
```

**Conversation ID Patterns:**
- `ember-home-{timestamp}` - EmberHomePage full-page chat
- `ember-learn-{timestamp}` - Learn page context
- `ember-explore-{timestamp}` - Explore page context
- `ember-project-{timestamp}` - Project page context
- `ember-default-{timestamp}` - Default context

### Events: Backend → Frontend

| Event | Data | Purpose |
|-------|------|---------|
| `connected` | `{conversation_id, timestamp}` | Connection confirmed |
| `task_queued` | `{task_id}` | Message queued to Celery |
| `processing_started` | `{conversation_id}` | Agent begins processing |
| `chunk` | `{chunk, conversation_id}` | Streaming text token |
| `tool_start` | `{tool, conversation_id}` | Tool execution started |
| `tool_end` | `{tool, output, conversation_id}` | Tool execution completed |
| `image_generating` | `{message, session_id}` | Image generation in progress |
| `image_generated` | `{image_url, filename, session_id}` | Image ready |
| `completed` | `{conversation_id, project_created}` | Processing finished |
| `error` | `{error}` | Error occurred |
| `quota_exceeded` | `{error, reason, ...}` | Usage limit hit |

### Events: Frontend → Backend

| Event | Data | Purpose |
|-------|------|---------|
| `message` | `{message}` | User sends chat message |
| `ping` | `{type: 'ping'}` | Heartbeat (every 30s) |

---

## Tool Reference

### Discovery Tools (9 tools)

| Tool | Description | Needs State |
|------|-------------|-------------|
| `search_projects` | Find projects by keyword, category, or tags | No |
| `get_recommendations` | Personalized project suggestions | **Yes** |
| `find_similar_projects` | Find projects similar to a given project | No |
| `get_trending_projects` | Get trending projects from day/week/month | No |
| `get_project_details` | Get detailed info about a specific project | No |
| `unified_search` | Search across all content types (projects, quizzes, tools, lessons) | **Yes** |
| `get_related_content` | Get content related to a specific item via knowledge graph | **Yes** |
| `get_current_challenge` | Get the current weekly challenge with user participation status | **Yes** |
| `find_people_to_connect` | Find people to follow based on shared interests, roles, and goals | **Yes** |

### Learning Tools (3 tools)

*Simplified from 14 tools to 3 tools. Learner context (profile, stats, progress, suggestions) is now injected at conversation start via `LearnerContextService` - no tool call needed.*

| Tool | Description | Needs State |
|------|-------------|-------------|
| `find_learning_content` | Find learning content (tools, projects, quizzes, games) about a topic. Returns renderable content (inline_game, project_card, quiz_card, tool_info). | **Yes** |
| `create_learning_path` | Generate a structured learning path for a topic. Creates a curriculum mixing videos, articles, quizzes, games, and code repos. Saved to user's profile. | **Yes** |
| `update_learner_profile` | Save learner preferences, interests, and skills discovered during conversation. Updates learning style, difficulty level, session length, interests, and skill proficiencies. | **Yes** |

### Project Tools (9 tools)

| Tool | Description | Needs State |
|------|-------------|-------------|
| `create_project` | Create a new project with metadata | **Yes** |
| `import_from_url` | Unified URL import (GitHub, YouTube, etc.) | **Yes** |
| `import_github_project` | Import GitHub repo with full AI analysis | **Yes** |
| `scrape_webpage_for_project` | Scrape any webpage and create project | **Yes** |
| `create_media_project` | Unified media handling (images, videos, AI content) | **Yes** |
| `create_project_from_screenshot` | Create project by analyzing screenshot | **Yes** |
| `create_product` | Create marketplace product | **Yes** |
| `extract_url_info` | Extract and categorize URLs from text | No |
| `regenerate_architecture_diagram` | Regenerate project's Mermaid diagram | **Yes** |

*Note: `import_video_project` is deprecated (use `create_media_project`), `fetch_github_metadata` is internal only.*

### Orchestration Tools (7 tools)

| Tool | Description | Needs State |
|------|-------------|-------------|
| `navigate_to_page` | Navigate user to a page (auto-executes) | No |
| `highlight_element` | Highlight UI element with animation | No |
| `open_tray` | Open slide-out panel (chat, quest, comments, etc.) | No |
| `show_toast` | Show notification with variant | No |
| `trigger_action` | Trigger site action (start_battle, create_project, etc.) | No |
| `get_fun_activities` | List available fun activities on AllThrive | No |
| `launch_inline_game` | Embed mini-game in chat (snake, quiz, random) | No |

### Profile Tools (3 tools)

| Tool | Description | Needs State |
|------|-------------|-------------|
| `gather_user_data` | Gather comprehensive user data | **Yes** |
| `generate_profile_sections` | Generate profile sections | **Yes** |
| `save_profile_sections` | Save generated sections to profile | **Yes** |

### State Injection

Tools marked with **"Needs State"** receive a `state` dict injected with:
- `user_id`: The authenticated user's ID
- `username`: The user's username
- `session_id`: The WebSocket session ID

This is handled automatically by `create_tool_node_with_state_injection()` in `ember/agent.py`.

---

## Feature Support Matrix

| Feature | EmbeddedChatLayout | SidebarChatLayout |
|---------|-------------------|-------------------|
| WebSocket chat | ✅ | ✅ |
| Streaming responses | ✅ | ✅ |
| Tool execution (31 tools) | ✅ | ✅ |
| GitHub integration | ✅ | ✅ |
| GitLab integration | ✅ | ✅ |
| Figma integration | ✅ | ✅ |
| YouTube import | ✅ | ✅ |
| Nano Banana (image gen) | ✅ | ✅ |
| Inline games (snake, quiz) | ✅ | ✅ |
| Onboarding flow | ✅ | ✅ |
| Orchestration actions | ✅ | ✅ |
| Quota management | ✅ | ✅ |
| Learning content display | ✅ | ✅ |
| File uploads (drag & drop) | ✅ | ✅ |
| Context-aware actions | via feeling pills | via quick actions |
| Typewriter greeting | ✅ | ❌ |
| Connection status | ✅ | ✅ |

### File Upload Constraints

| Constraint | Value |
|------------|-------|
| Max attachments per message | 5 |
| Max message length | 10,000 characters |
| Max image size | 50MB |
| Max video size | 500MB |
| Max document size | 100MB |
| Supported image types | JPEG, PNG, GIF, WebP |
| Supported video types | MP4, WebM |
| Supported document types | PDF, Word, Excel, PowerPoint, ZIP |

---

## Error Handling

All chat components use structured error handling via `logError` from `@/utils/errorHandler`:

```typescript
import { logError } from '@/utils/errorHandler';

try {
  // operation
} catch (error) {
  logError('componentName.operationName', error);
  // handle gracefully
}
```

This provides:
- Structured logging with timestamps and context
- Sentry integration in production
- Pretty console output in development

---

## File Locations

### Frontend (Core Components)

| Component | Location |
|-----------|----------|
| ChatCore | `frontend/src/components/chat/core/ChatCore.tsx` |
| ChatMessageList | `frontend/src/components/chat/core/ChatMessageList.tsx` |
| ChatInputArea | `frontend/src/components/chat/core/ChatInputArea.tsx` |
| Types | `frontend/src/components/chat/core/types.ts` |

### Frontend (Layouts)

| Component | Location |
|-----------|----------|
| EmbeddedChatLayout | `frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx` |
| SidebarChatLayout | `frontend/src/components/chat/layouts/SidebarChatLayout.tsx` |

### Frontend (Messages)

| Component | Location |
|-----------|----------|
| AssistantMessage | `frontend/src/components/chat/messages/AssistantMessage.tsx` |
| UserMessage | `frontend/src/components/chat/messages/UserMessage.tsx` |
| LoadingMessage | `frontend/src/components/chat/messages/LoadingMessage.tsx` |
| GameMessage | `frontend/src/components/chat/messages/GameMessage.tsx` |
| OnboardingMessage | `frontend/src/components/chat/messages/OnboardingMessage.tsx` |
| OrchestrationPrompt | `frontend/src/components/chat/messages/OrchestrationPrompt.tsx` |
| QuotaExceededBanner | `frontend/src/components/chat/messages/QuotaExceededBanner.tsx` |
| GeneratingImageMessage | `frontend/src/components/chat/messages/GeneratingImageMessage.tsx` |
| LearningContentMessage | `frontend/src/components/chat/messages/LearningContentMessage.tsx` |

### Frontend (Integrations)

| Component | Location |
|-----------|----------|
| useIntegrationFlow | `frontend/src/components/chat/integrations/useIntegrationFlow.ts` |
| GitHubFlow | `frontend/src/components/chat/integrations/GitHubFlow.tsx` |
| GitLabFlow | `frontend/src/components/chat/integrations/GitLabFlow.tsx` |
| FigmaFlow | `frontend/src/components/chat/integrations/FigmaFlow.tsx` |
| IntegrationPicker | `frontend/src/components/chat/integrations/IntegrationPicker.tsx` |

### Frontend (Onboarding)

| Component | Location |
|-----------|----------|
| OnboardingIntroMessage | `frontend/src/components/chat/onboarding/OnboardingIntroMessage.tsx` |
| AvatarTemplateSelector | `frontend/src/components/chat/onboarding/AvatarTemplateSelector.tsx` |
| AvatarPreviewMessage | `frontend/src/components/chat/onboarding/AvatarPreviewMessage.tsx` |
| PathSelectionMessage | `frontend/src/components/chat/onboarding/PathSelectionMessage.tsx` |
| LearningGoalSelectionMessage | `frontend/src/components/chat/onboarding/LearningGoalSelectionMessage.tsx` |

### Frontend (Games)

| Component | Location |
|-----------|----------|
| MiniSnakeGame | `frontend/src/components/chat/games/MiniSnakeGame.tsx` |
| QuickQuiz | `frontend/src/components/chat/games/QuickQuiz.tsx` |
| ChatGameCard | `frontend/src/components/chat/games/ChatGameCard.tsx` |

### Frontend (Cards)

| Component | Location |
|-----------|----------|
| LearningTeaserCard | `frontend/src/components/chat/cards/LearningTeaserCard.tsx` |

### Frontend (Hooks)

| Hook | Location |
|------|----------|
| useIntelligentChat | `frontend/src/hooks/useIntelligentChat.ts` |
| useOnboardingChat | `frontend/src/hooks/useOnboardingChat.ts` |
| useOrchestrationActions | `frontend/src/hooks/useOrchestrationActions.ts` |

### Backend (Ember Agent)

| Component | Location |
|-----------|----------|
| Ember Agent | `services/agents/ember/agent.py` |
| Ember Prompts | `services/agents/ember/prompts.py` |
| Ember Tools Registry | `services/agents/ember/tools.py` |

### Backend (Specialized Tool Modules)

| Component | Location |
|-----------|----------|
| Discovery Tools | `services/agents/discovery/tools.py` |
| Learning Tools | `services/agents/learning/tools.py` |
| Project Tools | `services/agents/project/tools.py` |
| Orchestration Tools | `services/agents/orchestration/tools.py` |
| Profile Tools | `services/agents/profile/tools.py` |

### Backend (Infrastructure)

| Component | Location |
|-----------|----------|
| Chat Consumer | `core/agents/consumers.py` |
| Chat Tasks | `core/agents/tasks.py` |
| WebSocket Routing | `core/agents/routing.py` |
| Security (Prompt Injection) | `core/agents/security.py` |
| Metrics | `core/agents/metrics.py` |
| Checkpointer | `services/agents/auth/checkpointer.py` |

---

## Data Flow: Message → Response

```
1. User sends message via WebSocket
   └─► ChatConsumer.receive() validates & queues

2. Celery task process_chat_message_task()
   ├─► Validate user exists
   ├─► Check quota (check_and_reserve_ai_request)
   ├─► Security filter (PromptInjectionFilter)
   ├─► Send "processing_started" event
   └─► Route to _process_with_orchestrator()

3. Orchestrator routing
   ├─► Image generation keywords? → Gemini 2.0 Flash
   └─► Everything else → stream_ember_response()

4. Ember agent (LangGraph)
   ├─► Build message history (max 50 messages)
   ├─► LLM with tools bound (gpt-4o-mini)
   ├─► Stream chunks via Redis Pub/Sub
   ├─► Execute tools with state injection
   └─► Max 10 iterations, 30s timeout per tool

5. Frontend receives events
   ├─► chunk: Stream text into message
   ├─► tool_start/tool_end: Show tool status
   ├─► completed: Mark response done
   └─► Special: inline_game, learning_content, orchestration actions
```

---

## Migration Notes

### Legacy Components (To Be Removed)

The following components are kept for backward compatibility but should be migrated:

| Legacy | New Replacement |
|--------|-----------------|
| `ChatInterface.tsx` | `ChatCore.tsx` + layouts |
| `IntelligentChatPanel.tsx` | `ChatSidebar.tsx` + `SidebarChatLayout.tsx` |

### Migration Steps

1. Update routes to use new page components
2. Update DashboardLayout to use ChatSidebar
3. Verify all features work in both layouts
4. Remove legacy components

---

## Testing Checklist

### Core Functionality
- [ ] WebSocket connection/reconnection
- [ ] Message streaming (chunks appear in real-time)
- [ ] Tool execution with status indicators
- [ ] Error handling (quota, timeouts, failures)
- [ ] File upload (images, videos, documents)
- [ ] Drag-and-drop attachments

### Discovery Tools (9)
- [ ] `search_projects` - Search by keyword
- [ ] `get_recommendations` - Personalized suggestions
- [ ] `find_similar_projects` - Similar project matching
- [ ] `get_trending_projects` - Trending feed
- [ ] `get_project_details` - Project deep dive
- [ ] `unified_search` - Cross-content search (projects, quizzes, tools, lessons)
- [ ] `get_related_content` - Related content via knowledge graph
- [ ] `get_current_challenge` - Weekly challenge display
- [ ] `find_people_to_connect` - Connection suggestions

### Learning Tools (3)
- [ ] `find_learning_content` - Find tools, projects, quizzes, games (returns inline_game, project_card, etc.)
- [ ] `create_learning_path` - Generate structured curriculum
- [ ] `update_learner_profile` - Save preferences, interests, skills

### Project Tools (9)
- [ ] `import_from_url` - GitHub URL
- [ ] `import_from_url` - YouTube URL
- [ ] `import_from_url` - Generic webpage
- [ ] `create_media_project` - Uploaded image/video
- [ ] `create_project` - From scratch
- [ ] `create_product` - Marketplace item
- [ ] `regenerate_architecture_diagram` - Diagram fix

### Orchestration Tools (7)
- [ ] `navigate_to_page` - Navigation works
- [ ] `highlight_element` - UI highlighting
- [ ] `open_tray` - Panel opening
- [ ] `show_toast` - Notifications
- [ ] `trigger_action` - Start battle/quiz
- [ ] `get_fun_activities` - Fun activity suggestions / surprise me
- [ ] `launch_inline_game` - Snake/quiz/ethics/prompt_battle game in chat

### Profile Tools (3)
- [ ] `gather_user_data` - Data collection
- [ ] `generate_profile_sections` - AI generation
- [ ] `save_profile_sections` - Save to profile

### Integration Flows
- [ ] GitHub OAuth + repo import
- [ ] Figma OAuth + file import
- [ ] YouTube video import
- [ ] Onboarding flow with avatar generation

---

## Related Documentation

- `/docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md` - WebSocket details
- `/docs/evergreen-architecture/04-AI-ARCHITECTURE.md` - AI provider architecture
- `/docs/evergreen-architecture/06-TAXONOMY-SYSTEM.md` - Taxonomy and tools directory
