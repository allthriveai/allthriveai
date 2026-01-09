# AI Collective Platform Restructure

> **Tagline:** Share what you offer. Ask for what you need. The All Thrive AI Collective.

## Pre-Sprint 1: Documentation Setup

Copy this plan to permanent docs:
```
docs/collective-rebuild/
  full-rebuild.md        # This plan file (copy from ~/.claude/plans/)
```

---

## Information Architecture (DECIDED)

### Target Users
**Both equally** - Builders AND non-technical users. The platform needs to serve:
- AI builders who create apps, offer services, share knowledge
- Non-technical users who discover tools, find experts, learn

### Tools Directory Decision: MERGE
All apps live in one unified system:
- User-built apps are Offers with `type='app'`
- External tools can still be listed but as "community curated" offers
- No separate `/tools` directory - everything is discoverable via `/discover`
- "Built by @username" badge for user-created apps

### Navigation: Substack-Style (Ask/Offer Focused)

**Header (minimal, focused):**
```
Logo | Discover | [Search] [Ava] [User Menu]
```

Primary focus is on **Ask & Offer** actions, accessible from:
- Home dashboard quick actions
- Ava chat suggestions
- Profile pages

**Footer (comprehensive):**
```
┌─────────────────────────────────────────────────────────────┐
│  Discover         Creator Tools      Company      Resources  │
│  ─────────        ────────────       ─────────    ────────── │
│  Browse Offers    Social Clips       About        Help       │
│  Browse Asks      Learning Paths     Blog         Docs       │
│  Browse People    (future tools)     Contact      Community  │
│                                      Careers      Guidelines │
└─────────────────────────────────────────────────────────────┘
```

### Concept Mapping (Final)

| Existing | New Concept | Relationship |
|----------|-------------|--------------|
| **Tools Directory** | Offers (type=app) | **MERGED** - All apps are offers |
| **Projects** | Offers (things built) | Projects become offer showcase pages |
| **Products** (marketplace) | Offers (paid) | Products are paid offers |
| **Services** | Offers (type=service) | New category |
| **Learning Paths** | Offers (type=course) | Creator courses in Discovery |
| **Explore Feed** | `/discover` page | Problem-based discovery |

### URL Structure

| Page | URL | Description |
|------|-----|-------------|
| Home (dashboard) | `/home` | User's asks, offers, activity |
| Discovery | `/discover` | Browse all (default view) |
| Browse Offers | `/discover/offers` | All offers, filterable |
| Browse Asks | `/discover/asks` | All asks, filterable |
| Browse People | `/discover/people` | All creators |
| My Offers | `/my/offers` | User's own offers |
| My Asks | `/my/asks` | User's own asks |
| Create Offer | `/my/offers/new` | Create new offer |
| Create Ask | `/my/asks/new` | Create new ask |
| Profile | `/@username` | Creator storefront |

**Note:** `/my/*` for user's own stuff, `/discover/*` for browsing others.

### Feed Strategy

The `/discover` page uses **problem-based discovery** for non-technical users:

1. **Category selection** - "What do you need help with?"
   - Marketing & Content
   - Sales & Outreach
   - Customer Support
   - Operations & Productivity
   - Creative & Design
   - Development & Technical

2. **Results show unified view:**
   - Apps/Tools that solve this problem
   - Experts offering services
   - Courses to learn yourself
   - Open asks from others (community needs)

3. **Personalized section** - "For you" based on your asks/offers

### Quick Actions

Users can quickly post asks/offers from:
- **Home dashboard** - "Add Offer" / "Add Ask" buttons
- **Ava chat** - "I can help you create an ask..."
- **Profile** - "Add to your offerings"
- **Discover** - "Can't find what you need? Post an ask"

---

## Approach: Incremental Rollout

Go slow. Don't one-shot. Each sprint is independently shippable.

---

## PHASE 1: Foundation (Sprints 1-4)

---

## Sprint 1: Hide Legacy + Minimal Shell

**Goal:** Strip down nav, create placeholder pages, redirect to new home

### 1.1 Hide Legacy Navigation
Modify `menuData.ts` to remove:
- Discover (Learn, Play, Tools, Lounge)
- Keep routes working for direct URLs, just hide from nav

**New Nav (Sprint 1 - minimal):**
```
Logo | [Search] [Ava] [User Menu]
```

User menu keeps: Profile, Settings, Sign Out

**Nav evolves:**
- Sprint 1-5: Minimal nav (no Discover link yet)
- Sprint 6: Add "Discover" to nav when Discovery page is built

