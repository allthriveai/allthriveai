# Listing Implementation Phases

> **Approach:** Build inline editing first (the foundation), then layer agentic chat on top.

---

## Phase 1: Core Model + Basic CRUD ✅

**Goal:** Get the Listing model in place with API endpoints.

### Backend Tasks
- [x] Create `core/listings/` Django app
- [x] Listing model (core fields only):
  - Identity: `id`, `user`, `slug`
  - Content: `title`, `description`, `body`, `body_html`
  - Intent: `intent` (ask/offer)
  - Type: `listing_type` FK
  - Status: `status`, `visibility`, `is_archived`
  - Timestamps: `created_at`, `updated_at`, `published_at`
- [x] Add `listing_type` taxonomy seed data (28 types with hierarchy)
- [x] ListingSerializer (basic fields)
- [x] ListingViewSet with CRUD
- [x] URL routes: `/api/v1/listings/`
- [x] Permissions: owner can edit, anyone can view published

### Frontend Tasks
- [x] TypeScript types: `Listing`, `ListingIntent`, `ListingType`
- [x] API service: `listingApi.ts`
- [x] Basic ListingPage route: `/@username/:slug`

### Deliverable
Can create/read/update/delete listings via API. Basic page renders listing data.

---

## Phase 2: Full Inline Editing ✅

**Goal:** Complete inline editing for all fields, same UX as Projects.

### Backend Tasks
- [x] Add all remaining Listing fields:
  - Categorization: `category`, `tags`, `tools`
  - Media: `featured_image_url`, `banner_url`, `logo_url`, `media`
  - Pricing: `is_paid`, `price`, `pricing_type`, `currency`, `stripe_*`, `accepts_credits`, `credit_price`
  - Budget: `budget_min`, `budget_max`, `is_negotiable`
  - Availability: `is_available`, `capacity`, `response_time`
  - Timeline: `deadline`
  - Location: `location`, `timezone`
  - Requirements: `requirements`, `ideal_match`
  - Recurring: `is_recurring`, `recurrence_type`
  - Links: `external_url`, `source_url`
  - Ownership: `owner` (for agents)
- [x] Update ListingSerializer with all fields
- [x] Add taxonomy relationships (category, topics, tools M2M)

### Frontend Tasks
- [x] `ListingEditor.tsx` — Render props component (mirror ProjectEditor)
- [x] `ListingEditView.tsx` — Full edit UI composition
- [x] Inline editing for all fields:
  - [x] `InlineEditableTitle` for title
  - [x] `InlineEditableText` for description
  - [x] `EditableBlocksContainer` for body (rich content)
  - [x] Dropdown for intent, listing_type, category, status, visibility
  - [ ] TagInput for topics (UI ready, needs wiring)
  - [ ] ToolSelector for tools (UI ready, needs wiring)
  - [x] InlineEditableNumber for price
  - [ ] ImageUploader for media
  - [x] InlineEditableUrl for links
- [x] Conditional field display by listing_type (with intent-based rules)
- [x] Auto-save with 2000ms debounce
- [x] "Saving..." indicator and lastSaved timestamp
- [x] Read-only view for non-owners

### Deliverable
Full inline editing experience identical to Projects. All fields editable in place.

---

## Phase 3: Engagement & Social (Partial) 🟡

**Goal:** Add hearts, comments, saves, and engagement tracking.

### Backend Tasks
- [x] ListingHeart model (likes)
- [x] ListingSave model (clippings/bookmarks)
- [x] ListingComment model (with threading)
- [x] ListingView model (view tracking)
- [x] Add engagement count fields to Listing:
  - `heart_count`, `comment_count`, `share_count`, `save_count`, `view_count`
  - `connection_count`, `conversion_rate`
- [x] API endpoints:
  - POST `/api/v1/listings/:id/heart/`
  - POST `/api/v1/listings/:id/save/`
  - GET/POST `/api/v1/listings/:id/comments/`
- [ ] Signals to update count fields on heart/save/comment

### Frontend Tasks
- [x] Heart button component
- [x] Save/bookmark button
- [ ] Comments section with replies
- [ ] Engagement stats display
- [ ] Share functionality (reuse ShareModal)

### Deliverable
Users can like, save, comment on listings. Engagement metrics visible.

---

## Phase 4: Discovery & AI Matching

**Goal:** Weaviate integration for AI-powered discovery.

### Backend Tasks
- [ ] Add `weaviate_id` field to Listing
- [ ] Weaviate collection schema for Listings
- [ ] Sync on listing create/update:
  - Generate embedding from title + description + body
  - Store in Weaviate with metadata
- [ ] Search API endpoint: `/api/v1/listings/search/`
  - Natural language query
  - Returns similar listings
- [ ] Ask/Offer matching endpoint:
  - Given an Ask, find relevant Offers
  - Given an Offer, find relevant Asks

### Frontend Tasks
- [ ] Search bar with natural language input
- [ ] "Similar listings" section on listing page
- [ ] "Matching offers/asks" section

### Deliverable
AI-powered search and matching. "People who might help" suggestions.

---

## Phase 5: Agentic Chat Creation (Ava)

