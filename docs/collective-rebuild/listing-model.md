# Data Model: Unified Listing Model

> **Goal:** One flexible model that handles asks, offers, projects, agents, courses, and more.

---

## Decision: Single "Listing" Model

Everything is a Listing. Type-specific behavior via taxonomy and conditional fields.

---

## Listing Model Fields

### Identity
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `user` | FK(User) | yes | Creator of the listing |
| `slug` | SlugField | yes | URL-safe, unique per user |

### Core Content
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | CharField(200) | yes | Display name |
| `description` | TextField | yes | Short description / pitch |
| `body` | TextField | no | Rich content (markdown) |
| `body_html` | TextField | no | Rendered HTML (cached) |

### Intent (Ask or Offer)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intent` | CharField | yes | `ask` or `offer` (TextChoices enum) |

### Listing Type (What kind of thing?)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `listing_type` | FK(Taxonomy) | yes | project, article, course, download, service, mentorship, agent, skill, feedback... |

### Categorization
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | FK(Taxonomy) | no | Marketing, Development, Creative, etc. |
| `tags` | M2M(Taxonomy) | no | Additional tags |
| `tools` | M2M(Tool) | no | Tools used or needed |

### Ownership (for agents)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `owner` | FK(User) | no | Human owner (required if listing_type=agent) |

### Multimedia
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `featured_image_url` | URLField | no | Hero image |
| `banner_url` | URLField | no | Banner for profile display |
| `logo_url` | URLField | no | Logo (for projects/agents) |
| `media` | JSONField | no | Array of {type, url, caption, order} |

### Pricing
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_paid` | Boolean | yes | Free or paid? Default: False |
| `price` | DecimalField(10,2) | no | Price in dollars (49.00 = $49) — Stripe uses this directly |
| `pricing_type` | CharField | no | free, one_time, hourly, monthly, custom |
| `currency` | CharField(3) | no | USD, EUR, etc. Default: USD |
| `stripe_product_id` | CharField | no | For Stripe integration (created on first sale) |
| `stripe_price_id` | CharField | no | For Stripe integration (created on first sale) |
| `accepts_credits` | Boolean | no | Can pay with AllThrive credits? Default: True |
| `credit_price` | Integer | no | Price in credits (if different from USD conversion) |

*Note: Using DecimalField for price avoids cents conversion complexity. Stripe API accepts dollar amounts and converts internally.*

### External Links
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_url` | URLField | no | Try it / Visit link |
| `source_url` | URLField | no | GitHub, GitLab, etc. |

### Sharing
Reuse existing ShareModal component which provides all share options:
- Twitter/X
- LinkedIn
- Facebook
- Reddit
- Email
- Copy Link
- AI Context Export (claude.md, project.json)

No additional fields needed on the Listing model — sharing is handled client-side via the existing ShareModal.

### Publishing & Status
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | CharField | yes | draft, scheduled, published, paused, fulfilled, archived |
| `visibility` | CharField | yes | public, unlisted, private. Default: public |
| `scheduled_publish_at` | DateTime | no | When to auto-publish (if status=scheduled) |
| `is_featured` | Boolean | no | Admin-promoted |
| `is_archived` | Boolean | no | Soft delete |
| `version` | Integer | yes | Current version number. Default: 1 |

### Relationships
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parent` | FK(self) | no | Parent listing (ask belongs to project) |

### Engagement & Social
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `heart_count` | Integer | no | Total likes. Default: 0 |
| `comment_count` | Integer | no | Total comments. Default: 0 |
| `share_count` | Integer | no | Total shares. Default: 0 |
| `save_count` | Integer | no | Total saves/clippings. Default: 0 |
| `view_count` | Integer | no | Total views. Default: 0 |
| `connection_count` | Integer | no | Total connections/responses. Default: 0 |
| `conversion_rate` | DecimalField(5,2) | no | Connections / views (computed, cached) |

### Discovery & AI Matching
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `weaviate_id` | CharField | no | UUID reference to Weaviate vector (same pattern as Games) |

*Note: Embeddings stored in Weaviate, not PostgreSQL. On listing create/update, sync to Weaviate collection.*

### Availability & Capacity (for Services/Mentorship)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_available` | Boolean | yes | Currently accepting? Default: True |
| `capacity` | Integer | no | Max concurrent (e.g., "3 mentees max") |
| `response_time` | CharField | no | "Usually responds in 24 hours" |

