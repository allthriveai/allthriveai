# Content Engine UI - Full Implementation Plan

## Goal
Build a **chat-first, responsive** Content Engine that mirrors MCP capabilities:
- **Idea Library** - Brainstorm and manage content ideas
- **Clip Creator** - Chat-driven React Framer animated clips (like current social-clip)
- **Content Calendar** - Visual schedule for all platforms
- **Brand Voice** - Configure tone, personality, visual style

## Key Design Principles

1. **Chat-First** - Conversation drives clip creation ("What clip do you want to build?")
2. **Responsive UI** - Content Engine works on desktop AND mobile
3. **9:16 Output** - All clips are portrait format (optimized for LinkedIn, YouTube Shorts, Reels)
4. **Single Page with Tabs** - All features in one Content Engine page
5. **React Framer Focus** - Animated clips only (not text cards or video shorts for now)

---

## Design System: Neon Glass Styleguide

All components MUST use the existing Neon Glass design system (`/styleguide`):

**Core Classes:**
- `.glass-panel` / `.glass-card` / `.glass-subtle` - Containers
- `.btn-primary` / `.btn-secondary` / `.btn-outline` / `.btn-ghost` - Buttons
- `.input-glass` - Form inputs
- `.neon-border` / `.shadow-neon` - Active/highlighted states

**Colors:**
- Cyan: `#22D3EE` (primary actions, links)
- Green: `#4ADE80` (success, growth)
- Magenta: `#D946EF` (accents, AI agents)
- Primary gradient: `from-cyan-400 to-green-400`

**Border Radius:** `rounded` (4px) as default for all interactive elements

**Platform Badges:**
- LinkedIn: Blue (`bg-blue-500/20 text-blue-400 border-blue-500/30`)
- YouTube: Red (`bg-red-500/20 text-red-400 border-red-500/30`)
- Twitter: Cyan (`bg-cyan-500/20 text-cyan-400 border-cyan-500/30`)

---

## Architecture Overview

```
/create/content-engine      → Single page with tabbed navigation

Tabs:
├── Ideas        → Idea Library (list/card views)
├── Create       → Chat-first Clip Creator with preview
├── Calendar     → Content schedule
└── Brand Voice  → Brand settings
```

**Responsive Layout:**

*Mobile:*
- Bottom tab navigation (like native apps)
- Full-screen tabs
- Touch-friendly interactions

*Desktop:*
- Side tabs or top tabs
- Split view where appropriate (chat + preview side by side)

**Clip Output:** Always 9:16 portrait (1080x1920) for social platforms

---

## Phase 1: Content Engine Shell (Single Page with Tabs)

### 1.1 Main Page Structure

**Create:** `frontend/src/pages/content-engine/ContentEnginePage.tsx`

```tsx
// Responsive tabbed layout
<div className="min-h-screen bg-background">
  {/* Tab Content Area */}
  <div className="pb-16 md:pb-0 md:pl-20">
    {activeTab === 'ideas' && <IdeasTab />}
    {activeTab === 'create' && <CreateTab />}
    {activeTab === 'calendar' && <CalendarTab />}
    {activeTab === 'brand' && <BrandVoiceTab />}
  </div>

  {/* Bottom Tab Bar (Mobile) */}
  <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t md:hidden">
    <TabBar tabs={['ideas', 'create', 'calendar', 'brand']} />
  </nav>

  {/* Side Tab Bar (Desktop) - w-20 for icon + label */}
  <nav className="hidden md:flex fixed left-0 top-16 bottom-0 w-20 glass-panel border-r flex-col">
    <SideTabBar />
  </nav>
</div>
```

### 1.2 Tab Components

**Create:** `frontend/src/components/content-engine/tabs/`
- `TabBar.tsx` - Bottom navigation for mobile
- `SideTabBar.tsx` - Side navigation for desktop
- `IdeasTab.tsx` - Ideas list/card view
- `CreateTab.tsx` - Chat-first clip creator
- `CalendarTab.tsx` - Content calendar
- `BrandVoiceTab.tsx` - Brand settings

---

## Phase 2: Ideas Tab

### 2.1 Backend (Already Exists)
- `ContentIdea` model: `saved` → `planned` → `in_progress` → `archived`
- API at `/api/v1/content-engine/ideas/`

### 2.2 Ideas Tab Component

**Create:** `frontend/src/components/content-engine/tabs/IdeasTab.tsx`

