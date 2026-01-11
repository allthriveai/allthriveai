# AI Collective Data Model

> **Last Updated:** January 2025
>
> This document defines the core entities for the Ask & Offer AI Collective platform.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary Keys | **Integer (auto-increment)** | Consistent with User, Project, Product models |
| Offer vs Product | **New Offer model** | Clean slate. Product model deprecated in Phase 3 |
| Ask Categories | **Yes, same as Offers** | Unified discovery experience |
| Slug scope | **Unique per user** | Like Projects: `/@username/offer-slug` |

---

## Deprecation Plan

| Model | Status | Replacement | Delete In |
|-------|--------|-------------|-----------|
| `Project` | DEPRECATED | `Offer` | Phase 3 |
| `Product` | DEPRECATED | `Offer` (with `is_paid=True`) | Phase 3 |

## Models NOT Deprecated (Keep & Integrate)

| Model | Status | Integration |
|-------|--------|-------------|
| `Tool` | **KEEP** | Curated resource directory. M2M link to Offers/Asks. |
| `SavedLearningPath` | **KEEP** | Course Publisher foundation. Published paths become Offers. |
| `LearnerProfile` | **KEEP** | Student progress tracking for enrolled courses. |
| `LessonProgress` | **KEEP** | Per-lesson completion tracking. |

---

## MODEL 1: Offer

> **What users PROVIDE** - apps, courses, services, skills, feedback capacity

### Offer Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `user` | FK(User) | yes | - | Creator of the offer |
| `slug` | SlugField(220) | yes | auto | URL-safe identifier, unique per user |
| `title` | CharField(200) | yes | - | Display name |
| `description` | TextField | yes | - | Full description (markdown supported) |
| `offer_type` | CharField(20) | yes | - | See OfferType choices below |
| `featured_image_url` | URLField | no | '' | Hero image |
| `banner_url` | URLField | no | '' | Banner image (for profile pages) |
| `external_url` | URLField | no | '' | Link to app/course/etc (for type=app, link) |
| **Content** |
| `body` | TextField | no | '' | Post content (markdown), for type=post |
| `body_html` | TextField | no | '' | Rendered HTML (cached) |
| `content` | JSONField | no | {} | Structured page layout blocks (from Project model) |
| **Source Tracking** |
| `source_type` | CharField(20) | no | '' | Where imported from: github, gitlab, figma, url, manual |
| `source_url` | URLField | no | '' | Original source URL (for imports) |
| `source_metadata` | JSONField | no | {} | Additional source data (repo stars, etc.) |
| **Categorization** |
| `category` | FK(Taxonomy) | no | null | Primary category for Discovery |
| `tags` | M2M(Taxonomy) | no | [] | Additional tags (type=skill, topic) |
| **Tools Integration** |
| `tools` | M2M(Tool) | no | [] | Tools used to build this (shows "Built with Claude" badge) |
| **Pricing** |
| `is_paid` | BooleanField | yes | False | Is this a paid offering? |
| `price_cents` | PositiveIntegerField | no | 0 | Price in cents (e.g., 4900 = $49) |
| `currency` | CharField(3) | yes | 'usd' | ISO currency code |
| `pricing_type` | CharField(20) | yes | 'free' | See PricingType choices |
| `stripe_product_id` | CharField(255) | no | '' | Stripe product for paid offers |
| `stripe_price_id` | CharField(255) | no | '' | Stripe price for paid offers |
| **Status** |
| `status` | CharField(20) | yes | 'draft' | See OfferStatus choices |
| `is_featured` | BooleanField | yes | False | Admin-promoted |
| `is_archived` | BooleanField | yes | False | Soft delete |
| **Metrics** |
| `view_count` | PositiveIntegerField | yes | 0 | Total views |
| `connection_count` | PositiveIntegerField | yes | 0 | Total connections made |
| **Timestamps** |
| `created_at` | DateTimeField | auto | now | Creation time |
| `updated_at` | DateTimeField | auto | now | Last update |
| `published_at` | DateTimeField | no | null | When made public |

### OfferType Choices

