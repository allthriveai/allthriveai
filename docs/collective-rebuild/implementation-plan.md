# AI Collective Platform Restructure

> **Tagline:** Share what you offer. Ask for what you need. The All Thrive AI Collective.

## Pre-Sprint 1: Documentation Updates

Update existing docs in `/docs/collective-rebuild/` with Tools and LearningPath integration:

### Files to Update

1. **`docs/collective-rebuild/architecture.md`**
   - Add "Tools Directory Integration" section (Tools as resources, M2M with Offers/Asks)
   - Add "Learning Path Integration" section (Sage as agent, Course Publisher vision)
   - Update "What Gets Merged" table to clarify Tools and LearningPath are NOT merged
   - Update "What Gets Kept" table

2. **`docs/collective-rebuild/data-model.md`**
   - Add `Offer.tools` M2M field to Offer model spec
   - Add `Ask.tools` M2M field to Ask model spec
   - Add `AgentProfile` model (links agents to human owners)
   - Add "TOOLS DIRECTORY INTEGRATION" section
   - Add "LEARNING PATH INTEGRATION" section
   - Update deprecation tables (Tool and LearningPath are KEEP not DEPRECATED)

3. **`docs/collective-rebuild/full-rebuild.md`**
   - Sync with plan file (copy relevant sections from ~/.claude/plans/)

---

## Information Architecture (DECIDED)

### Target Users
**Both equally** - Builders AND non-technical users. The platform needs to serve:
- AI builders who create apps, offer services, share knowledge
- Non-technical users who discover tools, find experts, learn

### Tools Directory Decision: KEEP SEPARATE
Tools Directory is a curated resource library that complements (not merges with) Offers:
- **Tools** = Team-curated external AI tools (Claude, Midjourney, etc.) via YAML fixture
- **Offers** = User-created content (apps, courses, services, etc.)
- Tools connect to Offers/Asks via M2M relationships ("Built with Claude" badges)
- `/discover/tools` for browsing curated tools, `/discover/offers` for user offerings
- See TOOLS DIRECTORY INTEGRATION section for full details

### Navigation Structure (Final)

**Design Philosophy:** Action-oriented, feeling-based names that reflect the two-sided marketplace journey:
1. **Discover** - Find what you need (people, offers, asks, tools, courses)
2. **Connect** - Match with people, manage connections, have conversations
3. **Ava** - AI assistant for guidance and help (separate from user-to-user messages)

**Top Navigation (4 items):**
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

**Connect page (tabs or sections):**
```
Dashboard    ← Activity feed, matches, quick stats
Connections  ← Active connections with people
Messages     ← User-to-user conversations
Community    ← Events, weekly challenges, community activities
```

**Discover (dropdown or page with tabs):**
```
All         ← /discover
────────────
Offers      ← /discover/offers
Asks        ← /discover/asks
People      ← /discover/people
Tools       ← /discover/tools
Courses     ← /discover/courses
```

**Avatar Dropdown:**
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

**Footer (minimal, 3 columns):**
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

**Key Decisions:**
- "Discover, Connect, Ava" = action/feeling-based, not feature-based
- Learning is in two places: Discover/Courses (browse) + Avatar/My Learning (enrolled)
- Creator Tools in avatar dropdown (not top nav) - keeps nav clean
- Payments split: Purchases (buyer), Earnings (seller/creator)
- No separate "Learn" top nav - courses are discoverable content
- Messages live under Connect (not separate nav item)
- Community events/challenges live under Connect (community building activities)

### Concept Mapping (Final)

| Existing | New Concept | Relationship |
|----------|-------------|--------------|
| **Tools Directory** | Tools (separate) | **KEEP** - Curated resources, M2M with Offers/Asks |
| **Projects** | Offers (things built) | Projects become offer showcase pages |
| **Products** (marketplace) | Offers (paid) | Products are paid offers |
| **Services** | Offers (type=service) | New category |
| **Learning Paths** | Offers (type=course) | Creator courses in Discovery |
| **Explore Feed** | `/discover` page | Problem-based discovery |