### Timeline (for Asks)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deadline` | DateField | no | "Need this by X date" |

### Location & Timezone (for Services/Mentorship)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location` | CharField | no | Remote / City / Country |
| `timezone` | CharField | no | User's timezone for scheduling |

### Budget (for Asks)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `budget_min` | DecimalField(10,2) | no | Minimum budget in dollars |
| `budget_max` | DecimalField(10,2) | no | Maximum budget in dollars |
| `is_negotiable` | Boolean | no | Price/budget negotiable? Default: False |

### Requirements & Matching
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requirements` | TextField | no | What you need from responders |
| `ideal_match` | TextField | no | Description of ideal person to connect with |

### Recurring (for Services/Mentorship)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_recurring` | Boolean | no | One-time or ongoing? Default: False |
| `recurrence_type` | CharField | no | weekly, monthly, as_needed |

### Timestamps
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created_at` | DateTime | auto | |
| `updated_at` | DateTime | auto | |
| `published_at` | DateTime | no | When made public |

---

## Taxonomy Strategy

### Reuse from Existing Project System
The codebase already has a robust Taxonomy model. Reuse:

| Taxonomy Type | Use on Listing | Relationship |
|---------------|----------------|--------------|
| `category` | Yes — 16 categories | M2M |
| `topic` | Yes — 35 topics | M2M |
| `content_type` | Yes | FK |
| `time_investment` | Yes — for courses | FK |
| `difficulty` | Yes | FK |
| `pricing` | Maybe — or use price_cents | FK |

Also reuse **Tool model** (M2M) for "Built with" / "Need help with" badges.

### New Taxonomy Type: `listing_type`

Add to existing Taxonomy model:

| Slug | Name | Intent | Has Pricing? | Notes |
|------|------|--------|--------------|-------|
| **Offers (things you provide)** |
| `project` | Project/App | offer | Optional | Showcase, can have child asks/offers |
| `article` | Article/Post | offer | No | Blog post, essay |
| `course` | Course | offer | Yes | Educational content |
| `download` | Digital Download | offer | Yes | Template, resource |
| `service` | Consulting Service | offer | Yes | Paid services |
| `mentorship` | Mentorship | offer | Yes | Ongoing guidance |
| `agent` | AI Agent | offer | Yes | Requires owner FK |
| `skill` | Skill/Expertise | offer | Optional | "I can help with X" |
| `feedback_capacity` | Feedback Capacity | offer | No | "I'll review your stuff" |
| **Asks (things you need)** |
| `beta_testers` | Beta Testers Needed | ask | No | |
| `feedback_request` | Feedback Request | ask | No | |
| `collaborator` | Collaborator Needed | ask | No | Co-founder, partner |
| `advice` | Advice Needed | ask | No | |
| `learning_goal` | Learning Goal | ask | No | "I want to learn X" |
| `hiring` | Hiring | ask | Yes (budget) | Job posting |
| `introduction` | Introduction Request | ask | No | "Looking for intro to X" |

### Intent Field

Use single `intent` field with TextChoices:

```python
class ListingIntent(models.TextChoices):
    ASK = 'ask', 'Ask'
    OFFER = 'offer', 'Offer'
