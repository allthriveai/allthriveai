# Tool Models Setup Guide

This guide explains the new dedicated Tool models architecture and how to set it up.

## Overview

We've created a **dedicated Tool model** that's separate from the generic Taxonomy model. This allows for:

- Rich, comprehensive tool pages with detailed content
- User reviews and ratings
- Tool bookmarks/favorites
- Tool comparisons
- Better SEO and discoverability
- Scalability for future features (integrations, pricing updates, etc.)

## Architecture

### Models Created

1. **`Tool`** - Main model for AI tools with comprehensive fields
   - Basic info (name, tagline, description)
   - Categorization (category, tags)
   - Media (logo, banner, screenshots, demo video)
   - Links (website, docs, pricing, GitHub, social)
   - Pricing & access information
   - Rich content sections (overview, features, use cases, tips, best practices, limitations)
   - Technical details (model info, integrations, API availability)
   - SEO fields (meta description, keywords)
   - Status & metrics (featured, verified, view count, popularity score)

2. **`ToolReview`** - User reviews with ratings, pros/cons
3. **`ToolComparison`** - User-created tool comparisons
4. **`ToolBookmark`** - User bookmarks/favorites

### API Endpoints

```
GET    /api/v1/tools/                    # List all tools
GET    /api/v1/tools/{slug}/              # Tool detail
GET    /api/v1/tools/featured/            # Featured tools
GET    /api/v1/tools/categories/          # Categories with counts
GET    /api/v1/tools/{slug}/reviews/      # Tool reviews
GET    /api/v1/tools/{slug}/similar/      # Similar tools

GET    /api/v1/tool-reviews/              # All reviews
POST   /api/v1/tool-reviews/              # Create review
POST   /api/v1/tool-reviews/{id}/mark_helpful/  # Mark helpful

GET    /api/v1/tool-comparisons/          # User's comparisons
POST   /api/v1/tool-comparisons/          # Create comparison

GET    /api/v1/tool-bookmarks/            # User's bookmarks
POST   /api/v1/tool-bookmarks/            # Create bookmark
POST   /api/v1/tool-bookmarks/toggle/     # Toggle bookmark
```

## Setup Steps

### 1. Create and Run Migrations

```bash
# Generate migrations for new models
python manage.py makemigrations core

# Run migrations
python manage.py migrate core
```

Or with Docker:
```bash
docker-compose exec backend python manage.py makemigrations core
docker-compose exec backend python manage.py migrate core
```

### 2. Register API Routes

Add to `config/urls.py` or your main URL configuration:

```python
from core.tool_views import (
    ToolViewSet, ToolReviewViewSet,
    ToolComparisonViewSet, ToolBookmarkViewSet
)

# In your router setup:
router.register(r'tools', ToolViewSet, basename='tool')
router.register(r'tool-reviews', ToolReviewViewSet, basename='tool-review')
router.register(r'tool-comparisons', ToolComparisonViewSet, basename='tool-comparison')
router.register(r'tool-bookmarks', ToolBookmarkViewSet, basename='tool-bookmark')
```

### 3. Update Frontend Types

Add to `frontend/src/types/models.ts`:

```typescript
export interface Tool {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category: string;
  category_display: string;
  tags: string[];

  // Media
  logo_url?: string;
  banner_url?: string;
  screenshot_urls: string[];
  demo_video_url?: string;

  // Links
  website_url: string;
  documentation_url?: string;
  pricing_url?: string;
  github_url?: string;
  twitter_handle?: string;
  discord_url?: string;

  // Pricing
  pricing_model: string;
  pricing_model_display: string;
  starting_price?: string;
  has_free_tier: boolean;
  requires_api_key: boolean;
  requires_waitlist: boolean;

  // Content
  overview?: string;
  key_features: Array<{title: string; description: string}>;
  use_cases: Array<{title: string; description: string; example?: string}>;
  usage_tips: string[];
  best_practices: string[];
  limitations: string[];
  alternatives: string[];

  // Technical
  model_info: Record<string, any>;
  integrations: string[];
  api_available: boolean;
  languages_supported: string[];

  // Metrics
  is_featured: boolean;
  is_verified: boolean;
  view_count: number;
  popularity_score: number;
  average_rating?: number;
  review_count: number;
  bookmark_count: number;

  created_at: string;
  updated_at: string;
}

export interface ToolReview {
  id: number;
  tool: number;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  use_case?: string;
  user_username: string;
  user_avatar_url?: string;
  user_role: string;
  is_verified_user: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}
```

### 4. Create Frontend Services

Create `frontend/src/services/tools.ts`:

```typescript
import api from './api';
import type { Tool, ToolReview } from '@/types/models';

export async function getTools(params?: {
  category?: string;
  search?: string;
  featured?: boolean;
}) {
  const response = await api.get('/tools/', { params });
  return response.data;
}

export async function getToolBySlug(slug: string): Promise<Tool> {
  const response = await api.get(`/tools/${slug}/`);
  return response.data;
}

export async function getToolReviews(slug: string) {
  const response = await api.get(`/tools/${slug}/reviews/`);
  return response.data;
}

export async function getSimilarTools(slug: string): Promise<Tool[]> {
  const response = await api.get(`/tools/${slug}/similar/`);
  return response.data;
}

export async function createReview(data: {
  tool: number;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
}): Promise<ToolReview> {
  const response = await api.post('/tool-reviews/', data);
  return response.data;
}

export async function toggleBookmark(toolId: number) {
  const response = await api.post('/tool-bookmarks/toggle/', { tool_id: toolId });
  return response.data;
}
```

## Populating Data

### Option 1: Django Admin

1. Go to `/admin/core/tool/`
2. Click "Add Tool"
3. Fill in all fields (the admin is organized into logical sections)
4. Save

### Option 2: Django Shell

```python
from core.models import Tool

tool = Tool.objects.create(
    name="ChatGPT",
    tagline="AI-powered conversational assistant",
    description="OpenAI's ChatGPT provides natural language interactions...",
    category="chat",
    website_url="https://chat.openai.com",
    logo_url="https://example.com/logos/chatgpt.png",
    pricing_model="freemium",
    has_free_tier=True,
    tags=["NLP", "OpenAI", "Conversation"],
    usage_tips=[
        "Be specific in your prompts",
        "Use iterative refinement"
    ],
    key_features=[
        {"title": "Natural Conversations", "description": "Engage in human-like dialogue"},
        {"title": "Code Generation", "description": "Generate and debug code"}
    ],
    is_active=True
)
```

### Option 3: Management Command

Create a management command to import tools from JSON or CSV.

## Frontend Pages to Build

### 1. Tool Directory (`/tools`)
**Status**: ✅ Already exists, needs updating
- Update to use new Tool model instead of Taxonomy
- Add filtering by category, pricing model
- Add "Featured" section
- Add "Verified" badges

### 2. Tool Detail Page (`/tools/{slug}`)
**Status**: ❌ Needs to be created
- Hero section with logo, name, tagline
- Website/documentation/pricing links
- Overview section
- Key Features grid
- Use Cases with examples
- Usage Tips (numbered list)
- Best Practices
- Limitations
- Technical Details
- Similar Tools section
- Reviews section
- Bookmark button
- Share button

### 3. Tool Comparison Page (`/tools/compare`)
**Status**: ❌ Future feature
- Side-by-side comparison of tools
- Feature comparison matrix
- Pricing comparison

## Migration from Taxonomy to Tool

If you have existing tools in the Taxonomy table, create a migration script:

```python
# In a management command or migration
from core.models import Taxonomy, Tool

def migrate_tools():
    taxonomies = Taxonomy.objects.filter(category='tool', is_active=True)

    for tax in taxonomies:
        Tool.objects.get_or_create(
            name=tax.name,
            defaults={
                'tagline': tax.description[:200],
                'description': tax.description,
                'category': 'other',  # Map to appropriate category
                'website_url': tax.website_url or 'https://example.com',
                'logo_url': tax.logo_url or '',
                'usage_tips': tax.usage_tips or [],
                'best_practices': tax.best_for or [],
                'is_active': tax.is_active,
            }
        )
```

## Next Steps

1. **Run migrations** to create the database tables
2. **Add URL routing** for the new API endpoints
3. **Update ToolDirectoryPage** to use `/api/v1/tools/` instead of `/api/v1/taxonomies/`
4. **Create ToolDetailPage** component for individual tool pages
5. **Add sample tools** via Django admin
6. **Test the new endpoints** with Postman or curl
7. **Update frontend types** and services

## Benefits of This Approach

✅ **Scalability**: Can add any field without polluting Taxonomy model
✅ **Rich Content**: Supports detailed tool pages with multiple content sections
✅ **Community Features**: Reviews, ratings, bookmarks, comparisons
✅ **SEO**: Dedicated pages with proper meta tags
✅ **Analytics**: Track views, popularity, engagement
✅ **Flexibility**: Easy to add new features like pricing updates, change logs, integrations
✅ **Performance**: Optimized queries with proper indexes

## Troubleshooting

### Issue: Import errors for Tool model
**Solution**: Make sure `tool_models.py` is imported in `core/models.py`

### Issue: Migrations fail
**Solution**: Check for circular dependencies, ensure all ForeignKeys reference correct models

### Issue: API returns 404
**Solution**: Verify URL routing is configured correctly in `config/urls.py`