| Value | Label | Description | Example |
|-------|-------|-------------|---------|
| **Things Built** |
| `app` | App/Tool | Software, website, bot, agent, MCP, game | "MeetingBot - AI meeting summaries" |
| `template` | Template | Downloadable resource | "AI Prompt Pack - $19" |
| **Knowledge Sharing** |
| `course` | Course | Educational content | "Build Your First AI Tool - $49" |
| `post` | Post | Blog post, article, essay | "How I built my first AI agent" |
| `link` | Link | Shared resource/find (Things I Love) | "This Claude prompt guide is amazing" |
| **Services** |
| `service` | Service | Consulting, coaching | "1:1 AI Strategy - $200/hr" |
| `mentorship` | Mentorship | Ongoing guidance | "Monthly mentorship - $150/mo" |
| **Quick Help** |
| `skill` | Skill | Quick help capacity | "I can review your landing page" |
| `feedback` | Feedback | Beta testing capacity | "Happy to beta test your app" |

### OfferStatus Choices

| Value | Label | Description |
|-------|-------|-------------|
| `draft` | Draft | Not visible to others |
| `active` | Active | Visible and accepting connections |
| `paused` | Paused | Temporarily not accepting |
| `archived` | Archived | Soft deleted |

### PricingType Choices

| Value | Label | Description |
|-------|-------|-------------|
| `free` | Free | No cost |
| `one_time` | One-time | Single payment |
| `hourly` | Hourly | Per-hour rate |
| `monthly` | Monthly | Recurring subscription |
| `custom` | Contact | Price on request |

### Offer Indexes

```python
indexes = [
    models.Index(fields=['user', 'status']),           # User's offers list
    models.Index(fields=['status', 'offer_type']),     # Discovery by type
    models.Index(fields=['category', 'status']),       # Discovery by category
    models.Index(fields=['-created_at']),              # Recent offers
    models.Index(fields=['is_featured', '-created_at']), # Featured offers
]
```

### Offer Constraints

```python
constraints = [
    models.UniqueConstraint(
        fields=['user', 'slug'],
        name='unique_offer_slug_per_user'
    ),
]
```

---

## MODEL 2: Ask

> **What users NEED** - beta testers, feedback, collaborators, learning goals

### Ask Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `user` | FK(User) | yes | - | Person asking |
| `slug` | SlugField(220) | yes | auto | URL-safe identifier, unique per user |
| `title` | CharField(200) | yes | - | What you need (short) |
| `description` | TextField | yes | - | Full details |
| `ask_type` | CharField(20) | yes | - | See AskType choices |
| `featured_image_url` | URLField | no | '' | Optional image |
| **Categorization** |
| `category` | FK(Taxonomy) | no | null | Category for Discovery |
| `tags` | M2M(Taxonomy) | no | [] | Additional context tags |
| **Tools Integration** |
| `tools` | M2M(Tool) | no | [] | Tools related to this ask (shows "Need help with Midjourney" badge) |
| **Budget** |
| `is_paid_opportunity` | BooleanField | yes | False | Willing to pay? |
| `budget_min_cents` | PositiveIntegerField | no | null | Min budget |
| `budget_max_cents` | PositiveIntegerField | no | null | Max budget |
| `currency` | CharField(3) | yes | 'usd' | Budget currency |
| **Status** |
| `status` | CharField(20) | yes | 'open' | See AskStatus choices |
| `is_archived` | BooleanField | yes | False | Soft delete |
| **Metrics** |
| `view_count` | PositiveIntegerField | yes | 0 | Total views |
| `response_count` | PositiveIntegerField | yes | 0 | Connections received |
| **Timestamps** |
| `created_at` | DateTimeField | auto | now | When posted |
| `updated_at` | DateTimeField | auto | now | Last edit |
| `fulfilled_at` | DateTimeField | no | null | When marked fulfilled |
| `expires_at` | DateTimeField | no | null | Optional expiration |

### AskType Choices

| Value | Label | Description | Example |
|-------|-------|-------------|---------|
| `beta_tester` | Beta Testers | Need people to try your thing | "Looking for 10 beta testers for my app" |
| `feedback` | Feedback | Want review/critique | "Need feedback on my landing page" |
| `collaborator` | Collaborator | Looking for partner | "Seeking technical co-founder" |
| `learning` | Learning Goal | Want to learn something | "Want to learn prompt engineering" |
| `hire` | Hiring | Paid contractor/employee | "Hiring React developer" |
| `advice` | Advice | Seeking guidance | "Need advice on pricing strategy" |
| `introduction` | Introduction | Want to meet someone | "Looking for intro to VCs" |

