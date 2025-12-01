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
* (default) → DefaultProjectLayout (NEW)
```

### Layer 3: Shared Project Context
React context providing:
- Project data
- Owner status
- Like/comment handlers
- Share handlers
- Edit handlers

### Layer 4: Reusable UI Components
- `ProjectHero` - Handles all hero display modes
- `ProjectActions` - Like, share, comment buttons
- `ShareModal` - Single share modal component
- `ProjectOwnerMenu` - Edit/delete/showcase menu
- `MermaidDiagram` - Already duplicated, needs extraction

---

## File Structure

```
frontend/src/
├── pages/
│   └── ProjectDetailPage.tsx        # Thin container (~150 lines)
│
├── contexts/
│   └── ProjectContext.tsx           # Project state & actions
│
├── hooks/
│   ├── useProject.ts                # Data fetching hook
│   ├── useProjectLike.ts            # Like logic hook
│   └── useProjectShare.ts           # Share logic hook
│
├── components/projects/
│   ├── layouts/
│   │   ├── ProjectLayoutRouter.tsx  # Routes to correct layout
│   │   ├── DefaultProjectLayout.tsx # Default/prompt layout
│   │   ├── github/
│   │   │   └── GitHubProjectLayout.tsx
│   │   ├── figma/
│   │   │   └── FigmaProjectLayout.tsx
│   │   └── reddit/
│   │       └── RedditThreadLayout.tsx
│   │
│   ├── hero/
│   │   ├── ProjectHero.tsx          # Hero container
│   │   ├── HeroImage.tsx            # Image mode
│   │   ├── HeroVideo.tsx            # Video mode
│   │   ├── HeroQuote.tsx            # Quote mode
│   │   ├── HeroSlideshow.tsx        # Slideshow mode
│   │   └── HeroSlideUp.tsx          # Slide-up mode
│   │
│   ├── shared/
│   │   ├── ProjectActions.tsx       # Like, comment, share buttons
│   │   ├── ShareModal.tsx           # Share modal
│   │   ├── ProjectOwnerMenu.tsx     # Owner dropdown menu
│   │   ├── MermaidDiagram.tsx       # Mermaid renderer
│   │   └── LegacyBlockRenderer.tsx  # Legacy block compatibility
│   │
│   ├── sections/                    # Already exists
│   │   └── ...
│   │
│   └── CommentTray.tsx              # Already exists
```

---

## Implementation Phases

### Phase 1: Extract Shared Utilities (Low Risk)
1. Create `MermaidDiagram` shared component (duplicated 3x currently)
2. Create `ShareModal` shared component
3. Create `useProjectLike` hook
4. Create `useProjectShare` hook

**Files affected**: New files only, no breaking changes

### Phase 2: Create Project Context
1. Create `ProjectContext` with:
   - project state
   - isOwner
   - like handlers
   - share handlers
   - comment handlers
2. Create `ProjectProvider` wrapper

**Files affected**: New context file

### Phase 3: Extract Hero Components
1. Create `ProjectHero` container that switches on `heroDisplayMode`
2. Extract each mode into its own component:
   - `HeroImage`
   - `HeroVideo`
   - `HeroQuote`
   - `HeroSlideshow` (move `SlideshowCarousel`)
   - `HeroSlideUp` (already `SlideUpHero`)

**Files affected**: New hero files, then update ProjectDetailPage

### Phase 4: Create DefaultProjectLayout
1. Extract the default layout logic from ProjectDetailPage
2. Use `ProjectHero` component
3. Use `ProjectSections` for v2, `LegacyBlockRenderer` for v1
4. Use `ProjectActions` for action buttons

**Files affected**: New DefaultProjectLayout, simplify ProjectDetailPage

### Phase 5: Create ProjectLayoutRouter
1. Create router component that maps type → layout
2. Each layout receives project from context
3. Update existing layouts to use shared components

**Files affected**: New router, update ProjectDetailPage to use it

### Phase 6: Refactor Existing Layouts
1. Update `GitHubProjectLayout` to use shared components
2. Update `FigmaProjectLayout` to use shared components
3. Update `RedditThreadLayout` to use shared components

**Files affected**: Existing layout files

### Phase 7: Final Cleanup
1. Remove duplicated code from ProjectDetailPage
2. Add proper TypeScript interfaces
3. Add JSDoc documentation
4. Add error boundaries per layout

---

## Component Specifications

### ProjectContext
```typescript
interface ProjectContextValue {
  project: Project;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  handleLike: () => Promise<void>;
  handleShare: () => void;
  handleEdit: () => void;
  handleDelete: () => Promise<void>;
  handleToggleShowcase: () => Promise<void>;

