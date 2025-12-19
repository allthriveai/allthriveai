# Unified Chat Architecture

**Last Updated:** 2025-12-19
**Status:** Active - Unified ChatCore + Ember Agent
**Purpose:** Document the intelligent chat system with unified frontend and backend

---

## Executive Summary

AllThrive AI's intelligent chat system uses a **unified architecture** on both frontend and backend:

- **Frontend**: Single `ChatCore` component with render props pattern, consumed by two layouts
- **Backend**: Unified Ember agent with access to all ~27 tools

### Key Design Principles
- **One backend, two UIs**: Same WebSocket connection, different visual presentations
- **Render props pattern**: `ChatCore` exposes state, layouts decide presentation
- **Feature parity**: Both layouts support all features (integrations, games, onboarding, orchestration)
- **Clean separation**: Core logic separated from UI components

### Key Stats
- **Total Tools:** 27 (2-3% of context window, ~3,000 tokens)
- **Architecture:** Single unified Ember agent (no supervisor routing)
- **Token Tracking:** Full usage tracking via `AIUsageTracker`
- **Frontend:** ChatCore + 2 layouts (EmbeddedChatLayout, SidebarChatLayout)

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
│   ├── OnboardingIntroMessage.tsx
│   ├── AvatarTemplateSelector.tsx
│   ├── AvatarPreviewMessage.tsx
│   └── index.ts
│
├── ChatSidebar.tsx                # Public sidebar component
├── ChatPlusMenu.tsx               # Plus menu for integrations
├── ChatErrorBoundary.tsx          # Error boundary wrapper
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
    │   └── tools.py               # Unified tool registry (~27 tools)
    │
    └── Tool Categories:
        ├── Discovery (5 tools)    # Search, recommendations
        ├── Learning (5 tools)     # Quiz help, progress
        ├── Project (10 tools)     # Create, import projects
        ├── Orchestration (5 tools)# Navigation, UI control
        └── Profile (3 tools)      # Profile generation
```

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

### Discovery Agent (5 tools)

| Tool | Description |
|------|-------------|
| `search_projects` | Find projects by keyword, category, or tags |
| `get_recommendations` | Personalized project suggestions |
| `find_similar_projects` | Find projects similar to a given project |
| `get_trending_projects` | Get trending projects from day/week/month |
| `get_project_details` | Get detailed info about a specific project |

### Learning Agent (5 tools)

| Tool | Description |
|------|-------------|
| `get_learning_progress` | User's learning paths with skill levels |
| `get_quiz_hint` | Hint for quiz question WITHOUT revealing answer |
| `explain_concept` | Explain topic at user's skill level |
| `suggest_next_activity` | Recommend next quiz based on progress |
| `get_quiz_details` | Detailed info about a specific quiz |

### Project Agent (10 tools)

| Tool | Description |
|------|-------------|
| `create_project` | Create a new project with metadata |
| `import_from_url` | Unified URL import (GitHub, YouTube, etc.) |
| `import_github_project` | Import GitHub repo with full AI analysis |
| `scrape_webpage_for_project` | Scrape any webpage and create project |
| `create_media_project` | Unified media handling |
| `create_project_from_screenshot` | Create project by analyzing screenshot |
| `create_product` | Create marketplace product |
| `extract_url_info` | Extract and categorize URLs from text |
| `fetch_github_metadata` | Fetch GitHub repository metadata |
| `regenerate_architecture_diagram` | Regenerate project's Mermaid diagram |

### Orchestration Agent (5 tools)

| Tool | Description |
|------|-------------|
| `navigate_to_page` | Navigate user to a page (auto-executes) |
| `highlight_element` | Highlight UI element with animation |
| `open_tray` | Open slide-out panel |
| `show_toast` | Show notification |
| `trigger_action` | Trigger site action |

### Profile Agent (3 tools)

| Tool | Description |
|------|-------------|
| `gather_user_data` | Gather comprehensive user data |
| `generate_profile_sections` | Generate profile sections |
| `save_profile_sections` | Save generated sections to profile |

---

## Feature Support Matrix

| Feature | EmbeddedChatLayout | SidebarChatLayout |
|---------|-------------------|-------------------|
| WebSocket chat | ✅ | ✅ |
| Streaming responses | ✅ | ✅ |
| Tool execution | ✅ | ✅ |
| GitHub integration | ✅ | ✅ |
| GitLab integration | ✅ | ✅ |
| Figma integration | ✅ | ✅ |
| YouTube import | ✅ | ✅ |
| Nano Banana (image gen) | ✅ | ✅ |
| Inline games | ✅ | ✅ |
| Onboarding flow | ✅ | ✅ |
| Orchestration actions | ✅ | ✅ |
| Quota management | ✅ | ✅ |
| Context-aware actions | via feeling pills | via quick actions |
| Typewriter greeting | ✅ | ❌ |
| Connection status | ✅ | ✅ |

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

### Frontend (New Unified Architecture)

| Component | Location |
|-----------|----------|
| ChatCore | `frontend/src/components/chat/core/ChatCore.tsx` |
| ChatMessageList | `frontend/src/components/chat/core/ChatMessageList.tsx` |
| ChatInputArea | `frontend/src/components/chat/core/ChatInputArea.tsx` |
| Types | `frontend/src/components/chat/core/types.ts` |
| EmbeddedChatLayout | `frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx` |
| SidebarChatLayout | `frontend/src/components/chat/layouts/SidebarChatLayout.tsx` |
| useIntegrationFlow | `frontend/src/components/chat/integrations/useIntegrationFlow.ts` |
| GitHubFlow | `frontend/src/components/chat/integrations/GitHubFlow.tsx` |
| GitLabFlow | `frontend/src/components/chat/integrations/GitLabFlow.tsx` |
| FigmaFlow | `frontend/src/components/chat/integrations/FigmaFlow.tsx` |
| Message components | `frontend/src/components/chat/messages/` |

### Frontend (Hooks)

| Hook | Location |
|------|----------|
| useIntelligentChat | `frontend/src/hooks/useIntelligentChat.ts` |
| useOnboardingChat | `frontend/src/hooks/useOnboardingChat.ts` |
| useOrchestrationActions | `frontend/src/hooks/useOrchestrationActions.ts` |

### Backend

| Component | Location |
|-----------|----------|
| Ember Agent | `services/agents/ember/agent.py` |
| Ember Prompts | `services/agents/ember/prompts.py` |
| Ember Tools | `services/agents/ember/tools.py` |
| Chat Consumer | `core/agents/consumers.py` |
| Chat Tasks | `core/agents/tasks.py` |

---

## Migration Notes

### Legacy Components (To Be Removed)

The following components are kept for backward compatibility but should be migrated:

| Legacy | New Replacement |
|--------|-----------------|
| `IntelligentChatPanel.tsx` | `ChatSidebar.tsx` + `SidebarChatLayout.tsx` |
| `EmberHomePage.tsx` | `EmberHomePageV2.tsx` |

### Migration Steps

1. Update routes to use new page components
2. Update DashboardLayout to use ChatSidebar
3. Verify all features work in both layouts
4. Remove legacy components

---

## Related Documentation

- `/docs/AGENTIC_LEARNING_PATHS_PLAN.md` - Enhanced learning tools plan
- `/docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md` - WebSocket details
- `/docs/evergreen-architecture/04-AI-ARCHITECTURE.md` - AI provider architecture