### URL Structure

| Purpose | URL Pattern | Examples |
|---------|-------------|----------|
| **Browse others** | `/discover/*` | `/discover`, `/discover/offers`, `/discover/asks`, `/discover/people`, `/discover/tools`, `/discover/courses` |
| **Manage yours** | `/my/*` | `/my/offers`, `/my/asks`, `/my/learning`, `/my/purchases` |
| **Profiles** | `/@username` | `/@sarah`, `/@aiconsultant` |
| **Dashboard** | `/home` | User's personal dashboard (via Connect nav) |
| **Creator Tools** | `/creator/*` | `/creator/clips`, `/creator/courses` |
| **Messages** | `/messages` | User-to-user messaging (via Connect page) |
| **Community** | `/community` | Events, weekly challenges, community activities |
| **Ava** | `/ava` | AI assistant chat |
| **Settings** | `/settings` | Account settings, `/settings/earnings` for creators |

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

## TOOLS DIRECTORY INTEGRATION

> **Tools are NOT deprecated.** The Tools Directory is a curated resource library that complements Ask/Offer.

### Concept: Tools as Resources

| Concept | Description | Example |
|---------|-------------|---------|
| **Tools Directory** | Curated external AI tools (team-managed) | Claude, Midjourney, ElevenLabs |
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
- **Offers using this tool** - "Apps built with Claude"
- **Asks needing this tool** - "People looking for Claude help"
- **Experts for this tool** - Users who've helped others with it

### Implementation Notes

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

### Why Keep Tools Separate from Offers

| Aspect | Tools | Offers (type=app) |
|--------|-------|-------------------|
| **Creator** | Team-curated | User-created |
| **Purpose** | Resource discovery | User-to-user exchange |
| **Data** | Rich metadata, game stats | Basic project info |
| **Source** | YAML fixture | Live database |
| **Examples** | Claude, Midjourney | "My AI Meeting Bot" |

---

## LEARNING PATH INTEGRATION

> **LearningPaths evolve into Course Publisher** - A creator tool for experts to build AI-assisted courses as Offers.

### Two-Part Strategy

**1. Sage as @allierays's Agent**
- Sage becomes a visible AI agent owned by @allierays (you)
- Demonstrates the agent ownership model before Sprint 9
- Sage's existing learning paths become Offers from your profile
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

### Sage Agent Model

```python
# Sage is already a User with role='agent', tier='curation'
# Add ownership linkage:

class AgentProfile(models.Model):
    """Links agent users to their human owners"""
    user = models.OneToOneField(User, on_delete=models.CASCADE,
                                  related_name='agent_profile',
                                  limit_choices_to={'role': 'agent'})
    owner = models.ForeignKey(User, on_delete=models.CASCADE,
                               related_name='owned_agents')
    created_at = models.DateTimeField(auto_now_add=True)

# Sage setup:
# sage.agent_profile.owner = allierays_user
```

### Course Publisher Vision (Future Sprint)

**Creator Flow:**
1. Creator opens Course Publisher (`/creator/courses/new`)
2. Provides: topic, target audience, learning goals
3. AI suggests curriculum structure (modules, lessons)
4. Creator refines, adds expertise, records content
5. AI generates quizzes, summaries, exercises
6. Creator publishes → becomes Offer (type: `course`)

**AI Assistance:**
- Curriculum structuring from outline
- Content generation with creator review
- Quiz/exercise creation
- Cover image generation
- Pricing suggestions based on depth

**Reuses Existing:**
- `SavedLearningPath` model (path_data, curriculum items)
- `LessonProgress` tracking for students
- `MicroLesson` content templates
- Image generation pipeline

### Implementation Phases

| Phase | What | When |
|-------|------|------|
| Phase 1 (Sprint 2) | Add AgentProfile model, link Sage to @allierays | Sprint 2 |
| Phase 1 (Sprint 5) | Show Sage's courses on @allierays profile | Sprint 5 |
| Phase 2 (Future) | Course Publisher creator tool | Future Sprint |

