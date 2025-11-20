# Project Metadata Form Implementation

## Overview

Added a structured metadata form section to the Project Editor page that allows users to set project title, description, and tools before designing the detailed project page blocks.

## Changes Made

### 1. Backend Changes

#### `core/projects/serializers.py`
- Added `tools` field to `ProjectSerializer.Meta.fields`
- Added `external_url` field to `ProjectSerializer.Meta.fields`
- Tools field supports ManyToMany relationship with Tool model
- Serializer automatically handles reading and writing of tool IDs and URL validation

#### `core/projects/models.py`
- Already had `tools` ManyToManyField from previous implementation (migration 0025)
- Already had `is_highlighted` and `is_private` fields from previous implementation (migration 0026)
- Added `external_url` URLField (migration 0027) for linking to live demos, GitHub repos, etc.

### 2. Frontend Changes

#### Type Definitions (`frontend/src/types/models.ts`)
- Added `tools: number[]` to `Project` interface
- Added `isHighlighted: boolean` to `Project` interface
- Added `isPrivate: boolean` to `Project` interface
- Updated `ProjectPayload` to include:
  - `tools?: number[]`
  - `isHighlighted?: boolean`
  - `isPrivate?: boolean`
  - `isPublished?: boolean`
  - Made `title` optional (was required before)

#### New Component: ToolSelector (`frontend/src/components/projects/ToolSelector.tsx`)
A reusable multi-select dropdown component for selecting tools:

**Features:**
- Fetches all tools from `/api/v1/tools/` endpoint
- Search functionality (searches name, tagline, and tags)
- Displays tool logos when available
- Shows selected tools as removable pills
- Dropdown with checkmarks for selected items
- Disabled state support
- Click-outside to close dropdown
- Responsive design with dark mode support

**Usage:**
```tsx
<ToolSelector
  selectedToolIds={projectTools}
  onChange={setProjectTools}
  disabled={isSaving}
/>
```

#### ProjectEditorPage Updates (`frontend/src/pages/ProjectEditorPage.tsx`)

**New State Variables:**
- `projectTitle: string` - Stores project title separately from page blocks
- `projectUrl: string` - External URL for live demo, GitHub repo, etc.
- `projectDescription: string` - Maps to "Why it's cool" field (200 char limit)
- `projectTools: number[]` - Array of selected tool IDs

**Layout Structure:**
1. **Top Bar** - Navigation, save status, settings hamburger
2. **Banner Section** - Full-width banner image upload/URL with hover icon
3. **Metadata Form Section** (NEW) - Structured fields:
   - Page Title input (large text field)
   - Project URL input (for live demos, GitHub, etc.)
   - Tools Used multi-select (ToolSelector component)
   - Why It's Cool textarea (200 char limit with counter)
4. **Page Builder Section** - Custom block editor for detailed content

**Key Behaviors:**
- All metadata fields autosave with 2-second debounce
- Title is saved independently from first heading block in page builder
- Description enforces 200 character limit with visual feedback
- Character counter turns red when at max length
- Changes trigger `hasUnsavedChanges` flag
- Max-width container (max-w-5xl) centers all content

**Settings Sidebar Update:**
- Tools section now shows count of selected tools
- Links to main metadata form for editing

#### Services Update (`frontend/src/services/projects.ts`)
- Updated `transformProject()` to include:
  - `isHighlighted: data.isHighlighted ?? false`
  - `isPrivate: data.isPrivate ?? false`
  - `tools: data.tools || []`

## API Endpoints Used

### Tools Endpoint
- `GET /api/v1/tools/` - List all tools with pagination
- Supports query params: `ordering`, `category`, `pricing_model`, etc.
- Returns: `PaginatedResponse<Tool>`

### Projects Endpoint
- `PATCH /api/v1/me/projects/{id}/` - Update project
- Accepts: `title`, `description`, `external_url`, `tools` (array of IDs), `thumbnailUrl`, `content`
- Returns: Updated `Project` object

## Styling & UX

- Metadata section has clear visual separation with border-bottom
- Form fields use consistent styling with proper dark mode support
- Tools selector displays pills with logos and hover states
- Character counter provides immediate feedback on description length
- All fields are properly labeled with helpful descriptions
- Disabled state during save operations prevents conflicts
- Responsive design works on mobile and desktop

## Testing Considerations

When testing this feature:

1. **Title Field**
   - Verify title saves independently from heading blocks
   - Check top bar displays current title
   - Test autosave triggers after 2 seconds

2. **Tools Selector**
   - Verify tools load from API
   - Test search functionality
   - Check selected tools display as pills
   - Verify removal works
   - Test that selections persist after save

3. **Description Field**
   - Verify 200 character limit enforcement
   - Check character counter updates
   - Test that counter turns red at max length
   - Verify autosave includes description

4. **Autosave**
   - Test 2-second debounce works
   - Verify "Saving..." indicator appears
   - Check "Saved at [time]" message displays
   - Ensure no conflicts with manual saves

5. **Settings Sidebar**
   - Verify tool count displays correctly
   - Test visibility toggles still work

## Database Migrations

Migrations used:
- Migration 0025: Added `tools` ManyToMany field
- Migration 0026: Added `is_highlighted` and `is_private` fields
- Migration 0027: Added `external_url` URLField

## Future Enhancements

Potential improvements:
- Add tool categories/filters in selector
- Show tool preview on hover
- Allow creating new tools from selector
- Add bulk tool selection by category
- Save draft changes to localStorage for crash recovery
- Add undo/redo functionality
- Visual preview of metadata section in published view
