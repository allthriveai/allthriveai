# User Profile Projects & Masonry Showcase

## Overview

The user profile is the central place where a user consolidates and showcases all of their AI projects. Each project can appear in two contexts:

1. **Highlighted Showcase** – a curated masonry grid at the top of the profile, ideal for "hero" projects.
2. **Playground Area** – a broader, possibly denser masonry grid for all projects, experiments, and drafts.

We want this experience to feel agentic and automated: the system should help the user ingest and structure projects from links (Midjourney, ChatGPT, GitHub, etc.) while still allowing full manual control.

All projects must always be isolated to the authenticated user ID, and **each project must have its own unique URL of the form**:

> `allthrive.ai/{username}/{project-slug}`

---

## Data Model & URLs (High-Level)

### Users (Existing)
We already have a custom Django `User` model defined in `core/user_models.py` and exposed via `core/models.py`, plus a matching `User` type on the frontend.

**Backend `User` model (simplified):**
- Inherits from `AbstractUser` (username, email, first_name, last_name, password, etc.).
- `role: UserRole` – `explorer | expert | mentor | patron | admin`.
- `avatar_url: URLField` – profile image.
- `bio: TextField` – profile bio.
- `ordering = ['-date_joined']`.

We will re-use the existing `username` field as the public identifier in URLs:

- Profile URL: `/{username}`.
- Project URL: `/{username}/{project-slug}`.

On the frontend, the `User` interface in `frontend/src/types/models.ts` (and the `ProfileCenter` component in `frontend/src/components/profile/ProfileCenter.tsx`) already consume this structure. The plan below focuses on adding projects and URLs on top of this, not redefining users.

### Projects

**Table: `projects`**
- `id` (UUID/primary key)
- `user_id` (foreign key → `users.id`)
- `slug` (string)
- `title`
- `description`
- `type` (enum: `github_repo`, `image_collection`, `prompt`, `other`)
- `is_showcase` (boolean)
- `is_archived` (boolean)
- `thumbnail_url` (nullable)
- `created_at`, `updated_at`

**Constraints**
- `UNIQUE (user_id, slug)`
- `slug` must be URL-safe (lowercase, alphanumeric + dashes, no spaces).

**Table: `project_sources`** (optional but recommended for flexibility)
- `id`
- `project_id` (foreign key → `projects.id`)
- `source_type` (enum: `github`, `midjourney`, `chatgpt`, `custom`)
- `source_url`
- `metadata` (JSONB) – source-specific fields (e.g. repo stats, image hashes, prompt text references).

**Isolation Requirements**
- All queries must filter on `user_id` on the backend.
- No project can be created or updated without a valid authenticated `user_id`.
- The client must never be allowed to change `user_id` directly (only the server binds `user_id` from the auth context).

### Slug Generation Strategy

We need a consistent and collision-safe way to produce `project-slug` values for URLs.

1. **Base slug from title or source**
   - Manual projects: generate from `title` (e.g. "My Cool Agent" → `"my-cool-agent"`).
   - Link-based projects:
     - GitHub: generate from repo name.
     - Midjourney: generate from collection or prompt label.
     - ChatGPT: generate from the main prompt title or the first few words.

2. **Collision handling (per-user)**
   - Check if `(user_id, slug)` already exists.
   - If yes, append numeric suffixes: `slug`, `slug-2`, `slug-3`, etc.

3. **User overrides (later)**
   - Allow the user to edit the slug in project settings.
   - On change, enforce that `(user_id, slug)` is still unique.

### Project Layout & Blocks (Portfolio-style)

Each project page at `/{username}/{project-slug}` is rendered from a structured "project document" rather than just flat fields.

**Core layout (default template):**
- **Cover image** – large hero visual at the top.
- **Project title** – directly under or overlaid on the cover image.
- **Tags row** – a strip of chips under the title.
- **Body blocks** – an ordered mix of text and images that reads like a polished portfolio or case study.

**Suggested document shape:**
- `coverImage: { url, alt }`
- `title: string`
- `slug: string`
- `tags: string[]`
- `blocks: Array<
    { type: 'text', style: 'body' | 'heading' | 'quote', content: string } |
    { type: 'image', url: string, caption?: string } |
    { type: 'imageGrid', images: Array<{ url: string, caption?: string }>, caption?: string }
  >`

This structure can live directly in the `projects` table (JSONB) or in a related `project_content`/`project_blocks` table, but the important part is that these blocks are **reorderable** and support drag-and-drop in the UI.

### One-shot Project Creation Philosophy