### Files to Modify/Create

```
# Sprint 2: Agent ownership
core/collective/models.py              # Add AgentProfile model
core/management/commands/seed_core_team.py  # Link Sage to @allierays

# Sprint 5: Profile integration
frontend/src/components/profile/OffersSection.tsx  # Show courses from owned agents

# Future: Course Publisher
frontend/src/pages/creator/CourseBuilderPage.tsx   # AI-assisted builder
core/learning_paths/views.py                       # Course publishing endpoint
```

---

## PHASE 1: Foundation (Sprints 1-4)

---

## DATA-MODEL.MD UPDATES (From Code Review)

Before Sprint 1, update `docs/collective-rebuild/data-model.md` with these additions:

### 1. Full Taxonomy Model Documentation

Replace the minimal "TAXONOMY: Categories" section with:

```markdown
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

OFFER_CATEGORY = 'offer_category', 'Offer Category'

### Related Models (Already Exist)

**TopicDefinition** - AI-generated definitions for topics:
- `slug`, `display_name`, `description`, `aliases`, `project_count`

**UserTag** - Tags associated with users:
- `user`, `taxonomy`, `name`, `source`, `confidence_score`, `decay_factor`

**UserInteraction** - Track interactions for auto-tagging:
- `user`, `interaction_type`, `metadata`, `extracted_keywords`
```

### 2. Add `limit_choices_to` Specs

Update Offer and Ask categorization fields:

```python
# Offer model
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

# Ask model (same pattern)
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

### 3. Add Follow Model Indexes

```python
# Follow model
class Meta:
    indexes = [
        models.Index(fields=['follower', '-created_at']),   # Who I follow
        models.Index(fields=['following', '-created_at']),  # My followers
    ]
```

### 4. Document on_delete Behavior

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

### 5. Add User Model Updates Section

```markdown
## USER MODEL UPDATES

Add to `core/users/models.py`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `helped_count` | PositiveIntegerField | 0 | Number of people helped (completed connections) |

Method to add:

def increment_helped_count(self):
    """Called when a Connection is marked completed where this user is responder."""
    from django.db.models import F
    User.objects.filter(pk=self.pk).update(helped_count=F('helped_count') + 1)
    self.refresh_from_db(fields=['helped_count'])
```

### 6. Add Signals Section

```markdown
## SIGNALS (core/collective/signals.py)

### Counter Updates

| Signal | Trigger | Action |
|--------|---------|--------|
| `post_save(Connection)` | Connection created | Increment `Offer.connection_count` or `Ask.response_count` |
| `post_save(Connection)` | Connection.status → 'completed' | Increment `User.helped_count` for responder |
| `post_save(Follow)` | Follow created | Increment `User.followers_count` on following, `User.following_count` on follower |
| `post_delete(Follow)` | Follow deleted | Decrement counts |

### Implementation

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
        # Check if this is a new completion (use tracker or previous_status field)
        instance.responder.increment_helped_count()
```

### 7. Add Validation Section

```markdown
## VALIDATION RULES

### Connection Validation

class Connection(models.Model):
    def clean(self):
        # Must have ask OR offer (not both, not neither)
        if self.ask and self.offer:
            raise ValidationError("Connection cannot be for both an ask and an offer")
        if not self.ask and not self.offer and self.connection_type != 'direct':
            raise ValidationError("Non-direct connection must reference an ask or offer")

        # Cannot connect with yourself
        if self.initiator == self.responder:
            raise ValidationError("Cannot create a connection with yourself")

### Ask Budget Validation

class Ask(models.Model):
    def clean(self):
        if self.budget_min_cents and self.budget_max_cents:
            if self.budget_min_cents > self.budget_max_cents:
                raise ValidationError("Minimum budget cannot exceed maximum budget")