### AskStatus Choices

| Value | Label | Description |
|-------|-------|-------------|
| `open` | Open | Accepting responses |
| `in_progress` | In Progress | Working with someone |
| `fulfilled` | Fulfilled | Got what was needed |
| `closed` | Closed | No longer needed |

### Ask Indexes

```python
indexes = [
    models.Index(fields=['user', 'status']),           # User's asks
    models.Index(fields=['status', 'ask_type']),       # Discovery by type
    models.Index(fields=['category', 'status']),       # Discovery by category
    models.Index(fields=['status', '-created_at']),    # Recent open asks
    models.Index(fields=['is_paid_opportunity', 'status']), # Paid opportunities
]
```

### Ask Constraints

```python
constraints = [
    models.UniqueConstraint(
        fields=['user', 'slug'],
        name='unique_ask_slug_per_user'
    ),
]
```

---

## MODEL 3: Connection

> **Links users together** - response to an ask or inquiry about an offer

### Connection Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `initiator` | FK(User) | yes | - | Who started the connection |
| `responder` | FK(User) | yes | - | Who receives it |
| **Context** |
| `ask` | FK(Ask) | no | null | If responding to an ask |
| `offer` | FK(Offer) | no | null | If inquiring about an offer |
| `connection_type` | CharField(20) | yes | - | See ConnectionType choices |
| **Communication** |
| `initial_message` | TextField | yes | - | First message |
| `dm_thread` | FK(DirectMessageThread) | no | null | Link to DM for ongoing chat |
| **Status** |
| `status` | CharField(20) | yes | 'initiated' | See ConnectionStatus choices |
| **Commerce** |
| `agreed_price_cents` | PositiveIntegerField | no | null | Final agreed price |
| `stripe_payment_intent_id` | CharField(255) | no | '' | For paid connections |
| `paid_at` | DateTimeField | no | null | When payment completed |
| **Ratings** |
| `initiator_rating` | PositiveSmallIntegerField | no | null | 1-5 stars |
| `responder_rating` | PositiveSmallIntegerField | no | null | 1-5 stars |
| `initiator_feedback` | TextField | no | '' | Written feedback |
| `responder_feedback` | TextField | no | '' | Written feedback |
| **Timestamps** |
| `created_at` | DateTimeField | auto | now | When initiated |
| `updated_at` | DateTimeField | auto | now | Last status change |
| `completed_at` | DateTimeField | no | null | When marked complete |

### ConnectionType Choices

| Value | Label | Description |
|-------|-------|-------------|
| `ask_response` | Ask Response | Responding to someone's ask |
| `offer_inquiry` | Offer Inquiry | Inquiring about an offer |
| `direct` | Direct | Direct outreach (no ask/offer) |

### ConnectionStatus Choices

| Value | Label | Description |
|-------|-------|-------------|
| `initiated` | Initiated | Sent, awaiting response |
| `discussing` | Discussing | Both engaged, negotiating |
| `accepted` | Accepted | Agreed to proceed |
| `in_progress` | In Progress | Work happening |
| `completed` | Completed | Successfully finished |
| `declined` | Declined | Responder said no |
| `cancelled` | Cancelled | Initiator withdrew |

### Connection Indexes

```python
indexes = [
    models.Index(fields=['initiator', 'status']),      # My sent connections
    models.Index(fields=['responder', 'status']),      # My received connections
    models.Index(fields=['ask', 'status']),            # Connections on an ask
    models.Index(fields=['offer', 'status']),          # Connections on an offer
    models.Index(fields=['status', '-created_at']),    # Recent by status
]
```

### Connection Constraints

```python
constraints = [
    # Prevent duplicate active connections between same users for same ask/offer
    models.UniqueConstraint(
        fields=['initiator', 'responder', 'ask'],
        condition=Q(ask__isnull=False) & ~Q(status__in=['completed', 'declined', 'cancelled']),
        name='unique_active_connection_per_ask'
    ),
    models.UniqueConstraint(
        fields=['initiator', 'responder', 'offer'],
        condition=Q(offer__isnull=False) & ~Q(status__in=['completed', 'declined', 'cancelled']),
        name='unique_active_connection_per_offer'
    ),
]
```

---

## MODEL 4: Follow

