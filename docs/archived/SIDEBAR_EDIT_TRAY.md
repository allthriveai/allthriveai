# Sidebar Edit Tray Feature

## Overview

A new inline editing experience for project owners that allows quick edits without leaving the project detail page. The edit interface appears as a sidebar tray instead of navigating to a separate edit page.

## Implementation Date
November 24, 2025

## Features

### 1. **ProjectEditTray Component**
Location: `frontend/src/components/projects/ProjectEditTray.tsx`

A comprehensive sidebar editor with three tabs:

#### Content Tab
- Project title
- Description
- Tools & technologies selector
- Topics dropdown
- External project URL

#### Hero Display Tab
- Choose hero display mode:
  - Image (with upload)
  - Video (YouTube/Vimeo/Loom URL)
  - Quote (text input)
  - Slideshow (multiple images)
  - Slide Up (animated elements)
- Mode-specific configuration inputs

#### Settings Tab
- Visibility options:
  - Showcase toggle
  - Private toggle
- Project URL slug editor with auto-generation

### 2. **Integration with ProjectDetailPage**

#### Access Methods
1. **Options Menu**: Click the three-dot menu (⋮) → "Quick Edit" button
2. **Keyboard Shortcut**: Press `E` key anywhere on the page (owners only)

#### Visual Indicators
- The "Quick Edit" button shows a keyboard hint badge: `E`
- Clear separation between quick edit (sidebar) and full editor (separate page)

### 3. **Real-Time Updates**

- **Autosave**: Changes are automatically saved after 2 seconds of inactivity
- **Live Preview**: Updates reflect immediately in the main project view
- **Save Status**: Displays "Saving..." or "Saved at [time]" in the tray header

### 4. **Navigation Flow**

```
User Action                          → Destination
─────────────────────────────────────────────────────────────────
Click "+ Add Project"                → Full Page Editor (/edit)
Click "Quick Edit" on detail page    → Sidebar Tray (same page)
Press 'E' key (owner)                → Sidebar Tray (same page)
Click "Open Full Editor" in tray     → Full Page Editor (/edit)
Navigate to /:user/:project/edit     → Full Page Editor
```

## Design Philosophy

### Why Sidebar Tray?
1. **Contextual editing** - See changes in real-time
2. **Less disruption** - No navigation required for quick tweaks
3. **Familiar pattern** - Consistent with existing tool and comment trays
4. **Progressive enhancement** - Full editor still available for complex edits

### Why Keep Full Editor?
1. **Initial project creation** - More space for setting everything up
2. **Complex structural changes** - Better for extensive block editing
3. **Focus mode** - Distraction-free editing environment
4. **Deep linking** - Direct URL access to editor

## Technical Details

### State Management
- Local state within ProjectEditTray component
- Updates passed back to parent via `onProjectUpdate` callback
- Project state synchronized with detail page view

### Autosave Logic
- Debounced save after `AUTOSAVE_DEBOUNCE_MS` (2000ms)
- Race condition prevention using save version tracking
- Initial load detection to prevent save on mount

### Keyboard Shortcut
- Only active for project owners
- Disabled when typing in input/textarea elements
- Toggle behavior (open/close tray with same key)

## User Benefits

### For Project Owners
- **Faster editing** - No page navigation required
- **Immediate feedback** - See changes as you make them
- **Less context switching** - Edit while viewing as visitors see it
- **Flexible workflow** - Choose between quick edit and full editor

### For Development Team
- **Code reuse** - Shares logic with full editor
- **Consistent UX** - Matches existing tray patterns
- **Easy maintenance** - Single source of truth for edit logic
- **Scalable** - Easy to add more tabs/features

## Files Modified

### New Files
- `frontend/src/components/projects/ProjectEditTray.tsx`
- `docs/SIDEBAR_EDIT_TRAY.md`

### Modified Files
- `frontend/src/pages/ProjectDetailPage.tsx`
  - Added ProjectEditTray import
  - Added showEditTray state
  - Modified "Edit" button to open tray
  - Added keyboard shortcut listener
  - Added ProjectEditTray component rendering

## Future Enhancements

### Potential Improvements
1. **Block editor in tray** - Add "Project Details" tab for content blocks
2. **Undo/Redo** - Add history management
3. **Collaborative editing** - Real-time updates from other users
4. **Version history** - View and restore previous versions
5. **Mobile optimization** - Full-screen tray on mobile devices
6. **Keyboard shortcuts** - Additional shortcuts for common actions
7. **Drag-and-drop** - Drag images directly into tray

### Known Limitations
1. Block editing still requires full editor (intentional for v1)
2. No collaborative editing indicators
3. No version history visible in tray
4. Slideshow and slide-up modes have basic UI (can be enhanced)

## Testing Checklist

- [ ] Quick Edit button opens tray correctly
- [ ] E key shortcut works for owners
- [ ] E key disabled when typing in inputs
- [ ] E key has no effect for non-owners
- [ ] Autosave works after changes
- [ ] Changes reflect in main view immediately
- [ ] Tray closes properly with X button
- [ ] Tray closes when clicking overlay
- [ ] Full editor link works
- [ ] Slug auto-generation works
- [ ] Tools selector functions correctly
- [ ] Topics dropdown functions correctly
- [ ] Hero display modes switch correctly
- [ ] Image uploads work
- [ ] Showcase toggle works
- [ ] Private toggle works
- [ ] Mobile responsive (full-width on small screens)
- [ ] Dark mode styling correct
- [ ] No console errors
- [ ] Save status indicators work

## Related Documentation
- [Project Editor Page](../frontend/src/pages/ProjectEditorPage.tsx) - Full editor implementation
- [Project Detail Page](../frontend/src/pages/ProjectDetailPage.tsx) - View page with tray integration
- [Tool Selector](../frontend/src/components/projects/ToolSelector.tsx) - Reused component
- [Topic Dropdown](../frontend/src/components/projects/TopicDropdown.tsx) - Reused component
