# Onboarding Architecture

**Source of Truth** | **Last Updated**: 2025-12-01

This document defines the onboarding flow for AllThrive AI. The onboarding experience is designed to feel agentic and conversational, using a unified chat interface throughout the user journey.

---

## Overview

AllThrive's onboarding is split into two phases:

1. **Auth Chat** - Account creation with conversational flow
2. **Welcome Chat** - Post-auth orientation with actionable options

Both phases use AI-powered chat interfaces to create an engaging, personalized experience.

```
User Journey
├── Auth Chat (AuthPage)
│   ├── Welcome (OAuth or Email)
│   ├── Email Entry
│   ├── Username Suggestion/Custom
│   ├── Name Entry
│   ├── Password Entry
│   ├── Interests Selection
│   └── Values Agreement
│
└── Welcome Chat (ExplorePage)
    ├── Personalization Game (coming soon)
    ├── Add First Project
    └── Guided Creation (coming soon)
```

---

## 1. Auth Chat Flow

### 1.1 Purpose
Guide users through account creation with a conversational interface that feels less like a form and more like talking to an assistant.

### 1.2 Implementation

**Frontend**: `/frontend/src/pages/AuthPage.tsx`
**Hook**: `/frontend/src/hooks/useAuthChatStream.ts`
**Backend**: LangGraph state machine with PostgreSQL checkpointer

### 1.3 Flow Steps

| Step | State | User Action | UI Component |
|------|-------|-------------|--------------|
| Welcome | `welcome` | Click OAuth or Email button | `OAuthButtons` |
| Email | `email` | Enter email address | Text input |
| Username Suggest | `username_suggest` | Accept or reject suggestion | Yes/No buttons |
| Username Custom | `username_custom` | Enter custom username | Text input |
| Name | `name` | Enter first/last name | Two text inputs |
| Password | `password` | Create/enter password | Password input |
| Interests | `interests` | Select interests | Multi-select buttons |
| Values | `values` | Agree to community values | Confirmation button |
| Complete | `complete` | Auto-redirect | N/A |

### 1.4 State Machine

```typescript
type AuthStep =
  | 'welcome'
  | 'email'
  | 'username_suggest'
  | 'username_custom'
  | 'name'
  | 'password'
  | 'interests'
  | 'values'
  | 'complete';

interface AuthChatState {
  step: AuthStep;
  mode: 'signup' | 'login';
  messages: ChatMessage[];
  suggestedUsername?: string;
  isStreaming: boolean;
  error?: string;
}
```

### 1.5 Redirect on Completion

When auth completes successfully:

```typescript
// AuthPage.tsx
useEffect(() => {
  if (isAuthenticated && state.step === 'complete' && user?.username) {
    navigate('/explore?welcome=true');
  }
}, [isAuthenticated, state.step, user?.username, navigate]);
```

---

## 2. Welcome Chat Flow

### 2.1 Purpose
Orient new users after account creation with actionable next steps, delivered through the unified AI chat interface.

### 2.2 Implementation

**Component**: `/frontend/src/components/chat/IntelligentChatPanel.tsx`
**Layout Integration**: `/frontend/src/components/layouts/DashboardLayout.tsx`
**Detection**: `/frontend/src/pages/ExplorePage.tsx`

### 2.3 Activation

The welcome chat is triggered by the `?welcome=true` query parameter:

```typescript
// ExplorePage.tsx
const handleWelcomeOpen = useCallback((openAddProject: (welcomeMode?: boolean) => void) => {
  const isWelcome = searchParams.get('welcome') === 'true';
  if (isWelcome && !welcomeHandled) {
    setWelcomeHandled(true);
    // Remove param from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('welcome');
    setSearchParams(newParams, { replace: true });
    // Open chat in welcome mode
    setTimeout(() => openAddProject(true), 100);
  }
}, [searchParams, welcomeHandled, setSearchParams]);
```

### 2.4 Welcome Message

When `welcomeMode={true}`, the chat displays:

```
🎉 Glad you're here, {firstName}!

Let's get you started. What would you like to do?

┌─────────────────────────────────────┐
│ 🎮 Play a game                      │
│    Help us personalize your         │
│    experience                       │
├─────────────────────────────────────┤
│ ➕ Add your first project           │
│    Paste a link, connect an         │
│    integration, or describe it      │
├─────────────────────────────────────┤
│ ✨ Don't know where to start?       │
│    Let's make something new         │
│    together                         │
└─────────────────────────────────────┘
```

### 2.5 Option Handlers

Each button sends a message to the unified AI agent:

```typescript
// IntelligentChatPanel.tsx
const handlePlayGame = () => {
  setHasInteracted(true);
  sendMessage('Play a game to help personalize my experience');
};

const handleAddFirstProject = () => {
  setHasInteracted(true);
  sendMessage('I want to add my first project to my portfolio');
};

const handleMakeSomethingNew = () => {
  setHasInteracted(true);
  sendMessage("I don't know where to start - let's make something new together");
};
```