> **Creator following** - subscribe to a creator's updates

### Follow Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `follower` | FK(User) | yes | - | Who is following |
| `following` | FK(User) | yes | - | Who is being followed |
| `created_at` | DateTimeField | auto | now | When followed |

### Follow Indexes

```python
indexes = [
    models.Index(fields=['follower', '-created_at']),   # Who I follow
    models.Index(fields=['following', '-created_at']),  # My followers
]
```

### Follow Constraints

```python
constraints = [
    models.UniqueConstraint(
        fields=['follower', 'following'],
        name='unique_follow'
    ),
    models.CheckConstraint(
        check=~Q(follower=F('following')),
        name='no_self_follow'
    ),
]
```

> Note: User model already has `followers_count` and `following_count` fields that should be updated via signals.

---

## MODEL 5: AgentProfile

> **Links AI agents to human owners** - for agent accountability and profile display

### AgentProfile Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `user` | OneToOne(User) | yes | - | The agent user account (role='agent') |
| `owner` | FK(User) | yes | - | Human user who owns this agent |
| `created_at` | DateTimeField | auto | now | When ownership was established |

### AgentProfile Constraints

```python
class AgentProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='agent_profile',
        limit_choices_to={'role': 'agent'}
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='owned_agents'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=~Q(user=F('owner')),
                name='agent_cannot_own_itself'
            ),
        ]
```

### Usage

- **Sage setup:** `sage.agent_profile.owner = allierays_user`
- **Profile display:** Show agent's courses under owner's "Learn From Me" section
- **Accountability:** All agent actions traceable to human owner

---

## TOOLS DIRECTORY INTEGRATION

> **Tools are NOT deprecated.** The Tools Directory is a curated resource library that complements Ask/Offer.

### Concept: Tools as Resources

| Concept | Description | Example |
|---------|-------------|---------|
| **Tools Directory** | Curated external AI tools (team-managed via YAML) | Claude, Midjourney, ElevenLabs |
| **Offer with Tools** | User-created offering that uses tools | "Built with Claude" badge |
| **Ask with Tools** | User request for help with specific tools | "Need help with Midjourney" badge |

### Tools M2M Field Specs