**Mobile Layout:**
```
┌─────────────────────────┐
│ + Quick Capture Input   │
├─────────────────────────┤
│ Filter: [All ▼] 🔍      │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Idea Card           │ │
│ │ Title               │ │
│ │ [LinkedIn] [YouTube]│ │
│ │ Status: Saved       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Idea Card           │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

Features:
- Quick capture input at top (always visible)
- Toggle list/card view
- Tap to expand/edit
- Click actions (archive, create clip) - no swipe gestures for MVP

### 2.3 Components

**Create:** `frontend/src/components/content-engine/ideas/`
- `IdeaCard.tsx` - Glass card with click actions
- `IdeaList.tsx` - Compact list view
- `QuickCapture.tsx` - Inline idea input
- `IdeaFilters.tsx` - Status/platform filters
- `PlatformBadge.tsx` - Platform tag chips
- `StatusBadge.tsx` - Status indicator

---

## Phase 3: Create Tab (Chat-First Clip Creator)

### 3.1 Chat-First Architecture

The Create tab uses the **existing WebSocket chat pattern** from `/create/social-clip`:
- User describes what clip they want
- AI helps decide clip type, content, style
- Real-time preview updates as conversation progresses
- Final clip generated and ready to schedule

**Mobile Layout:**
```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   Clip Preview      │ │
│ │   (9:16 aspect)     │ │
│ │                     │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Chat Messages           │
│ ┌─────────────────────┐ │
│ │ AI: What clip do    │ │
│ │ you want to create? │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ You: A quick tip    │ │
│ │ about RAG...        │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ [Message input...]  ➤  │
└─────────────────────────┘
```

**Desktop Layout:**
```
┌──────────────────┬──────────────────┐
│                  │                  │
│   Chat Panel     │   Clip Preview   │
│                  │   (9:16 aspect)  │
│   Messages...    │                  │
│                  │   [▶ Play]       │
│   [Input...]     │   [Export]       │
│                  │                  │
└──────────────────┴──────────────────┘
```

### 3.2 Reuse Existing Components

**Keep/Adapt from current social-clip:**
- `ClipCreatorChatPanel.tsx` - WebSocket chat interface
- `ClipPreview.tsx` - Framer Motion preview renderer
- `ClipAgentConsumer` (backend) - WebSocket consumer

**New wrapper:**
- `CreateTab.tsx` - Mobile-optimized layout wrapping existing components

### 3.3 WebSocket Lifecycle

The `CreateTab` component must manage WebSocket connections carefully:
- Connect WebSocket when tab becomes active
- Disconnect when switching to another tab
- Handle reconnection on network errors
- Clean up on unmount

```tsx
// CreateTab.tsx - WebSocket lifecycle
useEffect(() => {
  if (isActive) {
    connectWebSocket();
  }
  return () => disconnectWebSocket();
}, [isActive]);
```

---

## Phase 4: Calendar Tab

### 4.1 Responsive Calendar

**Create:** `frontend/src/components/content-engine/tabs/CalendarTab.tsx`

**Mobile Layout:**
```
┌─────────────────────────┐
│ ◀ January 2025 ▶        │
├─────────────────────────┤
│ S  M  T  W  T  F  S     │
│       1  2  3  4  5     │
│ 6  7  8  9  10 11 12    │
│ 13 14 15●16 17 18 19    │  ← dot = has content
│ 20 21 22 23 24 25 26    │
│ 27 28 29 30 31          │
├─────────────────────────┤
│ Jan 16 - Today          │
│ ┌─────────────────────┐ │
│ │ 🔵 LinkedIn 9:00 AM │ │
│ │ RAG Tutorial Clip   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 🔴 YouTube 2:00 PM  │ │
│ │ AI Tools Roundup    │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

Features:
- Month view with dots for scheduled content
- Tap day to see schedule
- Tap event to view/edit
- Long-press to quick schedule
- Platform color coding

### 4.2 Components

**Create:** `frontend/src/components/content-engine/calendar/`
- `MobileCalendar.tsx` - Month grid with indicators
- `DaySchedule.tsx` - List of events for selected day
- `ScheduleCard.tsx` - Event card with platform badge
- `ScheduleModal.tsx` - Modal for scheduling a clip

---

## Phase 5: Brand Voice Tab

### 5.1 Adapt Existing Page

**Reuse:** `frontend/src/pages/BrandVoiceSettingsPage.tsx`

Wrap in tab-friendly component:

**Create:** `frontend/src/components/content-engine/tabs/BrandVoiceTab.tsx`

Features:
- Tone selector
- Personality traits (tags)
- Topics/pillars
- Signature phrases
- Color picker (primary/accent)
- Visual style description

---

## Phase 6: Routes & Navigation

### 6.1 Single Route

**Modify:** `frontend/src/routes/index.tsx`

