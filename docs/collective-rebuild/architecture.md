# AI Collective Architecture Overview

> **Vision:** Transform All Thrive into "The AI Network Collective" — Share what you offer. Ask for what you need. A place where AI builders share what they're working on, connect with each other, and thrive together.

---

## Core Concept

The entire platform revolves around two simple actions:

| Action | Description | Example |
|--------|-------------|---------|
| **Ask** | What you need help with | "Looking for beta testers for my AI app" |
| **Offer** | What you can give to others | "I can review your landing page" |

Everything else — discovery, profiles, connections, points — exists to facilitate these two actions.

---

## Target Users

We serve **two audiences equally**:

1. **AI Builders** — Create apps, offer services, share knowledge, find collaborators
2. **Non-Technical Users** — Discover AI tools, find experts, learn from courses

The platform must work for both. Builders need a place to showcase work. Non-technical users need problem-based discovery ("I need help with marketing") rather than technical browsing.

---

## Information Architecture

### What Gets Merged

| Old Concept | New Concept | Why |
|-------------|-------------|-----|
| Projects | Offers | Projects become offer showcase pages |
| Products (marketplace) | Offers (paid) | Products are just paid offers |
| Services | Offers (type=service) | New category for consulting, mentorship |

### What Gets Kept (NOT Merged)

| Feature | Status | Integration |
|---------|--------|-------------|
| User accounts & auth | **KEEP** | Core identity |
| Stripe Connect | **KEEP** | Payment infrastructure for creators |
| Ava chat | **KEEP** | Core AI assistant, reuse components |
| URL scraper | **KEEP** | Import apps/projects during onboarding |
| Taxonomy system | **KEEP** | Reuse for offer categories |
| Community messaging | **KEEP** | Essential for Ask/Offer connections |
| **Tools Directory** | **KEEP** | Curated resource library. M2M links to Offers/Asks. See below. |
| **SavedLearningPath** | **KEEP** | Course Publisher foundation. See below. |
| **Sage** | **KEEP** | @allierays's AI agent for learning. |

### What Gets Hidden (Then Deleted)

| Feature | Status |
|---------|--------|
| Learn pages | Hide in Phase 1, delete after Discovery is built |
| Play pages (Games, Battles) | Hide in Phase 1, evaluate later |
| Old home page | Replace with new Collective home |
| Old onboarding | Replace with Ava chat-based onboarding |

---

## URL Structure

Clear separation between browsing others and managing your own:

| Purpose | URL Pattern | Examples |
|---------|-------------|----------|
| **Browse others** | `/discover/*` | `/discover`, `/discover/offers`, `/discover/asks`, `/discover/people`, `/discover/tools`, `/discover/courses` |
| **Manage yours** | `/my/*` | `/my/offers`, `/my/asks`, `/my/learning`, `/my/purchases` |
| **Profiles** | `/@username` | `/@sarah`, `/@aiconsultant` |
| **Dashboard** | `/home` | User's personal dashboard (also reachable via Connect nav) |
| **Creator Tools** | `/creator/*` | `/creator/clips`, `/creator/courses` |
| **Messages** | `/messages` | User-to-user messaging (accessible via Connect page) |
| **Community** | `/community` | Events, weekly challenges, community activities |
| **Ava** | `/ava` | AI assistant chat |
| **Settings** | `/settings` | Account settings, `/settings/earnings` for creators |

---

## Navigation Structure

### Design Philosophy

Action-oriented, feeling-based names that reflect the two-sided marketplace journey:
1. **Discover** - Find what you need (people, offers, asks, tools, courses)
2. **Connect** - Match with people, manage connections, have conversations
3. **Ava** - AI assistant for guidance and help (separate from user-to-user messages)

### Top Navigation (4 items)

```
[Logo] | Discover | Connect | Ava | [Avatar]
```

| Item | Type | Destination | Description |
|------|------|-------------|-------------|
| Logo | Link | `/` or `/home` | Landing (logged out) or Dashboard (logged in) |
| Discover | Link/Dropdown | `/discover` | Browse offers, asks, people, tools, courses |
| Connect | Link | `/home` | Dashboard, connections, and messages |
| Ava | Link/Button | `/ava` or drawer | AI assistant chat (NOT user-to-user messages) |
| Avatar | Dropdown | See below | Profile, learning, creator tools, settings |

### Connect Page (tabs or sections)