```python
# Offer model
tools = models.ManyToManyField(
    'tools.Tool',
    blank=True,
    related_name='offers',
    help_text='Tools used to build this offering'
)

# Ask model
tools = models.ManyToManyField(
    'tools.Tool',
    blank=True,
    related_name='asks',
    help_text='Tools this ask is related to'
)
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

## LEARNING PATH INTEGRATION

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

### Implementation Phases

| Phase | What | When |
|-------|------|------|
| Phase 1 (Sprint 2) | Add AgentProfile model, link Sage to @allierays | Sprint 2 |
| Phase 1 (Sprint 5) | Show Sage's courses on @allierays profile | Sprint 5 |
| Phase 2 (Future) | Course Publisher creator tool | Future Sprint |

---

## EXISTING MODEL: Taxonomy

> **Unified tagging system** - already exists at `core/taxonomy/models.py`

### Taxonomy Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `taxonomy_type` | CharField(20) | yes | 'tool' | See TaxonomyType choices |
| `parent` | FK(self) | no | null | Parent for hierarchical taxonomies |
| `name` | CharField(100) | yes | - | Display name |
| `slug` | SlugField(120) | yes | auto | URL-friendly identifier (unique) |
| `description` | TextField | no | '' | Description text |
| `is_active` | BooleanField | yes | True | Available for selection |
| `color` | CharField(50) | no | '' | Display color for topics |
| **Tool-specific fields** |
| `website_url` | URLField | no | null | Official website URL |
| `logo_url` | URLField | no | null | Logo image URL |
| `usage_tips` | JSONField | no | [] | List of usage tips |
| `best_for` | JSONField | no | [] | List of best use cases |
| `created_at` | DateTimeField | auto | now | Creation time |

### TaxonomyType Choices (All 16 Existing)

| Value | Label | Used For |
|-------|-------|----------|
| `tool` | Tool | External tool entries (1:1 with Tool model) |
| `category` | Category | Predefined project categories |
| `topic` | Topic | Free-flowing tags (AI-generated) |
| `goal` | Goal | User goals ("Learn New Skills") |
| `industry` | Industry | Industry verticals ("Healthcare") |
| `interest` | Interest | User interests ("AI & Machine Learning") |
| `skill` | Skill | Technical skills ("Python") - hierarchical |
| `modality` | Learning Modality | How to learn ("Video", "Games") |
| `outcome` | Learning Outcome | What you'll achieve |
| `content_type` | Content Type | Type of content ("article", "video") |
| `time_investment` | Time Investment | Duration ("quick", "deep-dive") |
| `difficulty` | Difficulty | Level ("beginner", "advanced") |
| `pricing` | Pricing | Price tier ("free", "paid") |
| `personality` | Personality Type | MBTI types ("INTJ") |
| `learning_style` | Learning Style | Learning preference ("visual", "hands-on") |
| `role` | Role | Job function ("developer", "marketer") |

### New TaxonomyType: `offer_category`

Add to TaxonomyType choices in `core/taxonomy/models.py`:

```python
OFFER_CATEGORY = 'offer_category', 'Offer Category'
```

### Seed Data for offer_category

| Slug | Name | Description |
|------|------|-------------|
| `marketing-content` | Marketing & Content | Content creation, copywriting, social media |
| `sales-outreach` | Sales & Outreach | Lead gen, sales automation, CRM |
| `customer-support` | Customer Support | Chatbots, helpdesk, support automation |
| `operations` | Operations & Productivity | Workflow automation, project management |
| `creative-design` | Creative & Design | Image generation, video, design tools |
| `development` | Development & Technical | Coding, APIs, technical tools |
| `learning-education` | Learning & Education | Courses, tutorials, coaching |
| `other` | Other | Doesn't fit other categories |

### Taxonomy Indexes (Existing)

```python
indexes = [
    models.Index(fields=['taxonomy_type', 'is_active']),
]
```

### How Taxonomy is Used

- `Offer.category` → FK to Taxonomy where `taxonomy_type='offer_category'`
- `Offer.tags` → M2M to Taxonomy where `taxonomy_type IN ('skill', 'topic')`
- `Ask.category` → FK to Taxonomy where `taxonomy_type='offer_category'`
- `Ask.tags` → M2M to Taxonomy where `taxonomy_type IN ('skill', 'topic')`

### Related Models (Already Exist)

**TopicDefinition** - AI-generated definitions for topics:
- `slug`, `display_name`, `description`, `aliases`, `project_count`

**UserTag** - Tags associated with users:
- `user`, `taxonomy`, `name`, `source`, `confidence_score`, `decay_factor`

**UserInteraction** - Track interactions for auto-tagging:
- `user`, `interaction_type`, `metadata`, `extracted_keywords`

---

## RELATIONSHIPS DIAGRAM

```
┌─────────────┐
│    User     │
└─────────────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Offer    │    │     Ask     │    │   Follow    │    │AgentProfile │
│             │    │             │    │             │    │             │
│ user ──────►│    │ user ──────►│    │ follower ──►│    │ user ──────►│ (agent)
│ category ──►│    │ category ──►│    │ following ─►│    │ owner ─────►│ (human)
│ tags ──────►│    │ tags ──────►│    └─────────────┘    └─────────────┘
│ tools ─────►│    │ tools ─────►│
└─────────────┘    └─────────────┘
       │                  │
       │                  │
       └────────┬─────────┘
                │
                ▼
        ┌─────────────┐
        │ Connection  │
        │             │
        │ initiator ─►│──► User
        │ responder ─►│──► User
        │ ask ───────►│──► Ask (optional)
        │ offer ─────►│──► Offer (optional)
        │ dm_thread ─►│──► DirectMessageThread
        └─────────────┘

┌─────────────┐                    ┌─────────────┐
│  Taxonomy   │                    │    Tool     │
│             │                    │             │
│ type=offer_category ──► Offer.category        │ ◄── Offer.tools (M2M)
│ type=skill ──────────► Offer.tags, Ask.tags   │ ◄── Ask.tools (M2M)
│ type=topic ──────────► Offer.tags, Ask.tags   │
└─────────────┘                    └─────────────┘
```

---

## API ENDPOINTS

### Offers API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/offers/` | List offers (filtered) | Optional |
| POST | `/api/v1/offers/` | Create offer | Required |
| GET | `/api/v1/offers/{id}/` | Get offer detail | Optional |
| PATCH | `/api/v1/offers/{id}/` | Update offer | Owner |
| DELETE | `/api/v1/offers/{id}/` | Archive offer | Owner |
| GET | `/api/v1/offers/me/` | My offers | Required |
| POST | `/api/v1/offers/{id}/view/` | Record view | Optional |