### 1.2 New Home Page (Placeholder)
Create `CollectiveHomePage.tsx` at `/home`:
- Simple welcome message with tagline
- "Coming soon" messaging
- Ava chat sidebar (reuse existing `EmbeddedChatLayout` pattern)
- Link to complete onboarding if not done

```
┌────────────────────────────────┬──────────────────┐
│  Welcome to the AI Collective  │  AVA CHAT        │
│                                │  (collapsible)   │
│  "Share what you offer.        │                  │
│   Ask for what you need."      │  [Ava avatar]    │
│                                │                  │
│  [Complete Your Profile]       │  "Hi! I can help │
│                                │   you get set up"│
│  Your profile is X% complete   │                  │
│                                │  [input...]      │
└────────────────────────────────┴──────────────────┘
```

### 1.3 Route Changes
- `/home` → new home page (CollectiveHomePage)
- Keep all legacy routes working (just not in nav)
- `/onboarding` → still existing for now

**Note:** All new pages are top-level routes, NOT under `/collective/*`

### Files to Modify (Sprint 1)
```
frontend/src/components/navigation/menuData.ts    # Hide legacy sections
frontend/src/pages/CollectiveHomePage.tsx         # NEW - placeholder home
frontend/src/routes/index.tsx                     # Add new home route
```

---

## Sprint 2: Backend Models

**Goal:** Create data layer for Offers/Asks (no UI yet)

### 2.1 New Django App: `core/collective/`

> Note: App name is for code organization. API routes are `/api/v1/offers/`, `/api/v1/asks/`, `/api/v1/connections/` (no "collective" in URLs).

### 2.0 Data Model Decisions

**Offer replaces Project entirely:**
- New `Offer` model is the single source of truth for things users create/provide
- Existing `Project` model will be deprecated (PHASE_1 marker, remove in Phase 3)
- No migration of old projects - 16 users can re-enter during re-onboarding
- Offers include apps, courses, services, skills - all in one model with `offer_type`

**Category system:**
- Offers use existing `Taxonomy` model with new `taxonomy_type='offer_category'`
- Categories align with Discovery page: Marketing, Sales, Support, Operations, Creative, Development
- Seed categories in Sprint 2

**Offer Model:**
```python
class OfferType(models.TextChoices):
    APP = 'app', 'App/Tool'
    COURSE = 'course', 'Course/Workshop'
    SERVICE = 'service', 'Service'
    SKILL = 'skill', 'Skill/Expertise'
    FEEDBACK = 'feedback', 'Feedback Capacity'
    TEMPLATE = 'template', 'Template/Resource'

class PricingType(models.TextChoices):
    FREE = 'free', 'Free'
    ONE_TIME = 'one_time', 'One-time Payment'
    HOURLY = 'hourly', 'Hourly Rate'
    CUSTOM = 'custom', 'Custom/Contact'

class Offer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='collective_offers'
    )

    # Content
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    description = models.TextField()
    offer_type = models.CharField(max_length=20, choices=OfferType.choices)
    featured_image_url = models.URLField(blank=True)

    # Categorization (for Discovery)
    category = models.ForeignKey(
        'taxonomies.Taxonomy',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'taxonomy_type': 'offer_category'}
    )

    # Commerce (links to existing CreatorAccount for Stripe)
    is_paid = models.BooleanField(default=False)
    price_cents = models.IntegerField(default=0)
    currency = models.CharField(max_length=3, default='usd')
    pricing_type = models.CharField(max_length=20, choices=PricingType.choices, default='free')
    stripe_product_id = models.CharField(max_length=255, blank=True)
    stripe_price_id = models.CharField(max_length=255, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)

    # Metrics
    view_count = models.PositiveIntegerField(default=0)
    connection_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'slug'], name='unique_offer_per_user')
        ]
```

**Ask Model:**
```python
class AskType(models.TextChoices):
    BETA_TESTER = 'beta_tester', 'Beta Testers'
    FEEDBACK = 'feedback', 'Feedback/Review'
    COLLABORATOR = 'collaborator', 'Collaborator'
    LEARNING = 'learning', 'Learning Goal'
    HIRE = 'hire', 'Hiring/Contractor'
    ADVICE = 'advice', 'Advice/Guidance'

class AskStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    IN_PROGRESS = 'in_progress', 'In Progress'
    FULFILLED = 'fulfilled', 'Fulfilled'
    CLOSED = 'closed', 'Closed'

class Ask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='collective_asks'
    )

    # Content
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220)
    description = models.TextField()
    ask_type = models.CharField(max_length=20, choices=AskType.choices)
    featured_image_url = models.URLField(blank=True)

    # Budget (for paid opportunities)
    is_paid_opportunity = models.BooleanField(default=False)
    budget_min_cents = models.PositiveIntegerField(null=True, blank=True)
    budget_max_cents = models.PositiveIntegerField(null=True, blank=True)

    # Status
    status = models.CharField(max_length=20, choices=AskStatus.choices, default='open')
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'slug'], name='unique_ask_per_user')
        ]
```

