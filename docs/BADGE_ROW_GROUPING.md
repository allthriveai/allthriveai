# Badge Row Grouping

**Date:** 2025-11-27
**Feature:** Automatic grouping of consecutive shield/badge images into horizontal rows

---

## Overview

Shield badges (like shields.io badges) are now automatically detected and grouped into horizontal rows instead of being stacked vertically. This creates a much cleaner, more professional look that matches how badges are typically displayed in GitHub READMEs.

---

## Problem

**Before:**
```
Badge 1
Badge 2
Badge 3
Badge 4
```
↓ Badges stacked vertically (bad UX)

**After:**
```
[Badge 1] [Badge 2] [Badge 3] [Badge 4]
```
↓ Badges displayed in a horizontal row (good UX)

---

## How It Works

### 1. Badge Detection

The parser automatically detects badge images from these services:

**Supported Badge Services:**
- `img.shields.io` ✅
- `badge.fury.io` ✅
- `travis-ci.org` / `travis-ci.com` ✅
- `circleci.com` ✅
- `codecov.io` ✅
- `coveralls.io` ✅
- `snyk.io/test` ✅
- `badges.gitter.im` ✅
- `badge.buildkite.com` ✅
- `github.com/badges` ✅
- `flat.badgen.net` ✅
- `badgen.net` ✅

### 2. Automatic Grouping

When parsing README content:
1. Detect consecutive image blocks
2. Check if each image is a badge (using `_is_badge_url()`)
3. Group 2+ consecutive badges into a single `badgeRow` block
4. Single badges remain as regular image blocks

**Example:**

**Input (Markdown):**
```markdown
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build](https://img.shields.io/badge/build-passing-green.svg)
![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

Some text here...
```

**Output (Blocks):**
```json
[
  {
    "type": "badgeRow",
    "badges": [
      {"url": "https://img.shields.io/badge/license-MIT-blue.svg", "caption": "License"},
      {"url": "https://img.shields.io/badge/build-passing-green.svg", "caption": "Build"},
      {"url": "https://img.shields.io/badge/version-1.0.0-orange.svg", "caption": "Version"}
    ]
  },
  {
    "type": "text",
    "content": "Some text here...",
    "markdown": true
  }
]
```

### 3. Smart Grouping Rules

**Rule 1: Minimum 2 badges**
- Single badge → Regular `image` block
- 2+ consecutive badges → `badgeRow` block

**Rule 2: Consecutive only**
- Badges must be directly adjacent
- Any non-badge block breaks the group

**Example:**
```
Badge 1
Badge 2    } → Badge Row
Badge 3
Text
Badge 4    → Regular image block (not consecutive)
```

---

## Implementation

### Backend Changes

**File:** `services/readme_parser.py`

**1. Badge Detection Method**

Already existed:
```python
def _is_badge_url(self, url: str) -> bool:
    """Check if URL is a badge/shield image."""
    badge_services = [
        'img.shields.io',
        'badge.fury.io',
        # ... more services
    ]
    url_lower = url.lower()
    return any(badge_service in url_lower for badge_service in badge_services)
```

**2. Badge Grouping Method**

New method added:
```python
def _group_badge_images(self, blocks: list[dict]) -> list[dict]:
    """Group consecutive badge/shield images into horizontal badge rows."""
    grouped_blocks = []
    badge_group = []

    for block in blocks:
        # Check if this is a badge image
        if block.get('type') == 'image' and self._is_badge_url(block.get('url', '')):
            badge_group.append(block)
        else:
            # If we have accumulated badges, create a badgeRow block
            if badge_group:
                if len(badge_group) == 1:
                    # Single badge - add as regular image block
                    grouped_blocks.append(badge_group[0])
                else:
                    # Multiple consecutive badges - create badgeRow
                    grouped_blocks.append({
                        'type': 'badgeRow',
                        'badges': badge_group,
                    })
                badge_group = []

            # Add the non-badge block
            grouped_blocks.append(block)

    # Handle any remaining badges at the end
    if badge_group:
        if len(badge_group) == 1:
            grouped_blocks.append(badge_group[0])
        else:
            grouped_blocks.append({
                'type': 'badgeRow',
                'badges': badge_group,
            })

    return grouped_blocks
```

**3. Integration**

Called after all blocks are parsed:
```python
# Group consecutive badge images into badge rows
blocks = parser._group_badge_images(blocks)
```

---

### Frontend Changes

**File:** `frontend/src/pages/ProjectDetailPage.tsx`

**Badge Row Rendering (Detail View):**
```typescript
{block.type === 'badgeRow' && block.badges && (
  <div className="flex flex-wrap items-center justify-center gap-2 my-4">
    {block.badges.map((badge: any, badgeIndex: number) => (
      <img
        key={badgeIndex}
        src={badge.url}
        alt={badge.caption || ''}
        className="h-auto"
        style={{ maxHeight: '28px' }}
      />
    ))}
  </div>
)}
```

**Styling:**
- `flex flex-wrap` - Horizontal layout with wrapping
- `items-center justify-center` - Centered alignment
- `gap-2` - Consistent spacing between badges
- `maxHeight: '28px'` - Constrain badge height (typical shield.io size)

**File:** `frontend/src/components/projects/BlockEditorComponents.tsx`

