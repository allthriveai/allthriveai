# ProjectDetailPage Refactoring Plan

## Problem Statement

The `ProjectDetailPage.tsx` is currently **1740 lines** and growing with each new integration. This violates:
- Single Responsibility Principle (handles routing, data fetching, UI, modals, comments, sharing, likes, hero modes, legacy blocks, etc.)
- DRY Principle (share modal, like button, comments are duplicated across layouts)
- Open/Closed Principle (adding a new project type requires modifying this massive file)

## Current Architecture Analysis

### What's Already Well-Structured
1. **Type-specific layouts exist**: `GitHubProjectLayout`, `FigmaProjectLayout`, `RedditThreadLayout`
2. **Section system created**: New template v2 with `ProjectSections` component
3. **CommentTray exists**: Already extracted but not used everywhere
4. **Hooks pattern established**: `useAuth`, `useTheme`, custom hooks

### Pain Points
1. **Massive switch statement** for project type routing (lines 484-558)
2. **Hero section is 500+ lines** with 5 display modes inline
3. **Share modal duplicated** in page and in `RedditThreadLayout`
4. **Legacy block rendering** is 200+ lines inline
5. **State explosion**: 20+ useState calls in one component
6. **Comments sidebar** duplicated (page + layouts)
7. **Like logic** duplicated across components

---

## Implementation Status

### ✅ Phase 1: Extract Shared Utilities (COMPLETE)
- [x] `MermaidDiagram` - `src/components/projects/shared/MermaidDiagram.tsx`
- [x] `ShareModal` - `src/components/projects/shared/ShareModal.tsx`
- [x] `useProjectLike` hook - `src/hooks/useProjectLike.ts`
- [x] `useProjectShare` hook - `src/hooks/useProjectShare.ts`

### ✅ Phase 2: Create Project Context (COMPLETE)
- [x] `ProjectContext` - `src/contexts/ProjectContext.tsx`
- [x] Provides: project, isOwner, like/share/comment handlers, UI state

### ✅ Phase 3: Extract Hero Components (COMPLETE)
- [x] `ProjectHero` container - `src/components/projects/hero/ProjectHero.tsx`
- [x] Individual hero mode components in `hero/` folder

### ✅ Phase 4: Create DefaultProjectLayout (COMPLETE)
- [x] `DefaultProjectLayout` - `src/components/projects/layouts/DefaultProjectLayout.tsx`
- [x] Uses `ProjectHero`, `ProjectSections`, `EditableBlocksContainer`

### ✅ Phase 5: Create ProjectLayoutRouter (COMPLETE)
- [x] `ProjectLayoutRouter` - `src/components/projects/layouts/ProjectLayoutRouter.tsx`
- [x] Routes project.type to correct layout

### 🔄 Phase 6: Inline Editing System (IN PROGRESS)
- [x] `useInlineEditable` hook - `src/hooks/useInlineEditable.ts`
- [x] `InlineEditableTitle` / `InlineEditableText` - `src/components/projects/shared/InlineEditable.tsx`
- [x] `EditableContentBlock` - `src/components/projects/shared/EditableContentBlock.tsx`
- [x] `EditableBlocksContainer` - `src/components/projects/shared/EditableBlocksContainer.tsx`
- [ ] Verify inline editing works end-to-end in browser
- [ ] Add URL editing for image/video blocks

### ⏳ Phase 7: Update Existing Layouts (PENDING)
- [ ] Update `GitHubProjectLayout` to use shared components
- [ ] Update `FigmaProjectLayout` to use shared components
- [ ] Update `RedditThreadLayout` to use shared components

### ⏳ Phase 8: Final Cleanup (PENDING)
- [ ] Remove duplicated code from ProjectDetailPage
- [ ] Add proper TypeScript interfaces
- [ ] Add JSDoc documentation
- [ ] Add error boundaries per layout

---

## Proposed Architecture

### Layer 1: Smart Container (ProjectDetailPage)
Thin orchestration layer that:
- Fetches project data
- Determines layout type
- Provides context to children
- Handles URL routing

### Layer 2: Layout Router (ProjectLayoutRouter)
Pure routing component that maps `project.type` to layout:
```
github_repo → GitHubProjectLayout
figma_design → FigmaProjectLayout
reddit_thread → RedditThreadLayout
* (default) → DefaultProjectLayout
```

### Layer 3: Shared Project Context
React context providing:
- Project data
- Owner status
- Like/comment handlers
- Share handlers
- Edit handlers