**Connection Model:**
```python
class ConnectionStatus(models.TextChoices):
    INITIATED = 'initiated', 'Initiated'
    DISCUSSING = 'discussing', 'Discussing'
    ACCEPTED = 'accepted', 'Accepted'
    COMPLETED = 'completed', 'Completed'
    DECLINED = 'declined', 'Declined'

class Connection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='initiated_connections'
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_connections'
    )

    # What's being connected
    ask = models.ForeignKey(Ask, on_delete=models.SET_NULL, null=True, blank=True)
    offer = models.ForeignKey(Offer, on_delete=models.SET_NULL, null=True, blank=True)

    status = models.CharField(max_length=20, choices=ConnectionStatus.choices, default='initiated')
    initial_message = models.TextField()

    # Commerce (for paid offers)
    agreed_price_cents = models.PositiveIntegerField(null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
```

### 2.2 Basic API Endpoints
```
/api/v1/offers/              GET (list), POST (create)
/api/v1/offers/<uuid:id>/    GET, PATCH, DELETE
/api/v1/asks/                GET (list), POST (create)
/api/v1/asks/<uuid:id>/      GET, PATCH, DELETE
/api/v1/connections/         GET (list), POST (create)
/api/v1/connections/<uuid:id>/  GET, PATCH
```

### 2.3 Permissions
- `IsOwnerOrReadOnly` - only owner can edit, anyone can view active
- Filter inactive from public lists

### Files to Create (Sprint 2)
```
core/collective/__init__.py
core/collective/apps.py
core/collective/models.py
core/collective/serializers.py
core/collective/views.py
core/collective/urls.py
core/collective/permissions.py
core/collective/admin.py
core/urls.py                      # Add collective app
config/settings.py                # Add to INSTALLED_APPS
```

---

## Sprint 3: Onboarding Flow (Chat-Based with Ava)

**Goal:** Conversational onboarding that teaches values while collecting offers/asks

### 3.1 Design Philosophy

**Quick & Ask-First:**
- Start with ASKS (what do you need?) - simpler, gets people engaged fast
- Offers come later and can be more detailed
- Keep onboarding under 2 minutes

**Rich UI Inline:**
- Checkboxes, selection grids, and buttons appear as part of Ava's chat messages
- Not separate wizard pages - everything flows in conversation
- Makes selection easy while keeping conversational feel

### 3.2 Chat Flow Structure

```
/onboarding → Full-screen chat with Ava
```

**Part 1: Welcome**
```
Ava: "Welcome to All Thrive — The Ask & Offer AI Collective.

We believe everyone has something to offer and the ability to ask for what they need.

Our values are Generosity, Curiosity, and Respect.

We ask that you come with an open mind, share what you're working on, and ask and offer freely.

We're glad you're here. Let's get started."

[Continue →]
```

**Part 2: Curiosity (ASKS FIRST - quick)**
```
Ava: "Let's start with Curiosity.

What do you need right now? What are you trying to learn or figure out?

Select any that apply, or type your own:"

┌─────────────────────────────────────────────────────────┐
│  [ ] Feedback on something I'm building                 │
│  [ ] Beta testers for my project                        │
│  [ ] A collaborator or co-founder                       │
│  [ ] Learning a new skill (AI, coding, marketing)       │
│  [ ] Advice or mentorship                               │
│  [ ] Tool recommendations                               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Type your own ask...                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Your asks: [chip] [chip] [chip]    [Continue →]        │
└─────────────────────────────────────────────────────────┘
```
→ User can click checkboxes OR type custom asks
→ Each selection/entry appears as a chip below
→ Quick - no detailed follow-up, just collect and move on

