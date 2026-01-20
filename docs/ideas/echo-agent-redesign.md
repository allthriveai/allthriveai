# Echo Agent Redesign: From Tabbed UI to Conversation-First Experience

**Created:** 2025-01-19
**Status:** Proposal
**Author:** Claude + Allie

## Summary

Refactor the Content Engine from a tabbed application with an embedded chatbot into a **conversation-first micro-agent experience** where Echo IS the interface, not a component within it.

---

## The Problem

### Current State

The Content Engine is **UI-first** with tabs:

```
[Ideas Tab] [Create Tab] [Calendar Tab] [Brand Tab]
     ↓           ↓            ↓            ↓
   Echo        Clip         Schedule      Settings
   Chat       Creator      (separate)    (separate)
```

**Issues:**
1. User sees everything at once and must figure out the workflow
2. Echo is just one panel among many, not the guide
3. Tabs feel disconnected - no flow between them
4. Two separate chat systems (Echo vs Clip Creator)
5. State scattered across components with no shared context
6. Onboarding preferences don't persist into actual usage
7. No proactive guidance - user must drive everything

### What Users See Today

- Filter bar with 8+ content pillars
- Platform icons (Twitter, LinkedIn, YouTube)
- Quick prompt pills
- Ideas list with filters
- Quick capture input
- "Connecting to Echo..." loading state

**Result:** Overwhelming, not guided, feels "all over the place"

---

## The Vision: Agent-First Design

Echo should BE the interface, not live inside it.

### Core Principle

**One conversation handles everything:**
- Brainstorming → "Let's explore some ideas"
- Creating clips → "Want to turn this into a video?"
- Scheduling → "When should we post this?"
- Brand voice → Contextual, not a tab ("I'll use your usual tone")

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │                          │  │                             │ │
│  │   Echo Conversation      │  │   Context Panel             │ │
│  │   (70%)                  │  │   (30%)                     │ │
│  │                          │  │                             │ │
│  │   - Chat messages        │  │   Changes based on state:   │ │
│  │   - Idea suggestions     │  │   - Quick actions           │ │
│  │   - Inline actions       │  │   - Recent ideas            │ │
│  │                          │  │   - Clip preview            │ │
│  │                          │  │   - Mini calendar           │ │
│  │                          │  │   - Content pillars         │ │
│  │                          │  │                             │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

### 1. One Conversation, Many Capabilities

Echo handles everything through conversation. No tab switching.

**Before:** User clicks "Create Tab" to make a clip
**After:** Echo says "Want to turn this into a video?" and clip preview appears in context panel

### 2. Progressive Disclosure

Don't show complexity until it's needed:
- Don't show calendar until they have something to schedule
- Don't show clip preview until they're creating a clip
- Don't show all 8 pillars upfront - let Echo suggest based on topic

### 3. Contextual Actions, Not Tabs

Actions appear when relevant:

| State | Context Panel Shows |
|-------|---------------------|
| Idle / Welcome | Quick actions + recent ideas (collapsed) |
| Brainstorming | Content pillars + platform toggles |
| Idea suggested | Idea card with save/edit/develop buttons |
| Creating clip | Clip preview + timeline editor |
| Scheduling | Mini calendar + suggested times |
| Review mode | Ideas list with status filters |

### 4. Ideas as Context, Not a Separate View

Ideas appear inline when relevant:
- Session start: "Last time you saved 'AI Productivity Tips' — want to develop that?"
- After brainstorming: Idea card appears in chat, save button right there
- Review mode: Scrollable list in context panel

### 5. Agent Memory

Echo remembers across sessions:
- Content pillars and preferred platforms
- Ideas saved (and which are stale/undeveloped)
- Posting cadence and schedule
- What performed well (engagement data)
- Brand voice preferences

---

## User Flow Example