### Layer 4: Reusable UI Components (Shared Library)
Components that can be used by ANY layout:

```
src/components/projects/shared/
├── ProjectActions.tsx        # Like, share, comment buttons
├── ShareModal.tsx            # Share modal
├── MermaidDiagram.tsx        # Mermaid diagram renderer
├── InlineEditable.tsx        # Click-to-edit components
│   ├── InlineEditableTitle
│   ├── InlineEditableText
│   └── EditModeIndicator
├── EditableContentBlock.tsx  # Single block editor
├── EditableBlocksContainer.tsx # Full CRUD block container
└── IconCard.tsx              # Reusable icon card
```

**Import Pattern**: Direct imports, NO barrel files
```typescript
// ✅ Good - Direct imports
import { ShareModal } from '../shared/ShareModal';
import { MermaidDiagram } from '../shared/MermaidDiagram';
import { InlineEditableTitle } from '../shared/InlineEditable';

// ❌ Bad - Barrel imports
import { ShareModal, MermaidDiagram } from '../shared';
```

### Layer 5: Shared Hooks
```
src/hooks/
├── useInlineEditable.ts   # Click-to-edit state management
├── useProjectLike.ts      # Like logic
├── useProjectShare.ts     # Share logic
├── useProject.ts          # Data fetching (if needed)
```

### Layer 6: Shared Types
```
src/types/models.ts
├── ProjectBlock           # Block type with id field
├── ProjectContent         # Content structure
├── Project                # Full project model
```

---

## File Structure (Current)

```
frontend/src/
├── pages/
│   └── ProjectDetailPage.tsx        # Container (~150 lines target)
│
├── contexts/
│   └── ProjectContext.tsx           # ✅ DONE
│
├── hooks/
│   ├── useInlineEditable.ts         # ✅ DONE - Edit state management
│   ├── useProjectLike.ts            # ✅ DONE
│   └── useProjectShare.ts           # ✅ DONE
│
├── components/projects/
│   ├── layouts/
│   │   ├── ProjectLayoutRouter.tsx  # ✅ DONE
│   │   ├── DefaultProjectLayout.tsx # ✅ DONE
│   │   ├── github/
│   │   │   └── GitHubProjectLayout.tsx  # Needs shared component update
│   │   ├── figma/
│   │   │   └── FigmaProjectLayout.tsx   # Needs shared component update
│   │   └── reddit/
│   │       └── RedditThreadLayout.tsx   # Needs shared component update
│   │
│   ├── hero/
│   │   ├── ProjectHero.tsx          # ✅ DONE
│   │   ├── HeroImage.tsx            # ✅ DONE
│   │   ├── HeroVideo.tsx            # ✅ DONE
│   │   ├── HeroQuote.tsx            # ✅ DONE
│   │   ├── HeroSlideshow.tsx        # ✅ DONE
│   │   └── HeroSlideUp.tsx          # ✅ DONE
│   │
│   ├── shared/
│   │   ├── ProjectActions.tsx       # ✅ DONE
│   │   ├── ShareModal.tsx           # ✅ DONE
│   │   ├── MermaidDiagram.tsx       # ✅ DONE
│   │   ├── InlineEditable.tsx       # ✅ DONE (Title, Text, Indicator)
│   │   ├── EditableContentBlock.tsx # ✅ DONE
│   │   ├── EditableBlocksContainer.tsx # ✅ DONE
│   │   └── IconCard.tsx             # ✅ DONE
│   │
│   ├── sections/                    # ✅ DONE
│   │   └── ...
│   │
│   └── CommentTray.tsx              # ✅ DONE
```

---

## Reusable Component Guidelines

### 1. Direct Imports Only
Each component is imported directly from its file:
```typescript
import { EditableContentBlock } from '../shared/EditableContentBlock';
```

### 2. Layouts Choose What to Include
Each layout can import only what it needs:
```typescript
// DefaultProjectLayout imports everything
import { InlineEditableTitle, InlineEditableText, EditModeIndicator } from '../shared/InlineEditable';
import { EditableBlocksContainer } from '../shared/EditableBlocksContainer';

// GitHubProjectLayout might only need title editing
import { InlineEditableTitle } from '../shared/InlineEditable';
```

### 3. Shared Types from models.ts
All components use `ProjectBlock` from `@/types/models`:
```typescript
import type { Project, ProjectBlock } from '@/types/models';
```

### 4. Hooks for Shared Logic
Complex logic extracted to hooks:
```typescript
import { useInlineEditable } from '@/hooks/useInlineEditable';
```