**Part 3: Generosity (OFFERS - builds profile)**
```
Ava: "Now let's talk about Generosity — giving for the joy of giving.

What it IS:
• Unconditional — no expectation of anything back
• Consent-based — you choose what and when to give

What it is NOT:
• Bartering or trading
• Obligation — your presence is enough

What do YOU have to offer?"

┌─────────────────────────────────────────────────────────┐
│  THINGS YOU'VE BUILT (creates project pages)            │
│  [ ] An app or tool                                     │
│  [ ] A course or tutorial                               │
│  [ ] Templates or resources                             │
│                                                         │
│  SERVICES                                               │
│  [ ] Consulting or coaching                             │
│  [ ] Mentorship                                         │
│                                                         │
│  SKILLS (quick to give)                                 │
│  [ ] Website/landing page feedback                      │
│  [ ] Code review                                        │
│  [ ] Design feedback                                    │
│  [ ] Marketing/growth advice                            │
│  [ ] Writing/editing help                               │
│  [ ] Beta test others' projects                         │
│  [ ] Accountability partner                             │
│  [ ] Introductions/connections                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Type your own offer...                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Your offers: [chip] [chip]           [Continue →]      │
└─────────────────────────────────────────────────────────┘
```

**Offer Follow-ups (inline in chat):**

If user selects "An app or tool" / "Course" / "Templates":
```
Ava: "Nice! Paste a link and I'll create a page for you:"

┌─────────────────────────────────────────────────────────┐
│  🔗 https://myapp.com                                   │
│                                    [Import →]           │
└─────────────────────────────────────────────────────────┘

→ Uses existing URL scraper (services/url_import/scraper.py)
→ AI generates offer details (services/url_import/ai_analyzer.py)
→ Creates Offer with type: 'app' / 'course' / 'template'
→ Offer appears on profile automatically
```

If user selects "Consulting or coaching" / "Mentorship":
```
Ava: "What do you help people with? (e.g., 'AI strategy for startups')"

┌─────────────────────────────────────────────────────────┐
│  I help with...                                         │
└─────────────────────────────────────────────────────────┘

→ Creates Offer with type='service'
→ Can add pricing later
```

Skills (feedback, code review, etc.) → Quick, no follow-up needed
→ Creates Offer records with type='skill' or 'feedback'
→ Displayed on profile in "Quick Help" section

**Part 4: Respect & Agreement**
```
Ava: "Finally, Respect.

Our community guidelines:
• Be kind and constructive in feedback
• Honor people's time — show up when you commit
• Keep conversations confidential unless agreed otherwise
• Give credit where it's due
• No spam, no pitching without permission
• Assume good intent

These guidelines help us maintain a generous, curious, and respectful space."

[I agree to these guidelines ✓]
```

**Part 5: Complete**
```
Ava: "You're all set! Welcome to the collective.

Your profile now shows:
• [X] Offers you listed
• [X] Asks you shared

You can always update these from your profile.

Ready to explore?"

[Enter the Collective →]
```

### 3.3 Technical Implementation

**Chat UI:**
- Full-screen chat interface (reuse existing Ava chat components)
- Ava's messages appear as chat bubbles
- User responses can be:
  - Free text input
  - Clickable suggestion chips (for offers/asks ideas)
  - Action buttons ([Continue], [I understand], [I agree])
- Progress indicator subtle at top (not wizard steps)

**Suggestion Chips (shown during Offers/Asks steps):**
```typescript
const OFFER_SUGGESTIONS = [
  'Product/App I built',
  'Consulting/Coaching',
  'Website feedback',
  'Code review',
  'Design feedback',
  'Marketing help',
  'Beta testing',
  'Accountability partner',
  'Introductions',
];

const ASK_SUGGESTIONS = [
  'Beta testers',
  'Landing page feedback',
  'Code review',
  'Co-founder/Partner',
  'Learn AI/ML',
  'Learn to code',
  'Marketing advice',
  'Mentorship',
  'Tool recommendations',
];
```

**Data Collection:**
- When user clicks chip OR types custom response, Ava acknowledges and may ask follow-up
- Example: User clicks "Product/App I built"
  - Ava: "Nice! What's it called and what does it do?"
- All collected offers/asks saved to backend at end

**State Management:**
```typescript
interface OnboardingState {
  currentStep: 'welcome' | 'generosity' | 'offers' | 'curiosity' | 'asks' | 'respect' | 'complete';
  offers: Array<{ type: string; title: string; description: string }>;
  asks: Array<{ type: string; title: string; description: string }>;
  agreedToGuidelines: boolean;
}
```

### 3.4 Ava's Role: Conversational Guide

Ava is NOT a form wizard. She:
- Teaches the community values through conversation
- Suggests ideas but accepts anything the user types
- Asks clarifying follow-ups naturally
- Celebrates what users share
- Makes the onboarding feel like joining a community, not filling out forms

