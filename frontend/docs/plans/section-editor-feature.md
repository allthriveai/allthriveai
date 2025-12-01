# Section-Based Project Editor

## Overview

This document outlines the implementation plan for a rich, drag-and-drop section-based editor for project portfolios. The goal is to allow users to fully customize their project pages with inline editing, reorderable sections, and beautiful components like IconCards.

## Design Goals

1. **Inline Editing** - Notion-style click-to-edit directly in place
2. **Drag-and-Drop** - Reorder sections and items within sections
3. **Beautiful Components** - IconCards, feature grids, and polished UI elements
4. **FontAwesome Icons** - Searchable icon picker for customization
5. **Template v2 Compatibility** - Works with the existing section-based data model

---

## Reference Implementation

The project at `/alliejones42/redis-wellness` demonstrates the target visual style:

### Key Features Section
- Grid of IconCards (3-4 columns on desktop)
- Each card has: Icon (FontAwesome) + Title + Description
- Hover effects with gradient accent bar
- Responsive layout

### Section Types
| Section | Description | Editable Elements |
|---------|-------------|-------------------|
| Overview | Headline + description + metrics | Text, metric values |
| Features | Grid of IconCards | Icon, title, description per card |
| Tech Stack | Categorized technology badges | Category name, tech items |
| Gallery | Image carousel/grid | Images, captions, layout |
| Architecture | Mermaid diagram | Diagram code, description |
| Demo | Video/CTA buttons | Video URL, button text/links |
| Challenges | Problem/solution pairs | Challenge, solution, outcome |
| Links | Resource links | Label, URL, icon |

---

## Architecture

### New Components

#### 1. `IconCard` Component
```
Location: src/components/projects/shared/IconCard.tsx

Props:
- icon: string (FontAwesome icon name, e.g., "FaRocket")
- title: string
- description: string
- isEditing?: boolean
- onIconChange?: (icon: string) => void
- onTitleChange?: (title: string) => void
- onDescriptionChange?: (desc: string) => void
- onDelete?: () => void

Features:
- Click icon to open IconPicker modal
- Inline text editing for title/description
- Drag handle visible on hover
- Delete button on hover
```

#### 2. `SectionEditor` Component
```
Location: src/components/projects/sections/SectionEditor.tsx

Props:
- section: ProjectSection
- isEditing: boolean
- onUpdate: (content: SectionContent) => void
- onDelete: () => void
- onToggleEnabled: () => void

Features:
- Renders the appropriate editor based on section.type
- Drag handle for reordering sections
- Collapse/expand toggle
- Enable/disable toggle
- Edit mode toggle
```

#### 3. `SectionsEditorCanvas` Component
```
Location: src/components/projects/sections/SectionsEditorCanvas.tsx

Props:
- sections: ProjectSection[]
- onSectionsChange: (sections: ProjectSection[]) => void

Features:
- DndContext wrapper for section reordering
- Maps sections to SectionEditor components
- "Add Section" button at bottom
- Section type picker modal
```

### Section-Specific Editors

#### `FeaturesSectionEditor`
```
Location: src/components/projects/sections/editors/FeaturesSectionEditor.tsx

Features:
- Grid of editable IconCards
- Drag-and-drop reorder within grid
- "Add Feature" button
- Bulk actions (delete selected, duplicate)
```

#### `OverviewSectionEditor`
```
Location: src/components/projects/sections/editors/OverviewSectionEditor.tsx

Features:
- Inline editable headline (large text)
- Rich text description editor
- Editable metrics row (icon picker + value input)
```

#### `TechStackSectionEditor`
```
Location: src/components/projects/sections/editors/TechStackSectionEditor.tsx

Features:
- Editable category headers
- Add/remove technologies per category
- Icon URL or SimpleIcons slug support
- Drag to reorder categories
```

#### `GallerySectionEditor`
```
Location: src/components/projects/sections/editors/GallerySectionEditor.tsx

Features:
- Image upload/URL input
- Caption editing
- Layout toggle (carousel/grid/masonry)
- Drag to reorder images
```

#### `ChallengesSectionEditor`
```
Location: src/components/projects/sections/editors/ChallengesSectionEditor.tsx

Features:
- Accordion-style challenge cards
- Inline edit challenge/solution/outcome
- Add/delete challenges
- Drag to reorder
```

---

## Data Flow

