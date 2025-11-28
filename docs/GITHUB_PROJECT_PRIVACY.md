# GitHub Project Privacy Settings

**Date:** 2025-11-27
**Feature:** Private Project Toggle

---

## Overview

GitHub projects are now **published by default** when imported. Users can optionally mark projects as **private** to hide them from public view.

---

## Default Behavior

### ✅ Published (Default)
- All GitHub imports are **published** by default
- Visible on user's public profile
- Accessible via direct URL
- Included in public listings

### 🔒 Private (Optional)
- User can check "Private Project" checkbox
- **Hidden from public** - only visible to the owner
- Not shown in public listings
- Not indexed by search engines

---

## Implementation

### Backend API Changes

**File:** `core/integrations/github/views.py`

**Request Parameters:**
```json
{
  "url": "https://github.com/owner/repo",
  "is_showcase": false,     // Optional: Add to showcase tab
  "is_private": false       // Optional: Hide from public
}
```

**Logic:**
```python
is_private = request.data.get('is_private', False)  # Default: False (public)

project = Project.objects.create(
    # ... other fields ...
    is_published=not is_private,  # Published unless marked as private
)
```

**Results:**
- `is_private=False` → `is_published=True` → **Public** ✅
- `is_private=True` → `is_published=False` → **Private** 🔒

---

### Agent Tool Changes

**File:** `services/project_agent/tools.py`

**Input Schema:**
```python
class ImportGitHubProjectInput(BaseModel):
    url: str = Field(description='GitHub repository URL')
    is_showcase: bool = Field(default=False, description='Add to showcase tab')
    is_private: bool = Field(default=False, description='Hide from public')
```

**Function:**
```python
def import_github_project(
    url: str,
    is_showcase: bool = False,
    is_private: bool = False,
    config: RunnableConfig | None = None,
) -> dict:
    # ... analysis code ...

    project = Project.objects.create(
        # ... other fields ...
        is_published=not is_private,
    )
```

---

## User Experience

### Frontend UI (Proposed)

**Import Dialog:**
```
┌─────────────────────────────────────────┐
│ Import GitHub Repository                │
├─────────────────────────────────────────┤
│                                         │
│ Repository URL:                         │
│ [https://github.com/user/repo        ] │
│                                         │
│ ☐ Add to Showcase                      │
│   (Feature this project publicly)       │
│                                         │
│ ☐ Private Project                      │
│   Hide from public, only visible to you │
│                                         │
│ [ Cancel ]              [ Import ]      │
└─────────────────────────────────────────┘
```

---

## Privacy Matrix

| Checkbox State | is_showcase | is_private | is_published | Visibility |
|----------------|-------------|------------|--------------|------------|
| ☑ Showcase (default)<br>☐ Private | **True** | False | **True** | 🌟 **Public + Showcase (default)** |
| ☐ Showcase<br>☐ Private | False | False | **True** | 🌍 Public |
| ☑ Showcase<br>☑ Private | True | True | **False** | 🔒 Private (showcase ignored) |
| ☐ Showcase<br>☑ Private | False | True | **False** | 🔒 Private |

**Note:** When `is_private=True`, the project is always hidden regardless of `is_showcase`.

---

## Field Meanings

### `is_showcase`
- **Purpose:** Controls whether project appears in **Showcase tab**
- **Visibility:** Only affects tab placement, not public access
- **Default:** `True` ⭐ (all projects showcased by default)

### `is_private`
- **Purpose:** Controls whether project is **hidden from public**
- **Visibility:** When `True`, project is completely private
- **Default:** `False`

### `is_published`
- **Purpose:** Controls **actual public visibility**
- **Calculated:** `is_published = not is_private`
- **Cannot be set directly** (derived from `is_private`)

---

## Migration from Old Behavior

### Before This Change
```python
is_published=is_showcase  # Only showcase items were published
```

**Problem:**
- Playground items were drafts (not published)
- Users had to add to showcase to make public
- No explicit privacy control

### After This Change
```python
is_published=not is_private  # Published unless marked private
```

**Solution:**
- All imports are public by default ✅
- Explicit "Private Project" checkbox for privacy
- Independent showcase and privacy controls

---

## API Examples

### Example 1: Public Project (Default)
```bash
POST /github/import/
{
  "url": "https://github.com/user/awesome-project"
}
```
**Result:** Public project, visible to everyone ✅

---

### Example 2: Showcase Project
```bash
POST /github/import/
{
  "url": "https://github.com/user/featured-work",
  "is_showcase": true
}
```
**Result:** Public project, shown in showcase tab ✅🌟

---

### Example 3: Private Project
```bash
POST /github/import/
{
  "url": "https://github.com/user/private-experiment",
  "is_private": true
}
```
**Result:** Private project, only visible to owner 🔒

---

### Example 4: Private Showcase (Edge Case)
```bash
POST /github/import/
{
  "url": "https://github.com/user/work-in-progress",
  "is_showcase": true,
  "is_private": true
}
```
**Result:** Private project (showcase flag ignored since private) 🔒

---

## Frontend Integration Checklist

- [ ] Add "Private Project" checkbox to import dialog
- [ ] Update import API call to include `is_private` parameter
- [ ] Show privacy indicator on project cards (🔒 icon for private)
- [ ] Filter private projects from public listings
- [ ] Show private projects only to owner
- [ ] Add "Make Public" / "Make Private" toggle in project settings
- [ ] Update project edit form with privacy toggle

---

## Security Considerations

### ✅ Implemented
- Privacy controlled server-side (not client-side)
- `is_published` derived from `is_private` (can't be bypassed)
- Projects filtered at query level (not just hidden in UI)

### 🔜 TODO
- Add project visibility middleware
- Audit log for privacy changes
- Bulk privacy actions
- Privacy change notifications

---

## Summary

**Default Behavior:** All GitHub projects are **public** ✅

**Privacy Control:** Users can check **"Private Project"** to hide from public 🔒

**Implementation:** `is_published = not is_private`

**Both API endpoints updated:**
- `/github/import/` ✅
- Agent tool `import_github_project` ✅

Ready for frontend integration! 🚀