### 3.5 Files to Create (Sprint 3)
```
frontend/src/pages/OnboardingChatPage.tsx       # Full-screen chat onboarding
frontend/src/components/onboarding/
  OnboardingChat.tsx                            # Chat container
  OnboardingMessage.tsx                         # Ava's messages with formatting
  SuggestionChips.tsx                           # Clickable offer/ask suggestions
  ActionButton.tsx                              # [Continue], [I agree] buttons
  ProgressIndicator.tsx                         # Subtle progress at top
frontend/src/hooks/useOnboardingChat.ts         # State management
frontend/src/data/onboardingContent.ts          # All Ava's messages, suggestions
backend: Add onboarding completion endpoint
```

---

## Sprint 4: Home Dashboard

**Goal:** Real dashboard replacing placeholder

### 4.1 Layout
```
┌────────────────────────────────┬──────────────────┐
│  MY OFFERS          MY ASKS    │  AVA CHAT        │
│  ┌──────────┐   ┌──────────┐   │  (collapsible)   │
│  │ 3 active │   │ 2 open   │   │                  │
│  │ [Add +]  │   │ [Add +]  │   │                  │
│  └──────────┘   └──────────┘   │                  │
│                                │                  │
│  RECENT ACTIVITY               │                  │
│  • New view on your offer      │                  │
│  • Connection request          │                  │
│                                │                  │
│  [Empty state if new user]     │                  │
└────────────────────────────────┴──────────────────┘
```

### 4.2 Mobile Layout
- Stack cards vertically
- Ava chat as floating button (opens drawer)

### Files to Create (Sprint 4)
```
frontend/src/pages/CollectiveDashboardPage.tsx   # Replace placeholder
frontend/src/components/collective/dashboard/
  OffersSummaryCard.tsx
  AsksSummaryCard.tsx
  ActivityFeed.tsx
  AvaSidebar.tsx
```

---

## PHASE 2: Growth Features (Sprints 5-8)

---

## Sprint 5: Creator Profile (Like Substack Publication)

**Goal:** Transform profiles into creator storefronts

### 5.1 Profile Layout
```
┌─────────────────────────────────────────────────────────────┐
│  @sarah                                    [Follow] [Share] │
│  "Building AI tools that make work easier"                  │
│  3 apps │ 2 courses │ 4,200 followers                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 APPS I'VE BUILT                                         │
│  • MeetingBot - AI meeting summaries [Try It]               │
│  • EmailHelper - Smart email replies [Try It]               │
│  • TaskAI - AI task prioritization [Coming Soon]            │
│                                                             │
│  📚 LEARN FROM ME                                           │
│  • "Build Your First AI Tool" - $49 [Enroll]                │
│  • "Prompt Engineering for Productivity" - $29 [Enroll]     │
│                                                             │
│  🤝 WORK WITH ME                                            │
│  • 1:1 Consulting - $200/hr [Book]                          │
│  • Mentorship - $150/mo [Apply]                             │
│  • Office Hours - Free for subscribers [Join]               │
│                                                             │
│  📝 RECENT UPDATES                                          │
│  • "How MeetingBot hit 1000 users" - Jan 5                  │
│  • "The one prompt that changed everything" - Dec 28        │
│                                                             │
│  💎 SUBSCRIBE ($10/mo)                                      │
│  Early access to new tools, behind-the-scenes, office hours │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 New Profile Section Types
Add to existing `profile_sections` JSONField:

| Section Type | Content | Source |
|--------------|---------|--------|
| `apps` | Projects with type='product'/'app' | Projects model |
| `courses` | Products with type='course' | Existing Product model |
| `services` | Consulting, mentorship offers | New Offer model |
| `updates` | Recent activity/posts | New or existing |
| `subscribe_cta` | Creator subscription tier | New CreatorSubscriptionTier |

### 5.3 Follow System
- `Follow` model (follower → following relationship)
- Follow button on profiles
- Follower count display
- Following feed (later)

### 5.4 Files to Create/Modify
```
core/collective/models.py              # Add Follow model
frontend/src/components/profile/sections/
  AppsSection.tsx                      # Apps I've built
  CoursesSection.tsx                   # Learn from me
  ServicesSection.tsx                  # Work with me
  UpdatesSection.tsx                   # Recent updates
  SubscribeCTASection.tsx              # Subscribe callout
