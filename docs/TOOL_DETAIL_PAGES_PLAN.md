# Tool Detail Pages Implementation Plan

## Overview

This document outlines the plan to implement comprehensive tool detail pages that display rich information about each AI tool, including company logos, websites, descriptions, use cases, and best practices. Tools will be their own entities with attached taxonomy relationships for personalization and tagging.

## Current State

### Existing Models ✅

1. **Tool Model** (`core/tools/models.py`) - Already exists with comprehensive fields:
   - Basic info: name, slug, tagline, description
   - Categorization: category, tags
   - Media: logo_url, banner_url, screenshot_urls, demo_video_url
   - Links: website_url, documentation_url, pricing_url, github_url, twitter_handle, discord_url
   - Pricing: pricing_model, starting_price, has_free_tier
   - Content: overview, key_features, use_cases, usage_tips, best_practices, limitations
   - Technical: model_info, integrations, api_available, languages_supported
   - Metrics: view_count, popularity_score, is_featured, is_verified

2. **Taxonomy Model** (`core/taxonomy/models.py`) - Exists with:
   - Basic fields: name, category, description
   - Tool-specific fields: website_url, logo_url, usage_tips, best_for
   - Used for personalization and user tagging

3. **Supporting Models**:
   - `ToolReview` - User reviews/ratings
   - `ToolComparison` - User-created comparisons
   - `ToolBookmark` - User favorites
   - `UserTag` - Links users to taxonomies (including tools)

### Existing Documentation

- `TOOL_MODELS_SETUP.md` - Comprehensive guide for Tool model setup ✅
- `TOOL_DIRECTORY.md` - Tool directory overview (needs updating)
- `TOOL_DIRECTORY_SETUP.md` - Setup guide for tool directory

### Gap Analysis

**Missing:**
1. ❌ Relationship between `Tool` and `Taxonomy` models
2. ❌ Frontend tool detail page (`/tools/{slug}`)
3. ❌ API endpoints for tool details are defined but need verification
4. ❌ Migration path from Taxonomy-based tools to Tool model
5. ❌ Project-to-Tool tagging (for future "projects using this tool" feature)

## Goals

### Phase 1: Tool Detail Pages (Current Focus)
- Display comprehensive tool information on dedicated pages
- Show company logo, website, description prominently
- Display bullet points for use cases and best practices
- Connect tools to taxonomy for personalization

### Phase 2: Future Enhancement
- Display all projects tagged with a specific tool
- Enable users to tag projects with tools they used
- Show tool usage statistics and popularity

## Architecture

### Database Schema Changes

#### 1. Add Tool-Taxonomy Relationship

```python
# In core/tools/models.py - Add to Tool model:

class Tool(models.Model):
    # ... existing fields ...

    # NEW FIELD: Link to corresponding taxonomy for personalization
    taxonomy = models.OneToOneField(
        'taxonomy.Taxonomy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tool_entity',
        help_text="Link to taxonomy entry for user personalization/tagging"
    )
```

**Rationale:**
- OneToOne relationship allows a Tool to optionally link to a Taxonomy
- Users can still select tools in personalization (via Taxonomy)
- Tool entity remains separate for rich content/SEO
- `SET_NULL` ensures deleting Taxonomy doesn't delete Tool

#### 2. Future: Add Project-Tool Tagging

```python
# Future enhancement (Phase 2) - not implementing yet
# In core/projects/models.py:

class Project(models.Model):
    # ... existing fields ...

    tools_used = models.ManyToManyField(
        'tools.Tool',
        blank=True,
        related_name='projects',
        help_text="AI tools/technologies used in this project"
    )
```

### API Endpoints

**Already Defined in TOOL_MODELS_SETUP.md:**

```
GET    /api/v1/tools/                    # List all tools (with filters)
GET    /api/v1/tools/{slug}/              # Tool detail
GET    /api/v1/tools/featured/            # Featured tools
GET    /api/v1/tools/categories/          # Categories with counts
GET    /api/v1/tools/{slug}/reviews/      # Tool reviews
GET    /api/v1/tools/{slug}/similar/      # Similar tools
```