```
User opens /create/content-engine

┌─────────────────────────────────────────────────────────────┐
│ Echo: "Hey! Ready to create? I see you have 3 saved ideas  │
│        and nothing scheduled for next week. What would you │
│        like to work on?"                                    │
│                                                             │
│        [Brainstorm new ideas]                               │
│        [Develop saved ideas (3)]                            │
│        [Plan next week's content]                           │
└─────────────────────────────────────────────────────────────┘

User: clicks "Brainstorm new ideas"

┌─────────────────────────────────────────────────────────────┐
│ Echo: "Let's brainstorm! I remember you focus on AI &      │
│        productivity for LinkedIn professionals.             │
│                                                             │
│        What's on your mind, or want me to suggest some     │
│        angles based on what's trending?"                    │
│                                                             │
│        [Suggest trending topics]  [I have something]        │
└─────────────────────────────────────────────────────────────┘

User: "I want to talk about how AI is changing sales"

┌─────────────────────────────────────────────────────────────┐
│ Echo: "Great topic! Here are 3 angles:                     │
│                                                             │
│        💡 **The AI Sales Assistant Reality Check**          │
│        Hook: "AI won't replace salespeople. But salespeople│
│        using AI will replace those who don't."              │
│        → LinkedIn, Twitter | Authority pillar               │
│        [Save] [Develop into clip] [Refine]                  │
│                                                             │
│        💡 **5 AI Tools That Actually Help Sales Teams**     │
│        Hook: "Forget the hype. These 5 tools are actually  │
│        being used by top sales teams..."                    │
│        → LinkedIn, YouTube | Educational pillar             │
│        [Save] [Develop into clip] [Refine]                  │
│                                                             │
│        💡 **Why Your CRM Data is Your AI Goldmine**         │
│        Hook: "That messy CRM data? It's about to become    │
│        your biggest competitive advantage."                 │
│        → LinkedIn | Behind-the-scenes pillar                │
│        [Save] [Develop into clip] [Refine]                  │
└─────────────────────────────────────────────────────────────┘

User: clicks [Develop into clip] on first idea

[Context panel transitions to clip preview]

┌─────────────────────────────────────────────────────────────┐
│ Echo: "Let's turn this into a clip! I'll draft a           │
│        60-second script based on your brand voice.          │
│                                                             │
│        Generating script..."                                │
│                                                             │
│ [Script appears, user can edit inline]                      │
│                                                             │
│ Echo: "Here's your clip preview. The hook hits at 0:03,    │
│        and we end with a CTA at 0:55.                       │
│                                                             │
│        [▶ Play preview]                                     │
│                                                             │
│        Happy with it?"                                      │
│                                                             │
│        [Looks good, schedule it]                            │
│        [Tweak the script]                                   │
│        [Try a different style]                              │
└─────────────────────────────────────────────────────────────┘

User: "Looks good, schedule it"

[Context panel transitions to mini calendar]

┌─────────────────────────────────────────────────────────────┐
│ Echo: "When should we post? Based on your audience:        │
│                                                             │
│        📈 Tuesday 9am has 23% higher engagement             │
│        📅 Thursday 2pm is your usual slot                   │
│                                                             │
│        [Tuesday 9am]  [Thursday 2pm]  [Pick custom time]    │
└─────────────────────────────────────────────────────────────┘

User: clicks [Tuesday 9am]

┌─────────────────────────────────────────────────────────────┐
│ Echo: "Done! 'The AI Sales Assistant Reality Check' is     │
│        scheduled for Tuesday at 9am on LinkedIn.            │
│                                                             │
│        What's next?"                                        │
│                                                             │
│        [Develop another idea]                               │
│        [Brainstorm more]                                    │
│        [I'm done for now]                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Proposed Component Structure

```tsx
// ContentEnginePage.tsx (simplified)
function ContentEnginePage() {
  return (
    <EchoAgentProvider>
      <div className="h-screen flex">
        {/* Main conversation area - 70% */}
        <EchoConversation />

        {/* Contextual panel - 30%, changes based on state */}
        <EchoContextPanel />
      </div>
    </EchoAgentProvider>
  );
}
```

### EchoAgentProvider (New)

Centralized state management for:
- Conversation history
- Current mode: `idle | brainstorm | create | schedule | review`
- Active idea being worked on
- User preferences (pillars, platforms)
- Session context

```tsx
interface EchoAgentState {
  mode: 'idle' | 'brainstorm' | 'create' | 'schedule' | 'review';
  activeIdea: ContentIdea | null;
  activePillars: string[];
  activePlatforms: Platform[];
  sessionContext: {
    ideasSavedThisSession: number;
    lastAction: string;
    userIntent: string | null;
  };
}
```

### EchoConversation (Refactored)

Single chat component that handles all modes:
- Renders messages with mode-specific components
- Idea suggestions inline (not separate IdeaSuggestionMessage)
- Actions trigger mode transitions
- No quick prompt pills cluttering the UI

### EchoContextPanel (New)

Dynamic panel that shows relevant content:

```tsx
function EchoContextPanel() {
  const { mode, activeIdea } = useEchoAgent();

  switch (mode) {
    case 'idle':
      return <QuickActionsPanel />;
    case 'brainstorm':
      return <BrainstormContext />; // pillars, platforms
    case 'create':
      return <ClipPreviewPanel idea={activeIdea} />;
    case 'schedule':
      return <SchedulePanel idea={activeIdea} />;
    case 'review':
      return <IdeasListPanel />;
  }
}
```

---

## Current Files to Refactor

### Remove / Consolidate

| File | Action |
|------|--------|
| `ContentEnginePage.tsx` | Simplify - remove tab routing |
| `IdeasTab.tsx` | Merge into EchoConversation + IdeasListPanel |
| `CreateTab.tsx` | Merge into EchoConversation + ClipPreviewPanel |
| `CalendarTab.tsx` | Merge into SchedulePanel (context panel) |
| `BrandVoiceTab.tsx` | Remove as tab, make it a setting Echo uses |
| `TabBar.tsx`, `SideTabBar.tsx` | Remove |
| `BrainstormChatPanel.tsx` | Evolve into EchoConversation |
| `ClipCreatorChatPanel.tsx` | Merge into EchoConversation |

### Keep / Evolve

| File | Action |
|------|--------|
| `useEchoChat.ts` | Keep, add mode awareness |
| `IdeaCard.tsx` | Keep, use in both chat and panel |
| `IdeaList.tsx` | Keep, use in IdeasListPanel |
| `ClipPreview.tsx` | Keep, use in ClipPreviewPanel |
| `MobileCalendar.tsx` | Keep, use in SchedulePanel |
| `EchoOnboarding.tsx` | Evolve - make preferences persist |

### Create New

| File | Purpose |
|------|---------|
| `EchoAgentProvider.tsx` | Central state management |
| `EchoConversation.tsx` | Unified chat component |
| `EchoContextPanel.tsx` | Dynamic context panel |
| `QuickActionsPanel.tsx` | Idle state panel |
| `BrainstormContext.tsx` | Brainstorm mode panel |
| `ClipPreviewPanel.tsx` | Create mode panel |
| `SchedulePanel.tsx` | Schedule mode panel |
| `IdeasListPanel.tsx` | Review mode panel |

---

## Implementation Phases

### Phase 1: Unify the Experience (MVP)

**Goal:** Single conversation view, no tabs

1. Create `EchoAgentProvider` with mode state
2. Remove tab navigation (TabBar, SideTabBar)
3. Create `EchoConversation` from BrainstormChatPanel
4. Create `EchoContextPanel` with mode switching
5. Move Ideas list to collapsible panel
6. Echo starts with context-aware greeting based on user data

**Success Criteria:**
- User can brainstorm, save ideas, and see them in panel
- No tabs visible
- Mode transitions work (idle → brainstorm → back)

### Phase 2: Smart Context Panel

**Goal:** Panel content seamlessly follows conversation

1. Implement all context panel variants
2. Add smooth transitions between modes
3. Actions in panel trigger Echo responses
4. Clip preview appears when developing idea
5. Calendar appears when scheduling

**Success Criteria:**
- Full flow: brainstorm → develop clip → schedule
- Panel transitions feel natural
- Actions bidirectional (chat ↔ panel)

### Phase 3: Memory & Proactivity

**Goal:** Echo feels like it knows you

1. Persist session context to backend
2. Load user history on session start
3. Proactive suggestions: "You haven't posted in 5 days..."
4. Learn from engagement data (if available)
5. Smart defaults based on past behavior

**Success Criteria:**
- Echo greets with relevant context
- Suggestions improve over time
- User feels "known"

---

## Open Questions

1. **Mobile experience?** Current design assumes side-by-side. Mobile might need sheet/drawer pattern for context panel.

2. **Keyboard shortcuts?** Power users might want quick access to modes without clicking.

3. **Undo/history?** If user accidentally closes a suggestion, how do they get it back?

4. **Multi-idea workflow?** Can user save multiple ideas then batch-develop them?

5. **Collaboration?** Future: can multiple team members use Echo together?

---

## Success Metrics

- **Time to first saved idea:** Should decrease (fewer clicks)
- **Ideas developed into clips:** Should increase (smoother flow)
- **Session duration:** Should increase (more engaging)
- **Return rate:** Should increase (feels productive)
- **User feedback:** "Feels guided" vs "overwhelming"

---

## References

- Current implementation: `frontend/src/pages/content-engine/`
- Echo WebSocket: `frontend/src/hooks/useEchoChat.ts`
- Ideas API: `frontend/src/services/contentEngine/ideas.ts`
- Related: `/docs/ideas/echo-agent-bugfixes.md`