frontend/src/types/profileSections.ts  # Add new section types
```

---

## Sprint 6: Discovery Experience (Non-Technical Friendly)

**Goal:** Help non-technical users find solutions by problem, not by browsing

### 6.1 Discovery Page (`/discover`)
```
┌─────────────────────────────────────────────────────────────┐
│  Find Your AI Solution                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  What do you need help with?                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Marketing│ │ Sales   │ │Customer │ │Operations│          │
│  │& Content│ │         │ │ Support │ │         │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  🔥 POPULAR FOR MARKETING                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Tool: ContentAI                                      │   │
│  │ "Writes marketing copy in your brand voice"          │   │
│  │ ★★★★☆ 4.2 │ Best for: Blog posts, ads, social      │   │
│  │ [Try It] [See Guide by @marketer]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  👤 EXPERTS WHO CAN HELP                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @aiconsultant - "AI for Small Business"             │   │
│  │ 500+ helped │ From $150/hr                          │   │
│  │ [View Profile] [Book Session]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📚 COURSES TO GET STARTED                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "AI Marketing for Non-Techies" by @contentqueen     │   │
│  │ 2 hours │ $49 │ 4.9★ (230 reviews)                  │   │
│  │ [Preview] [Enroll]                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Discovery by Problem Category
Categories (user-friendly, not technical):
- Marketing & Content
- Sales & Outreach
- Customer Support
- Operations & Productivity
- Learning & Education
- Creative & Design
- Development & Technical

Each category shows:
1. **Tools/Apps** - Products that solve this problem
2. **Experts** - People offering services in this area
3. **Courses** - Learning resources for this category

### 6.3 Search & Filter
- Natural language search: "I need help writing blog posts"
- Filter by: Price (free/paid), Rating, Category
- Ava-assisted: "Tell me what you're trying to do and I'll find solutions"

### 6.4 Files to Create
```
frontend/src/pages/DiscoverPage.tsx
frontend/src/components/discover/
  CategorySelector.tsx               # Problem category chips
  ToolCard.tsx                       # App/tool result card
  ExpertCard.tsx                     # Service provider card
  CourseCard.tsx                     # Learning resource card
  DiscoverySearch.tsx                # Natural language search
backend: API endpoints for discovery queries
```

---

## Sprint 7: Connections, Bookings & SMS Notifications

**Goal:** Enable users to connect on offers/asks with SMS notifications

### 7.1 Connection Flow
- "Connect" / "Book" / "Enroll" buttons on offers
- Initial message form (inline or modal)
- **SMS notification to recipient** (primary channel)
- Conversation thread using existing messaging system (reuse Lounge infrastructure)
- Each Connection gets a private DM thread between initiator and responder

### 7.2 SMS Notifications

**Why SMS over email:**
- Higher open rates (~98% vs ~20% for email)
- Immediate attention for time-sensitive connections
- Simpler to implement than email templates

**Notification triggers:**
| Event | SMS Message |
|-------|-------------|
| New connection request | "@username wants to connect about your [offer]. Reply in app: [link]" |
| Ask response | "Someone offered to help with your ask: [title]. See it: [link]" |
| Connection accepted | "@username accepted! Start chatting: [link]" |
| Help completed | "@username marked your help as complete. You earned +25 points!" |

**Implementation:**
```python
# core/notifications/sms.py
# Use Twilio or similar
def send_sms(user, message_type, context):
    if not user.phone_number or not user.sms_notifications_enabled:
        return
    # Rate limit: max 5 SMS per day per user
    # Template-based messages
```

**User settings:**
- Phone number (optional, collected in onboarding or settings)
- SMS notifications toggle (default: on if phone provided)
- Quiet hours setting (optional)

### 7.3 Integration with Existing Systems
- Products/Courses → Existing checkout flow
- Services → New booking flow (or Calendly integration)
- Skills (feedback, etc.) → Simple connection request

### 7.4 Files to Create
```
core/notifications/__init__.py
core/notifications/sms.py              # Twilio integration
core/notifications/templates.py        # SMS message templates
core/users/models.py                   # Add phone_number, sms_enabled fields
frontend/src/pages/settings/NotificationSettingsPage.tsx
```

---

## Sprint 8: Points System Redesign (Generosity-Based)

**Goal:** Reward helping others, make points visible and celebratory

### 8.1 New Points Philosophy
Points should reward **generosity** and **contribution**, not just activity.

**Old model (activity-based):**
- Login streak, completing lessons, posting projects

**New model (generosity-based):**
- Helping others with their asks
- Getting positive feedback on your offers
- Contributing to the community