```tsx
// Content Engine - single page with tabs
{ path: '/create/content-engine', element: <ContentEnginePage /> },
{ path: '/create/content-engine/:tab', element: <ContentEnginePage /> },

// Keep existing for backwards compatibility
{ path: '/create/social-clip', element: <Navigate to="/create/content-engine/create" /> },
{ path: '/create/brand-voice', element: <Navigate to="/create/content-engine/brand" /> },
```

### 6.2 Update Create Hub

**Modify:** `frontend/src/pages/CreatePage.tsx`

Add prominent link to Content Engine:

```tsx
{
  title: 'Content Engine',
  description: 'Create, schedule, and manage social content',
  icon: Sparkles,
  href: '/create/content-engine',
  featured: true,  // Make this prominent
}
```

---

## Phase 7: MCP ↔ Web UI Integration

The MCP and Content Engine UI are **two interfaces to the same backend**. Content created via MCP appears in the Web UI and vice versa.

### 7.1 Shared Backend Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   MCP Server    │     │  Content Engine │
│ (Claude Desktop)│     │   (Web UI)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Django REST API     │
         │ /api/v1/content-engine│
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   PostgreSQL DB       │
         │ ContentIdea, Clip,    │
         │ ScheduledPost, etc.   │
         └───────────────────────┘
```

### 7.2 MCP Server Location

**Full path:** `/Users/allierays/Sites/allthrive-mcp/`

| MCP File | Purpose |
|----------|---------|
| `src/allthrive_mcp/tools/ideas.py` | Ideas CRUD (list, create, update, delete) |
| `src/allthrive_mcp/tools/clips.py` | Clips CRUD + generate |
| `src/allthrive_mcp/tools/schedule.py` | Schedule posts to platforms |
| `src/allthrive_mcp/tools/brainstorm.py` | AI brainstorming |
| `src/allthrive_mcp/tools/brand_voice.py` | Brand voice settings |
| `src/allthrive_mcp/api_client.py` | HTTP client to Django backend |

### 7.3 No Changes Needed to MCP

The MCP already saves content to the backend via API. The Content Engine UI will display that content automatically. No MCP modifications required for this plan.

---

## Implementation Order

### Sprint 1: Content Engine Shell
1. Create `ContentEnginePage.tsx` with tab navigation
2. Create mobile `TabBar.tsx` and desktop `SideTabBar.tsx`
3. Add route `/create/content-engine/:tab?`
4. Create placeholder tab components

### Sprint 2: Create Tab (Chat-First)
1. Adapt existing `ClipCreatorChatPanel` for mobile
2. Adapt existing `ClipPreview` for responsive layout
3. Wire up WebSocket connection
4. Test end-to-end clip creation flow

### Sprint 3: Ideas Tab
1. Create `IdeasTab.tsx` with list/card toggle
2. Create `IdeaCard.tsx` with click actions (menu dropdown)
3. Create `QuickCapture.tsx` input
4. Wire up ideas API

### Sprint 4: Calendar Tab
1. Create `MobileCalendar.tsx` month view
2. Create `DaySchedule.tsx` for selected day
3. Create `ScheduleCard.tsx` event cards
4. Wire up calendar API

### Sprint 5: Brand Voice Tab + Polish
1. Adapt `BrandVoiceSettingsPage` for tab
2. Error handling & loading states
3. Responsive polish & testing
4. Verify MCP ↔ Web UI data sync works

---

## Key Files Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/pages/content-engine/ContentEnginePage.tsx` | Main page with tabs |
| `frontend/src/components/content-engine/tabs/TabBar.tsx` | Mobile bottom nav |
| `frontend/src/components/content-engine/tabs/SideTabBar.tsx` | Desktop side nav |
| `frontend/src/components/content-engine/tabs/IdeasTab.tsx` | Ideas list/card |
| `frontend/src/components/content-engine/tabs/CreateTab.tsx` | Chat-first creator |
| `frontend/src/components/content-engine/tabs/CalendarTab.tsx` | Calendar view |
| `frontend/src/components/content-engine/tabs/BrandVoiceTab.tsx` | Brand settings |
| `frontend/src/components/content-engine/ideas/IdeaCard.tsx` | Idea card component |
| `frontend/src/components/content-engine/ideas/QuickCapture.tsx` | Quick input |
| `frontend/src/components/content-engine/calendar/MobileCalendar.tsx` | Month calendar |
| `frontend/src/components/content-engine/calendar/DaySchedule.tsx` | Day events |
| `frontend/src/services/contentEngine/ideas.ts` | Ideas API service |
| `frontend/src/services/contentEngine/schedule.ts` | Schedule API service |
| `frontend/src/types/contentEngine.ts` | TypeScript types for all content engine models |