The creation flow should ask the user as little as possible:

- Initial prompt: **“Drop a link or images to start your project.”**
- From the link/images, the system:
  - Infers a title, picks a cover image, and generates tags.
  - Builds an initial set of blocks (overview text, image grid, additional sections).
- The user then refines via:
  - Drag-and-drop of blocks and images.
  - Inline edits to title, tags, and text.
  - Optional chat prompts for rewriting or retagging.

---

## Phased Implementation Plan

This section breaks the work into phases so we can ship, test, and refine after each step.

### Phase 1 – Data & URL Foundation

**Goal:** Have a solid backend model where projects are strictly scoped to a user and each project has a stable URL: `/{username}/{project-slug}`.

**Build:**

- **Data model**
  - `projects` table/model:
    - `id`, `user_id`, `title`, `description`, `type`, `is_showcase`, `is_archived`, `thumbnail_url`, `slug`, timestamps.
  - Constraint: `UNIQUE (user_id, slug)` so URLs are unique per user.
- **Slugging**
  - Function to generate URL-safe slugs from titles/source (lowercase, `-` separated).
  - Per-user collision handling (`slug`, `slug-2`, `slug-3`, …).
- **Auth & isolation**
  - Ensure all project CRUD operations derive `user_id` from auth context (never from the client).
  - Every query filters by `user_id`.
- **APIs (backend only for now)**
  - `POST /api/v1/projects` – create project (manual or link mode, but link can be a no-op stub).
  - `GET /api/v1/projects` – list projects for current user.
  - `GET /api/v1/projects/:id` – fetch single project (internal detail).
  - `PATCH /api/v1/projects/:id`, `DELETE /api/v1/projects/:id`.

**Test & refine:**

- Unit tests for slug generation & uniqueness.
- Access control tests: user A cannot see/update user B’s projects.
- Verify that the API can create/list projects without any UI yet.
- Adjust field names, enums, and slug rules before they leak into the UI.

---

### Phase 2 – Basic Profile & Project Detail Pages (Manual Only)

**Goal:** A simple, non-agentic experience where a user can create projects manually and view them at their unique URLs, building on the existing profile UI and auth.

**What already exists:**
- Django auth with the custom `User` model and `/auth/me/` endpoint consumed by `frontend/src/services/auth.ts`.
- A profile center component at `frontend/src/components/profile/ProfileCenter.tsx` that:
  - Shows the profile header (avatar, name, bio).
  - Provides tabs for `Showcase`, `Playground`, and `Settings`.
  - Currently shows placeholder content (no real projects yet).

**Build on top of this:**

- **Routing**
  - Profile page route (e.g. `/[username]`), using the existing profile layout.
  - Project detail route: `/[username]/[projectSlug]`.
    - Backend: resolve project by `(username → user_id, slug)` or via an internal lookup.

- **APIs**
  - `GET /api/v1/projects` – list projects for the authenticated user.
  - `POST /api/v1/projects` – create a new project.
  - `GET /api/v1/projects/:id` – fetch a single project for the owner.

- **Profile UI wiring**
  - Replace the “0 Projects” and placeholder cards with real project data from `GET /api/projects`.
  - In the `Showcase` tab:
    - Render showcase projects (where `is_showcase=true`).
  - In the `Playground` tab:
    - Render all projects or all non-showcase projects.
  - Each project card links to `/[username]/[projectSlug]`.

- **Manual project creation UI (temporary until Phase 4)**
  - Add an **“Add project”** or **“Upload a project”** button to the profile header or Showcase tab.
  - For this phase, a simple modal or side panel form is acceptable:
    - Title, description, type, thumbnail URL (optional), showcase toggle.
    - Optional slug field, or auto-generate from title.
  - On submit → `POST /api/projects`, then update list.

- **Project detail page**
  - Display title, description, type, thumbnail, and any links.
  - Basic layout only; no agentic editing yet.

**Test & refine:**

- E2E: log in as user, create project, visit `/username/slug`, verify data is correct.
- Confirm per-user isolation by checking what happens when you manually navigate to another user’s slug.
- Collect feedback on required fields, project types, and URL structure before adding automation.

---

### Phase 3 – Masonry Layout & Showcase / Playground Experience

**Goal:** Make the profile visually compelling with masonry grids and clear separation between showcase and playground projects.

**Build:**

- **Masonry grids**
  - Replace basic lists with responsive masonry grids for:
    - Showcase section.
    - Playground section.
  - Card variations:
    - Image-heavy card (future Midjourney).
    - Text/prompt card.
    - Repo-style card (for future GitHub projects).