**Goal:** Create listings via conversation with Ava.

### Backend Tasks
- [ ] Ava tool: `create_listing`
  - Accepts: title, description, intent, listing_type, category
  - Creates draft listing
  - Returns listing URL
- [ ] Ava tool: `update_listing`
  - Accepts: listing_id, field updates
  - Patches listing
- [ ] Ava prompts for listing creation flow:
  - "What would you like to offer?"
  - "What do you need help with?"
  - Suggestion of listing_type, category, tools

### Frontend Tasks
- [ ] "Create Listing" button opens Ava chat
- [ ] Ava creation flow UX
- [ ] Seamless transition: Ava creates draft → user lands on edit view
- [ ] Ava suggestions during editing (floating helper)

### Deliverable
Full agentic creation flow. Users can describe what they want, Ava creates it.

---

## Phase 6: Profile Integration

**Goal:** Display listings on user profiles, replace Projects.

### Backend Tasks
- [ ] User profile endpoint includes listings
- [ ] Filter by intent: asks vs offers
- [ ] Sort by: recent, popular, featured

### Frontend Tasks
- [ ] Profile page: "Offers" section
- [ ] Profile page: "Asks" section
- [ ] ListingCard component for grid display
- [ ] Quick actions: edit, pause, archive

### Deliverable
User profiles showcase their offers and asks prominently.

---

## Phase 7: Version History

**Goal:** Track listing changes, allow restore.

### Backend Tasks
- [ ] ListingVersion model
- [ ] Create version on publish
- [ ] API endpoints:
  - GET `/api/v1/listings/:id/versions/`
  - POST `/api/v1/listings/:id/versions/:version_id/restore/`
- [ ] Limit to last 50 versions per listing

### Frontend Tasks
- [ ] Version history dropdown/modal
- [ ] Diff view between versions
- [ ] "Restore this version" button

### Deliverable
Users can view history and restore previous versions.

---

## Phase 8: Credits & Payments

**Goal:** Enable paid listings with Stripe and AllThrive credits.

### Backend Tasks
- [ ] Add `credit_balance` to User model
- [ ] CreditTransaction model
- [ ] Coupon model
- [ ] Stripe integration for paid listings:
  - Create product/price on first sale
  - Handle checkout session
  - Handle webhooks
- [ ] Credit purchase flow
- [ ] Credit spending flow

### Frontend Tasks
- [ ] Pricing display on listing cards/pages
- [ ] "Buy with Credits" option
- [ ] Checkout flow
- [ ] Credit balance display
- [ ] Purchase credits modal

### Deliverable
Paid listings work. Users can buy/earn/spend credits.

---

## Phase 9: Connections

**Goal:** Enable ask responses and offer inquiries.

### Backend Tasks
- [ ] Connection model (already exists, may need updates)
- [ ] Connection flow for asks:
  - "I can help" → creates connection
  - Status: initiated → discussing → accepted → completed
- [ ] Connection flow for offers:
  - "Inquire" or "Book" → creates connection
  - Payment integration for paid offers
- [ ] Notifications on connection events

### Frontend Tasks
- [ ] "I can help" / "Respond" button on asks
- [ ] "Inquire" / "Book" button on offers
- [ ] Connection status display
- [ ] Messaging integration

### Deliverable
Users can respond to asks, inquire about offers. Full connection lifecycle.

---

## Phase 10: Sunset Projects

**Goal:** Remove legacy Project system.

### Tasks
- [ ] Hide Project UI completely
- [ ] Remove Project routes
- [ ] Keep Project model/data temporarily (backup)
- [ ] Notify beta users about migration
- [ ] After confirmation, delete Project model code

### Deliverable
Clean codebase. Everything is Listings.

---

## Implementation Order Summary

| Phase | Focus | Dependencies |
|-------|-------|--------------|
| 1 | Core Model | None |
| 2 | Inline Editing | Phase 1 |
| 3 | Engagement | Phase 1 |
| 4 | AI Matching | Phase 1 |
| 5 | Ava Chat | Phase 2 |
| 6 | Profiles | Phase 2, 3 |
| 7 | Versions | Phase 2 |
| 8 | Payments | Phase 1 |
| 9 | Connections | Phase 3, 8 |
| 10 | Sunset | All |

---

## Quick Wins (Can Start Now)

These don't depend on Listing model:

1. **Seed `listing_type` taxonomy** — Get the 16 types into the database ✅
2. **TypeScript types** — Define `Listing` interface ✅
3. **Study ProjectEditor** — Document patterns to replicate ✅

---

## Starting Point

**Phase 1 + 2 together** — Build model with all fields, then immediately build inline editing. This gives us a complete vertical slice. ✅

Estimate: ~2-3 focused coding sessions for backend, ~3-4 for frontend with inline editing.

---

## Bonus: Agent Ownership System ✅

Added outside original plan:

- [x] `owned_by` field on User model (agent→human relationship)
- [x] `agent` tier for AI agent users
- [x] Signal to auto-create agent User when agent listing is published
- [x] Agent badge and ownership display on ProfileHeader
- [x] MyAgentsSection component for human profiles
- [x] MCP Server listing type under Project category