```
ProjectEditorPage
  └── SectionsEditorCanvas
        ├── SectionEditor (overview)
        │     └── OverviewSectionEditor
        ├── SectionEditor (features)
        │     └── FeaturesSectionEditor
        │           └── IconCard (×N)
        ├── SectionEditor (tech_stack)
        │     └── TechStackSectionEditor
        └── ...
```

### State Management
- Use existing `ProjectEditor` component pattern (render props)
- Add new editor props for sections management:
  - `sections: ProjectSection[]`
  - `setSections: (sections: ProjectSection[]) => void`
  - `updateSectionContent: (id: string, content: SectionContent) => void`
  - `addSection: (type: SectionType) => void`
  - `deleteSection: (id: string) => void`
  - `reorderSections: (startIndex: number, endIndex: number) => void`

---

## Implementation Phases

### Phase 1: Foundation Components
1. Create `IconCard` component with edit mode
2. Create `SectionEditor` wrapper component
3. Create `SectionsEditorCanvas` with drag-and-drop
4. Update `ProjectEditor` to manage sections state

### Phase 2: Section-Specific Editors
1. `FeaturesSectionEditor` with IconCard grid
2. `OverviewSectionEditor` with inline editing
3. `TechStackSectionEditor` with categories
4. `GallerySectionEditor` with image management

### Phase 3: Advanced Editors
1. `ArchitectureSectionEditor` with Mermaid preview
2. `DemoSectionEditor` with video embed
3. `ChallengesSectionEditor` with accordion
4. `LinksSectionEditor` with link cards
5. `CustomSectionEditor` (block-based fallback)

### Phase 4: Polish & Integration
1. Add section type picker modal
2. Auto-save functionality
3. Undo/redo support (optional)
4. Keyboard shortcuts
5. Mobile responsiveness

---

## File Structure

```
src/components/projects/
├── shared/
│   ├── IconCard.tsx              # NEW - Reusable icon card component
│   ├── IconCardEditor.tsx        # NEW - Edit mode for IconCard
│   └── ... (existing)
├── sections/
│   ├── index.ts                  # Update exports
│   ├── SectionRenderer.tsx       # Existing - display mode
│   ├── SectionEditor.tsx         # NEW - edit mode wrapper
│   ├── SectionsEditorCanvas.tsx  # NEW - drag-and-drop canvas
│   ├── editors/
│   │   ├── index.ts
│   │   ├── OverviewSectionEditor.tsx
│   │   ├── FeaturesSectionEditor.tsx
│   │   ├── TechStackSectionEditor.tsx
│   │   ├── GallerySectionEditor.tsx
│   │   ├── ArchitectureSectionEditor.tsx
│   │   ├── DemoSectionEditor.tsx
│   │   ├── ChallengesSectionEditor.tsx
│   │   ├── LinksSectionEditor.tsx
│   │   └── CustomSectionEditor.tsx
│   └── ... (existing display components)
└── ProjectEditor.tsx             # Update to include sections management
```

---

## IconCard Component Specification

### Display Mode
```tsx
<div className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
  {/* Icon */}
  <div className="mb-4">
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
      <FaIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
    </div>
  </div>

  {/* Title */}
  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 transition-colors">
    {title}
  </h4>

  {/* Description */}
  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
    {description}
  </p>

  {/* Hover Accent */}
  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity" />
</div>
```

### Edit Mode
```tsx
<div className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-6 border-2 border-dashed border-primary-300 dark:border-primary-700">
  {/* Drag Handle */}
  <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
    <Bars3Icon className="w-5 h-5 text-gray-400" />
  </div>

  {/* Delete Button */}
  <button className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
    <XMarkIcon className="w-4 h-4" />
  </button>

  {/* Editable Icon */}
  <button onClick={openIconPicker} className="mb-4">
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center hover:ring-2 hover:ring-primary-500 transition-all">
      <FaIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
    </div>
  </button>

  {/* Editable Title */}
  <input
    value={title}
    onChange={(e) => onTitleChange(e.target.value)}
    className="w-full text-lg font-semibold bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-white"
    placeholder="Feature title..."
  />

  {/* Editable Description */}
  <textarea
    value={description}
    onChange={(e) => onDescriptionChange(e.target.value)}
    className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-600 dark:text-gray-400 resize-none"
    placeholder="Describe this feature..."
    rows={2}
  />
</div>
```

---

## Integration with Existing Editor