### 2.6 Agent Responses

The AI agent handles these messages:

| Message | Agent Response |
|---------|----------------|
| "Play a game..." | Coming soon message (Phase 2) |
| "Add my first project..." | Project creation flow (GitHub, URL, describe, manual) |
| "Let's make something new..." | Coming soon message (Phase 2) |

---

## 3. Architecture Components

### 3.1 IntelligentChatPanel

The unified chat component that handles both regular chat and welcome mode. This replaced the previous `RightChatPanel` component.

```typescript
interface IntelligentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  welcomeMode?: boolean;  // Show onboarding welcome message
}
```

**Features**:
- WebSocket-based real-time streaming
- LangGraph agent integration
- Automatic mode switching (project creation vs support)
- ChatGPT-style + menu with integrations
- Welcome mode for new user onboarding
- Contextual conversation state management

**Migration Note**: The `RightChatPanel` component was deprecated in December 2024 and fully replaced by `IntelligentChatPanel`, which provides a unified chat experience for all use cases.

### 3.2 DashboardLayout

Manages panel state and exposes functions to child pages:

```typescript
interface DashboardLayoutProps {
  children: ReactNode | ((props: {
    openChat: (menuItem: string) => void;
    openAddProject: (welcomeMode?: boolean) => void;
  }) => ReactNode);
  openAboutPanel?: boolean;
}
```

**Panel Management**:
- Manages multiple right-side panels (About, Events, IntelligentChat)
- Ensures only one panel is open at a time
- Provides overlay functionality for mobile responsiveness
- Exposes `openAddProject()` function with optional `welcomeMode` parameter

**State Management**:
- `aboutOpen` - Controls About panel visibility
- `eventsOpen` - Controls Events Calendar panel visibility
- `addProjectOpen` - Controls IntelligentChat panel visibility
- `addProjectWelcomeMode` - Controls welcome message display

### 3.3 State Flow

```
ExplorePage detects ?welcome=true
         │
         ▼
DashboardLayout.openAddProject(true)
         │
         ▼
setAddProjectOpen(true)
setAddProjectWelcomeMode(true)
         │
         ▼
IntelligentChatPanel renders with welcomeMode={true}
         │
         ▼
renderEmptyState() shows welcome message
         │
         ▼
User clicks option → sendMessage() → AI Agent
```

---

## 4. Personalization Integration

### 4.1 Interests Collection (Auth Phase)

During signup, users select from predefined interests:

```typescript
const interests = [
  { id: 'explore', label: 'Explore' },
  { id: 'share_skills', label: 'Share my skills' },
  { id: 'invest', label: 'Invest in AI projects' },
  { id: 'mentor', label: 'Mentor others' },
];
```

These are stored and used by the PersonalizationEngine for the "For You" feed.

### 4.2 Personalization Game (Phase 2)

The "Play a game" option will launch an interactive quiz that:
- Presents project comparisons (A/B choices)
- Asks about tool preferences
- Identifies skill levels
- Builds a detailed preference profile

**Architecture**: See `/docs/PERSONALIZATION_PLAN.md` for full details.

---

## 5. Future Enhancements

### 5.1 Phase 2: Personalization Game
- Interactive preference quiz
- Visual A/B project comparisons
- Gamified point system
- Progressive disclosure of features

### 5.2 Phase 3: Guided Creation
- AI-assisted project ideation
- Template-based scaffolding
- Step-by-step wizard with chat guidance
- Integration with AI coding assistants

### 5.3 Phase 4: Onboarding Analytics
- Track completion rates by step
- A/B test different welcome messages
- Identify drop-off points
- Measure time-to-first-project

---

## 6. Key Files

### Frontend

| File | Purpose |
|------|---------|
| `pages/AuthPage.tsx` | Auth chat UI and flow |
| `hooks/useAuthChatStream.ts` | Auth state management |
| `components/chat/IntelligentChatPanel.tsx` | Unified AI chat with welcome mode |
| `components/layouts/DashboardLayout.tsx` | Panel state management |
| `pages/ExplorePage.tsx` | Welcome param detection |

### Backend

| File | Purpose |
|------|---------|
| `services/ai/agents/auth_chat/` | LangGraph auth agent |
| `services/ai/agents/router/` | Unified chat router agent |
| `core/users/views.py` | User creation API |

---

## 7. Design Principles

### 7.1 Conversational Over Form-Based
Every interaction should feel like a dialogue, not a form submission.

### 7.2 Progressive Disclosure
Don't overwhelm new users. Reveal features as they become relevant.

### 7.3 Unified Experience
One chat interface for auth, onboarding, project creation, and support.

### 7.4 Actionable Options
Always give users clear next steps with prominent CTAs.

### 7.5 Graceful Degradation
If AI is unavailable, fallback to static UI without losing functionality.

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