  // UI State
  showShareModal: boolean;
  setShowShareModal: (show: boolean) => void;
  showCommentTray: boolean;
  setShowCommentTray: (show: boolean) => void;
  showEditTray: boolean;
  setShowEditTray: (show: boolean) => void;
}
```

### ProjectLayoutRouter
```typescript
interface ProjectLayoutRouterProps {
  // Uses context, no props needed
}

function ProjectLayoutRouter() {
  const { project } = useProjectContext();

  // Pending analysis check
  if (isPendingAnalysis(project)) {
    return <PendingAnalysisView project={project} />;
  }

  // Route to correct layout
  switch (project.type) {
    case 'github_repo':
      return <GitHubProjectLayout />;
    case 'figma_design':
      return <FigmaProjectLayout />;
    case 'reddit_thread':
      return <RedditThreadLayout />;
    default:
      return <DefaultProjectLayout />;
  }
}
```

### useProjectLike Hook
```typescript
function useProjectLike(projectId: number) {
  const [isLiked, setIsLiked] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const { reward } = useReward('likeReward', 'emoji', { emoji: ['💗'] });

  const toggleLike = async () => {
    // ... like logic
  };

  return { isLiked, heartCount, isLiking, toggleLike };
}
```

---

## Adding New Project Types (Future)

With this architecture, adding a new type (e.g., `notion_page`) requires:

1. Create `NotionProjectLayout.tsx` in `layouts/notion/`
2. Add case to `ProjectLayoutRouter`
3. Done!

No changes to `ProjectDetailPage.tsx` or any shared components.

---

## Estimated Line Counts (Post-Refactor)

| File | Lines |
|------|-------|
| ProjectDetailPage.tsx | ~150 |
| ProjectContext.tsx | ~100 |
| ProjectLayoutRouter.tsx | ~50 |
| DefaultProjectLayout.tsx | ~300 |
| ProjectHero.tsx | ~50 |
| HeroImage.tsx | ~80 |
| HeroVideo.tsx | ~100 |
| HeroQuote.tsx | ~50 |
| HeroSlideshow.tsx | ~100 |
| ProjectActions.tsx | ~100 |
| ShareModal.tsx | ~150 |
| ProjectOwnerMenu.tsx | ~80 |
| MermaidDiagram.tsx | ~50 |
| LegacyBlockRenderer.tsx | ~200 |
| useProjectLike.ts | ~40 |
| useProjectShare.ts | ~30 |
| useProject.ts | ~60 |

**Total**: ~1,690 lines spread across 17 files (avg ~100 lines each)
**Current**: 1,740 lines in 1 file

Same total code, but:
- Each file has single responsibility
- Easy to test individually
- Easy to modify without breaking others
- Easy to add new project types

---

## Testing Strategy

1. **Unit tests per component**: Each extracted component gets tests
2. **Integration tests**: ProjectLayoutRouter correctly routes
3. **E2E tests**: Existing tests should pass unchanged

---

## Migration Safety

- **No breaking changes to routes** - URL structure unchanged
- **No API changes** - Same backend calls
- **Gradual migration** - Can migrate one phase at a time
- **Feature flags** - Can toggle between old/new architecture

---

## Success Metrics

1. ✅ No file > 300 lines
2. ✅ Each component has single responsibility
3. ✅ Adding new project type requires only 2 files
4. ✅ All existing tests pass
5. ✅ No visual regressions