### Asks API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/asks/` | List asks (filtered) | Optional |
| POST | `/api/v1/asks/` | Create ask | Required |
| GET | `/api/v1/asks/{id}/` | Get ask detail | Optional |
| PATCH | `/api/v1/asks/{id}/` | Update ask | Owner |
| DELETE | `/api/v1/asks/{id}/` | Archive ask | Owner |
| GET | `/api/v1/asks/me/` | My asks | Required |
| PATCH | `/api/v1/asks/{id}/status/` | Change status | Owner |

### Connections API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/connections/` | My connections | Required |
| POST | `/api/v1/connections/` | Create connection | Required |
| GET | `/api/v1/connections/{id}/` | Get connection | Participant |
| PATCH | `/api/v1/connections/{id}/` | Update status | Participant |
| POST | `/api/v1/connections/{id}/rate/` | Add rating | Participant |

### Discovery API

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/discover/` | Unified discovery | Optional |
| GET | `/api/v1/discover/offers/` | Browse offers | Optional |
| GET | `/api/v1/discover/asks/` | Browse asks | Optional |
| GET | `/api/v1/discover/people/` | Browse creators | Optional |

---

## Project → Offer Migration Mapping

For reference when re-onboarding users or building migration tools:

| Project Field | Offer Field | Conversion |
|---------------|-------------|------------|
| `title` | `title` | Direct copy |
| `description` | `description` | Direct copy |
| `slug` | `slug` | Direct copy |
| `type` | `offer_type` | Map: github_repo/gitlab_project → `app`, video → `link`, prompt → `template`, social_clip → `post` |
| `featured_image_url` | `featured_image_url` | Direct copy |
| `banner_url` | `banner_url` | Direct copy |
| `external_url` | `external_url` | Direct copy |
| `content` | `content` | Direct copy (JSONField) |
| `categories` M2M | `category` FK | Take first category, or let user re-select |
| `topics` M2M | `tags` M2M | Direct copy |
| `is_private=True` | `status='draft'` | Map visibility to status |
| `is_private=False` | `status='active'` | Map visibility to status |
| `is_product=True` | `is_paid=True` | Map product flag |
| `view_count` | `view_count` | Direct copy |
| `tools` M2M | `tools` M2M | Direct copy (reuse Tool M2M) |
| `is_showcased` | ❌ DROP | All offers showcased by default |
| `is_highlighted` | `is_featured` | Map highlight to featured |
| ❌ N/A | `source_type` | Set based on original project type (github, figma, etc.) |

---

## ON_DELETE BEHAVIOR

| Model | FK Field | on_delete | Rationale |
|-------|----------|-----------|-----------|
| Offer | `user` | CASCADE | Delete offers when user deleted |
| Offer | `category` | SET_NULL | Keep offer if category removed |
| Ask | `user` | CASCADE | Delete asks when user deleted |
| Ask | `category` | SET_NULL | Keep ask if category removed |
| Connection | `initiator` | CASCADE | Delete connection if initiator deleted |
| Connection | `responder` | CASCADE | Delete connection if responder deleted |
| Connection | `ask` | SET_NULL | Keep connection history |
| Connection | `offer` | SET_NULL | Keep connection history |
| Connection | `dm_thread` | SET_NULL | Keep connection even if DM deleted |
| Follow | `follower` | CASCADE | Delete follow if follower deleted |
| Follow | `following` | CASCADE | Delete follow if following deleted |

---

## LIMIT_CHOICES_TO SPECS

### Offer Model

```python
category = models.ForeignKey(
    'taxonomy.Taxonomy',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    limit_choices_to={'taxonomy_type': 'offer_category', 'is_active': True},
    related_name='offers',
)
tags = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    limit_choices_to={'taxonomy_type__in': ['skill', 'topic'], 'is_active': True},
    related_name='tagged_offers',
)
```

### Ask Model

```python
category = models.ForeignKey(
    'taxonomy.Taxonomy',
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    limit_choices_to={'taxonomy_type': 'offer_category', 'is_active': True},
    related_name='asks',
)
tags = models.ManyToManyField(
    'taxonomy.Taxonomy',
    blank=True,
    limit_choices_to={'taxonomy_type__in': ['skill', 'topic'], 'is_active': True},
    related_name='tagged_asks',
)
```

---

## USER MODEL UPDATES

Add to `core/users/models.py`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `helped_count` | PositiveIntegerField | 0 | Number of people helped (completed connections) |

### Method to Add

```python
def increment_helped_count(self):
    """Called when a Connection is marked completed where this user is responder."""
    from django.db.models import F
    User.objects.filter(pk=self.pk).update(helped_count=F('helped_count') + 1)
    self.refresh_from_db(fields=['helped_count'])