**Need to verify these are registered in `config/urls.py`**

### Frontend Components

#### 1. Tool Detail Page (`/tools/{slug}`)

**Route:** `/tools/:slug`

**Sections:**
1. **Hero Section**
   - Large company logo (responsive sizing)
   - Tool name (H1)
   - Tagline
   - Category badge
   - Primary CTA: "Visit Website" button
   - Secondary actions: Bookmark, Share

2. **Overview Section**
   - Full description (supports Markdown)
   - Key stats (pricing model, free tier availability, API access)

3. **Key Features Grid**
   - Display `key_features` array
   - Each feature: title + description
   - Icon-based cards

4. **Use Cases Section**
   - Display `use_cases` array
   - Each use case: title, description, optional example
   - Structured as expandable cards or tabs

5. **Best Practices**
   - Display `best_practices` array as numbered list
   - Clear, actionable items
   - Visual checkmarks or numbered badges

6. **Usage Tips**
   - Display `usage_tips` array as bullet points
   - Highlighted tips section
   - "Pro Tips" badge styling

7. **Technical Details** (Collapsible)
   - Model information
   - Integrations supported
   - Languages supported
   - API availability

8. **Limitations** (if any)
   - Display `limitations` array
   - Transparent about constraints
   - Helps set user expectations

9. **Similar Tools** (Sidebar or bottom)
   - Query by same category
   - Display top 3-5 alternatives
   - Quick comparison links

10. **Reviews Section** (Future)
    - User reviews and ratings
    - Add review functionality
    - Helpful/not helpful voting

11. **Related Projects** (Phase 2 - Not Yet)
    - Projects tagged with this tool
    - User showcase

#### 2. Update Tool Directory Page

**File:** `frontend/src/pages/ToolDirectoryPage.tsx`

**Changes:**
- Link tool cards to `/tools/{slug}` instead of opening sidebar
- Keep search and filtering functionality
- Update to use `/api/v1/tools/` endpoint (instead of `/api/v1/taxonomies/?category=tool`)

## Implementation Steps

### Step 1: Database Migration ✅ NEXT

1. Add `taxonomy` field to Tool model
2. Create and run migration:
   ```bash
   python manage.py makemigrations core
   python manage.py migrate core
   ```

### Step 2: Data Migration Script

Create management command to link existing Tools to Taxonomies:

```python
# core/management/commands/link_tools_taxonomy.py

from django.core.management.base import BaseCommand
from core.tools.models import Tool
from core.taxonomy.models import Taxonomy

class Command(BaseCommand):
    help = 'Link Tool entities to corresponding Taxonomy entries'

    def handle(self, *args, **options):
        tools = Tool.objects.filter(taxonomy__isnull=True)

        for tool in tools:
            # Try to find matching taxonomy by name
            taxonomy = Taxonomy.objects.filter(
                name__iexact=tool.name,
                category='tool'
            ).first()

            if not taxonomy:
                # Create taxonomy if it doesn't exist
                taxonomy = Taxonomy.objects.create(
                    name=tool.name,
                    category='tool',
                    description=tool.description[:500],  # Truncate if needed
                    website_url=tool.website_url,
                    logo_url=tool.logo_url,
                    usage_tips=tool.usage_tips,
                    best_for=tool.best_practices[:5] if tool.best_practices else [],
                    is_active=tool.is_active
                )
                self.stdout.write(f"Created taxonomy for {tool.name}")

            tool.taxonomy = taxonomy
            tool.save(update_fields=['taxonomy'])
            self.stdout.write(f"Linked {tool.name} to taxonomy")
```

### Step 3: Backend API Updates

1. **Verify ViewSet Registration**
   - Check `config/urls.py` for tool routes
   - Register if missing:
     ```python
     from core.tools.views import ToolViewSet
     router.register(r'tools', ToolViewSet, basename='tool')
     ```