```
Dashboard    ← Activity feed, matches, quick stats
Connections  ← Active connections with people
Messages     ← User-to-user conversations
Community    ← Events, weekly challenges, community activities
```

### Discover (dropdown or page with tabs)

```
All         ← /discover
────────────
Offers      ← /discover/offers
Asks        ← /discover/asks
People      ← /discover/people
Tools       ← /discover/tools
Courses     ← /discover/courses
```

### Avatar Dropdown

```
My Profile          → /@username
────────────────────
My Learning         → /my/learning (enrolled courses, progress)
My Purchases        → /my/purchases
My Earnings         → /my/earnings (creators only, shows if has Stripe)
────────────────────
Creator Tools
  Social Clips      → /creator/clips
  Course Builder    → /creator/courses
────────────────────
Settings            → /settings
Sign Out
```

### Footer (minimal, 3 columns)

```
┌────────────────────────────────────────────────────────────────┐
│  Discover         │ Creator Tools    │ About                   │
│  ─────────────────│──────────────────│─────────────────────────│
│  Offers           │ Social Clips     │ Our Story               │
│  Asks             │ Course Builder   │ Community Guidelines    │
│  People           │                  │ Help & Feedback         │
│  Tools            │                  │                         │
│  Courses          │                  │                         │
└────────────────────────────────────────────────────────────────┘
```

### Key Decisions

- "Discover, Connect, Ava" = action/feeling-based, not feature-based
- Learning is in two places: Discover/Courses (browse) + Avatar/My Learning (enrolled)
- Creator Tools in avatar dropdown (not top nav) - keeps nav clean
- Payments split: Purchases (buyer), Earnings (seller/creator)
- No separate "Learn" top nav - courses are discoverable content
- Messages live under Connect (not separate nav item)
- Community events/challenges live under Connect (community building activities)

---

## Data Model Overview

### Three Core Entities

**1. Offer** — What someone provides
- Types: App, Course, Service, Skill, Feedback, Template
- Can be free or paid (integrates with Stripe)
- Categorized for discovery (Marketing, Sales, Support, etc.)
- Replaces: Projects, Products, Tools

**2. Ask** — What someone needs
- Types: Beta Testers, Feedback, Collaborator, Learning Goal, Hiring, Advice
- Status: Open → In Progress → Fulfilled/Closed
- Can include budget for paid opportunities

**3. Connection** — Links an Ask to an Offer (or two users)
- Initiated when someone responds to an ask or reaches out about an offer
- Status: Initiated → Discussing → Accepted → Completed/Declined
- Triggers messaging thread between users
- Triggers SMS notifications

### Supporting Entities

- **Follow** — User follows another user (for creator profiles)
- **Taxonomy** — Categories for offers (reuses existing system)
- **Tool** — Curated external AI tools (M2M with Offers/Asks)
- **AgentProfile** — Links AI agent users to human owners

---

## Tools Directory Integration

> **Tools are NOT deprecated.** The Tools Directory is a curated resource library that complements Ask/Offer.

### Concept: Tools as Resources

| Concept | Description | Example |
|---------|-------------|---------|
| **Tools Directory** | Curated external AI tools (team-managed via YAML) | Claude, Midjourney, ElevenLabs |
| **Offer with Tools** | User-created offering that uses tools | "Built with Claude" badge |
| **Ask with Tools** | User request for help with specific tools | "Need help with Midjourney" badge |

### How Tools Connect to Ask/Offer

```
┌─────────────────┐
│  Tools Directory │  ← Curated by team (YAML fixture)
│  /tools          │  ← Browse, search, compare
└────────┬────────┘
         │
         │ M2M relationships
         ▼
┌────────────────────────────────────────────┐
│                                            │
│  ┌──────────┐          ┌──────────┐        │
│  │  Offer   │          │   Ask    │        │
│  │          │          │          │        │
│  │ tools ───┼──────────┼── tools  │        │
│  │          │          │          │        │
│  └──────────┘          └──────────┘        │
│                                            │
│  "Built with Claude"   "Need help with     │
│  "Uses Midjourney"      Midjourney"        │
│                                            │
└────────────────────────────────────────────┘
```

### Tool Badge Display

**On Offers:**
- Shows tool logos as small badges
- Clicking badge opens Tool detail tray
- Discovery: Filter offers by tools used