The `ProjectEditorPage` will be updated to add a new "Sections" tab alongside the existing "TL;DR" and "Details" tabs:

```tsx
// Tab Navigation
<nav className="flex gap-8">
  <button onClick={() => setActiveTab('tldr')}>TL;DR</button>
  <button onClick={() => setActiveTab('sections')}>Sections</button>  {/* NEW */}
  <button onClick={() => setActiveTab('details')}>Project Details</button>
</nav>

// Tab Content
{activeTab === 'sections' && (
  <SectionsEditorCanvas
    sections={editorProps.sections}
    onSectionsChange={editorProps.setSections}
  />
)}
```

---

## Migration Strategy

1. **Existing projects without sections**: Continue using legacy blocks
2. **Projects with templateVersion: 2**: Show sections editor
3. **Upgrade path**: Add "Convert to Sections" button for legacy projects

---

## Success Criteria

- [ ] Users can edit all section content inline
- [ ] IconCards display correctly with FontAwesome icons
- [ ] Drag-and-drop works for reordering sections and items
- [ ] Changes auto-save to backend
- [ ] Preview matches the published view
- [ ] Mobile-responsive editing experience
- [ ] No regressions in existing editor functionality

---

## Dependencies

- `@dnd-kit/core` - Already installed
- `@dnd-kit/sortable` - Already installed
- `react-icons/fa` - Already installed
- `IconPicker` component - Already exists at `src/components/editor/IconPicker.tsx`

---

## New Editor Architecture (Fresh Build)

Rather than refactoring the existing `ProjectEditor.tsx` (610 lines) and `ProjectEditorPage.tsx` (1,223 lines), we will build a new section-based editor from scratch. This new editor will be the **default for ALL projects** - providing inline editing for every project type.

### Design Philosophy

1. **Start Fresh**: Create new components rather than refactoring legacy code
2. **Reuse Patterns**: Extract working patterns from existing code (upload handlers, autosave, etc.)
3. **Universal Editor**: The new section editor works for ALL project types
4. **Inline Editing Everywhere**: Every project gets the beautiful inline editing experience

### Routing Strategy

```tsx
// In routes/index.tsx

// The new SectionEditorPage replaces the legacy editor for ALL projects
// Route: /:username/:projectSlug/edit -> SectionEditorPage

// Legacy ProjectEditorPage can be kept temporarily at a different route
// for fallback purposes during transition, then deprecated
```

### New Files to Create

#### Core Editor Infrastructure

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/pages/SectionEditorPage.tsx` | New page for section-based editing | ~150 |
| `src/contexts/SectionEditorContext.tsx` | State management for section editor | ~300 |
| `src/hooks/useSectionEditor.ts` | Custom hook for section operations | ~100 |

#### Editor UI Components

| File | Purpose | Reuse From |
|------|---------|-----------|
| `src/components/projects/editor/EditorTopBar.tsx` | Header with title, save status | Extract from ProjectEditorPage |
| `src/components/projects/editor/EditorSidebar.tsx` | Settings panel | Extract from ProjectEditorPage |
| `src/components/projects/editor/BannerEditor.tsx` | Banner image editing | Extract from ProjectEditorPage |
| `src/components/projects/editor/MetadataEditor.tsx` | Title, description, tools, topics | Extract from ProjectEditorPage TL;DR tab |

#### Section Editor Components

| File | Purpose |
|------|---------|
| `src/components/projects/sections/SectionsEditorCanvas.tsx` | Main canvas with drag-and-drop sections |
| `src/components/projects/sections/SectionEditor.tsx` | Wrapper for individual section editing |
| `src/components/projects/sections/SectionTypePicker.tsx` | Modal to add new section types |
| `src/components/projects/sections/editors/index.ts` | Export all section editors |

### SectionEditorContext Design

```tsx
// src/contexts/SectionEditorContext.tsx

interface SectionEditorContextValue {
  // Project
  project: Project;

  // Save state
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  save: () => Promise<void>;

  // Metadata
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  bannerUrl: string;
  setBannerUrl: (url: string) => void;
  externalUrl: string;
  setExternalUrl: (url: string) => void;
  tools: number[];
  setTools: (tools: number[]) => void;
  categories: number[];
  setCategories: (categories: number[]) => void;
  topics: string[];
  setTopics: (topics: string[]) => void;