```

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

**Goal:** Create data layer for Offers/Asks/Connections (no UI yet)

### 2.1 New Django App: `core/collective/`

> Note: App name is for code organization. API routes are `/api/v1/offers/`, `/api/v1/asks/`, `/api/v1/connections/` (no "collective" in URLs).

---

## ENTITY SPECIFICATION DOCUMENT

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary Keys | **Integer (auto-increment)** | Consistent with User, Project, Product models |
| Offer vs Product | **New Offer model** | Clean slate. Product model deprecated in Phase 3 |
| Ask Categories | **Yes, same as Offers** | Unified discovery experience |
| Slug scope | **Unique per user** | Like Projects: `/@username/offer-slug` |

### Deprecation Plan

| Model | Status | Replacement | Delete In |
|-------|--------|-------------|-----------|
| `Project` | DEPRECATED | `Offer` | Phase 3 |
| `Product` | DEPRECATED | `Offer` (with `is_paid=True`) | Phase 3 |

### Models NOT Deprecated (Keep & Integrate)

| Model | Status | Integration |
|-------|--------|-------------|
| `Tool` | **KEEP** | Curated resource directory. Link to Offers/Asks via M2M. |
| `LearningPath` | **KEEP** | Evolves into Course Publisher. See LEARNING PATH INTEGRATION section. |

### Project → Offer Migration Mapping

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
| `tools` M2M | ❌ DROP | Not needed in new model |
| `is_showcased` | ❌ DROP | All offers showcased by default |
| `is_highlighted` | `is_featured` | Map highlight to featured |
| ❌ N/A | `source_type` | Set based on original project type (github, figma, etc.) |

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
| `app` | App/Tool | Software, website, bot | "MeetingBot - AI meeting summaries" |
| `template` | Template | Downloadable resource | "AI Prompt Pack - $19" |
| **Knowledge Sharing** |
| `course` | Course | Educational content | "Build Your First AI Tool - $49" |
| `post` | Post | Blog post, article, essay | "How I built my first AI agent" |
| `link` | Link | Shared resource/find | "This Claude prompt guide is amazing" |
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

## MODEL 4: Follow (Sprint 5)

> **Creator following** - subscribe to a creator's updates

### Follow Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | AutoField | auto | - | Integer primary key |
| `follower` | FK(User) | yes | - | Who is following |
| `following` | FK(User) | yes | - | Who is being followed |
| `created_at` | DateTimeField | auto | now | When followed |

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

### TaxonomyType Choices (Existing)

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

Add this new type for Offer/Ask categorization in Discovery:

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

### Related Models

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
       ├──────────────────┬──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Offer    │    │     Ask     │    │   Follow    │
│             │    │             │    │             │
│ user ──────►│    │ user ──────►│    │ follower ──►│
│ category ──►│    │ category ──►│    │ following ─►│
│ tags ──────►│    │ tags ──────►│    └─────────────┘
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

┌─────────────┐
│  Taxonomy   │
│             │
│ type=offer_category ──► Offer.category, Ask.category
│ type=skill ──────────► Offer.tags, Ask.tags
│ type=topic ──────────► Offer.tags, Ask.tags
└─────────────┘
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

## FILES TO CREATE (Sprint 2)

```
core/collective/
├── __init__.py
├── apps.py
├── models.py                 # Offer, Ask, Connection
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
└── seed_offer_categories.py  # Create taxonomy entries
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

## Sprint 5: Creator Profile (Offers + Asks Structure)

**Goal:** Transform profiles into simple storefronts organized by Offers and Asks

### 5.1 Profile Layout

Profile sections in order:
1. **Header** - Name, tagline, social proof stats
2. **What I Offer** - with subsections by type
3. **What I Need** - asks (flat list, no subsections)
4. **Recent Activity** - at the bottom for social proof