**On Asks:**
- Shows "Help wanted with [Tool]" indicator
- Links to tool page for context
- Discovery: Find experts for specific tools

### Tool Page Enhancements (Future)

On each Tool's detail page (`/tools/:slug`), show:
- **Offers using this tool** — "Apps built with Claude"
- **Asks needing this tool** — "People looking for Claude help"
- **Experts for this tool** — Users who've helped others with it

---

## Learning Path Integration

> **LearningPaths evolve into Course Publisher** — A creator tool for experts to build AI-assisted courses as Offers.

### Two-Part Strategy

**1. Sage as @allierays's Agent**
- Sage becomes a visible AI agent owned by @allierays
- Demonstrates the agent ownership model before Sprint 9
- Sage's existing learning paths become Offers from the profile
- Shows in "Learn From Me" section: courses by Sage

**2. Course Publisher (Creator Tool)**
- New creator tool for experts/creators (like Social Clips)
- AI-assisted course building: creators provide expertise, AI helps structure
- Published courses become Offers (type: `course`)
- Target audience: experts/creators (Teachable/Kajabi style)

### How It Maps to Ask/Offer

| LearningPath Concept | Ask/Offer Equivalent |
|---------------------|----------------------|
| Published SavedLearningPath | Offer (type: `course`) |
| Path creator | Offer.user (the expert) |
| Path pricing | Offer.price_cents, pricing_type |
| Path tools | Offer.tools (M2M) |
| Path curriculum | Stored in SavedLearningPath.path_data |

### AgentProfile Model

```python
class AgentProfile(models.Model):
    """Links agent users to their human owners"""
    user = models.OneToOneField(User, on_delete=models.CASCADE,
                                  related_name='agent_profile',
                                  limit_choices_to={'role': 'agent'})
    owner = models.ForeignKey(User, on_delete=models.CASCADE,
                               related_name='owned_agents')
    created_at = models.DateTimeField(auto_now_add=True)
```

### Implementation Phases

| Phase | What | When |
|-------|------|------|
| Phase 1 (Sprint 2) | Add AgentProfile model, link Sage to @allierays | Sprint 2 |
| Phase 1 (Sprint 5) | Show Sage's courses on @allierays profile | Sprint 5 |
| Phase 2 (Future) | Course Publisher creator tool | Future Sprint |

---

## User Flows

### New User Onboarding (Chat-Based)

A conversational flow with Ava that teaches community values:

1. **Welcome** — Introduce the collective and values (Generosity, Curiosity, Respect)
2. **Asks First** — Quick selection of what they need (checkboxes + free text)
3. **Offers** — What they can give (with follow-ups for apps/services)
4. **Agreement** — Accept community guidelines
5. **Complete** — Welcome to the collective, redirect to home

Key design decisions:
- Asks come before Offers (quicker, gets engagement)
- UI is inline in chat (checkboxes, chips) not separate wizard pages
- Under 2 minutes total
- Can paste URL to import app details automatically

### Discovery Flow (Non-Technical Friendly)

Problem-based, not category-based:

1. User selects a problem category: "Marketing & Content"
2. See unified results:
   - Apps that solve this problem
   - Experts who can help
   - Courses to learn yourself
   - Open asks from others
3. Filter by price, type, etc.
4. Connect with creator or try the tool

### Connection Flow

1. User sees an offer or ask they want to respond to
2. Click "Connect" / "Book" / "Help"
3. Write initial message
4. Recipient gets SMS notification
5. Conversation thread opens (reuses existing messaging)
6. Complete the help → both get points

---

## Notifications Strategy

### Primary Channel: SMS

Why SMS over email:
- 98% open rate vs 20% for email
- Immediate attention for connections
- Simpler to implement

### Notification Triggers

| Event | Message |
|-------|---------|
| New connection request | "@user wants to connect about your [offer]" |
| Someone responds to your ask | "Someone offered to help with: [title]" |
| Connection accepted | "@user accepted! Start chatting" |
| Help completed | "You earned +25 points!" |

### User Controls

- Phone number (optional, collected in settings)
- SMS toggle (default on if phone provided)
- Quiet hours (optional)

---

## Points System (Generosity-Based)

### Philosophy Shift

| Old (Activity) | New (Generosity) |
|----------------|------------------|
| Login streaks | Helping others |
| Completing lessons | Quality contributions |
| Posting projects | Community support |