2. **Update ToolViewSet Serializer**
   - Include taxonomy relationship in serializer
   - Add computed fields (review_count, average_rating, bookmark_count)

3. **Add/Verify Custom Actions**
   - `@action` for `similar/` endpoint
   - `@action` for incrementing view count
   - `@action` for `reviews/` nested endpoint

### Step 4: Frontend Type Definitions

**File:** `frontend/src/types/models.ts`

Add or update Tool interface (already defined in TOOL_MODELS_SETUP.md):

```typescript
export interface Tool {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;

  // Taxonomy link
  taxonomy?: number;  // NEW: ID of linked taxonomy

  // ... rest of fields from TOOL_MODELS_SETUP.md
}
```

### Step 5: Frontend Services

**File:** `frontend/src/services/tools.ts`

Create service functions (template provided in TOOL_MODELS_SETUP.md):

```typescript
import api from './api';
import type { Tool } from '@/types/models';

export async function getToolBySlug(slug: string): Promise<Tool> {
  const response = await api.get(`/tools/${slug}/`);
  return response.data;
}

export async function getSimilarTools(slug: string): Promise<Tool[]> {
  const response = await api.get(`/tools/${slug}/similar/`);
  return response.data;
}

// ... other functions
```

### Step 6: Build Tool Detail Page Component

**File:** `frontend/src/pages/ToolDetailPage.tsx`

**Structure:**
```tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getToolBySlug, getSimilarTools } from '@/services/tools';

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: tool, isLoading } = useQuery({
    queryKey: ['tool', slug],
    queryFn: () => getToolBySlug(slug!),
  });

  const { data: similarTools } = useQuery({
    queryKey: ['similar-tools', slug],
    queryFn: () => getSimilarTools(slug!),
    enabled: !!tool,
  });

  if (isLoading) return <ToolDetailSkeleton />;
  if (!tool) return <NotFound />;

  return (
    <div className="tool-detail-page">
      <ToolHeroSection tool={tool} />
      <ToolOverviewSection tool={tool} />
      <ToolFeaturesSection features={tool.key_features} />
      <ToolUseCasesSection useCases={tool.use_cases} />
      <ToolBestPracticesSection practices={tool.best_practices} />
      <ToolUsageTipsSection tips={tool.usage_tips} />
      {tool.limitations?.length > 0 && (
        <ToolLimitationsSection limitations={tool.limitations} />
      )}
      <ToolTechnicalSection tool={tool} />
      {similarTools && <SimilarToolsSection tools={similarTools} />}
    </div>
  );
}
```

**Component Breakdown:**

1. `ToolHeroSection` - Logo, name, tagline, CTA buttons
2. `ToolOverviewSection` - Description and key stats
3. `ToolFeaturesSection` - Grid of key features
4. `ToolUseCasesSection` - Use case cards
5. `ToolBestPracticesSection` - Numbered list with icons
6. `ToolUsageTipsSection` - Bullet points with highlights
7. `ToolLimitationsSection` - Transparent limitations
8. `ToolTechnicalSection` - Collapsible technical details
9. `SimilarToolsSection` - Related tools carousel

### Step 7: Update Tool Directory Page

**File:** `frontend/src/pages/ToolDirectoryPage.tsx`

**Changes:**
1. Update API endpoint:
   ```typescript
   // OLD
   const tools = await getTaxonomies({ category: 'tool' });

   // NEW
   const tools = await getTools();
   ```

2. Update tool card links:
   ```tsx
   // OLD
   <div onClick={() => openToolSidebar(tool)}>

   // NEW
   <Link to={`/tools/${tool.slug}`}>
   ```

3. Keep existing search/filter functionality

### Step 8: Routing

**File:** `frontend/src/App.tsx` (or routing file)

Add route:
```typescript
<Route path="/tools/:slug" element={<ToolDetailPage />} />
```

### Step 9: Populate Sample Data

Use Django admin or management command to add comprehensive tool data:

**Sample Tool (ChatGPT):**
```json
{
  "name": "ChatGPT",
  "tagline": "AI-powered conversational assistant by OpenAI",
  "description": "ChatGPT is a large language model that can engage in natural conversations...",
  "category": "chat",
  "website_url": "https://chat.openai.com",
  "logo_url": "https://example.com/logos/chatgpt.png",
  "pricing_model": "freemium",
  "has_free_tier": true,
  "key_features": [
    {
      "title": "Natural Conversations",
      "description": "Engage in human-like dialogue on any topic"
    },
    {
      "title": "Code Generation",
      "description": "Write and debug code in multiple languages"
    }
  ],
  "use_cases": [
    {
      "title": "Content Writing",
      "description": "Generate blog posts, articles, and marketing copy",
      "example": "Write a 500-word blog post about AI trends in 2025"
    },
    {
      "title": "Code Assistance",
      "description": "Debug errors and generate boilerplate code",
      "example": "Help me fix this Python function that's throwing a TypeError"
    }
  ],
  "usage_tips": [
    "Be specific and detailed in your prompts",
    "Break complex tasks into smaller steps",
    "Iterate on responses by asking follow-up questions",
    "Use system messages to set context and tone"
  ],
  "best_practices": [
    "Start with clear objectives for your conversation",
    "Provide examples when asking for creative output",
    "Fact-check important information from responses",
    "Use markdown formatting for structured output",
    "Save important conversations for future reference"
  ],
  "limitations": [
    "Knowledge cutoff date may be outdated",
    "Cannot access real-time information or browse the web",
    "May occasionally generate incorrect or biased information",
    "Cannot execute code or access external APIs"
  ],
  "is_featured": true,
  "is_verified": true
}
```

### Step 10: Testing Checklist

- [ ] Migration runs successfully
- [ ] Tool-Taxonomy linking script works
- [ ] API endpoints return correct data
- [ ] Tool detail page loads correctly
- [ ] All sections render with proper data
- [ ] Links work (website, docs, pricing)
- [ ] Similar tools section populates
- [ ] Responsive design works on mobile
- [ ] SEO meta tags are correct
- [ ] Tool directory links to detail pages
- [ ] Bookmarking functionality works (if implemented)
- [ ] View count increments on page visit

### Step 11: Documentation Updates

Update these docs:
1. **TOOL_DIRECTORY.md** - Update with new detail page info
2. **TOOL_DIRECTORY_SETUP.md** - Add detail page setup steps
3. **README.md** - Add section about tool detail pages (if relevant)

## Design Considerations

### Required Content for Each Tool Page

**Minimum Required Fields:**
- ✅ Company logo (`logo_url`)
- ✅ Website URL (`website_url`)
- ✅ Description (`description`)
- ✅ Use cases (`use_cases` array)
- ✅ Best practices (`best_practices` array)

**Recommended Fields:**
- Tagline
- Key features
- Usage tips
- Pricing information
- Category
- Tags for filtering

**Optional But Valuable:**
- Screenshots
- Demo video
- Technical details
- Integrations
- Limitations
- Alternative tools

### Visual Design Guidelines

**Hero Section:**
- Logo size: 80-120px on desktop, 64px on mobile
- Background: Subtle gradient or tool brand colors
- CTA button: High contrast, prominent placement

**Content Sections:**
- Clear visual hierarchy with headings
- Consistent spacing between sections
- Use of icons/badges for visual interest
- Code blocks for technical examples
- Expandable/collapsible sections for dense content

**Color Coding:**
- Features: Blue/primary color
- Use cases: Green (success)
- Tips: Yellow/amber (info)
- Best practices: Purple (premium)
- Limitations: Orange (warning)

### SEO Optimization