```
┌─────────────────────────────────────────────────────────────┐
│  @sarah                                    [Follow] [Share] │
│  "Building AI tools that make work easier"                  │
│                                                             │
│  🌱 1,240 pts  •  👥 23 helped  •  👀 412 followers           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ═══════════════════════════════════════════════════════    │
│  WHAT I OFFER                                               │
│  ═══════════════════════════════════════════════════════    │
│                                                             │
│  🛠️ Things I'm Working On                                   │
│  • MeetingBot - AI meeting summaries [Try It]               │
│  • TaskAI Agent - AI task prioritization [Coming Soon]      │
│                                                             │
│  📚 Learn From Me                                           │
│  • "Build Your First AI Tool" - $49 [Enroll]                │
│  • "How I got 1000 users" - free post                       │
│                                                             │
│  🤝 Work With Me                                            │
│  • 1:1 Consulting - $200/hr [Book]                          │
│  • Landing page feedback - free [Request]                   │
│                                                             │
│  ❤️ Things I Love                                           │
│  • This Claude prompt guide is incredible                   │
│  • Best MCP tutorial I've found                             │
│                                                             │
│  ═══════════════════════════════════════════════════════    │
│  WHAT I NEED                                                │
│  ═══════════════════════════════════════════════════════    │
│                                                             │
│  • Beta testers for TaskAI [Open]                           │
│  • Technical co-founder [Open]                              │
│  • Want to learn prompt engineering [Open]                  │
│                                                             │
│  ═══════════════════════════════════════════════════════    │
│  RECENT ACTIVITY                                            │
│  ═══════════════════════════════════════════════════════    │
│                                                             │
│  • Helped @mike with landing page feedback - 2 days ago     │
│  • Posted "How MeetingBot hit 1000 users" - 1 week ago      │
│  • Shipped TaskAI v2.0 - 2 weeks ago                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Stats in header for immediate social proof
- Offers together, then Asks together (never interleaved)
- Asks are flat list (no subsections needed)
- Recent Activity at bottom shows the person is active

### 5.2 Offer Subsections (within "What I Offer")

Four subsections, auto-generated based on which offer types the user has:

| Subsection | Shows Offers Where | Icon |
|------------|-------------------|------|
| Things I'm Working On | `offer_type IN ('app')` | 🛠️ |
| Learn From Me | `offer_type IN ('course', 'template', 'post')` | 📚 |
| Work With Me | `offer_type IN ('service', 'mentorship', 'skill', 'feedback')` | 🤝 |
| Things I Love | `offer_type IN ('link')` | ❤️ |

**Notes:**
- "Things I'm Working On" = apps, agents, MCPs, games, ideas (finished or WIP)
- "Learn From Me" = courses, templates, posts (educational content)
- "Work With Me" = services, mentorship, quick help (ways to engage)
- "Things I Love" = curated links, recommendations (curation)
- Empty subsections are hidden automatically

### 5.3 Asks (within "What I Need")

Asks are displayed as a **flat list** (no subsections). Each ask shows:
- Title
- Type badge (beta testers, feedback, collaborator, etc.)
- Status (Open, In Progress, Fulfilled)

### 5.4 Follow System
- `Follow` model (follower → following relationship)
- Follow button on profiles
- Follower count display
- Following feed (later)

### 5.5 Files to Create/Modify
```
core/collective/models.py              # Add Follow model
frontend/src/components/profile/
  OffersSection.tsx                    # Container for all offer subsections
  AsksSection.tsx                      # Container for all ask subsections
  OfferSubsection.tsx                  # Reusable subsection (Apps, Courses, etc.)
  AskSubsection.tsx                    # Reusable subsection (Looking For, Learning)
frontend/src/utils/profileGrouping.ts  # Logic to group offers/asks by type
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

### 8.7 Dual Currency: Points + Credits

**Two Currency Types:**

| Currency | Earned By | Used For | Can Be Purchased |
|----------|-----------|----------|------------------|
| **Points** | Giving, helping, contributing | Status, badges, feature unlocks, leaderboards | NO (earned only) |
| **Credits** | Points conversion OR purchase | AI features (Ava, clips, course builder) | YES |