### Point Values

| Action | Points | Category |
|--------|--------|----------|
| Respond to someone's ask | +15 | Giving |
| Complete a help session | +25 | Giving |
| Receive "helpful" rating | +20 | Giving |
| Give feedback on a project | +10 | Giving |
| Beta test someone's app | +15 | Giving |
| Someone responds to your ask | +5 | Receiving |
| Add an offer | +10 | Building |
| Complete onboarding | +25 | Community |

### Visibility

- Toast notifications for every point-earning action
- Points displayed prominently in nav
- Profile shows "Helped X people" alongside points
- Leaderboard: "Top Helpers This Week"

---

## Creator Profiles (Substack-Style)

Each creator gets a storefront at `/@username`:

### Sections

1. **Header** — Avatar, bio, follower count, follow button
2. **Apps I've Built** — Offers with type=app
3. **Learn From Me** — Courses and educational content
4. **Work With Me** — Services, consulting, mentorship
5. **Recent Updates** — Activity feed
6. **Subscribe CTA** — Creator subscription tier (future)

### Follow System

- Users can follow creators
- Follower count on profile
- Following feed (future feature)

---

## Technical Approach

### New Django App: `core/collective/`

Contains:
- Offer, Ask, Connection models
- Follow model
- API endpoints at `/api/v1/offers/`, `/api/v1/asks/`, `/api/v1/connections/`

### Frontend Structure

New pages:
- `CollectiveHomePage` — Dashboard
- `OnboardingChatPage` — Ava-based onboarding
- `DiscoverPage` — Problem-based discovery
- Profile section components for creator storefronts

Reused:
- Ava chat components
- Messaging infrastructure
- Design system (Neon Glass)

---

## Phased Rollout

### Phase 1: Foundation (Sprints 1-4)

| Sprint | Goal |
|--------|------|
| 1 | Hide legacy nav, create placeholder home page |
| 2 | Build Offer/Ask/Connection backend models |
| 3 | Build Ava chat-based onboarding |
| 4 | Build real home dashboard |

**Outcome:** Users can onboard, create offers/asks, see their dashboard

### Phase 2: Growth (Sprints 5-8)

| Sprint | Goal |
|--------|------|
| 5 | Creator profiles (Substack-style storefronts) |
| 6 | Discovery page (problem-based browsing) |
| 7 | Connections, bookings, SMS notifications |
| 8 | Points system redesign (generosity-based) |

**Outcome:** Full Ask & Offer experience with discovery and connections

### Phase 3: Cleanup (Future)

- Delete hidden legacy code
- Remove deprecated models
- Clean up migrations
- Remove PHASE_1 code markers

### Deferred: Sprint 9 (Agents for Hire)

Needs more design work before implementation:
- Hosting model (platform vs self-hosted)
- Economics (API costs, revenue share)
- Accountability chain
- Legal review

---

## Tech Debt Strategy

### Approach: Hide First, Delete Later

1. **Sprint 1:** Hide features from nav (keep routes working)
2. **Phase 2:** Verify new system is stable
3. **Phase 3:** Delete hidden code

### Code Markers

Three markers to track tech debt:
- `PHASE_1: [HIDDEN]` — Feature hidden, delete after Sprint X
- `PHASE_1: [DEPRECATED]` — Old code, use new thing instead
- `PHASE_1: [KEEP]` — Intentionally keeping, with reason

### Why This Approach

- Safer rollback if something breaks
- Can still test old flows if needed
- Cleaner git history (one delete commit later)
- Only 16 beta users, so low risk either way

---

## Open Questions

1. **Lounge/Community Chat** — Currently marked as KEEP. Does it fit the Ask/Offer model, or should it evolve?

2. **Agent Hosting** — If we let creators list AI agents, who pays for API costs?

3. **Creator Subscriptions** — Do we build Substack-style paid subscriptions, or defer?

4. **Content Gating** — Should some offers be subscriber-only?

---

## Success Metrics

### Phase 1 Success

- All 16 beta users re-onboarded
- Users have created offers and asks
- Home dashboard shows their activity

### Phase 2 Success

- Users discovering offers through problem categories
- Connections being made between users
- SMS notifications driving engagement
- Points being earned through generosity actions

### Long-Term

- Number of active offers
- Ask fulfillment rate
- Connection completion rate
- "Helped X people" growth
- Creator follower growth