### 8.2 Points Actions (Rebalanced)

| Action | Points | Why |
|--------|--------|-----|
| **GIVING** | | |
| Respond to someone's ask | +15 | Core generosity action |
| Complete a help session | +25 | Followed through |
| Receive "helpful" rating | +20 | Quality contribution |
| Give feedback on a project | +10 | Community support |
| Beta test someone's app | +15 | Helping builders |
| **RECEIVING** | | |
| Someone responds to your ask | +5 | Engagement (smaller reward) |
| Mark help as "received" | +5 | Closing the loop |
| **BUILDING** | | |
| Add an offer | +10 | Contributing to ecosystem |
| First project page created | +20 | One-time bonus |
| **COMMUNITY** | | |
| Welcome a new member | +5 | Hospitality |
| Get followed | +2 | Building reputation |
| Complete onboarding | +25 | Getting started |

### 8.3 Toast Notifications (Celebratory)
Make points visible and fun with toasts:

```
┌─────────────────────────────────────────┐
│  🎉 +15 points!                         │
│  You helped @sarah with her ask         │
│  ───────────────────────────────────    │
│  Total: 340 points                      │
└─────────────────────────────────────────┘
```

**Toast triggers:**
- Every points-earning action shows a toast
- Milestone toasts: "You've helped 10 people! 🌟"
- Streak toasts: "3 days of giving! 🔥"

### 8.4 Points Display
- Show points prominently in header/nav
- Profile shows "helped X people" not just points
- Leaderboard: "Top Helpers This Week"

### 8.5 Implementation

**Backend changes:**
```python
# Update existing add_points() in core/users/models.py
# Add new activity_types:
GENEROSITY_ACTIONS = [
    'respond_to_ask',      # +15
    'complete_help',       # +25
    'helpful_rating',      # +20
    'give_feedback',       # +10
    'beta_test',           # +15
    'add_offer',           # +10
    'welcome_member',      # +5
]
```

**Frontend changes:**
```
frontend/src/components/common/PointsToast.tsx    # Celebratory toast
frontend/src/hooks/usePointsToast.ts             # Show toast on point events
frontend/src/components/nav/PointsDisplay.tsx    # Header points counter
```

### 8.6 "Helped" Counter
New metric alongside points:
- "Helped 23 people" on profile
- More meaningful than raw points
- Tracks completed help sessions

---

## Sprint 9: Agents for Hire (NEEDS MORE DESIGN)

**Goal:** Let creators list AI agents they've built as hirable offerings

**Status:** ⚠️ This sprint needs more design work before implementation

### 9.1 Key Requirements
- Agents are User accounts with `role='agent'`
- **No onboarding** for agents (skip onboarding flow)
- **Owner accountability** - every agent MUST be linked to a human user
- **Stripe linked to owner** - payments go through owner's Stripe Connect
- All actions traceable back to owning user

### 9.2 Open Questions to Resolve

**Hosting Model:**
| Option | Pros | Cons |
|--------|------|------|
| **All Thrive Hosted** | Simple for creators, we manage AI tokens | We eat API costs, scaling concerns |
| **Self-Hosted** | Creator pays their own API costs | Complex setup, harder onboarding |
| **Hybrid** | Platform agents hosted, custom agents BYOK | Two systems to maintain |

**Pricing/Economics:**
- If we host: How do we cover API costs? Per-message fee? Subscription tier?
- If self-hosted: How do creators connect their own API keys?
- Revenue share on agent usage?

**Accountability Chain:**
```
Agent (@contentbot)
  ↓ owned by
Human User (@allie)
  ↓ linked to
Stripe Connect Account
  ↓ responsible for
All agent actions, payments, refunds, disputes
```