**Points → Credits Conversion (one-way):**
- 100 points = 10 credits (example rate)
- One-way conversion only (credits can't become points)
- Preserves points as "pure" generosity metric

**Credit Usage:**
| Feature | Cost |
|---------|------|
| Ava conversation session | 1 credit |
| Social Clip generation | 5 credits |
| Course Builder AI assist | 10 credits |
| Image generation | 2 credits |

**Credit Packs (Purchase):**
| Pack | Price | Credits | Bonus |
|------|-------|---------|-------|
| Starter | $5 | 100 | - |
| Builder | $20 | 500 | +25% |
| Creator | $50 | 1500 | +50% |

### 8.8 Peer Rewards (User-to-User)

**Gift Points:**
- Users can gift earned points to others
- "Thanks for the feedback! Here's 50 points"
- Creates peer economy of appreciation

**Gift Credits:**
- Users can gift credits to others
- Real value exchange for exceptional help

**Endorsements:**
- Public testimonials that show on profiles
- "Sarah gave me incredible feedback on my landing page"
- Builds social proof for givers

**Peer Badges:**
- Award badges to others after receiving help
- Categories: "Amazing Feedback", "Patient Teacher", "Quick Responder"
- Badges accumulate on profile

**Post-Connection UI:**
```
┌─────────────────────────────────────────┐
│  How was your experience with @sarah?   │
│                                         │
│  ⭐⭐⭐⭐⭐  (required rating)            │
│                                         │
│  Want to show extra appreciation?       │
│  [🎁 Gift Points] [💎 Gift Credits]     │
│  [🏆 Award Badge] [📝 Write Endorsement]│
│                                         │
└─────────────────────────────────────────┘
```

### 8.9 Unlockable Rewards (Earned by Giving)

**Visual Status (Point Thresholds):**
| Threshold | Reward |
|-----------|--------|
| 100 pts | Bronze avatar frame |
| 250 pts | Silver avatar frame |
| 500 pts | Gold avatar frame |
| 1000 pts | Diamond avatar frame + animated effects |

**Feature Unlocks:**
| Threshold | Feature |
|-----------|---------|
| 50 pts | Priority placement in Discover |
| 150 pts | Pin featured offers on profile |
| 300 pts | Analytics on your offers |
| 500 pts | Early access to new features |

**Social Access:**
| Threshold | Access |
|-----------|--------|
| 200 pts | Featured in "Top Helpers" |
| 400 pts | Invitation to Givers Circle |
| 600 pts | Ability to host community events |

### 8.10 The Virtuous Cycle

```
Give Help → Earn Points → Unlock Features / Convert to Credits → Use AI → Create Offers → Help More
     ↑                                                                                    │
     └────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** Generosity has real value. The more you give, the more AI power and platform features you unlock.

### 8.11 Generosity Economy Data Models

#### MODEL: CreditTransaction

> **Tracks all credit changes** - purchases, point conversions, usage, gifts

```python
class CreditTransaction(models.Model):
    """Every credit change is logged here"""
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credit_transactions')

    # Transaction details
    amount = models.IntegerField()  # Positive for additions, negative for usage
    transaction_type = models.CharField(max_length=20, choices=[
        ('purchase', 'Purchase'),           # Bought credit pack
        ('points_conversion', 'Points Conversion'),  # Converted points to credits
        ('gift_received', 'Gift Received'),  # Received from another user
        ('gift_sent', 'Gift Sent'),          # Sent to another user (negative)
        ('usage', 'Usage'),                  # Used for AI features (negative)
        ('refund', 'Refund'),                # Refunded credits
        ('bonus', 'Bonus'),                  # Platform bonus/promotion
    ])

    # Optional references
    related_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='related_credit_transactions')  # For gifts
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)  # For purchases
    points_converted = models.PositiveIntegerField(null=True, blank=True)  # For conversions

    # Context
    description = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # Feature used, etc.

    # Audit
    balance_after = models.PositiveIntegerField()  # Running balance
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type', '-created_at']),
        ]