  // Hero
  heroDisplayMode: HeroDisplayMode;
  setHeroDisplayMode: (mode: HeroDisplayMode) => void;
  heroContent: HeroContent;
  setHeroContent: (content: Partial<HeroContent>) => void;

  // Sections
  sections: ProjectSection[];
  updateSectionContent: (sectionId: string, content: SectionContent) => void;
  addSection: (type: SectionType, afterId?: string) => void;
  deleteSection: (sectionId: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  toggleSectionEnabled: (sectionId: string) => void;

  // Upload handlers (reuse from existing)
  uploadBanner: (file: File) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  uploadVideo: (file: File) => Promise<string>;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
}
```

### SectionEditorPage Layout

```tsx
// src/pages/SectionEditorPage.tsx

export default function SectionEditorPage() {
  const { username, projectSlug } = useParams();
  const [project, setProject] = useState<Project | null>(null);

  // Loading/error states...

  return (
    <DashboardLayout autoCollapseSidebar>
      <SectionEditorProvider project={project} onProjectUpdate={setProject}>
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
          {/* Top Bar */}
          <EditorTopBar />

          {/* Sidebar (settings, project info) */}
          <EditorSidebar />

          {/* Main Editor Canvas */}
          <div className="flex-1 overflow-y-auto">
            {/* Banner Editor */}
            <BannerEditor />

            {/* Inline Preview/Edit - Like the display page but editable */}
            <div className="max-w-6xl mx-auto px-8 py-12">
              {/* Title - Inline Editable */}
              <InlineEditableTitle />

              {/* Description - Inline Editable */}
              <InlineEditableDescription />

              {/* Hero Display - Inline Editable */}
              <HeroEditor />

              {/* Sections Canvas */}
              <SectionsEditorCanvas />

              {/* Add Section Button */}
              <AddSectionButton />
            </div>
          </div>
        </div>
      </SectionEditorProvider>
    </DashboardLayout>
  );
}
```

### Inline Editing UX

The new editor shows the actual project layout (like the display page) but with inline editing capabilities:

```tsx
// Example: Inline Editable Title
function InlineEditableTitle() {
  const { title, setTitle } = useSectionEditorContext();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
        className="text-4xl font-bold w-full bg-transparent border-b-2 border-primary-500 focus:outline-none"
        autoFocus
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-4xl font-bold cursor-text hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -mx-2 transition-colors"
    >
      {title || 'Click to add title...'}
    </h1>
  );
}
```

### Patterns to Reuse from Existing Editor

1. **Autosave Logic** (from ProjectEditor.tsx:372-381)
   ```tsx
   useEffect(() => {
     if (!hasUnsavedChanges || !project) return;
     const timer = setTimeout(() => handleSave(), AUTOSAVE_DEBOUNCE_MS);
     return () => clearTimeout(timer);
   }, [hasUnsavedChanges, project, handleSave]);
   ```

2. **Upload Handlers** (from ProjectEditor.tsx:450-527)
   - `handleBannerUpload`
   - `handleFeaturedImageUpload`
   - `handleVideoUpload`

3. **Slug Generation** (from ProjectEditor.tsx:223-231)
   ```tsx
   useEffect(() => {
     if (title && !customSlugSet) {
       setSlug(generateSlug(title));
     }
   }, [title, customSlugSet]);
   ```

4. **DnD Kit Patterns** (from BlockEditorComponents.tsx)
   - `useSortable` hook usage
   - `DndContext` and `SortableContext` setup
   - Drag handle component pattern

5. **Banner Gradient Options** (from ProjectEditorPage.tsx:269-299)
   - Preset gradient images
   - Selection UI with checkmark

### File Structure

```
src/
├── pages/
│   ├── ProjectEditorPage.tsx      # Legacy editor (unchanged)
│   └── SectionEditorPage.tsx      # NEW - Section-based editor
├── contexts/
│   ├── ProjectContext.tsx         # Existing - for display
│   └── SectionEditorContext.tsx   # NEW - for section editor
├── components/projects/
│   ├── editor/                    # NEW directory
│   │   ├── index.ts
│   │   ├── EditorTopBar.tsx
│   │   ├── EditorSidebar.tsx
│   │   ├── BannerEditor.tsx
│   │   ├── MetadataEditor.tsx
│   │   ├── HeroEditor.tsx
│   │   ├── InlineEditableTitle.tsx
│   │   └── InlineEditableDescription.tsx
│   ├── sections/
│   │   ├── SectionsEditorCanvas.tsx   # NEW
│   │   ├── SectionEditor.tsx          # NEW
│   │   ├── SectionTypePicker.tsx      # NEW
│   │   └── editors/                   # NEW directory
│   │       ├── index.ts
│   │       ├── OverviewSectionEditor.tsx
│   │       ├── FeaturesSectionEditor.tsx
│   │       ├── TechStackSectionEditor.tsx
│   │       ├── GallerySectionEditor.tsx
│   │       ├── ArchitectureSectionEditor.tsx
│   │       ├── DemoSectionEditor.tsx
│   │       ├── ChallengesSectionEditor.tsx
│   │       ├── LinksSectionEditor.tsx
│   │       └── CustomSectionEditor.tsx
│   └── shared/
│       ├── IconCard.tsx               # NEW
│       └── ... (existing)
```

### Migration Path

1. **All Projects**: Use the new SectionEditorPage as the default editor
2. **Projects Without Sections**: Auto-initialize with default sections based on existing content
3. **Legacy Blocks**: Convert legacy block content to appropriate sections on first edit
4. **Fallback**: Keep legacy editor accessible via feature flag during transition period

### Auto-Initialize Sections for Non-Section Projects

```tsx
// When opening a project without sections in the new editor
function initializeSectionsFromProject(project: Project): ProjectSection[] {
  const sections: ProjectSection[] = [];

  // Always add Overview section
  sections.push({
    id: crypto.randomUUID(),
    type: 'overview',
    enabled: true,
    order: 0,
    content: {
      headline: project.title,
      description: project.description || '',
      metrics: [],
    },
  });

  // If project has legacy blocks, create a Custom section with them
  if (project.content?.blocks?.length > 0) {
    sections.push({
      id: crypto.randomUUID(),
      type: 'custom',
      enabled: true,
      order: 1,
      content: {
        blocks: project.content.blocks,
      },
    });
  }

  // Add empty Features section for user to populate
  sections.push({
    id: crypto.randomUUID(),
    type: 'features',
    enabled: true,
    order: 2,
    content: {
      title: 'Key Features',
      features: [],
    },
  });

  return sections;
}
```

### Testing Checklist

- [ ] New SectionEditorPage loads correctly for ALL project types
- [ ] Projects without sections get auto-initialized sections
- [ ] Autosave works in new editor
- [ ] All section types are editable
- [ ] Drag-and-drop reordering works
- [ ] IconCard component works with icon picker
- [ ] Changes persist to backend
- [ ] Preview matches display page

---

## Updated Implementation Phases

### Phase 0: Editor Infrastructure (New Build)
1. Create `SectionEditorContext.tsx` with state management
2. Create `SectionEditorPage.tsx` with basic layout
3. Create `EditorTopBar.tsx` (extract/adapt from existing)
4. Create `EditorSidebar.tsx` (extract/adapt from existing)
5. Create `BannerEditor.tsx` (extract/adapt from existing)
6. Update routing to use new editor for ALL projects
7. Add auto-initialization logic for projects without sections

### Phase 1: Foundation Components
1. Create `IconCard.tsx` component with display and edit modes
2. Create `SectionsEditorCanvas.tsx` with drag-and-drop
3. Create `SectionEditor.tsx` wrapper component
4. Create `SectionTypePicker.tsx` modal

### Phase 2: Section-Specific Editors
1. `FeaturesSectionEditor.tsx` with IconCard grid
2. `OverviewSectionEditor.tsx` with inline editing
3. `TechStackSectionEditor.tsx` with categories
4. `GallerySectionEditor.tsx` with image management

### Phase 3: Advanced Editors
1. `ArchitectureSectionEditor.tsx` with Mermaid preview
2. `DemoSectionEditor.tsx` with video embed
3. `ChallengesSectionEditor.tsx` with accordion
4. `LinksSectionEditor.tsx` with link cards
5. `CustomSectionEditor.tsx` (block-based fallback)

### Phase 4: Polish & Integration
1. Inline editing for title/description
2. Hero display editing
3. Keyboard shortcuts
4. Mobile responsiveness
5. Error handling and loading states

---

## Testing & Validation Protocol

**IMPORTANT**: After completing each phase, Claude must run real tests to validate functionality before moving to the next phase. Tests should include curl commands, browser verification, and fixing any issues until all tests pass.

### Phase 0 Validation
```bash
# 1. Verify dev server is running
curl -s http://localhost:5173 | head -5

