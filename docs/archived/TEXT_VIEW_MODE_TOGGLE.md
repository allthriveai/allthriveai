# Per-Block Text View Toggle

**Date:** 2025-11-27
**Feature:** Individual Markdown vs Plain Text toggle for each text block

---

## Overview

Each text block in project details now has its **own toggle** to switch between **Markdown** (formatted, default) and **Plain Text** (raw markdown) views. Users can mix and match - some blocks in markdown, others in plain text!

---

## User Interface

### Toggle Location

Each text block has a **hover toggle button** in the top-right corner:

```
┌───────────────────────────────────────┐
│  This is a text block          [🔤 Plain Text] │  ← Appears on hover
│  with **markdown** formatting         │
└───────────────────────────────────────┘
```

### Toggle Behavior

**Hover to reveal:**
- Button hidden by default (clean UI)
- Appears when hovering over text block
- `opacity-0 group-hover:opacity-100` transition

**Button states:**
- 🔤 Plain Text - Click to show raw markdown
- 📝 Markdown - Click to show formatted view

**Styling:**
- Small, unobtrusive button
- Gray background with hover effect
- Positioned absolutely in top-right corner
- Shadow for depth

**Responsive design:**
- Works on mobile, tablet, desktop
- Touch-friendly tap targets
- Hover works on desktop, always visible on mobile (tap anywhere)

---

## View Modes

### 1. Markdown (Default) ✅

**What it does:**
- Parses and renders markdown formatting
- Shows rich text with:
  - **Bold**, *italic*, `code`
  - Links (clickable)
  - Lists (bullet, numbered)
  - Block quotes
  - Headings

**Example:**
```
Input:  # Features\n- **Fast** processing\n- Easy to use

Output: (Rendered HTML)
        Features (large heading)
        • Fast processing (bold "Fast")
        • Easy to use
```

**Use case:**
- Default reading experience
- Best for most users
- Rich formatting

---

### 2. Plain Text 📝

**What it does:**
- Shows raw markdown text
- No parsing or rendering
- Monospace font
- Gray background box
- Preserves all formatting characters

**Example:**
```
Input:  # Features\n- **Fast** processing\n- Easy to use

Output: (Raw text in mono font)
        # Features
        - **Fast** processing
        - Easy to use
```

**Use case:**
- See raw markdown
- Copy markdown source
- Debug formatting issues
- Accessibility (screen readers)
- Technical users who prefer raw text

---

## Implementation

### State Management

```typescript
const [plainTextBlocks, setPlainTextBlocks] = useState<Set<string>>(new Set());
```

**Tracks:** Which blocks are in plain text mode (by block ID)
**Default:** Empty set (all blocks show markdown)

### Toggle Function

```typescript
const toggleBlockViewMode = (blockId: string) => {
  setPlainTextBlocks(prev => {
    const newSet = new Set(prev);
    if (newSet.has(blockId)) {
      newSet.delete(blockId);  // Switch to markdown
    } else {
      newSet.add(blockId);      // Switch to plain text
    }
    return newSet;
  });
};
```

### Per-Block Toggle Button

```tsx
<div className="group relative">
  {/* Toggle button - appears on hover */}
  <button
    onClick={() => toggleBlockViewMode(blockId)}
    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded shadow-sm z-10"
    title={isPlainText ? "Show Markdown" : "Show Plain Text"}
  >
    {isPlainText ? '📝 Markdown' : '🔤 Plain Text'}
  </button>

  {/* Block content */}
  {isPlainText ? (
    <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
      {block.content}
    </div>
  ) : (
    <div className="prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: marked.parse(block.content) }}
    />
  )}
</div>
```

### Text Block Rendering

**Top-level text blocks:**
```tsx
{block.type === 'text' && (
  <>
    {textViewMode === 'markdown' ? (
      <div className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(marked.parse(block.content))
        }}
      />
    ) : (
      <div className="font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap">
        {block.content}
      </div>
    )}
  </>
)}
```

**Nested text blocks (in columns):**
Same logic applied to nested blocks within column layouts.

---

## Styling

### Markdown Mode

**Classes:**
```css
prose dark:prose-invert max-w-none
```