```

#### MODEL: PointGift

> **Peer-to-peer point transfers**

```python
class PointGift(models.Model):
    """User gifting points to another user"""
    id = models.AutoField(primary_key=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='points_sent')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='points_received')

    amount = models.PositiveIntegerField()
    message = models.CharField(max_length=280, blank=True)  # Optional thank you note

    # Context (optional)
    connection = models.ForeignKey('collective.Connection', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='point_gifts')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['sender', '-created_at']),
            models.Index(fields=['recipient', '-created_at']),
        ]
```

#### MODEL: Endorsement

> **Public testimonials that show on profiles**

```python
class Endorsement(models.Model):
    """Public testimonial from one user to another"""
    id = models.AutoField(primary_key=True)
    endorser = models.ForeignKey(User, on_delete=models.CASCADE, related_name='endorsements_given')
    endorsee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='endorsements_received')

    content = models.TextField(max_length=500)  # "Sarah gave me incredible feedback..."

    # Context (optional)
    connection = models.ForeignKey('collective.Connection', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='endorsements')

    # Moderation
    is_approved = models.BooleanField(default=True)  # Auto-approve, moderate if flagged
    is_featured = models.BooleanField(default=False)  # Endorsee can pin on profile

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['endorsee', '-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['endorser', 'endorsee', 'connection'],
                name='unique_endorsement_per_connection'
            ),
        ]
```

#### MODEL: PeerBadge

> **Badges users can award to each other**

```python
class PeerBadgeType(models.Model):
    """Types of badges that can be awarded"""
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=50)  # "Amazing Feedback"
    description = models.CharField(max_length=200)
    icon = models.CharField(max_length=50)  # Emoji or icon class
    category = models.CharField(max_length=20, choices=[
        ('quality', 'Quality'),      # Amazing Feedback, Thorough Review
        ('speed', 'Speed'),          # Quick Responder, Fast Helper
        ('teaching', 'Teaching'),    # Patient Teacher, Great Explainer
        ('community', 'Community'),  # Welcoming, Supportive
    ])
    is_active = models.BooleanField(default=True)

class PeerBadgeAward(models.Model):
    """Instance of a badge being awarded"""
    id = models.AutoField(primary_key=True)
    badge_type = models.ForeignKey(PeerBadgeType, on_delete=models.CASCADE)
    awarder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges_awarded')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges_received')

    # Context
    connection = models.ForeignKey('collective.Connection', on_delete=models.SET_NULL,
                                    null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['badge_type', 'recipient']),
        ]
```

#### User Model Updates for Generosity Economy

Add to `core/users/models.py`:

```python
# Credits balance
credit_balance = models.PositiveIntegerField(default=0)

# Generosity metrics
points_gifted_total = models.PositiveIntegerField(default=0)  # Total points given away
credits_gifted_total = models.PositiveIntegerField(default=0)  # Total credits given away

# Unlockable status
avatar_frame = models.CharField(max_length=20, default='none', choices=[
    ('none', 'None'),
    ('bronze', 'Bronze'),
    ('silver', 'Silver'),
    ('gold', 'Gold'),
    ('diamond', 'Diamond'),
])

def add_credits(self, amount, transaction_type, description='', **kwargs):
    """Add credits with transaction logging"""
    from core.collective.models import CreditTransaction
    new_balance = self.credit_balance + amount
    CreditTransaction.objects.create(
        user=self,
        amount=amount,
        transaction_type=transaction_type,
        description=description,
        balance_after=new_balance,
        **kwargs
    )
    User.objects.filter(pk=self.pk).update(credit_balance=new_balance)
    self.refresh_from_db(fields=['credit_balance'])

def convert_points_to_credits(self, points_amount):
    """Convert points to credits (100 pts = 10 credits)"""
    if points_amount < 100:
        raise ValueError("Minimum 100 points required for conversion")
    if self.total_points < points_amount:
        raise ValueError("Insufficient points")

    credits = points_amount // 10  # 100 pts = 10 credits

    # Deduct points
    self.total_points -= points_amount
    self.save(update_fields=['total_points'])

    # Add credits
    self.add_credits(
        amount=credits,
        transaction_type='points_conversion',
        points_converted=points_amount,
        description=f'Converted {points_amount} points to {credits} credits'
    )
    return credits
