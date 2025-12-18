# Plan: Add Full Editing Capabilities to ClippedArticleLayout

## Summary
Add full editing capabilities to `ClippedArticleLayout` while preserving its unique "mini landing page" design with source attribution bar, "Visit Site" button, and "Clipped by" footer.

## Approach
Enhance `ClippedArticleLayout` with all the editing features from `DefaultProjectLayout`:
- Edit mode toggle
- Inline title editing
- Description editing
- Tools editing (from tool taxonomy)
- Category picker
- Hero image editing
- Section editing
- Owner menu

## Files to Modify

### 1. `frontend/src/components/projects/layouts/ClippedArticleLayout.tsx`
Add all editing capabilities from DefaultProjectLayout.

### 2. `frontend/src/components/projects/shared/InlineToolsEditor.tsx`
Add `darkMode` prop to support ClippedArticleLayout's light background.

## Implementation Steps

### Step 1: Add imports to ClippedArticleLayout
```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { updateProject, getTaxonomies } from '@/services/projects';
import { InlineEditableTitle, EditModeIndicator } from '../shared/InlineEditable';
import { TldrSection } from '../shared/TldrSection';
import { InlineToolsEditor } from '../shared/InlineToolsEditor';
import { EditableBlocksContainer } from '../shared/EditableBlocksContainer';
import { ProjectSections } from '../sections';
import { EllipsisVerticalIcon, TrashIcon, ChevronDownIcon, CalendarIcon, PencilIcon } from '@heroicons/react/24/outline';
```

### Step 2: Add context values and state
```typescript
const {
  // existing...
  isOwner,
  setProject,
  handleDelete,
} = useProjectContext();

const [isEditMode, setIsEditMode] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [showMenu, setShowMenu] = useState(false);
const [showCategoryPicker, setShowCategoryPicker] = useState(false);
const [allCategories, setAllCategories] = useState<Taxonomy[]>([]);

const isEditing = isOwner && isEditMode;
```

### Step 3: Add handler functions (copy patterns from DefaultProjectLayout)
- `handleTitleChange` - update title
- `handleToolsChange` - update tools
- `handleCategoryChange` - update category
- `handleSectionUpdate` - update section content
- `handleAddSection` - add new section
- `handleDeleteSection` - delete section
- `handleReorderSections` - reorder sections
- `toggleEditMode` - toggle edit mode

### Step 4: Update InlineToolsEditor for light theme
Add `darkMode?: boolean` prop (default `true`), change styling when `false`:
- Labels: `text-white/50` → `text-gray-500 dark:text-white/50`
- Buttons: `bg-white/5` → `bg-gray-100 dark:bg-white/5`
- Text: `text-white/80` → `text-gray-700 dark:text-white/80`
- Borders: `border-white/10` → `border-gray-200 dark:border-white/10`

### Step 5: Update ClippedArticleLayout UI

**Add EditModeIndicator** (before closing fragment):
```tsx
<EditModeIndicator isOwner={isOwner} isEditMode={isEditMode} onToggle={toggleEditMode} isSaving={isSaving} />
```

**Add owner menu** (top-right of content area):
```tsx
{isOwner && (
  <div className="absolute top-4 right-4">
    {/* Menu with delete, etc. */}
  </div>
)}
```

**Replace static title** with InlineEditableTitle:
```tsx
<InlineEditableTitle
  value={project.title}
  isEditable={isEditing}
  onChange={handleTitleChange}
  placeholder="Enter title..."
  className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6"
  as="h1"
/>
```

**Replace static category badge** with editable picker (when editing)

**Replace description section** with TldrSection:
```tsx
<TldrSection
  project={project}
  isEditing={isEditing}
  onProjectUpdate={setProject}
  darkMode={false}
/>
```

**Replace static tools section** with InlineToolsEditor:
```tsx
<InlineToolsEditor
  tools={project.toolsDetails || []}
  toolIds={project.tools || []}
  isEditing={isEditing}
  onToolClick={openToolTray}
  onToolsChange={handleToolsChange}
  isSaving={isSaving}
  darkMode={false}
/>
```

**Replace static sections** with editable ProjectSections:
```tsx
<ProjectSections
  sections={sections}
  isEditing={isEditing}
  onSectionUpdate={handleSectionUpdate}
  onAddSection={handleAddSection}
  onDeleteSection={handleDeleteSection}
  onReorderSections={handleReorderSections}
/>
```

## Key Considerations

1. **Preserve clipped-specific UX**: Source attribution bar, "Visit Site" button, and "Clipped by" footer remain unchanged
2. **Light theme styling**: InlineToolsEditor needs `darkMode={false}` prop
3. **TldrSection**: Already supports `darkMode={false}`
4. **Code from DefaultProjectLayout**: Copy handler patterns for sections, categories, etc.
5. **snake_case / camelCase mapping**: API returns snake_case (`tools_details`, `external_url`, `featured_image_url`) but frontend uses camelCase (`toolsDetails`, `externalUrl`, `featuredImageUrl`). Ensure:
   - API payloads sent use snake_case (check `updateProject` service)
   - Responses are properly transformed to camelCase
   - The `transformProject` function in `services/projects.ts` handles this mapping

## Testing
- Test edit mode toggle
- Test editing title, description, tools, category
- Test section add/edit/delete/reorder
- Verify source attribution bar remains visible
- Verify "Clipped by" footer remains visible
- Test on both light and dark mode