# 2. Test that new editor page loads for a project
curl -s "http://localhost:5173/alliejones42/redis-wellness/edit" | grep -o "SectionEditor\|editor"

# 3. Check for console errors in browser DevTools
# Manual: Open browser, navigate to edit page, check console

# 4. Verify context is providing state
# Manual: Add console.log in SectionEditorContext, check values load
```

**Exit Criteria Phase 0:**
- [ ] New SectionEditorPage renders without errors
- [ ] EditorTopBar shows project title and save status
- [ ] EditorSidebar opens/closes correctly
- [ ] BannerEditor displays and allows banner changes
- [ ] All projects route to new editor (not just v2)

### Phase 1 Validation
```bash
# 1. Test IconCard renders in features section
curl -s "http://localhost:5173/alliejones42/redis-wellness/edit" | grep -o "IconCard\|icon-card"

# 2. Verify drag-and-drop library is loaded
curl -s "http://localhost:5173/alliejones42/redis-wellness/edit" | grep -o "dnd-kit\|sortable"
```

**Exit Criteria Phase 1:**
- [ ] IconCard component displays with icon, title, description
- [ ] IconCard edit mode allows changing icon via picker
- [ ] Sections can be reordered via drag-and-drop
- [ ] SectionTypePicker modal shows all section types
- [ ] Adding a new section works

### Phase 2 Validation
```bash
# 1. Test each section editor loads
# Navigate to project with each section type and verify editable