```

---

## SIGNALS (core/collective/signals.py)

### Counter Updates

| Signal | Trigger | Action |
|--------|---------|--------|
| `post_save(Connection)` | Connection created | Increment `Offer.connection_count` or `Ask.response_count` |
| `post_save(Connection)` | Connection.status → 'completed' | Increment `User.helped_count` for responder |
| `post_save(Follow)` | Follow created | Increment `User.followers_count` on following, `User.following_count` on follower |
| `post_delete(Follow)` | Follow deleted | Decrement counts |

### Implementation Example

```python
from django.db.models import F
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=Connection)
def update_connection_counts(sender, instance, created, **kwargs):
    if created:
        if instance.offer:
            Offer.objects.filter(pk=instance.offer_id).update(
                connection_count=F('connection_count') + 1
            )
        if instance.ask:
            Ask.objects.filter(pk=instance.ask_id).update(
                response_count=F('response_count') + 1
            )

@receiver(post_save, sender=Connection)
def update_helped_count(sender, instance, **kwargs):
    if instance.status == 'completed':
        # Use a tracker or check previous status to avoid double-counting
        instance.responder.increment_helped_count()

@receiver(post_save, sender=Follow)
def increment_follow_counts(sender, instance, created, **kwargs):
    if created:
        User.objects.filter(pk=instance.following_id).update(
            followers_count=F('followers_count') + 1
        )
        User.objects.filter(pk=instance.follower_id).update(
            following_count=F('following_count') + 1
        )

@receiver(post_delete, sender=Follow)
def decrement_follow_counts(sender, instance, **kwargs):
    User.objects.filter(pk=instance.following_id).update(
        followers_count=F('followers_count') - 1
    )
    User.objects.filter(pk=instance.follower_id).update(
        following_count=F('following_count') - 1
    )
```

---

## VALIDATION RULES

### Connection Validation

```python
class Connection(models.Model):
    def clean(self):
        from django.core.exceptions import ValidationError

        # Must have ask OR offer (not both, not neither) for non-direct connections
        if self.ask and self.offer:
            raise ValidationError("Connection cannot be for both an ask and an offer")
        if not self.ask and not self.offer and self.connection_type != 'direct':
            raise ValidationError("Non-direct connection must reference an ask or offer")

        # Cannot connect with yourself
        if self.initiator == self.responder:
            raise ValidationError("Cannot create a connection with yourself")
```

### Ask Budget Validation

```python
class Ask(models.Model):
    def clean(self):
        from django.core.exceptions import ValidationError

        if self.budget_min_cents and self.budget_max_cents:
            if self.budget_min_cents > self.budget_max_cents:
                raise ValidationError("Minimum budget cannot exceed maximum budget")
```

---

## FILES TO CREATE (Sprint 2)

```
core/collective/
├── __init__.py
├── apps.py
├── models.py                 # Offer, Ask, Connection, Follow, AgentProfile
├── serializers.py            # CRUD serializers
├── views.py                  # ViewSets
├── urls.py                   # Router config
├── permissions.py            # IsOwnerOrReadOnly, IsParticipant
├── admin.py                  # Admin interface
├── filters.py                # DRF filters for discovery
├── signals.py                # Update counts, send notifications
└── migrations/
    └── 0001_initial.py

core/urls.py                  # Add collective app routes
config/settings.py            # Add to INSTALLED_APPS

# Seed data
core/collective/management/commands/
├── seed_offer_categories.py  # Create taxonomy entries
└── link_sage_to_owner.py     # Link Sage agent to @allierays

# User model update
core/users/migrations/
└── XXXX_add_helped_count.py  # Add helped_count field
```