**Styles by block type:**
- Heading: `text-2xl font-bold`
- Quote: `border-l-4 border-primary-500 pl-6 italic`
- Body: Default prose styling

### Plain Text Mode

**Classes:**
```css
font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap
```

**Features:**
- Monospace font (code-like)
- Light gray background (dark: dark gray)
- Padding for readability
- Preserves whitespace and line breaks
- Headings: `font-bold text-base` (slightly larger)

---

## User Experience

### When to Use Markdown (Default)

✅ **Best for:**
- Reading project details
- Viewing formatted content
- Following links
- General browsing

### When to Use Plain Text

✅ **Best for:**
- Copying markdown source
- Debugging formatting
- Seeing raw structure
- Screen reader users (simpler text)
- Technical users who prefer raw format

---

## Examples

### Feature List

**Markdown view:**
```
Features
• Fast and efficient
• Privacy-focused
• Easy to use
```

**Plain text view:**
```
## Features
- **Fast** and efficient
- Privacy-focused
- Easy to use
```

### Code Block Reference

**Markdown view:**
```
See the example code in the README
```

**Plain text view:**
```
See the `example code` in the README
```

---

## Dark Mode Support

Both views support dark mode:

**Markdown:**
- Uses `dark:prose-invert` for dark-friendly colors

**Plain Text:**
- Dark background: `dark:bg-gray-900`
- Light text color (automatic from parent)

---

## Accessibility

### Keyboard Navigation

- Toggle buttons are focusable
- Tab to navigate between buttons
- Enter/Space to activate

### Screen Readers

- Buttons have clear labels: "Markdown" and "Plain Text"
- Active state announced via styling
- Plain text mode may be easier for some screen readers

---

## Mobile Responsiveness

**All screen sizes:**
- Toggle appears inline with header
- Buttons stack nicely on mobile
- Touch-friendly tap targets
- No horizontal scroll

---

## Benefits

✅ **Granular control** - Toggle individual blocks, not all at once
✅ **Mix and match** - Some blocks in markdown, others in plain text
✅ **Clean UI** - Buttons hidden until hover (no clutter)
✅ **Accessibility** - Plain text for screen readers when needed
✅ **Developer-friendly** - Inspect raw markdown for specific blocks
✅ **Copy-friendly** - Easy to copy source of individual blocks
✅ **No additional API calls** - Client-side only
✅ **Instant switching** - No page reload
✅ **Context-aware** - Each block remembers its state independently

---

## Future Enhancements

Potential improvements:
- **Copy button** for plain text mode
- **Download markdown** button
- **Syntax highlighting** for markdown in plain text mode
- **Remember preference** (localStorage)
- **Per-block toggle** (instead of global)
- **"View Source"** modal for individual blocks

---

## Files Changed

**Frontend:**
- `frontend/src/pages/ProjectDetailPage.tsx`
  - Added `textViewMode` state
  - Added toggle buttons in header
  - Updated text block rendering (top-level and nested)

---

## Testing

1. Navigate to any project detail page
2. Find "Project Details" section with text blocks
3. **Hover over any text block**
4. Verify: Toggle button appears in top-right corner (🔤 Plain Text)
5. Click toggle button
6. Verify: That specific block shows raw markdown (with `**`, `#`, etc.)
7. Hover again and click toggle (now shows 📝 Markdown)
8. Verify: Block returns to formatted view
9. Test with multiple blocks:
   - Toggle block 1 to plain text ✅
   - Toggle block 3 to plain text ✅
   - Verify: Block 2 still shows markdown ✅
   - Toggle block 1 back to markdown ✅
   - Verify: Block 3 still plain text, others markdown ✅
10. Test with:
    - Different block types (headings, quotes, body)
    - Column layouts (nested blocks)
    - Dark mode
    - Mobile view

---

## Summary

Each text block now has its **own individual toggle**:
- **Markdown** (default): Formatted, rich text
- **Plain Text**: Raw markdown source

**Key features:**
- ✅ Hover to reveal toggle button (clean UI)
- ✅ Toggle individual blocks independently
- ✅ Mix markdown and plain text blocks
- ✅ Works for all text blocks (including columns)
- ✅ No backend changes needed!

Perfect for developers who want to inspect specific blocks without switching the entire page! 🎉