### Files to Modify/Adapt

| File | Changes |
|------|---------|
| `frontend/src/routes/index.tsx` | Add content-engine route |
| `frontend/src/pages/CreatePage.tsx` | Add Content Engine link |
| `frontend/src/components/creator/ClipCreatorChatPanel.tsx` | Make responsive |
| `frontend/src/components/creator/ClipPreview.tsx` | Make responsive |

---

## API Endpoints & Services

### Backend API Routes (verify against `core/content_engine/urls.py`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/content-engine/ideas/` | GET, POST | List/create ideas |
| `/api/v1/content-engine/ideas/{id}/` | GET, PUT, DELETE | Idea detail |
| `/api/v1/content-engine/clips/` | GET, POST | List/create clips |
| `/api/v1/content-engine/clips/{id}/` | GET, PUT, DELETE | Clip detail |
| `/api/v1/content-engine/schedule/` | GET, POST | List/create scheduled posts |
| `/api/v1/content-engine/schedule/{id}/` | GET, PUT, DELETE | Schedule detail |
| `/api/v1/content-engine/brand-voice/` | GET, PUT | Get/update brand voice |

### Frontend API Services

**`frontend/src/services/contentEngine/ideas.ts`**
```typescript
export const ideasApi = {
  list: (params?: { status?: string; platform?: string }) =>
    api.get<PaginatedResponse<ContentIdea>>('/content-engine/ideas/', { params }),
  create: (data: CreateIdeaPayload) =>
    api.post<ContentIdea>('/content-engine/ideas/', data),
  update: (id: number, data: Partial<ContentIdea>) =>
    api.patch<ContentIdea>(`/content-engine/ideas/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/content-engine/ideas/${id}/`),
};
```

**`frontend/src/services/contentEngine/schedule.ts`**
```typescript
export const scheduleApi = {
  list: (params?: { start_date?: string; end_date?: string }) =>
    api.get<PaginatedResponse<ScheduledPost>>('/content-engine/schedule/', { params }),
  create: (data: CreateSchedulePayload) =>
    api.post<ScheduledPost>('/content-engine/schedule/', data),
  update: (id: number, data: Partial<ScheduledPost>) =>
    api.patch<ScheduledPost>(`/content-engine/schedule/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/content-engine/schedule/${id}/`),
};
```

---

## Loading & Error States

Each tab must handle these states consistently:

| State | Component | Behavior |
|-------|-----------|----------|
| Loading | `<LoadingSpinner />` | Centered spinner with glass background |
| Empty | `<EmptyState />` | Helpful message + primary action button |
| Error | `<ErrorState />` | Error message + retry button |

**Pattern for each tab:**
```tsx
function IdeasTab() {
  const { data, isLoading, error, refetch } = useQuery(['ideas'], ideasApi.list);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState message="Failed to load ideas" onRetry={refetch} />;
  if (!data?.results.length) return <EmptyState message="No ideas yet" action={<QuickCapture />} />;

  return <IdeaList ideas={data.results} />;
}
```

---

## TypeScript Types

**`frontend/src/types/contentEngine.ts`**
```typescript
export type IdeaStatus = 'saved' | 'planned' | 'in_progress' | 'archived';
export type Platform = 'linkedin' | 'youtube' | 'twitter';
export type ClipStatus = 'draft' | 'ready' | 'scheduled' | 'published';

export interface ContentIdea {
  id: number;
  title: string;
  description?: string;
  status: IdeaStatus;
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentClip {
  id: number;
  title: string;
  scenes: ClipScene[];
  status: ClipStatus;
  ideaId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledPost {
  id: number;
  clipId: number;
  platform: Platform;
  scheduledFor: string;
  status: 'scheduled' | 'published' | 'failed';
  createdAt: string;
}

export interface BrandVoice {
  id: number;
  tone: string;
  personality: string[];
  topics: string[];
  signaturePhrases: string[];
  primaryColor: string;
  accentColor: string;
}
```

---

## Notes

- **Chat-first** - All clip creation through conversation (like current social-clip)
- **Responsive UI** - Works on desktop and mobile (bottom tabs on mobile, side tabs on desktop)
- **9:16 Output** - Clips always render at 1080x1920 portrait for social platforms
- **Single page** - `/create/content-engine` with 4 tabs
- **Reuse existing** - Adapt ClipCreatorChatPanel and ClipPreview, don't rebuild
- **React Framer only** - Animated clips for now (not text cards or video shorts)
- **LinkedIn publishing** - Deferred, focus on content creation first