---

## Inline Editing Architecture

### Components
1. **`useInlineEditable`** hook - Manages edit state, save/cancel, loading, errors
2. **`InlineEditableTitle`** - Click-to-edit headings (h1-h4)
3. **`InlineEditableText`** - Click-to-edit paragraphs (single/multiline)
4. **`EditableContentBlock`** - Renders and edits a single block
5. **`EditableBlocksContainer`** - Full CRUD: add, remove, reorder blocks with drag-and-drop

### Features
- Click any text to edit (for owners)
- Escape to cancel, Enter to save (single-line)
- Loading indicator during save
- Error toast on failure
- Delete confirmation modal (no browser `confirm()`)
- Drag-and-drop reordering with `@dnd-kit`
- Stable block IDs for React reconciliation

### Data Flow
```
User clicks text
    → startEditing() in useInlineEditable
    → Component switches to input mode
    → User types
    → User blurs or presses Enter
    → save() calls onChange prop
    → onChange calls updateProject API
    → onProjectUpdate updates context
    → UI reflects new value
```

---

## Adding New Project Types (Future)

With this architecture, adding a new type (e.g., `notion_page`) requires:

1. Create `NotionProjectLayout.tsx` in `layouts/notion/`
2. Import shared components as needed:
   ```typescript
   import { InlineEditableTitle } from '../shared/InlineEditable';
   import { ProjectActions } from '../shared/ProjectActions';
   ```
3. Add case to `ProjectLayoutRouter`
4. Done!

No changes to `ProjectDetailPage.tsx` or any shared components.

---

## Estimated Line Counts (Post-Refactor)

| File | Lines | Status |
|------|-------|--------|
| ProjectDetailPage.tsx | ~150 | In progress |
| ProjectContext.tsx | ~100 | ✅ Done |
| ProjectLayoutRouter.tsx | ~50 | ✅ Done |
| DefaultProjectLayout.tsx | ~380 | ✅ Done |
| ProjectHero.tsx | ~50 | ✅ Done |
| HeroImage.tsx | ~80 | ✅ Done |
| HeroVideo.tsx | ~100 | ✅ Done |
| HeroQuote.tsx | ~50 | ✅ Done |
| HeroSlideshow.tsx | ~100 | ✅ Done |
| ProjectActions.tsx | ~100 | ✅ Done |
| ShareModal.tsx | ~150 | ✅ Done |
| MermaidDiagram.tsx | ~50 | ✅ Done |
| InlineEditable.tsx | ~290 | ✅ Done |
| EditableContentBlock.tsx | ~220 | ✅ Done |
| EditableBlocksContainer.tsx | ~575 | ✅ Done |
| useInlineEditable.ts | ~115 | ✅ Done |
| useProjectLike.ts | ~40 | ✅ Done |
| useProjectShare.ts | ~30 | ✅ Done |

**Total**: ~2,780 lines spread across 18+ files (avg ~155 lines each)
**Original**: 1,740 lines in 1 file

More total code (added inline editing), but:
- Each file has single responsibility
- Easy to test individually
- Easy to modify without breaking others
- Easy to add new project types
- Reusable across layouts

---

## Next Steps

### Immediate
1. [ ] Test inline editing in browser
2. [ ] Add image/video URL editing for owners
3. [ ] Verify drag-and-drop reordering works

### Short-term
4. [ ] Update GitHubProjectLayout to use shared InlineEditable
5. [ ] Update FigmaProjectLayout to use shared components
6. [ ] Update RedditThreadLayout to use shared components

### Medium-term
7. [ ] Add undo/redo for block editing
8. [ ] Add optimistic updates for better UX
9. [ ] Add keyboard shortcuts (E to edit, Esc to cancel)

---

## Testing Strategy

1. **Unit tests per component**: Each extracted component gets tests
2. **Integration tests**: ProjectLayoutRouter correctly routes
3. **E2E tests**: Inline editing flow end-to-end
4. **Existing tests**: Should pass unchanged

---

## Migration Safety

- **No breaking changes to routes** - URL structure unchanged
- **No API changes** - Same backend calls
- **Gradual migration** - Can migrate one layout at a time
- **Backwards compatible** - Existing projects continue to work

---

## Success Metrics

1. ✅ No file > 600 lines (was 300, but inline editing adds complexity)
2. ✅ Each component has single responsibility
3. ✅ Adding new project type requires only 2 files
4. ⏳ All existing tests pass
5. ⏳ No visual regressions
6. ⏳ Inline editing works for owners
