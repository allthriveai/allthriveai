# AI Tool Directory

A dictionary-style directory of AI tools and platforms available at `/tools`.

## Overview

The Tool Directory provides a curated list of AI tools organized alphabetically, similar to a dictionary or encyclopedia. Users can browse and search through tools to discover AI platforms that fit their needs.

## Features

### 📖 Dictionary-Style Layout
- Tools grouped by first letter (A, B, C, etc.)
- Clean, alphabetical organization
- Letter headers with visual separation

### 🔍 Search Functionality
- Real-time search across tool names and descriptions
- Result counter shows number of matching tools
- Contextual empty states for no results

### 📱 Alphabet Navigation
- Fixed navigation sidebar (appears when 3+ letters)
- Quick jump to any letter section
- Smooth scrolling to sections

### 🎨 Visual Design
- Each tool displayed in a card with:
  - Tool name (heading)
  - Description
  - Sparkle icon
  - Hover effects
- Gradient letter badges
- Glass morphism styling

## Current Tools (25 AI Tools)

### Content Generation
- ChatGPT - OpenAI conversational AI
- Claude - Anthropic AI assistant
- Jasper - AI content platform for marketing
- Copy.ai - AI writing assistant
- Notion AI - AI in Notion workspace

### Image Generation
- Midjourney - AI digital artwork
- DALL-E - OpenAI text-to-image
- Stable Diffusion - Open-source image generation
- Canva AI - AI design tools
- Adobe Firefly - Adobe generative AI

### Code Assistance
- GitHub Copilot - AI pair programmer
- Cursor - AI-powered code editor
- LangChain - Framework for LLM apps
- AutoGPT - Autonomous AI agent

### Video & Audio
- Runway - AI video editing and generation
- Synthesia - AI video with avatars
- Descript - AI audio/video editing
- ElevenLabs - AI voice synthesis

### Platforms & Development
- Hugging Face - ML models and datasets
- Replicate - Run AI models in cloud
- Anthropic Console - Claude API platform
- OpenAI Playground - Test OpenAI models

### Other Tools
- Perplexity - AI search engine
- Grammarly - AI writing assistant
- Zapier AI - AI workflow automation

## Technical Implementation

### Backend
- Tools stored in `Taxonomy` model with `category='tool'`
- Retrieved via existing taxonomy API endpoints
- Managed through Django admin interface

### Frontend
- Page: `frontend/src/pages/ToolDirectoryPage.tsx`
- Route: `/tools` (public access)
- Uses `getTaxonomies()` service to fetch tools
- Filters by `category === 'tool'`

### Data Management

**Add new tools via Django Admin:**
1. Navigate to `/admin/core/taxonomy/`
2. Add new taxonomy
3. Set category to "Tool"
4. Add name and description
5. Set `is_active` to true

**Or via management command:**
```bash
# Edit core/management/commands/seed_taxonomies.py
# Add new tool to the list
docker compose exec web python manage.py seed_taxonomies
```

## Access

- **URL**: `http://localhost:3000/tools`
- **Access Level**: Public (no authentication required)
- **Menu**: Not currently in navigation menu (as requested)

## Future Enhancements

1. **Tool Details Page**: Click through to detailed page for each tool
2. **Categories/Tags**: Filter by use case (writing, coding, design, etc.)
3. **External Links**: Add official website links for each tool
4. **User Reviews**: Allow users to rate and review tools
5. **Pricing Information**: Show free/paid/freemium status
6. **Integration Status**: Show which tools have API integrations
7. **Usage Stats**: Track which tools are most popular
8. **Related Tools**: Show similar/alternative tools
9. **Comparison Feature**: Side-by-side tool comparisons

## Integration with Personalization

Tools in the directory are also available in the Personalization settings:
- Users can select tools they use/want to learn
- Tool selections appear in user profiles
- Can be used for personalized recommendations
- Auto-tagging based on user activity with specific tools

## SEO & Discovery

The tool directory can become a valuable resource for:
- Organic search traffic (people searching for AI tools)
- Educational content about AI tools
- Building authority in the AI tools space
- User acquisition through valuable content

Consider adding:
- Meta descriptions for SEO
- Structured data (Schema.org) for better search results
- Blog posts about specific tools
- Tutorial content linked to tools
