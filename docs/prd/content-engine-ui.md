# PRD: Content Engine UI

## Overview

**One-liner:** A chat-first, responsive Content Engine that mirrors MCP capabilities for creating, scheduling, and managing social media content.

**Problem:** Users can create content via MCP (Claude Desktop) but have no web UI to view, manage, or schedule that content. The existing `/create/social-clip` page is desktop-only and disconnected from the idea library and calendar.

**Success Metric:** Users can create animated clips via chat, manage their idea library, view their content calendar, and configure brand voice—all from a single responsive page that syncs with MCP.

## Users

- **Content creators** using AllThrive to build their personal brand
- **MCP users** who create content via Claude Desktop and want to view/edit in browser
- **Mobile users** who want to capture ideas and check their calendar on-the-go

## User Journey

### Happy Path: Create a Clip from Idea

1. User navigates to `/create/content-engine`
2. User sees 4 tabs: Ideas, Create, Calendar, Brand Voice
3. User goes to Ideas tab, sees their idea library
4. User taps an idea → "Create Clip" action
5. User is taken to Create tab with idea pre-loaded
6. AI asks clarifying questions via chat
7. Real-time 9:16 preview updates as conversation progresses
8. User says "looks good"
9. AI saves clip, offers to schedule
10. User schedules for LinkedIn tomorrow at 9am
11. User sees scheduled post in Calendar tab

### Happy Path: Quick Idea Capture (Mobile)

1. User opens Content Engine on phone
2. Bottom tab bar shows Ideas/Create/Calendar/Brand
3. User taps Ideas tab
4. Quick capture input at top is always visible
5. User types "Video about RAG chunking strategies" → Enter
6. Idea saved with "saved" status
7. User can tag platforms (LinkedIn, YouTube) later

### Error Scenarios

| Scenario | User Action | System Response |
|----------|-------------|-----------------|
| WebSocket disconnects | User is typing in Create tab | Show "Reconnecting..." toast, auto-reconnect |
| Empty idea library | User opens Ideas tab for first time | Show EmptyState with QuickCapture prominent |
| API error loading ideas | User opens Ideas tab | Show ErrorState with "Retry" button |
| Invalid schedule time | User picks time in the past | Disable confirm button, show "Select a future time" |
| Clip generation fails | AI can't generate valid clip | AI explains issue in chat, suggests fixes |

## Technical Requirements

### Dependencies (What Already Exists)

**Backend:**
- `ContentIdea` model with status workflow (`saved` → `planned` → `in_progress` → `archived`)
- `ContentClip` model with Framer Motion scene data
- `ScheduledPost` model for calendar
- `BrandVoice` model for tone/style settings
- REST API at `/api/v1/content-engine/`
- WebSocket consumer `ClipAgentConsumer` for chat-driven creation

**Frontend:**
- `ClipCreatorChatPanel.tsx` - WebSocket chat interface
- `ClipPreview.tsx` - Framer Motion 9:16 preview renderer
- `BrandVoiceSettingsPage.tsx` - Brand configuration form
- Neon Glass design system at `/styleguide`

**MCP:**
- AllThrive MCP server at `/Users/allierays/Sites/allthrive-mcp/`
- Tools: ideas, clips, schedule, brainstorm, brand_voice
- Already saves to same backend API

### New Components to Build

**Pages:**
- `ContentEnginePage.tsx` - Main tabbed container

**Tab Components:**
- `TabBar.tsx` - Mobile bottom navigation
- `SideTabBar.tsx` - Desktop side navigation
- `IdeasTab.tsx` - Idea library with list/card toggle
- `CreateTab.tsx` - Chat-first clip creator wrapper
- `CalendarTab.tsx` - Content schedule view
- `BrandVoiceTab.tsx` - Brand settings wrapper

**Ideas Components:**
- `IdeaCard.tsx` - Glass card with actions
- `IdeaList.tsx` - Compact list view
- `QuickCapture.tsx` - Inline idea input
- `IdeaFilters.tsx` - Status/platform filters
- `PlatformBadge.tsx` - Platform tag chips
- `StatusBadge.tsx` - Status indicator

**Calendar Components:**
- `MobileCalendar.tsx` - Month grid with dots
- `DaySchedule.tsx` - Events for selected day
- `ScheduleCard.tsx` - Event card
- `ScheduleModal.tsx` - Scheduling form

**Services:**
- `frontend/src/services/contentEngine/ideas.ts`
- `frontend/src/services/contentEngine/schedule.ts`
- `frontend/src/types/contentEngine.ts`

### Out of Scope (v2)

- Publishing directly to LinkedIn/YouTube/Twitter (deferred)
- Text + Image cards (React Framer clips only for now)
- Video shorts (animated clips only)
- Swipe gestures on mobile (click actions only for MVP)
- Drag-and-drop reordering
- Analytics/engagement tracking

### Constraints

- All clips must render at 9:16 portrait (1080x1920)
- Must use Neon Glass design system (`/styleguide`)
- WebSocket must connect/disconnect on tab switch to avoid resource leaks
- Mobile: bottom tab navigation (like native apps)
- Desktop: side tab navigation with split view for Create tab
- Must sync with MCP—content created via MCP appears in Web UI

## Implementation Tasks