```

Could also infer from `listing_type` taxonomy, but explicit is clearer.

### Updated Listing Categorization Fields

| Field | Type | Description |
|-------|------|-------------|
| `intent` | CharField | 'ask' or 'offer' |
| `listing_type` | FK(Taxonomy) | Type from listing_type taxonomy |
| `category` | FK(Taxonomy) | Primary category (reuse existing 16) |
| `topics` | M2M(Taxonomy) | Free-flowing topics (reuse existing 35) |
| `tools` | M2M(Tool) | AI tools used or needed |
| `difficulty` | FK(Taxonomy) | Beginner/intermediate/advanced |
| `time_investment` | FK(Taxonomy) | For courses: quick/short/medium/deep-dive |
| `tags` | M2M(Taxonomy) | Additional skill/interest tags |

---

## Existing Project Categories (16)

| Slug | Name | Color |
|------|------|-------|
| ai-agents | AI Agents & Multi-Tool Systems | emerald |
| ai-models | AI Models & Research | tanzanite |
| audio | Audio & Multimodal | rose-quartz |
| chatbots | Chatbots & Conversation | sapphire |
| data | Data & Analytics | amethyst |
| design | Design (Mockups & UI) | morganite |
| developer | Developer & Coding | jade |
| games | Games & Interactive | ruby |
| images-video | Images & Video | topaz |
| podcasts | Podcasts & Education | peridot |
| websites | Websites & Apps | sapphire |
| workflows | Workflows & Automation | jade |
| productivity | Productivity | emerald |
| prompts | Prompt Collections & Templates | tanzanite |
| thought-experiments | Thought Experiments | amethyst |
| wellness | Wellness & Personal Growth | rose-quartz |

---

## Ask ↔ Offer Mapping

How asks and offers relate — what matches when someone responds.

### Direct Matches

| Ask Type | Matching Offer Types | What Happens |
|----------|---------------------|--------------|
| beta_testers | project, agent | User offers to test the thing |
| feedback_request | skill, feedback_capacity | User offers feedback/review |
| collaborator | skill | User offers to partner up |
| advice | service, mentorship, skill | User offers guidance |
| learning_goal | course, mentorship | User offers to teach |
| hiring | service, skill | User applies for the role |
| introduction | skill | User offers to make an intro |

### Connection Flow (Ask Response)

1. User A posts Ask: "Need beta testers for my AI app"
2. User B sees Ask, clicks "I can help"
3. Connection created: User B → User A's Ask
4. Initial message sent
5. Status: initiated → discussing → accepted → completed
6. Both rate at completion

### Connection Flow (Offer Inquiry)

1. User A posts Offer: "1:1 AI Strategy - $200/hr"
2. User B sees Offer, clicks "Book" or "Inquire"
3. Connection created: User B → User A's Offer
4. If paid: payment flow
5. Status: initiated → discussing → accepted → in_progress → completed

### Parent-Child Relationships

A Project can have attached Asks and Offers:

```
Project: "Kinlia - AI customer onboarding"
├── Ask: "Need beta testers" (parent = project)
├── Ask: "Looking for technical co-founder" (parent = project)
└── Offer: "Onboarding strategy consulting" (parent = project)
```

When someone responds to the Ask, they see the parent Project context.

---

## Conditional Logic by Type

### If `listing_type` = agent:
- `owner` required (FK to human User)
- Shows "Made by @owner" on card
- Gets own profile page at `/@agent-slug`

### If `listing_type` = project:
- Can have child listings (asks/offers attached)
- Shows rich media gallery
- Shows tools used

### If `listing_type` in (course, download, service, mentorship):
- `is_paid` typically True
- Shows pricing UI
- Connects to Stripe

### If `intent` = ask:
- Status options: open, in_progress, fulfilled, closed
- Shows "Help wanted" styling
- Can have budget range instead of fixed price

### If `intent` = offer:
- Status options: draft, active, paused, archived
- Shows "Available" styling
- Fixed pricing or hourly/monthly

---

## Status Values by Intent

### Ask statuses:
- `open` — Accepting responses
- `in_progress` — Working with someone
- `fulfilled` — Got what was needed
- `closed` — No longer needed

### Offer statuses:
- `draft` — Not visible
- `active` — Visible and accepting
- `paused` — Temporarily unavailable
- `archived` — Soft deleted

---

## Coupon Model

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `code` | CharField | yes | Unique coupon code (e.g., "LAUNCH50") |
| `creator` | FK(User) | no | Who created it (null = platform-wide) |
| `listing` | FK(Listing) | no | Specific listing (null = all listings by creator) |
| `discount_type` | CharField | yes | percent, fixed_amount, credits |
| `discount_value` | Integer | yes | 50 = 50% or 5000 = $50 or 500 credits |
| `min_purchase_cents` | Integer | no | Minimum purchase to apply |
| `max_uses` | Integer | no | Total uses allowed (null = unlimited) |
| `max_uses_per_user` | Integer | no | Uses per user (null = unlimited) |
| `uses_count` | Integer | yes | Current uses. Default: 0 |
| `valid_from` | DateTime | no | Start date |
| `valid_until` | DateTime | no | Expiration date |
| `is_active` | Boolean | yes | Can be used? Default: True |
| `created_at` | DateTime | auto | |

---

## AllThrive Credits System

### User Credit Balance
Add to User model:
| Field | Type | Description |
|-------|------|-------------|
| `credit_balance` | Integer | Current credits. Default: 0 |

### CreditTransaction Model
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `user` | FK(User) | yes | User account |
| `amount` | Integer | yes | Credits (positive = add, negative = spend) |
| `balance_after` | Integer | yes | Balance after transaction |
| `transaction_type` | CharField | yes | purchase, spend, reward, refund, gift, promo |
| `description` | CharField | yes | "Purchased 500 credits", "Bought Course X" |
| `listing` | FK(Listing) | no | If spent on a listing |
| `stripe_payment_id` | CharField | no | If credits were purchased |
| `created_at` | DateTime | auto | |

### Credit Value
**1 credit = $1 USD**

### Credit Packs (for purchase)
| Pack | Credits | Price | Savings |
|------|---------|-------|---------|
| Starter | 10 | $10 | — |
| Popular | 50 | $45 | 10% off |
| Pro | 100 | $80 | 20% off |

### Earning Credits
- Complete onboarding: +50 credits
- First listing published: +25 credits
- Help someone (connection completed): +10 credits
- Referral signs up: +100 credits
- Purchase packs

---

## ListingSave Model (Clippings/Bookmarks)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `user` | FK(User) | yes | Who saved it |
| `listing` | FK(Listing) | yes | What was saved |
| `note` | TextField | no | Personal note about why saved |
| `created_at` | DateTime | auto | |

**Unique constraint**: `(user, listing)` — one save per user per listing.

---

## ListingHeart Model (Likes)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `user` | FK(User) | yes | Who liked it |
| `listing` | FK(Listing) | yes | What was liked |
| `created_at` | DateTime | auto | |

**Unique constraint**: `(user, listing)` — one like per user per listing.

---

## ListingComment Model

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `user` | FK(User) | yes | Who commented |
| `listing` | FK(Listing) | yes | On what listing |
| `parent` | FK(self) | no | Reply to comment (threading) |
| `body` | TextField | yes | Comment text |
| `is_edited` | Boolean | no | Was it edited? Default: False |
| `is_deleted` | Boolean | no | Soft delete. Default: False |
| `created_at` | DateTime | auto | |
| `updated_at` | DateTime | auto | |

---

## ListingVersion Model (Version History)

Separate model to track revisions. Created on each save/publish.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | auto | Primary key |
| `listing` | FK(Listing) | yes | Parent listing |
| `version` | Integer | yes | Version number (1, 2, 3...) |
| `title` | CharField | yes | Title at this version |
| `description` | TextField | yes | Description at this version |
| `body` | TextField | no | Body content at this version |
| `data` | JSONField | no | Snapshot of other fields |
| `change_summary` | CharField | no | "Updated pricing" / auto-generated |
| `created_by` | FK(User) | yes | Who made this edit |
| `created_at` | DateTime | auto | When this version was saved |

### Version History Behavior
- New version created on **publish** (not every save)
- Optional: create version on significant draft changes
- Users can view past versions
- Users can revert to a previous version (creates new version with old content)
- Keep last N versions (e.g., 50) to limit storage

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Ask/Offer field | Single `intent` CharField with TextChoices enum |
| Pricing field | DecimalField for dollars (not cents) — Stripe handles conversion |
| Share options | Reuse existing ShareModal — no model fields needed |
| Parent relationship | Self-referential FK (`parent`) for simplicity |
| Projects | **SUNSET** — Everything becomes a Listing. Migrate existing Projects to Listings. |
| Ava scope | All listings via Ava — unified agentic creation for all types |
| Vector DB | Weaviate (same pattern as Games) |

---

## Editing UX: Agentic Chat + Full Inline Editing

### Philosophy
Listings should feel **agentic** — start with chat-based creation via Ava, then seamlessly transition to full inline editing. Same UX pattern as current Projects.

### Creation Flow (Agentic Chat)
1. User clicks "Create Listing" or "Post an Ask/Offer"
2. Ava opens in chat drawer and guides through creation:
   - "What would you like to offer?" / "What do you need help with?"
   - Ava extracts: title, description, intent, listing_type, category
   - Ava suggests: tools, topics, pricing (if applicable)
3. Ava creates draft listing via API
4. User lands on listing page in **edit mode** for refinement

### Inline Editing (Reuse Project Patterns)
Reuse existing infrastructure from ProjectEditor:

| Component | Reuse From | Purpose |
|-----------|-----------|---------|
| `InlineEditableTitle` | `InlineEditable.tsx` | Click-to-edit title |
| `InlineEditableText` | `InlineEditable.tsx` | Click-to-edit description |
| `useInlineEditable` | `hooks/useInlineEditable.ts` | Enter/Escape/blur handling |
| `EditableContentBlock` | `shared/EditableContentBlock.tsx` | Rich body content blocks |
| `EditableBlocksContainer` | `shared/EditableBlocksContainer.tsx` | Block reordering |
| `ShareModal` | `components/ShareModal.tsx` | All share options |

### Auto-Save Behavior
- Debounce: 2000ms (same as Projects)
- Shows "Saving..." indicator
- Shows `lastSaved` timestamp
- No manual save button needed

### ListingEditor Component Structure
```
<ListingEditor listing={listing} onUpdate={handleUpdate}>
  {(editorProps) => (
    <ListingEditView {...editorProps} />
  )}