**Agent Capabilities:**
- Can agents have their own offers? (Agent offers writing services)
- Can agents respond to asks? (Agent helps with user's ask)
- Should agent conversations be visible to owner?

### 9.3 Minimum Viable Agent Model
```python
class Agent(models.Model):
    """
    Agent metadata - the actual User account has role='agent'
    This model adds agent-specific fields and ownership
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_profile')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_agents')

    # Listing
    tagline = models.CharField(max_length=200)
    description = models.TextField()
    capabilities = models.JSONField(default=list)  # ['writing', 'research', 'coding']

    # Hosting
    hosting_type = models.CharField(choices=[
        ('platform', 'All Thrive Hosted'),
        ('self', 'Self-Hosted (BYOK)'),
    ])
    api_key_encrypted = models.TextField(blank=True)  # For self-hosted

    # Pricing (payments go to owner's Stripe)
    is_free = models.BooleanField(default=True)
    price_per_message_cents = models.IntegerField(default=0)
    price_per_conversation_cents = models.IntegerField(default=0)

    # Status
    is_listed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
```

### 9.4 Profile Section (When Ready)
New profile section type: `my_agents`
- Shows agents owned by this creator
- Links to agent profile pages
- Shows pricing, try it button

### 9.5 Blocked By
- Decision on hosting model
- Decision on economics/pricing
- Stripe Connect flow for agent payments
- API key management (if self-hosted)

### 9.6 Next Steps
1. [ ] Design session on hosting model
2. [ ] Economics modeling (API costs vs revenue)
3. [ ] Security review for API key storage
4. [ ] Legal review (accountability, ToS for agents)

---

## Tech Debt Tracker

### Philosophy
**Hide first, delete later.** Even with 16 beta users, we take the safer approach - hide features from nav/UI first, verify the new system works, then delete in a later phase.

### Sprint 1: Hide These (Keep Routes Working)

| Feature | Action | Hide in Sprint | Delete After |
|---------|--------|----------------|--------------|
| Old nav sections | Hide from `menuData.ts` | Sprint 1 | Phase 3 |
| `/learn/*` routes | Keep routes, hide nav | Sprint 1 | Sprint 6 |
| `/play/*` routes | Keep routes, hide nav | Sprint 1 | Phase 3 |
| `/tools/*` routes | Keep routes, hide nav | Sprint 1 | Sprint 6 |
| `/lounge/*` routes | **KEEP VISIBLE** | - | - |
| Old home page | Hide, keep file | Sprint 1 | Sprint 4 |
| Old onboarding | Hide, keep file | Sprint 3 | Sprint 4 |

**Why hide instead of delete:**
- Safer rollback if something breaks
- Can still test old flows if needed
- Cleaner git history (one delete commit later vs scattered)

### Code Markers

```typescript
// PHASE_1: [HIDDEN] Feature hidden for AI Collective pivot
// Delete after Sprint X when [new feature] is stable

// PHASE_1: [DEPRECATED] Old implementation, use [new thing] instead
// Delete after Sprint X

// PHASE_1: [KEEP] Intentionally keeping
// Reason: [why]
```

### Models to Deprecate (Delete in Phase 3)

| Model | Status | Replacement | Delete After |
|-------|--------|-------------|--------------|
| `Project` | PHASE_1: [DEPRECATED] | `Offer` | Phase 3 |
| `LearningPath` | PHASE_1: [DEPRECATED] | `Offer` (type=course) | Phase 3 |
| `Quest` / `SideQuest` | PHASE_1: [DEPRECATED] | New points system | Phase 3 |
| `Tool` (external tools) | PHASE_1: [DEPRECATED] | `Offer` (curated) | Phase 3 |

### What We Keep

| Feature | Why Keep |
|---------|----------|
| User model | Core identity, points, etc. |
| Stripe Connect | Payment infrastructure |
| Ava chat | Core feature, reuse components |
| URL scraper | Reuse for Offer import |
| Taxonomy | Reuse for categories |
| Community chat/messaging | Essential for Ask/Offer connections |

### Phase Definitions

- **Phase 1** (Sprints 1-4): Hide legacy UI, build new foundation
- **Phase 2** (Sprints 5-8): Full feature set, verify stability
- **Phase 3** (Future): Delete hidden code, remove deprecated models, clean migrations

### Phase 3 Cleanup Checklist (Future)

When ready to delete:
- [ ] Verify no users accessing hidden routes (check analytics)
- [ ] Remove hidden nav sections from `menuData.ts`
- [ ] Delete hidden page components
- [ ] Remove deprecated model files
- [ ] Squash migrations for deleted models
- [ ] Remove PHASE_1 code markers

---

## Critical Files Reference

### Backend (existing patterns to follow)
- `core/users/models.py` - User model, profile_sections JSONField
- `core/marketplace/models.py` - CreatorAccount for Stripe Connect
- `core/marketplace/serializers.py` - Read/write serializer patterns
- `core/permissions.py` - Permission class patterns

### Frontend (existing patterns to follow)
- `frontend/src/components/chat/` - Ava chat integration
- `frontend/src/pages/AvaHomePage.tsx` - Current home layout
- `frontend/src/components/navigation/menuData.ts` - Navigation structure
- `frontend/src/pages/NeonGlassStyleguide.tsx` - Design system
