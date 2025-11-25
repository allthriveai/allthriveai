# Migration Guide: ProjectEditorPage Refactoring

## Overview

This document provides a detailed, step-by-step guide to refactor `ProjectEditorPage.tsx` (2,559 lines) to use the shared `ProjectEditor` core component, following the proven pattern from `ProjectEditTray.tsx`.

**Estimated Outcome**: ~900-1,000 lines (60% reduction)
**Risk Level**: LOW (pattern already proven with ProjectEditTray)
**Time Estimate**: 2-3 hours

---

## Step 1: Update Imports

### Current (lines 1-47)
```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject, deleteProjectRedirect } from '@/services/projects';
import { getTools } from '@/services/tools';
import { uploadImage, uploadFile } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ToolSelector } from '@/components/projects/ToolSelector';
import { TopicDropdown } from '@/components/projects/TopicDropdown';
import type { Project, ProjectBlock } from '@/types/models';
import type { TopicSlug } from '@/config/topics';
import { generateSlug } from '@/utils/slug';
import { AUTOSAVE_DEBOUNCE_MS } from '@/components/projects/constants';
// ... rest of imports
```

### New
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { listProjects, updateProject, deleteProjectRedirect } from '@/services/projects';
import { uploadImage, uploadFile } from '@/services/upload';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ToolSelector } from '@/components/projects/ToolSelector';
import { TopicDropdown } from '@/components/projects/TopicDropdown';
import type { Project, ProjectBlock } from '@/types/models';
import { generateSlug } from '@/utils/slug';
import { ProjectEditor } from '@/components/projects/ProjectEditor';  // NEW
// ... rest of imports (keep unchanged)
```

**Changes**:
- ❌ Remove: `useCallback`, `useRef`, `useMemo`
- ❌ Remove: `getTools`, `TopicSlug`, `AUTOSAVE_DEBOUNCE_MS`
- ✅ Add: `ProjectEditor`

---

## Step 2: Simplify Component State

### Current (lines 49-101)
```typescript
export default function ProjectEditorPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isInitialLoadRef = useRef(true);
  const saveVersionRef = useRef(0);

  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tldr' | 'details'>('tldr');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [projectTitle, setProjectTitle] = useState('');
  const [editableSlug, setEditableSlug] = useState('');
  const [customSlugSet, setCustomSlugSet] = useState(false);
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTools, setProjectTools] = useState<number[]>([]);
  const [allTools, setAllTools] = useState<any[]>([]);
  const [projectTopics, setProjectTopics] = useState<TopicSlug[]>([]);
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false);

  const [heroDisplayMode, setHeroDisplayMode] = useState<'image' | 'video' | 'slideshow' | 'quote' | 'slideup'>('image');
  const [heroQuote, setHeroQuote] = useState('');
  const [heroVideoUrl, setHeroVideoUrl] = useState('');
  const [heroSlideshowImages, setHeroSlideshowImages] = useState<string[]>([]);
  const [slideUpElement1Type, setSlideUpElement1Type] = useState<'image' | 'video' | 'text'>('image');
  const [slideUpElement1Content, setSlideUpElement1Content] = useState('');
  const [slideUpElement1Caption, setSlideUpElement1Caption] = useState('');
  const [slideUpElement2Type, setSlideUpElement2Type] = useState<'image' | 'video' | 'text'>('text');
  const [slideUpElement2Content, setSlideUpElement2Content] = useState('');
  const [slideUpElement2Caption, setSlideUpElement2Caption] = useState('');
  const [isUploadingSlideUp1, setIsUploadingSlideUp1] = useState(false);
  const [isUploadingSlideUp2, setIsUploadingSlideUp2] = useState(false);
  // ... 40+ state variables!
}
```

### New
```typescript
export default function ProjectEditorPage() {
  const { username, projectSlug } = useParams<{ username: string; projectSlug: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page-specific UI state only
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tldr' | 'details'>('tldr');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
}
```

**Changes**:
- ✅ Keep: `project`, `isLoading`, `error` (page load state)
- ✅ Keep: `showSettingsSidebar`, `focusedBlockId`, `showAddMenu`, `activeTab` (page UI state)
- ✅ Keep: `sensors` (for drag-drop)
- ❌ Remove: All 40+ editor state variables (will come from ProjectEditor)

---

## Step 3: Simplify Project Loading

### Current (lines 110-179)
```typescript
// Load project
useEffect(() => {
  async function loadProject() {
    // ... 60+ lines of state initialization
    setProject(foundProject);
    setThumbnailUrl(foundProject.thumbnailUrl || '');
    setProjectTitle(foundProject.title || '');
    // ... 30+ more setState calls
  }
  loadProject();
}, [projectSlug, username]);
```

### New
```typescript
// Load project
useEffect(() => {
  async function loadProject() {
    if (!projectSlug || !username) {
      setError('Invalid project URL');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const projects = await listProjects();
      const foundProject = projects.find(p => p.slug === projectSlug && p.username === username);

      if (!foundProject) {
        setError('Project not found');
        return;
      }

      setProject(foundProject);  // That's it! ProjectEditor handles the rest
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }

  loadProject();
}, [projectSlug, username]);
```

**Changes**:
- ❌ Remove: All state initialization (ProjectEditor does this)
- ✅ Keep: Basic project loading logic

---

## Step 4: Remove All Effects and Handlers

### Remove These Sections
- ❌ Lines 182-192: Tools loading effect
- ❌ Lines 194-223: Auto-suggest topics effect
- ❌ Lines 225-233: Auto-generate slug effect
- ❌ Lines 235-279: Form data memoization
- ❌ Lines 281-286: Unsaved changes effect
- ❌ Lines 288-364: handleSave function
- ❌ Lines 366-375: Autosave effect
- ❌ Lines 377-392: handleToggleShowcase
- ❌ Lines 394-445: addBlock function
- ❌ Lines 447-459: handleBannerUpload
- ❌ Lines 461-472: handleFeaturedImageUpload
- ❌ Lines 474-485: handleVideoUpload
- ❌ Lines 487-503: handleSlideUpElement1Upload
- ❌ Lines 505-521: handleSlideUpElement2Upload

All of these are provided by `ProjectEditor` via `editorProps`!

---

## Step 5: Add ProjectEditor Wrapper

### Insert After Loading/Error States (after line 555)

```typescript
  // Handle slug change for page navigation
  const handleSlugChange = (newSlug: string) => {
    if (username) {
      navigate(`/${username}/${newSlug}/edit`, { replace: true });
    }
  };

  return (
    <ProjectEditor
      project={project}
      onProjectUpdate={setProject}
      onSlugChange={handleSlugChange}
    >
      {(editorProps) => (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
          {/* All existing UI goes here, using editorProps instead of local state */}
        </div>
      )}
    </ProjectEditor>
  );
```

---

## Step 6: Replace State References in UI

Throughout the UI (lines 558-2559), replace all state references:

### Pattern
```typescript
// OLD
{projectTitle || 'Untitled Project'}
{isSaving ? 'Saving...' : null}
<input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
{heroDisplayMode === 'image' && ...}

// NEW
{editorProps.projectTitle || 'Untitled Project'}
{editorProps.isSaving ? 'Saving...' : null}
<input value={editorProps.thumbnailUrl} onChange={(e) => editorProps.setThumbnailUrl(e.target.value)} />
{editorProps.heroDisplayMode === 'image' && ...}
```

### Systematic Replacements

**Reading State**: Add `editorProps.` prefix
- `projectTitle` → `editorProps.projectTitle`
- `isSaving` → `editorProps.isSaving`
- `lastSaved` → `editorProps.lastSaved`
- `thumbnailUrl` → `editorProps.thumbnailUrl`
- `showBannerEdit` → `editorProps.showBannerEdit`
- `isUploadingBanner` → `editorProps.isUploadingBanner`
- `blocks` → `editorProps.blocks`
- `projectTools` → `editorProps.projectTools`
- `projectTopics` → `editorProps.projectTopics`
- `availableTopics` → `editorProps.availableTopics`
- `featuredImageUrl` → `editorProps.featuredImageUrl`
- `heroDisplayMode` → `editorProps.heroDisplayMode`
- ... (all editor state)

**Setting State**: Add `editorProps.` prefix
- `setProjectTitle` → `editorProps.setProjectTitle`
- `setThumbnailUrl` → `editorProps.setThumbnailUrl`
- `setBlocks` → `editorProps.setBlocks`
- ... (all setters)

**Calling Handlers**: Add `editorProps.` prefix
- `handleBannerUpload(file)` → `editorProps.handleBannerUpload(file)`
- `handleFeaturedImageUpload(file)` → `editorProps.handleFeaturedImageUpload(file)`
- `addBlock(id, type)` → `editorProps.addBlock(id, type)`
- ... (all handlers)

**Keep Unchanged**: Page-specific state
- `showSettingsSidebar`
- `focusedBlockId`
- `showAddMenu`
- `activeTab`
- `sensors`

---

## Step 7: Update TopicDropdown Component

### Current
```typescript
<TopicDropdown
  selectedTopics={projectTopics}
  onChange={setProjectTopics}
  disabled={isSaving}
/>
```

### New (Note: Change from TopicSlug[] to number[])
```typescript
<TopicDropdown
  selectedTopics={editorProps.projectTopics}
  availableTopics={editorProps.availableTopics}
  onChange={editorProps.setProjectTopics}
  disabled={editorProps.isSaving}
/>
```

---

## Step 8: Update Settings Sidebar

Replace state in settings sidebar (lines 622-828):

```typescript
// OLD
<input
  type="checkbox"
  checked={project.isShowcase}
  onChange={handleToggleShowcase}
  disabled={isSaving}
/>

<input
  value={editableSlug}
  onChange={(e) => {
    setEditableSlug(e.target.value);
    setCustomSlugSet(true);
  }}
/>

// NEW
<input
  type="checkbox"
  checked={project.isShowcase}
  onChange={editorProps.handleToggleShowcase}
  disabled={editorProps.isSaving}
/>

<input
  value={editorProps.editableSlug}
  onChange={(e) => {
    editorProps.setEditableSlug(e.target.value);
    editorProps.setCustomSlugSet(true);
  }}
/>
```

---

## Step 9: Keep Block Editor Components Unchanged

The block editor components (lines 1883-2559) can stay as-is:
- `BlockEditor`
- `DraggableColumnBlock`
- `ColumnBlockEditor`
- `SlideshowImageItem`
- `AddBlockMenu`

These are fine inline for now. They can be extracted to separate files in a future PR.

---

## Step 10: Verify and Test

### Verification Checklist
```bash
# 1. TypeScript compilation
cd frontend && npx tsc --noEmit

# 2. Count lines (should be ~900-1000)
wc -l frontend/src/pages/ProjectEditorPage.tsx

# 3. Search for remaining duplicate state
grep -n "useState<" frontend/src/pages/ProjectEditorPage.tsx | wc -l
# Should only see ~4-5 (page-specific UI state)

# 4. Search for duplicate effects
grep -n "useEffect" frontend/src/pages/ProjectEditorPage.tsx | wc -l
# Should only see 1 (project loading)
```

### Testing Checklist
- [ ] Page loads project correctly
- [ ] Banner editor works (upload, URL, gradients)
- [ ] All metadata fields work (title, description, URL)
- [ ] Tools selector works
- [ ] Topics dropdown works
- [ ] Hero display modes work (image, video, quote, slideshow, slide-up)
- [ ] Block editor works (add, edit, delete, reorder)
- [ ] Column blocks work (add, edit, delete, drag between columns)
- [ ] Autosave works
- [ ] Settings sidebar works (showcase, private, slug, redirects)
- [ ] Slug change navigates correctly
- [ ] Preview button works

---

## Common Pitfalls

### 1. Forgetting `editorProps.` Prefix
**Error**: `projectTitle is not defined`
**Fix**: Change `projectTitle` to `editorProps.projectTitle`

### 2. TopicSlug vs number[]
**Error**: Type mismatch in TopicDropdown
**Fix**: ProjectEditor uses `number[]` for topics, not `TopicSlug[]`

### 3. Missing availableTopics Prop
**Error**: TopicDropdown needs availableTopics
**Fix**: Pass `editorProps.availableTopics` to TopicDropdown

### 4. Keeping Old Handlers
**Error**: Function not defined after removing handlers
**Fix**: Use `editorProps.handleXxx` instead

---

## Estimated Impact

### Before
- **Lines**: 2,559
- **State Variables**: 40+
- **Effects**: 7
- **Handlers**: 10+
- **Duplication**: 70% with ProjectEditor core

### After
- **Lines**: ~900-1,000 (60% reduction)
- **State Variables**: 4 (page-specific UI only)
- **Effects**: 1 (project loading)
- **Handlers**: 1 (slug change navigation)
- **Duplication**: 0%

### Benefits
- ✅ Single source of truth for editor logic
- ✅ Bug fixes in core benefit both editors
- ✅ Easier to maintain and test
- ✅ Consistent behavior between page and tray
- ✅ Type-safe with comprehensive interfaces

---

## Example: Before & After Comparison

### Top Bar Section (lines 558-597)

#### Before
```typescript
<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <Link to={`/${username}/${projectSlug}`}>
      <ArrowLeftIcon className="w-5 h-5" />
    </Link>
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        {projectTitle || 'Untitled Project'}
      </h1>
      {isSaving ? (
        <p className="text-xs text-gray-500">Saving...</p>
      ) : lastSaved ? (
        <p className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</p>
      ) : null}
    </div>
  </div>

  <div className="flex items-center gap-3">
    <button onClick={() => window.open(`/${project.username}/${project.slug}`, '_blank')}>
      <EyeIcon className="w-5 h-5" />
      <span>Preview</span>
    </button>
    <button onClick={() => setShowSettingsSidebar(true)}>
      <Bars3Icon className="w-6 h-6" />
    </button>
  </div>
</div>
```

#### After
```typescript
<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <Link to={`/${username}/${projectSlug}`}>
      <ArrowLeftIcon className="w-5 h-5" />
    </Link>
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        {editorProps.projectTitle || 'Untitled Project'}
      </h1>
      {editorProps.isSaving ? (
        <p className="text-xs text-gray-500">Saving...</p>
      ) : editorProps.lastSaved ? (
        <p className="text-xs text-gray-500">Saved {editorProps.lastSaved.toLocaleTimeString()}</p>
      ) : null}
    </div>
  </div>

  <div className="flex items-center gap-3">
    <button onClick={() => window.open(`/${project.username}/${project.slug}`, '_blank')}>
      <EyeIcon className="w-5 h-5" />
      <span>Preview</span>
    </button>
    <button onClick={() => setShowSettingsSidebar(true)}>
      <Bars3Icon className="w-6 h-6" />
    </button>
  </div>
</div>
```

**Changes**: Just add `editorProps.` prefix to editor state!

---

## Timeline

**Phase 1**: Preparation (15 min)
- Back up current file
- Review migration guide

**Phase 2**: State Cleanup (30 min)
- Update imports
- Remove state variables
- Remove effects and handlers

**Phase 3**: UI Updates (60-90 min)
- Add ProjectEditor wrapper
- Replace all state references
- Update component props

**Phase 4**: Testing (30 min)
- TypeScript verification
- Manual testing
- Fix any issues

**Total**: 2-3 hours

---

## Conclusion

This refactoring follows the exact same pattern as `ProjectEditTray.tsx`, which is already proven to work. The main difference is scale - ProjectEditorPage has more UI, but the refactoring approach is identical.

The result will be a cleaner, more maintainable codebase with zero code duplication between the two editor modes.

**Risk**: LOW - Pattern already validated
**Benefit**: HIGH - 60% code reduction, single source of truth
**Recommendation**: Proceed with confidence 🚀
