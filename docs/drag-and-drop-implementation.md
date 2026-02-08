# Drag and Drop Implementation in AllThrive

This document explains how drag and drop functionality is implemented for projects and learning sections in AllThrive.

## Library Used

**@dnd-kit** - A modern, lightweight, performant, accessible and extensible drag & drop toolkit for React.

### Installed Packages

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/modifiers": "^9.0.0",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

## Project Section Reordering

### Main Implementation

**File:** `frontend/src/components/projects/editor/SectionsEditorCanvas.tsx`

The project editor allows users to reorder sections via drag-and-drop.

### Key Features

- Vertical-only dragging with `restrictToVerticalAxis` modifier
- 8px activation constraint to prevent accidental drags
- Keyboard support for accessibility via `KeyboardSensor`
- `DragOverlay` shows a semi-transparent preview while dragging

### Code Pattern

```typescript
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// Configure sensors
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// Drag end handler
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = sections.findIndex((s) => s.id.toString() === active.id);
    const newIndex = sections.findIndex((s) => s.id.toString() === over.id);
    reorderSections(oldIndex, newIndex);
  }
};

// JSX structure
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={sections.map((s) => s.id.toString())}
    strategy={verticalListSortingStrategy}
  >
    {sections.map((section) => (
      <SectionEditor key={section.id} section={section} />
    ))}
  </SortableContext>
  <DragOverlay>
    {activeSection && <SectionEditor section={activeSection} isDragging />}
  </DragOverlay>
</DndContext>
```

### Section Editor Component

**File:** `frontend/src/components/projects/editor/SectionEditor.tsx`

Each section uses the `useSortable` hook:

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: section.id.toString() });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};

// Apply to element
<div ref={setNodeRef} style={style} {...attributes}>
  <div {...listeners} className="cursor-grab active:cursor-grabbing">
    {/* Drag handle */}
  </div>
  {/* Section content */}
</div>
```

## State Management

### Section Editor Context

**File:** `frontend/src/context/SectionEditorContext.tsx`

Key methods for managing section order:

```typescript
import { arrayMove } from '@dnd-kit/sortable';

const reorderSections = (fromIndex: number, toIndex: number) => {
  setSections((prev) => {
    const reordered = arrayMove(prev, fromIndex, toIndex);
    // Update order field for all sections
    return reordered.map((section, index) => ({
      ...section,
      order: index,
    }));
  });
  setHasUnsavedChanges(true);
  triggerAutosave();
};

const addSection = (type: SectionType, afterId?: string) => {
  // Insert at specific position and recalculate order
};

const deleteSection = (sectionId: string) => {
  // Remove and recalculate order
};

const duplicateSection = (sectionId: string) => {
  // Clone and insert after, recalculate order
};
```

## Backend Persistence

### Data Model

**File:** `core/projects/models.py`

Projects store sections as JSON in the `content` field:

```python
class Project(models.Model):
    content = models.JSONField(default=dict, blank=True)
```

### Content Structure

```json
{
  "templateVersion": 2,
  "sections": [
    {
      "id": "uuid-1",
      "type": "overview",
      "enabled": true,
      "order": 0,
      "content": {
        "headline": "...",
        "description": "..."
      }
    },
    {
      "id": "uuid-2",
      "type": "features",
      "enabled": true,
      "order": 1,
      "content": {
        "features": [...]
      }
    }
  ]
}
```

### Autosave Flow

1. **User drags section** → DnD fires `handleDragEnd` event
2. **Context updates state** → Calls `reorderSections(oldIdx, newIdx)`
3. **Updates order field** → All sections recalculated with new index
4. **Marks unsaved** → Sets `hasUnsavedChanges = true`
5. **Debounced autosave** → 500ms timeout triggers save
6. **API call** → `PATCH /api/v1/projects/{id}/` with updated content
7. **Backend saves** → Updates `Project.content` JSONField
8. **UI confirms** → Shows "Saved at X:XX PM" timestamp

## Learning Sections

### Learning Path Section Reordering

**File:** `frontend/src/components/learning/sections/LearningSections.tsx`

Features:
- Edit mode toggle ("Organize" / "Done" button)
- Drag-and-drop only enabled in edit mode
- Shows unsorted topics not assigned to sections

**Sortable Wrapper:** `frontend/src/components/learning/sections/SortableLearningSection.tsx`

- Drag handle appears on hover (left side)
- Delete button on hover (right side)
- Opacity change during drag

### Learning Section Context

**File:** `frontend/src/context/LearningSectionEditorContext.tsx`

```typescript
// Reorder top-level sections
reorderSections(fromIndex, toIndex);

// Reorder topics within a section
reorderChildrenInSection(sectionId, fromIndex, toIndex);
```

API endpoint: `PATCH /me/learning-paths/sections-organization/`

Autosave debounce: 1500ms

## File Locations Summary

| Feature | File |
|---------|------|
| Project sections DnD | `frontend/src/components/projects/editor/SectionsEditorCanvas.tsx` |
| Section editor wrapper | `frontend/src/components/projects/editor/SectionEditor.tsx` |
| Section context & persistence | `frontend/src/context/SectionEditorContext.tsx` |
| Learning sections DnD | `frontend/src/components/learning/sections/LearningSections.tsx` |
| Sortable learning section | `frontend/src/components/learning/sections/SortableLearningSection.tsx` |
| Learning context | `frontend/src/context/LearningSectionEditorContext.tsx` |
| Backend model | `core/projects/models.py` |

## Best Practices Used

1. **Activation constraint** - 8px distance prevents accidental drags
2. **Vertical restriction** - Limits movement to one axis for cleaner UX
3. **Keyboard support** - Full accessibility with arrow key navigation
4. **Drag overlay** - Visual feedback during drag operation
5. **Debounced autosave** - Prevents excessive API calls
6. **Order field** - Explicit ordering for reliable persistence
7. **Optimistic updates** - UI updates immediately, then syncs to backend