**Badge Row Editing (Editor View):**
```typescript
{block.type === 'badgeRow' ? (
  <div>
    <div className="flex flex-wrap gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
      {block.badges?.map((badge: any, badgeIndex: number) => (
        <div key={badgeIndex} className="relative group">
          <img
            src={badge.url}
            alt={badge.caption || ''}
            className="h-auto"
            style={{ maxHeight: '28px' }}
          />
        </div>
      ))}
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
      Badge Row ({block.badges?.length || 0} badges) - Read-only from GitHub import
    </p>
  </div>
) : ...}
```

**Read-only in Editor:**
- Badges from GitHub import are displayed but not editable
- Shows count and origin message
- Visual distinction with dashed border

---

## User Experience

### Detail View (Published Page)

**Before:**
```
┌─────────────────────┐
│  [License Badge]    │
│  (full width)       │
└─────────────────────┘

┌─────────────────────┐
│  [Build Badge]      │
│  (full width)       │
└─────────────────────┘

┌─────────────────────┐
│  [Version Badge]    │
│  (full width)       │
└─────────────────────┘
```

**After:**
```
┌──────────────────────────────────────┐
│  [License] [Build] [Version]         │
│  (horizontal row, centered)          │
└──────────────────────────────────────┘
```

### Editor View

**Badge Row Display:**
```
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │
│ │  [Badge 1] [Badge 2] [Badge 3]    │ │
│ └────────────────────────────────────┘ │
│ Badge Row (3 badges) - Read-only       │
└────────────────────────────────────────┘
```

---

## Examples

### Example 1: Typical GitHub README

**Markdown:**
```markdown
# Project Name

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-green.svg)
![Version](https://img.shields.io/badge/version-2.1.0-orange.svg)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)

Description of the project...
```

**Result:**
- 4 badges grouped into one horizontal row
- Centered display
- Proper spacing
- Description text below

### Example 2: Mixed Content

**Markdown:**
```markdown
![Badge 1](https://img.shields.io/badge/status-active-green.svg)
![Badge 2](https://img.shields.io/badge/version-1.0.0-blue.svg)

![Screenshot](screenshots/demo.png)

![Badge 3](https://img.shields.io/badge/maintained-yes-green.svg)
```

**Result:**
- Badge 1 + Badge 2 → Badge row (2 badges)
- Screenshot → Regular image block (full width, centered)
- Badge 3 → Regular image block (single badge, not grouped)

### Example 3: Privacy Badge Example

**Markdown:**
```markdown
![Privacy](https://img.shields.io/badge/privacy-100%25%20local-success.svg)
![Open Source](https://img.shields.io/badge/open%20source-yes-brightgreen.svg)
```

**Result:**
- 2 badges in horizontal row
- Natural width maintained (not stretched)
- Centered display

---

## Benefits

✅ **Professional appearance** - Matches GitHub README style
✅ **Better space usage** - Horizontal rows vs vertical stacking
✅ **Automatic detection** - No manual work required
✅ **Smart grouping** - Only groups consecutive badges
✅ **Flexible** - Single badges remain as regular images
✅ **Responsive** - Wraps on small screens with `flex-wrap`
✅ **Consistent height** - Max 28px (standard badge height)
✅ **Centered** - Professional centered alignment

---

## Logging

**Success:**
```
🏷️  Grouped 4 consecutive badges into a badge row
🏷️  Grouped 2 consecutive badges into a badge row (at end)
```

**No grouping needed:**
```
(No log - single badges remain as regular image blocks)
```

---

## Testing

### Test Case 1: Multiple Consecutive Badges

**Input:**
```markdown
![Badge 1](https://img.shields.io/badge/test-1-blue.svg)
![Badge 2](https://img.shields.io/badge/test-2-green.svg)
![Badge 3](https://img.shields.io/badge/test-3-red.svg)
```

**Expected:**
- One `badgeRow` block with 3 badges
- Horizontal display
- Centered

### Test Case 2: Single Badge

**Input:**
```markdown
![Badge](https://img.shields.io/badge/test-badge-blue.svg)
```

**Expected:**
- Regular `image` block (not badgeRow)
- Centered display
- Natural width

### Test Case 3: Interrupted Sequence

**Input:**
```markdown
![Badge 1](https://img.shields.io/badge/test-1-blue.svg)
![Badge 2](https://img.shields.io/badge/test-2-green.svg)

Some text

![Badge 3](https://img.shields.io/badge/test-3-red.svg)
```

**Expected:**
- Badge Row (badges 1-2)
- Text block
- Regular image (badge 3 - single, not consecutive)

### Verification:

1. Import a GitHub repo with shields.io badges
2. Check project detail page
3. Verify badges display in horizontal row
4. Check editor view
5. Verify badge row shown as read-only
6. Verify proper spacing and centering

---

## Limitations

**Read-only in Editor:**
- Badge rows from GitHub imports are read-only
- Cannot add/remove badges from a badge row
- To edit, would need to delete entire block and re-add

**Future Enhancements:**
- Add manual badge row creation in editor
- Allow adding/removing badges from badge rows
- Badge row editing UI

---

## Summary

Shield/badge images are now automatically detected and grouped into horizontal rows:

- ✅ **Auto-detection** - Recognizes 12+ badge services
- ✅ **Smart grouping** - 2+ consecutive badges → badge row
- ✅ **Horizontal layout** - Professional appearance
- ✅ **Responsive** - Wraps on small screens
- ✅ **Natural sizing** - Respects badge dimensions
- ✅ **Centered alignment** - Clean look

Perfect for GitHub READMEs with shields.io badges! 🏷️
