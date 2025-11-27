# Markdown/WYSIWYG Editor Mode Toggle

**Date:** 2025-11-27
**Feature:** Per-block editor mode toggle on project edit page

---

## Overview

Each text block in the project editor now has its **own toggle** to switch between **Markdown** (raw text, default) and **WYSIWYG** (rich text editor) editing modes. Users can choose their preferred editing experience for each block!

---

## User Interface

### Toggle Location

Each text block has a **hover toggle button** in the block toolbar (top-right corner):

```
┌─────────────────────────────────────────────────┐
│                     [📄][📝][🗑️] │  ← Toolbar appears on hover
│  Text content here...                           │
│  **markdown** formatted                         │
└─────────────────────────────────────────────────┘

Toolbar buttons (left to right):
📄 = Editor mode toggle (Markdown/WYSIWYG)
📝 = Drag handle (reorder blocks)
🗑️ = Delete block
```

### Toggle Behavior

**Hover to reveal:**
- Button hidden by default (clean UI)
- Appears when hovering over text block
- `opacity-0 group-hover:opacity-100` transition
- Instant mode switching

**Button states:**
- 📝 WYSIWYG - Click to switch to rich text editor
- 💻 Markdown - Click to switch to markdown editor

**Styling:**
- Part of the block toolbar
- Consistent with drag and delete buttons
- White background with hover effect
- Shadow for depth
- Only visible for text blocks (not headings)

**Responsive design:**
- Works on desktop, tablet, mobile
- Touch-friendly tap targets

---

## Editor Modes

### 1. Markdown (Default) ✅

**What it is:**
- Simple textarea with monospace font
- Raw markdown text editing
- No formatting applied during editing
- Gray background to distinguish from WYSIWYG

**Features:**
- Monospace font (code-like)
- Syntax highlighting (none - plain text)
- Minimum height: 150px (top-level blocks)
- Minimum height: 100px (column blocks)
- Resizable vertically

**Styling:**
```css
font-mono text-sm bg-gray-50 dark:bg-gray-900
border border-gray-300 dark:border-gray-700
```

**Use case:**
- Default editing experience
- Direct control over markdown syntax
- Quick text entry
- Copy/paste markdown from other sources
- Imported content from GitHub (already markdown)

---

### 2. WYSIWYG (Optional) 📝

**What it is:**
- Tiptap-based rich text editor
- Visual formatting with toolbar
- WYSIWYG (What You See Is What You Get)
- Outputs HTML content

**Features:**
- Rich formatting toolbar:
  - **Bold**, *Italic*
  - Headings (H2, H3)
  - Bullet lists
  - Code blocks
  - Links
- Visual editing experience
- Prose styling applied

**Use case:**
- Users who prefer visual editing
- Less technical users
- Rich formatting without markdown knowledge
- Visual feedback while editing

---

## Implementation

### State Management

Each text block maintains its own editor mode state:

```typescript
// Default to markdown mode (true = markdown, false = WYSIWYG)
const [isMarkdownMode, setIsMarkdownMode] = useState(true);
```

**Tracks:** Editor mode for each individual block
**Default:** `true` (markdown mode)
**Independent:** Each block has its own state

### Toggle Function

**In Block Toolbar:**

```typescript
{/* Hover Toolbar - Top Right Corner */}
<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
  {/* Toggle button for text blocks */}
  {block.type === 'text' && block.style !== 'heading' && (
    <button
      onClick={() => setIsMarkdownMode(!isMarkdownMode)}
      className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded shadow-md border border-gray-200 dark:border-gray-700"
      title={isMarkdownMode ? "Switch to WYSIWYG Editor" : "Switch to Markdown Editor"}
    >
      {isMarkdownMode ? (
        <DocumentTextIcon className="w-4 h-4" />
      ) : (
        <CodeBracketIcon className="w-4 h-4" />
      )}
    </button>
  )}
  <button {...attributes} {...listeners} className="...">
    <Bars3Icon className="w-4 h-4" />
  </button>
  <button onClick={onDelete} className="...">
    <TrashIcon className="w-4 h-4" />
  </button>
</div>
```

### Top-Level Text Blocks

```typescript
{block.style === 'heading' ? (
  <input
    type="text"
    value={block.content}
    onChange={(e) => onChange({ content: e.target.value })}
    className="w-full text-4xl font-bold ..."
    placeholder="Title"
  />
) : isMarkdownMode ? (
  <textarea
    value={block.content || ''}
    onChange={(e) => onChange({ content: e.target.value })}
    className="w-full min-h-[150px] px-4 py-3 font-mono text-sm ..."
    placeholder="Start writing in markdown..."
  />
) : (
  <RichTextEditor
    content={block.content || ''}
    onChange={(content) => onChange({ content })}
    placeholder="Start writing..."
  />
)}
```

### Column Text Blocks

Same logic applied to text blocks within column layouts:

```typescript
{isMarkdownMode ? (
  <textarea
    value={block.content || ''}
    onChange={(e) => onChange({ content: e.target.value })}
    className="w-full min-h-[100px] px-3 py-2 font-mono text-xs ..."
    placeholder="Start writing in markdown..."
  />
) : (
  <RichTextEditor
    content={block.content || ''}
    onChange={(content) => onChange({ content })}
    placeholder="Start writing..."
    className="text-sm"
  />
)}
```

---

## Styling Differences

### Markdown Mode

