# Frontend Blocks Wiring Fix

**Date:** 2025-11-27
**Issue:** Project details showing as empty even though 54 README blocks were created

---

## Problems Found

### 1. Field Name Mismatch ❌

**Backend saved:**
```python
content={
    'readme_blocks': analysis.get('readme_blocks', []),  # ❌ Wrong field name
}
```

**Frontend expected:**
```typescript
project.content.blocks.map((block, index) => {  // ✅ Looking for 'blocks'
```

**Result:** Frontend couldn't find the blocks because it was looking for `blocks` but backend saved them as `readme_blocks`.

---

### 2. Generated Diagram Not in Blocks ❌

**Backend saved:**
```python
validated['generated_diagram'] = generated_diagram  # Stored separately
```

**Frontend expected:**
```typescript
project.content.blocks.map((block, index) => {
  if (block.type === 'mermaid') {  // Looking for mermaid blocks in the array
```

**Result:** AI-generated diagrams were stored in `generated_diagram` but never added to the blocks array, so frontend couldn't display them.

---

## Solutions Implemented

### Fix 1: Rename `readme_blocks` to `blocks`

**Files Updated:**
- `core/integrations/github/views.py:300`
- `services/project_agent/tools.py:283`

**Changes:**
```python
# Before
'readme_blocks': analysis.get('readme_blocks', []),

# After
'blocks': analysis.get('readme_blocks', []),  # Frontend expects 'blocks'
```

---

### Fix 2: Add Generated Diagram to Blocks Array

**File:** `services/github_ai_analyzer.py`

**Success case (lines 174-182):**
```python
if generated_diagram:
    validated['generated_diagram'] = generated_diagram
    # Add generated diagram as a mermaid block so frontend can display it
    validated['readme_blocks'].append({
        'type': 'mermaid',
        'code': generated_diagram,
        'caption': 'Architecture Diagram',
    })
    logger.info(f'✅ AI generated architecture diagram for {name} and added to blocks')
```

**Fallback case (lines 231-239):**
```python
if generated_diagram:
    fallback['generated_diagram'] = generated_diagram
    # Add generated diagram as a mermaid block so frontend can display it
    fallback['readme_blocks'].append({
        'type': 'mermaid',
        'code': generated_diagram,
        'caption': 'Architecture Diagram',
    })
    logger.info(f'✅ Generated diagram added to fallback blocks for {name}')
```

---

## How It Works Now

### Before Fix:
```json
{
  "content": {
    "readme_blocks": [/* 54 blocks */],  // Frontend can't see this
    "generated_diagram": "graph TB..."    // Frontend can't see this either
  }
}
```
**Result:** Empty project details 😞

### After Fix:
```json
{
  "content": {
    "blocks": [
      /* 54 blocks from README */,
      {
        "type": "mermaid",
        "code": "graph TB...",
        "caption": "Architecture Diagram"
      }
    ]
  }
}
```
**Result:** All blocks render! 🎉

---

## Frontend Block Rendering Support

The frontend already has full support for rendering these block types:

### Supported Block Types:

1. **Text Blocks**
   ```typescript
   { type: 'text', style: 'heading'|'quote'|'body', content: string, markdown: boolean }
   ```

2. **Image Blocks**
   ```typescript
   { type: 'image', url: string, caption: string }
   ```

3. **Mermaid Diagrams** ✅
   ```typescript
   { type: 'mermaid', code: string, caption: string }
   ```

4. **Code Snippets**
   ```typescript
   { type: 'code_snippet', code: string, language: string, filename: string }
   ```

5. **Image Grids**
   ```typescript
   { type: 'imageGrid', images: [{url, caption}], caption: string }
   ```

6. **Columns Layout**
   ```typescript
   { type: 'columns', columnCount: number, columns: [...] }
   ```

7. **Buttons**
   ```typescript
   { type: 'button', text: string, url: string, icon: string, style: string }
   ```

---

## What the Frontend Does

**File:** `frontend/src/pages/ProjectDetailPage.tsx:925`

```typescript
{project.content.blocks.map((block, index) => {
  // Renders each block based on type
  if (block.type === 'text') { /* render text */ }
  if (block.type === 'image') { /* render image */ }
  if (block.type === 'mermaid') { /* render mermaid diagram */ }
  if (block.type === 'code_snippet') { /* render code */ }
  if (block.type === 'imageGrid') { /* render image grid */ }
  // etc...
})}
```

---

## Testing

After importing `redis-wellness`, the project should now display:

✅ **54 README content blocks** (headings, paragraphs, images, etc.)
✅ **1 AI-generated Architecture Diagram** (rendered as Mermaid)

### Verify in Database:
```sql
SELECT
  title,
  jsonb_array_length(content->'blocks') as block_count,
  content->'generated_diagram' IS NOT NULL as has_diagram
FROM projects
WHERE slug = 'redis-wellness-5';
```

Expected result:
```
title            | block_count | has_diagram
-----------------|-------------|------------
redis-wellness   |     55      |    true
```

(54 README blocks + 1 generated diagram block = 55 total)

### Verify in Logs:
```
📦 README Parser Final Result:
   - Total blocks: 54

✅ AI generated architecture diagram for redis-wellness and added to blocks

💾 About to create project with data:
   readme_blocks_count: 54
```

Note: After the fix, the final count should show 55 (54 + 1 diagram).

---

## Summary

Two critical issues prevented the frontend from displaying project details:

1. **Field name mismatch**: Backend saved `readme_blocks`, frontend expected `blocks` ✅ Fixed
2. **Generated diagrams not in array**: Stored separately instead of as blocks ✅ Fixed

Both issues are now resolved. The next GitHub import will show all content blocks and the AI-generated architecture diagram! 🚀