```

#### Seed Data: PeerBadgeType

```python
PEER_BADGES = [
    {'slug': 'amazing-feedback', 'name': 'Amazing Feedback', 'icon': '🎯', 'category': 'quality'},
    {'slug': 'thorough-review', 'name': 'Thorough Review', 'icon': '🔍', 'category': 'quality'},
    {'slug': 'quick-responder', 'name': 'Quick Responder', 'icon': '⚡', 'category': 'speed'},
    {'slug': 'fast-helper', 'name': 'Fast Helper', 'icon': '🚀', 'category': 'speed'},
    {'slug': 'patient-teacher', 'name': 'Patient Teacher', 'icon': '🎓', 'category': 'teaching'},
    {'slug': 'great-explainer', 'name': 'Great Explainer', 'icon': '💡', 'category': 'teaching'},
    {'slug': 'welcoming', 'name': 'Welcoming', 'icon': '👋', 'category': 'community'},
    {'slug': 'supportive', 'name': 'Supportive', 'icon': '🤝', 'category': 'community'},
]
```

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

### 9.3 Agent Model (Extends AgentProfile)

> **Note:** The base `AgentProfile` model is defined in LEARNING PATH INTEGRATION section.
> Sprint 9 extends it with marketplace features.

```python
# Base model (from LEARNING PATH INTEGRATION, Sprint 2):
class AgentProfile(models.Model):
    """Links agent users to their human owners"""
    user = models.OneToOneField(User, on_delete=models.CASCADE,
                                  related_name='agent_profile',
                                  limit_choices_to={'role': 'agent'})
    owner = models.ForeignKey(User, on_delete=models.CASCADE,
                               related_name='owned_agents')
    created_at = models.DateTimeField(auto_now_add=True)

    # Sprint 9 additions (when ready):
    tagline = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    capabilities = models.JSONField(default=list)  # ['writing', 'research', 'coding']

    # Hosting
    hosting_type = models.CharField(max_length=20, choices=[
        ('platform', 'All Thrive Hosted'),
        ('self', 'Self-Hosted (BYOK)'),
    ], default='platform')
    api_key_encrypted = models.TextField(blank=True)  # For self-hosted

    # Pricing (payments go to owner's Stripe)
    is_free = models.BooleanField(default=True)
    price_per_message_cents = models.PositiveIntegerField(default=0)
    price_per_conversation_cents = models.PositiveIntegerField(default=0)

    # Status
    is_listed = models.BooleanField(default=False)  # Visible in marketplace
    is_active = models.BooleanField(default=True)
```

**Implementation Strategy:**
- Sprint 2: Create `AgentProfile` with just `user`, `owner`, `created_at`
- Sprint 9: Add marketplace fields via migration when ready

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
| `Quest` / `SideQuest` | PHASE_1: [DEPRECATED] | New points system | Phase 3 |

### Models to KEEP (Integrate, Not Deprecate)

| Model | Status | Integration |
|-------|--------|-------------|
| `Tool` | PHASE_1: [KEEP] | Curated resource directory. M2M with Offers/Asks. |
| `SavedLearningPath` | PHASE_1: [KEEP] | Course Publisher. Published paths become Offers. |
| `LearnerProfile` | PHASE_1: [KEEP] | Student progress tracking for enrolled courses. |
| `LessonProgress` | PHASE_1: [KEEP] | Per-lesson completion tracking. |

### What We Keep

| Feature | Why Keep |
|---------|----------|
| User model | Core identity, points, etc. |
| Stripe Connect | Payment infrastructure |
| Ava chat | Core feature, reuse components |
| URL scraper | Reuse for Offer import |
| Taxonomy | Reuse for categories |
| Community chat/messaging | Essential for Ask/Offer connections |
| **Tools Directory** | Curated resource library, M2M with Offers/Asks |
| **SavedLearningPath** | Course Publisher foundation. Expert courses as Offers. |
| **Sage** | @allierays's AI agent. Demonstrates agent ownership model. |

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
