# AI Collective Architecture Overview

> **Vision:** Transform All Thrive from a learning platform into "The Ask & Offer AI Collective" — a place where AI builders share what they offer, ask for what they need, and connect with each other.

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
| Tools Directory | Offers (type=app) | All apps in one place, whether built by users or curated |
| Projects | Offers | Projects become offer showcase pages |
| Products (marketplace) | Offers (paid) | Products are just paid offers |
| Learning Paths | Offers (type=course) | Courses are offers from creators |
| Services | Offers (type=service) | New category for consulting, mentorship |

### What Gets Kept

| Feature | Why Keep |
|---------|----------|
| User accounts & auth | Core identity |
| Stripe Connect | Payment infrastructure for creators |
| Ava chat | Core AI assistant, reuse components |
| URL scraper | Import apps/projects during onboarding |
| Taxonomy system | Reuse for offer categories |
| Community messaging | Essential for Ask/Offer connections |

### What Gets Hidden (Then Deleted)

| Feature | Status |
|---------|--------|
| Learn pages | Hide in Phase 1, delete after Discovery is built |
| Play pages (Games, Battles) | Hide in Phase 1, evaluate later |
| Tools directory | Hide in Phase 1, merged into Offers |
| Old home page | Replace with new Collective home |
| Old onboarding | Replace with Ava chat-based onboarding |

---

## URL Structure

Clear separation between browsing others and managing your own:

| Purpose | URL Pattern | Examples |
|---------|-------------|----------|
| **Browse others** | `/discover/*` | `/discover`, `/discover/offers`, `/discover/asks`, `/discover/people` |
| **Manage yours** | `/my/*` | `/my/offers`, `/my/asks`, `/my/offers/new` |
| **Profiles** | `/@username` | `/@sarah`, `/@aiconsultant` |
| **Dashboard** | `/home` | User's personal dashboard |

---

## Navigation Evolution

### Phase 1 (Sprints 1-5): Minimal
```
Logo | [Search] [Ava] [User Menu]
```
- Strip down to essentials
- Focus on onboarding and home dashboard
- No Discover link yet (page doesn't exist)

### Phase 2 (Sprint 6+): Full
```
Logo | Discover | [Search] [Ava] [User Menu]
```
- Add Discover when the page is built
- Footer expands with: Discover, Creator Tools, Company, Resources

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