- **Showcase controls**
  - On each card:
    - Toggle “Add to showcase” / “Remove from showcase” (updates `is_showcase`).
  - Optional: simple ordering (e.g., by created_at or manual “pin to top” later).

- **Polish URLs in UI**
  - Each card clearly shows or hints at its unique URL (e.g., via “Open project” button).

**Test & refine:**

- Visual QA: different project counts, very long titles, no images.
- Performance check with many projects.
- UX feedback on whether the layout clearly communicates “hero” vs “playground” projects.

---

### Phase 4 – “Upload a Project” One-shot Chat + Visual Editor

**Goal:** Let users create a full project page from a single link or image drop, then refine the layout via drag-and-drop with minimal questions.

**Build:**

- **Right-side chat panel**
  - Replace the current “Add project” entry with **“Upload a project”**.
  - On click, open a right-side panel with a chat-like UI.

- **One-shot conversation and auto-generation**
  - Initial prompt: **“Drop a link or images to start your project.”**
  - Accepted inputs: links (GitHub, Midjourney, ChatGPT, etc.) and/or images (Midjourney outputs, screenshots).
  - On receive:
    - Call ingestion logic (Phase 5 for GitHub, stubbed heuristics for others) to:
      - Infer a title and URL slug.
      - Pick a cover image.
      - Generate tags.
      - Build an initial set of blocks (overview text, image grids, etc.) following the portfolio layout described above.
    - Create a **project draft document** (not yet persisted or persisted as draft).
    - Show a live preview of the `/username/project` page based on that draft.

- **Visual layout editor (drag-and-drop)**
  - Inside the panel (or in an expanded view), render the project using the blocks model:
    - Drag blocks up/down to reorder sections.
    - Drag images within grids to reorder them.
    - Drag an image into the cover slot to change the cover image.
    - Inline edit title, tags, and text directly on the preview.
  - The chat can suggest refinements (e.g., “Shorten overview”, “Add different tags”) but is not required for basic edits.

- **Integration with existing UI**
  - On “Save project”, persist the draft via `POST /api/projects` (or `PATCH` if updating) and redirect or link to `/username/project-slug`.
  - After save, the project appears in the profile’s showcase/playground grids (Phase 2 & 3).

**Test & refine:**

- Validate that most users can go from link/image → live project with one interaction plus light drag-and-drop.
- Check that the default generated layout (cover, title, tags, blocks) feels like a polished portfolio without extra questions.
- Gather feedback on how often users rely on chat vs direct manipulation.

---

### Phase 5 – Real Link Ingestion (GitHub First)

**Goal:** Make the “Pull from a link” path truly automated, starting with GitHub repos.

**Build:**

- **Link detection & ingestion endpoint**
  - `POST /api/projects/ingest-link`:
    - Accepts `source_url`.
    - Detects if it’s GitHub; if not, return a “not supported yet” response.
    - For GitHub:
      - Fetch repo metadata (name, description, language, stars, topics, updated_at).
      - Suggest `title`, `description`, `type=github_repo`, `slug`.
      - Optionally suggest a thumbnail (generated pattern or static template).

- **Chat flow integration**
  - When user chooses “Pull from a link”:
    - Call `ingest-link` → show a preview card (title, description, slug, thumbnail).
    - Chat: “Here’s what I found. Want to tweak the title/description/URL before saving?”
    - On confirmation, call `POST /api/projects` with the suggested data.
  - On project creation, show final URL and optionally open the detail page.

**Test & refine:**

- Test multiple GitHub URLs, including:
  - Short/simple names.
  - Repos with long descriptions or no description.
- Verify slug uniqueness logic still holds when many repos have similar names.
- Gather feedback on default titles/descriptions and whether users want more/less auto-filling.

---

### Phase 6 – Additional Sources & AI Enrichment

**Goal:** Expand sources and make the system feel truly “agentic”.

**Build:**

- **New link types**
  - Midjourney: handle image or collection links, store image URLs and generate thumbnails.
  - ChatGPT/prompt URLs: capture prompt, key response snippets.

- **AI enrichment**
  - Summarize README/prompts into concise project descriptions.
  - Auto-generate tags and categories.
  - Suggest projects to promote to showcase.

- **Conversational editing**
  - Support commands like:
    - “Make this description shorter.”
    - “Add this to my showcase.”
    - “Generate a better title for this.”

**Test & refine:**

- A/B test with/without AI-suggested descriptions/tags.
- Evaluate how often users accept or override suggestions.
- Tune models and prompts based on real usage.