### Phase 1: Content Engine Shell
- [ ] Create `frontend/src/pages/content-engine/ContentEnginePage.tsx`
- [ ] Create `frontend/src/components/content-engine/tabs/TabBar.tsx` (mobile)
- [ ] Create `frontend/src/components/content-engine/tabs/SideTabBar.tsx` (desktop)
- [ ] Add routes `/create/content-engine` and `/create/content-engine/:tab`
- [ ] Add redirects from `/create/social-clip` → `/create/content-engine/create`
- [ ] Create placeholder components for all 4 tabs
- [ ] Update `CreatePage.tsx` with Content Engine link

### Phase 2: Create Tab (Chat-First)
- [ ] Create `CreateTab.tsx` wrapper with responsive layout
- [ ] Adapt `ClipCreatorChatPanel.tsx` for mobile viewport
- [ ] Adapt `ClipPreview.tsx` for responsive sizing
- [ ] Implement WebSocket connect/disconnect on tab active state
- [ ] Handle reconnection on network errors
- [ ] Test end-to-end clip creation flow

### Phase 3: Ideas Tab
- [ ] Create `frontend/src/types/contentEngine.ts` with TypeScript types
- [ ] Create `frontend/src/services/contentEngine/ideas.ts` API service
- [ ] Create `IdeasTab.tsx` with list/card view toggle
- [ ] Create `IdeaCard.tsx` with glass styling and action menu
- [ ] Create `IdeaList.tsx` compact view
- [ ] Create `QuickCapture.tsx` input component
- [ ] Create `IdeaFilters.tsx` for status/platform filtering
- [ ] Create `PlatformBadge.tsx` and `StatusBadge.tsx`
- [ ] Wire up ideas API with loading/error/empty states

### Phase 4: Calendar Tab
- [ ] Create `frontend/src/services/contentEngine/schedule.ts` API service
- [ ] Create `CalendarTab.tsx` container
- [ ] Create `MobileCalendar.tsx` month grid with indicators
- [ ] Create `DaySchedule.tsx` for selected day events
- [ ] Create `ScheduleCard.tsx` with platform badges
- [ ] Create `ScheduleModal.tsx` for scheduling clips
- [ ] Wire up schedule API with loading/error/empty states

### Phase 5: Brand Voice Tab + Polish
- [ ] Create `BrandVoiceTab.tsx` wrapping existing settings
- [ ] Add consistent loading/error states to all tabs
- [ ] Test responsive behavior on mobile and desktop
- [ ] Verify MCP ↔ Web UI data sync works
- [ ] Cross-browser testing

## Test Scenarios

### E2E Tests to Write

1. **Content Engine Navigation** - Verify user can switch between all 4 tabs, URL updates correctly
2. **Ideas CRUD** - Verify user can create, view, filter, and archive ideas
3. **Quick Capture** - Verify mobile quick capture saves idea with correct status
4. **Create Clip Flow** - Verify chat conversation generates clip preview in real-time
5. **Schedule Clip** - Verify user can schedule clip and it appears in calendar
6. **Calendar View** - Verify dots appear on days with content, day selection works
7. **Brand Voice Settings** - Verify changes persist and affect clip generation
8. **MCP Sync** - Verify content created via MCP appears in Web UI
9. **Responsive Layout** - Verify bottom tabs on mobile, side tabs on desktop
10. **WebSocket Reconnection** - Verify Create tab reconnects after network drop

### Unit Tests

1. **IdeaCard** - Renders correctly with all status types
2. **PlatformBadge** - Shows correct colors for LinkedIn/YouTube/Twitter
3. **MobileCalendar** - Correctly marks days with scheduled content
4. **TabBar** - Active state styling works correctly

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/content-engine/ideas/` | GET | List ideas (supports `?status=` and `?platform=` filters) |
| `/api/v1/content-engine/ideas/` | POST | Create new idea |
| `/api/v1/content-engine/ideas/{id}/` | PATCH | Update idea |
| `/api/v1/content-engine/ideas/{id}/` | DELETE | Delete idea |
| `/api/v1/content-engine/clips/` | GET | List clips |
| `/api/v1/content-engine/clips/` | POST | Create clip |
| `/api/v1/content-engine/clips/{id}/` | GET/PATCH/DELETE | Clip detail |
| `/api/v1/content-engine/schedule/` | GET | List scheduled posts (`?start_date=` `?end_date=`) |
| `/api/v1/content-engine/schedule/` | POST | Schedule a clip |
| `/api/v1/content-engine/schedule/{id}/` | PATCH/DELETE | Update/delete schedule |
| `/api/v1/content-engine/brand-voice/` | GET/PUT | Get/update brand voice |
| `ws://localhost:8000/ws/clip-agent/` | WebSocket | Chat-driven clip creation |

## Design Reference

- **Design System:** Neon Glass (`/styleguide`)
- **Primary Color:** Cyan `#22D3EE`
- **Success Color:** Green `#4ADE80`
- **Accent Color:** Magenta `#D946EF`
- **Platform Badges:**
  - LinkedIn: Blue (`bg-blue-500/20 text-blue-400`)
  - YouTube: Red (`bg-red-500/20 text-red-400`)
  - Twitter: Cyan (`bg-cyan-500/20 text-cyan-400`)