# 2. Test autosave via API call
curl -X PATCH "http://localhost:8000/api/projects/{id}/" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"content": {"sections": [...]}}' | jq '.content.sections'
```

**Exit Criteria Phase 2:**
- [ ] FeaturesSectionEditor: Can add/edit/delete/reorder features
- [ ] OverviewSectionEditor: Inline editing works for headline/description
- [ ] TechStackSectionEditor: Can add/edit categories and technologies
- [ ] GallerySectionEditor: Can upload/reorder images
- [ ] Changes autosave to backend

### Phase 3 Validation
```bash
# 1. Test Mermaid diagram rendering
curl -s "http://localhost:5173/alliejones42/redis-wellness/edit" | grep -o "mermaid"

# 2. Test video embed parsing
# Manual: Add YouTube/Vimeo URL, verify embed works
```

**Exit Criteria Phase 3:**
- [ ] ArchitectureSectionEditor: Mermaid code editable with live preview
- [ ] DemoSectionEditor: Video URL parsing and embed works
- [ ] ChallengesSectionEditor: Accordion UI with add/edit/delete
- [ ] LinksSectionEditor: Link cards with icon picker
- [ ] CustomSectionEditor: Block-based fallback works

### Phase 4 Validation
```bash
# 1. Full end-to-end test
# Create new project -> Edit all sections -> Save -> View published page

# 2. Mobile responsiveness
# Use Chrome DevTools mobile emulation, verify all editors work

# 3. Keyboard shortcuts
# Test: Cmd+S saves, Escape closes modals, Tab navigation works
```

**Exit Criteria Phase 4:**
- [ ] Title/description inline editing feels smooth
- [ ] Hero display can be changed between all 5 modes
- [ ] Keyboard shortcuts work (Cmd+S, Escape, etc.)
- [ ] Mobile layout is usable
- [ ] Error states show helpful messages
- [ ] Loading states prevent double-saves

### Continuous Testing Loop

```
┌─────────────────────────────────────────────────────────────┐
│  For each phase:                                            │
│                                                             │
│  1. Implement feature                                       │
│  2. Run validation tests (curl + manual)                    │
│  3. If tests fail → Fix issues → Go to step 2               │
│  4. If tests pass → Document what works → Next phase        │
│                                                             │
│  DO NOT proceed to next phase until all exit criteria met   │
└─────────────────────────────────────────────────────────────┘
```

### Issue Tracking During Implementation

When issues are found during testing, Claude will:
1. Log the issue with reproduction steps
2. Fix the issue immediately
3. Re-run the specific test that failed
4. Continue only when that test passes

Example issue log format:
```
ISSUE: IconCard icon picker not opening
REPRO: Click on icon in edit mode, nothing happens
CAUSE: onClick handler missing from icon wrapper
FIX: Added onClick={() => setShowIconPicker(true)} to icon div
VERIFIED: ✅ Icon picker now opens on click
```