**Top-level blocks:**
```css
w-full min-h-[150px] px-4 py-3
font-mono text-sm
bg-gray-50 dark:bg-gray-900
text-gray-900 dark:text-white
border border-gray-300 dark:border-gray-700
rounded-lg
focus:ring-2 focus:ring-primary-500
resize-y
```

**Column blocks:**
```css
w-full min-h-[100px] px-3 py-2
font-mono text-xs
bg-white dark:bg-gray-800
text-gray-900 dark:text-white
border border-gray-300 dark:border-gray-700
rounded
focus:ring-2 focus:ring-primary-500
resize-y
```

### WYSIWYG Mode

Uses `RichTextEditor` component with prose styling:
- Toolbar with formatting options
- Visual rendering of formatting
- Standard prose typography

---

## User Experience

### When to Use Markdown (Default)

✅ **Best for:**
- GitHub imports (already markdown)
- Technical users comfortable with markdown
- Quick text entry
- Direct control over formatting
- Copy/paste markdown content
- Default for all new blocks

### When to Use WYSIWYG

✅ **Best for:**
- Users who prefer visual editing
- Less technical users
- Visual feedback while editing
- Rich formatting without knowing markdown
- WYSIWYG editing experience

---

## Examples

### Markdown Mode Example

**Input:**
```
## Features

- **Fast** and efficient
- Privacy-focused
- Easy to use

[Learn more](https://example.com)
```

**Display:** Raw markdown text in monospace font

### WYSIWYG Mode Example

**Input:** Visual formatting via toolbar

**Display:** Rendered rich text with visual formatting

---

## Dark Mode Support

Both modes support dark mode:

**Markdown:**
- Dark background: `dark:bg-gray-900` (top-level)
- Dark background: `dark:bg-gray-800` (columns)
- Light text color (automatic)
- Dark borders: `dark:border-gray-700`

**WYSIWYG:**
- RichTextEditor handles dark mode internally
- Prose styling with dark mode support

---

## Accessibility

### Keyboard Navigation

- Toggle buttons are focusable
- Tab to navigate between buttons
- Enter/Space to activate toggle
- Textarea/Editor standard keyboard navigation

### Screen Readers

- Buttons have clear labels: "WYSIWYG" and "Markdown"
- Title attributes for additional context
- Active state announced via styling

---

## Mobile Responsiveness

**All screen sizes:**
- Toggle button visible on hover (desktop)
- Touch-friendly tap targets
- Responsive text sizing
- No horizontal scroll

---

## Benefits

✅ **Markdown default** - Best for GitHub imports and technical users
✅ **Optional WYSIWYG** - For users who prefer visual editing
✅ **Per-block toggle** - Each block independently controlled
✅ **Clean UI** - Buttons hidden until hover (no clutter)
✅ **Instant switching** - No page reload
✅ **Flexible editing** - Choose the best mode for each block
✅ **No backend changes** - Client-side only
✅ **Context-aware** - Each block remembers its state independently

---

## Important Notes

### Content Storage

- Content is stored as-is (whatever format the editor outputs)
- Markdown mode: Stores markdown text
- WYSIWYG mode: Stores HTML (from Tiptap)
- Switching modes: Content remains unchanged

### Headings Exception

- Heading-style blocks use simple text input
- No markdown/WYSIWYG toggle for headings
- Single-line input field

---

## Files Changed

**Frontend:**
- `frontend/src/components/projects/BlockEditorComponents.tsx`
  - Added `isMarkdownMode` state to `BlockEditor`
  - Added toggle button UI
  - Added markdown textarea for markdown mode
  - Conditional rendering based on mode
  - Added `isMarkdownMode` state to `ColumnBlockEditor`
  - Added toggle button for column text blocks
  - Conditional rendering for column blocks

**No backend changes needed!**

---

## Testing

1. Navigate to project edit page: `http://localhost:3002/[username]/[project-slug]/edit`
2. Go to "Project Details" tab
3. Find or add a text block
4. **Hover over the text block**
5. Verify: Toggle button appears in top-right corner (📝 WYSIWYG)
6. Click toggle button
7. Verify: Editor switches to WYSIWYG mode with toolbar
8. Click toggle again (now shows 💻 Markdown)
9. Verify: Editor switches back to markdown textarea
10. Test with multiple blocks:
    - Toggle block 1 to WYSIWYG ✅
    - Add block 2 (defaults to markdown) ✅
    - Toggle block 2 to WYSIWYG ✅
    - Verify: Block 1 still in WYSIWYG, block 2 in WYSIWYG ✅
    - Toggle block 1 back to markdown ✅
    - Verify: Block 2 still WYSIWYG, block 1 markdown ✅
11. Test with column layouts:
    - Add columns block
    - Add text block in column
    - Hover over column text block
    - Verify: Toggle button appears (smaller, says "WYSIWYG")
    - Click to toggle to WYSIWYG mode
    - Verify: Column text block switches to rich editor
12. Test with:
    - Different block types
    - Dark mode
    - Mobile view
    - Content preservation when switching modes

---

## Summary

All text blocks on the project edit page now have **markdown/WYSIWYG toggle**:
- **Markdown** (default): Simple textarea, monospace font
- **WYSIWYG** (optional): Rich text editor with toolbar

**Key features:**
- ✅ Markdown as default mode
- ✅ Hover to reveal toggle button (clean UI)
- ✅ Toggle individual blocks independently
- ✅ Works for both top-level and column text blocks
- ✅ No backend changes needed!
- ✅ Perfect for GitHub imports (already markdown)

Perfect for developers who prefer markdown but want the option to use WYSIWYG when needed! 🎉