Each tool page should have:
- Unique meta title: `{Tool Name} - {Tagline} | AllThrive AI`
- Meta description: `{tool.meta_description}` (auto-generated from description)
- Open Graph tags for social sharing
- Structured data (JSON-LD):
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ChatGPT",
    "applicationCategory": "AI Tools",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  }
  ```

## Phase 2: Project-Tool Integration (Future)

**Not implementing now, but planned for later:**

### 1. Add Project Tagging
- Add `tools_used` ManyToMany field to Project model
- Allow users to tag projects with tools during creation
- Display tools on project cards

### 2. Tool Page Project Showcase
- Add "Projects Using This Tool" section to tool detail page
- Query: `Project.objects.filter(tools_used=tool, is_public=True)`
- Display project cards with thumbnails
- Filter by "Featured Projects"

### 3. Analytics
- Track which tools are most used in projects
- Show popularity metrics on tool pages
- Generate "Trending Tools" based on recent project tags

### 4. Personalization
- Recommend tools based on user's project history
- Suggest projects based on tools user is interested in
- Auto-tag projects based on content (AI-powered)

## Migration Strategy

### From Taxonomy-Based Tools to Tool Entity

**Current State:**
- Tools exist as Taxonomy entries with `category='tool'`
- Users can select tools in personalization
- Tool directory reads from Taxonomy table

**Target State:**
- Tools are independent entities (Tool model)
- Tools optionally link to Taxonomy for personalization
- Rich tool detail pages with comprehensive info
- Tool directory reads from Tool table

**Migration Path:**

1. **Dual System (Transition Period)**
   - Tool model exists alongside Taxonomy
   - New tools added to both (via link)
   - Frontend gradually updated to use Tool endpoints

2. **Data Synchronization**
   - Run `link_tools_taxonomy` command
   - Verify all existing taxonomies with category='tool' have corresponding Tool entries
   - Create missing Tool entries if needed

3. **Frontend Migration**
   - Update ToolDirectoryPage to use `/api/v1/tools/`
   - Add new ToolDetailPage
   - Update routing

4. **Backward Compatibility**
   - Keep Taxonomy-based tool selection in personalization
   - UserTag continues to reference Taxonomy
   - Tool.taxonomy link enables cross-reference

5. **Deprecation (Future)**
   - Eventually phase out Taxonomy for tools
   - Migrate fully to Tool model
   - Update UserTag to reference Tool directly (breaking change)

## Timeline Estimate

- **Step 1-2 (Database):** 30 minutes
- **Step 3 (Backend API):** 1-2 hours
- **Step 4-5 (Frontend Services):** 1 hour
- **Step 6-8 (UI Components):** 4-6 hours
- **Step 9 (Data Population):** 1-2 hours
- **Step 10 (Testing):** 2-3 hours
- **Step 11 (Documentation):** 1 hour

**Total Estimate:** 10-15 hours

## Success Metrics

### Immediate (Phase 1)
- [ ] All tools have comprehensive detail pages
- [ ] Tool directory links to detail pages
- [ ] Users can view full tool information
- [ ] Page load time < 2 seconds
- [ ] Mobile responsive design works

### Future (Phase 2)
- [ ] Users can tag projects with tools
- [ ] Tool pages show related projects
- [ ] Analytics track tool popularity
- [ ] User engagement with tool pages measured

## Open Questions

1. **Logo Hosting:** Where will we host tool logos? (CDN, local storage, external URLs?)
2. **Data Maintenance:** Who maintains tool information? (Admin only, community contributions?)
3. **API Rate Limits:** Do we need rate limiting for tool detail endpoints?
4. **Caching Strategy:** Should we cache tool detail pages? (Redis, CDN?)
5. **User-Generated Content:** Will users be able to suggest edits to tool information?

## Related Documentation

- `TOOL_MODELS_SETUP.md` - Complete model setup guide
- `TOOL_DIRECTORY.md` - Tool directory overview
- `TOOL_DIRECTORY_SETUP.md` - Data population guide
- `PERSONALIZATION.md` - User personalization system
- `CORE_REFACTOR_CODE_REVIEW.md` - Domain structure

## Notes

- This plan follows AllThrive AI architecture patterns (domain-driven design)
- Tool model is in `core/tools/` domain
- Uses PostgreSQL JSON fields for structured data
- TypeScript for frontend (as per project standards)
- Docker ports: Frontend 3000, Backend 8000
- Pre-commit hooks will validate all code changes