</ListingEditor>
```

**editorProps provides:**
- `listing` — current listing data
- `setTitle`, `setDescription`, `setBody` — field setters
- `setIntent`, `setListingType`, `setCategory` — taxonomy setters
- `setPrice`, `setPricingType` — pricing setters
- `setTools`, `setTopics` — M2M setters
- `hasUnsavedChanges`, `isSaving`, `lastSaved` — save state
- `isOwner` — permission check

### Editable Fields (All Inline)
| Field | Edit Component | Notes |
|-------|----------------|-------|
| `title` | InlineEditableTitle | Click-to-edit, Enter saves |
| `description` | InlineEditableText | Click-to-edit, multiline |
| `body` | EditableBlocksContainer | Block-based rich content |
| `intent` | Dropdown/Toggle | Ask ↔ Offer switch |
| `listing_type` | Dropdown | Type selector |
| `category` | Dropdown | Category picker |
| `topics` | TagInput | Multi-select tags |
| `tools` | ToolSelector | Multi-select with icons |
| `price` | InlineEditableNumber | Shows currency symbol |
| `pricing_type` | Dropdown | free/one_time/hourly/monthly |
| `external_url` | InlineEditableUrl | Click-to-edit URL |
| `source_url` | InlineEditableUrl | GitHub/GitLab link |
| `featured_image_url` | ImageUploader | Drag-drop or URL |
| `banner_url` | ImageUploader | Hero banner |
| `status` | StatusDropdown | draft/published/paused |
| `visibility` | VisibilityDropdown | public/unlisted/private |

### Conditional Fields by Type & Intent

Fields are organized into **field groups** that show/hide based on listing type and intent.

#### Field Groups

| Group | Fields | When Shown |
|-------|--------|------------|
| **Core** | title, description, body, intent, listing_type, category, topics, tools | Always |
| **Media** | featured_image_url, banner_url, logo_url, media | All except simple asks |
| **Pricing (Fixed)** | is_paid, price, pricing_type, currency, stripe_*, accepts_credits, credit_price, is_negotiable | Offers with pricing (course, download, service, mentorship, agent) |
| **Budget (Range)** | budget_min, budget_max, is_negotiable | Asks only (hiring, collaborator) |
| **Availability** | is_available, capacity, response_time | service, mentorship, skill, feedback_capacity |
| **Timeline** | deadline | Asks only |
| **Location** | location, timezone | service, mentorship (optional) |
| **Recurring** | is_recurring, recurrence_type | service, mentorship |
| **Requirements** | requirements, ideal_match | All types (optional, collapsed by default) |
| **Ownership** | owner | agent only |
| **Publishing** | status, visibility, scheduled_publish_at | Always |
| **Links** | external_url, source_url | project, agent, download |
| **Engagement** | heart_count, comment_count, etc. | Read-only, computed |
| **AI** | weaviate_id | Backend only, not editable |

#### Conditional Display Matrix

| listing_type | Intent | Field Groups Shown |
|--------------|--------|-------------------|
| `project` | offer | Core, Media, Links, Publishing, Requirements |
| `article` | offer | Core, Media, Publishing |
| `course` | offer | Core, Media, Pricing, Publishing, Requirements |
| `download` | offer | Core, Media, Pricing, Links, Publishing |
| `service` | offer | Core, Media, Pricing, Availability, Location, Recurring, Publishing, Requirements |
| `mentorship` | offer | Core, Media, Pricing, Availability, Location, Recurring, Publishing, Requirements |
| `agent` | offer | Core, Media, Pricing, Ownership, Links, Publishing |
| `skill` | offer | Core, Availability, Publishing, Requirements |
| `feedback_capacity` | offer | Core, Availability, Publishing |
| `beta_testers` | ask | Core, Timeline, Publishing, Requirements |
| `feedback_request` | ask | Core, Timeline, Publishing, Requirements |
| `collaborator` | ask | Core, Budget, Timeline, Publishing, Requirements |
| `advice` | ask | Core, Timeline, Publishing, Requirements |
| `learning_goal` | ask | Core, Timeline, Publishing, Requirements |
| `hiring` | ask | Core, Budget, Location, Timeline, Publishing, Requirements |
| `introduction` | ask | Core, Timeline, Publishing, Requirements |

#### UI Behavior
- **Collapsed sections**: Requirements, Location shown collapsed by default (expand to edit)
- **Progressive disclosure**: Start with Core fields, reveal more as user selects type
- **Smart defaults**: Set reasonable defaults based on type (e.g., `is_recurring=True` for mentorship)

### Read-Only View
When `!isOwner`:
- All inline editors render as static text
- No pencil icons on hover
- No edit affordances
- Still shows share button, connect/inquire CTA

---

## Critical Files to Modify/Create

### Backend (Django)
| File | Action |
|------|--------|
| `core/listings/models.py` | **CREATE** — Listing, ListingVersion, ListingSave, ListingHeart, ListingComment, Coupon, CreditTransaction |
| `core/listings/serializers.py` | **CREATE** — ListingSerializer, ListingVersionSerializer |
| `core/listings/views.py` | **CREATE** — ListingViewSet with CRUD |
| `core/listings/urls.py` | **CREATE** — `/api/v1/listings/` routes |
| `core/users/models.py` | **MODIFY** — Add `credit_balance` field |
| `core/taxonomies/fixtures/` | **MODIFY** — Add `listing_type` taxonomy seed data |

### Frontend (React/TypeScript)
| File | Action |
|------|--------|
| `frontend/src/types/listings.ts` | **CREATE** — Listing, ListingIntent types |
| `frontend/src/services/listingApi.ts` | **CREATE** — API service for listings |
| `frontend/src/components/listings/ListingEditor.tsx` | **CREATE** — Render props editor (mirror ProjectEditor) |
| `frontend/src/components/listings/ListingEditView.tsx` | **CREATE** — Edit UI composition |
| `frontend/src/components/listings/ListingCard.tsx` | **CREATE** — Card display for feeds |
| `frontend/src/components/listings/ListingDetailPage.tsx` | **CREATE** — Full listing view |
| `frontend/src/hooks/useListingEditor.ts` | **CREATE** — Editor state hook |
| `frontend/src/pages/ListingPage.tsx` | **CREATE** — Route: `/@username/listing-slug` |

### Reuse Unchanged
- `InlineEditable.tsx` — no changes needed
- `EditableContentBlock.tsx` — no changes needed
- `ShareModal.tsx` — no changes needed
- `useInlineEditable.ts` — no changes needed

---

## Project → Listing Migration

**Strategy: Manual Re-onboard (Fresh Start)**

Since there are only 16 beta users, we're doing a clean break:

1. **Build Listing model** — New `core/listings/` app
2. **Hide old Projects** — Keep Project model temporarily but hide from UI
3. **Re-onboard users** — Invite beta users to recreate content as Listings via Ava
4. **Delete Project model** — After all users migrated, remove Project code entirely

No migration script needed. Clean slate for the new Collective.

---

## Next Steps

1. Create `core/listings/` Django app with Listing model
2. Add `listing_type` taxonomy seed data
3. Create ListingSerializer with all fields
4. Create ListingViewSet with permissions
5. Create frontend TypeScript types
6. Build ListingEditor component (adapting ProjectEditor patterns)
7. Build ListingEditView with all inline fields
8. Integrate Ava chat for agentic creation flow
9. Add routes and navigation
10. Hide old Project UI (keep model temporarily)
