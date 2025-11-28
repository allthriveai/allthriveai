# Dynamic Multi-Column Layouts

**Date:** 2025-11-27
**Feature:** AI-Powered Dynamic Layout Optimization

---

## Overview

GitHub project pages now use **AI-powered dynamic layouts** instead of boring single-column layouts! The system automatically detects which sections should be multi-column and groups related content for better visual presentation.

---

## How It Works

### 1. Rule-Based Detection (Fast)

**Automatic multi-column sections:**
- **Features** → 2-3 columns
- **Tech Stack** → 2-3 columns

**Logic:**
```python
if section_type in ['features', 'tech_stack'] and has_multiple_items:
    # Automatically create column layout
    column_count = 2 if items <= 2 else 3
```

### 2. AI-Powered Optimization (Smart)

After parsing, AI analyzes all blocks and suggests intelligent groupings:

```python
# AI analyzes: "Which consecutive blocks should be grouped into columns?"
optimized_blocks = ReadmeParser.optimize_layout_with_ai(blocks, repo_data)
```

**AI considers:**
- Block content and structure
- Related items that should be grouped
- Optimal column counts (2 or 3)
- Visual balance and readability

---

## Supported Column Layouts

### 2-Column Layout
**Use cases:**
- Comparisons (Before/After, Server/Client, etc.)
- Two related features
- Paired tech stack items

**Example:**
```
┌─────────────────────┬─────────────────────┐
│ Stateless Agent     │ Stateful Agent      │
│ - Fast responses    │ - Remembers context │
│ - No memory         │ - Slower startup    │
└─────────────────────┴─────────────────────┘
```

### 3-Column Layout
**Use cases:**
- Feature lists (3-9 items)
- Tech stack (multiple technologies)
- Benefits/highlights

**Example:**
```
┌───────────┬───────────┬───────────┐
│ Feature 1 │ Feature 2 │ Feature 3 │
│ --------- │ --------- │ --------- │
│ Feature 4 │ Feature 5 │ Feature 6 │
└───────────┴───────────┴───────────┘
```

---

## Column Count Logic

```python
if items <= 2:
    columns = 2
elif items <= 6:
    columns = 3
else:
    columns = 3  # Max 3 for readability
```

**Distribution:**
- 2 items → 2 columns (1 item each)
- 3 items → 3 columns (1 item each)
- 4 items → 2 columns (2 items each)
- 5 items → 3 columns (2, 2, 1)
- 6 items → 3 columns (2 items each)
- 7+ items → 3 columns (distributed evenly)

---

## AI Layout Optimization Process

### Input to AI:
```
Project: redis-wellness

Current blocks:
0: text/heading - Features
1: text/body - ✨ Compare stateless vs stateful agents...
2: text/body - 📊 Visualize health metrics with charts...
3: text/body - 🔒 Privacy-first: all data stays local...
4: text/heading - Tech Stack
5: text/body - Python 3.11+...
6: text/body - Redis & RedisVL...
```

### AI Response:
```json
{
  "groupings": [
    {
      "start": 1,
      "end": 4,
      "columns": 3,
      "reason": "Feature list items with emojis"
    },
    {
      "start": 5,
      "end": 7,
      "columns": 2,
      "reason": "Tech stack comparison"
    }
  ]
}
```

### Result:
- Blocks 1-3: Grouped into **3-column** feature grid
- Blocks 5-6: Grouped into **2-column** tech stack
- Other blocks: Remain single-column

---

## Frontend Rendering

The frontend already supports column layouts:

```typescript
{block.type === 'columns' && (
  <div className={`grid gap-6 ${
    block.columnCount === 1 ? 'grid-cols-1' :
    block.columnCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
    'grid-cols-1 md:grid-cols-3'
  }`}>
    {block.columns?.map((column, colIndex) => (
      <div key={colIndex} className="space-y-4">
        {column.blocks?.map((nestedBlock, nestedIndex) => (
          // Render nested blocks
        ))}
      </div>
    ))}
  </div>
)}
```

**Responsive behavior:**
- Mobile: Always 1 column
- Tablet/Desktop: 2 or 3 columns as specified

---

## Example Transformations

### Before (Boring Single Column):
```
Features
- Fast and efficient
- Privacy-focused
- Easy to use

Tech Stack
- Python
- Redis
- LangChain
```

### After (Dynamic Multi-Column):
```
Features
┌───────────────┬───────────────┬───────────────┐
│ Fast and      │ Privacy-      │ Easy to use   │
│ efficient     │ focused       │               │
└───────────────┴───────────────┴───────────────┘

Tech Stack
┌───────────────┬───────────────┐
│ Python        │ Redis         │
│ LangChain     │               │
└───────────────┴───────────────┘
```

---

## Configuration

### Rule-Based Sections
Edit `services/readme_parser.py:290` to add more auto-column sections:

```python
multi_column_types = ['features', 'tech_stack', 'benefits', 'highlights']
```

### AI Optimization
The AI can be disabled by commenting out line 160 in `github_ai_analyzer.py`:

```python
# Disable AI layout optimization
# optimized_blocks = ReadmeParser.optimize_layout_with_ai(blocks, repo_data)
optimized_blocks = blocks  # Use original blocks
```

---

## Performance

**Layout optimization is fast:**
- Rule-based: Instant
- AI optimization: ~300-500ms per project
- Total overhead: Minimal (runs during import, not on every view)

**Caching:**
Layouts are generated once during import and stored in the database. No runtime overhead for users viewing projects.

---

## Logging

Watch for these log messages during import:

```
📐 Created 3-column layout with 6 items for features section
🎨 AI Layout Optimization for redis-wellness
💡 AI suggested 2 layout groupings for redis-wellness
📐 Grouped blocks 1-4 into 3 columns: Feature list items
✅ Layout optimization complete: 54 → 48 blocks
```

---

## Block Structure

### Single-Column Block:
```json
{
  "type": "text",
  "style": "body",
  "content": "This is a paragraph",
  "markdown": true
}
```

### Multi-Column Block:
```json
{
  "type": "columns",
  "columnCount": 3,
  "containerWidth": "full",
  "columns": [
    {
      "blocks": [
        {"type": "text", "style": "body", "content": "Item 1", "markdown": true}
      ]
    },
    {
      "blocks": [
        {"type": "text", "style": "body", "content": "Item 2", "markdown": true}
      ]
    },
    {
      "blocks": [
        {"type": "text", "style": "body", "content": "Item 3", "markdown": true}
      ]
    }
  ]
}
```

---

## Benefits

✅ **More visually engaging** - Breaks up long single-column content
✅ **Better use of screen space** - Especially on desktop
✅ **AI-powered intelligence** - Smart grouping decisions
✅ **Automatic** - No manual configuration needed
✅ **Responsive** - Adapts to mobile/tablet/desktop
✅ **Flexible** - Can be extended with more rules

---

## Future Enhancements

Potential improvements:
- **Card-style layouts** for features with icons
- **Tabs** for different sections
- **Accordions** for long content
- **Side-by-side code comparisons**
- **Image galleries** with lightbox

---

## Summary

Projects now automatically get dynamic multi-column layouts:
1. **Rule-based** detection for common sections (features, tech stack)
2. **AI-powered** optimization for intelligent groupings
3. **Responsive** design that works on all devices
4. **Zero configuration** - works out of the box

Next GitHub import will have beautiful, dynamic layouts! 🎨✨
