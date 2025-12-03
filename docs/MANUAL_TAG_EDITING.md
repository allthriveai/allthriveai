# Manual Tag Editing for Reddit Projects

## Overview

Admins can manually edit tags (tools, categories, topics) for Reddit thread projects. Once edited, these tags are locked and won't be overwritten during resync.

## Problem Statement

Previously, Reddit thread projects were auto-tagged using AI topic extraction during sync. This was helpful for automation, but created issues:

1. **No admin control**: Couldn't manually fix incorrect auto-tags
2. **Tags reset on resync**: Manual edits would be overwritten on next sync
3. **No fine-tuning**: Couldn't curate tags for better discovery

## Solution

Added a `tags_manually_edited` flag to the `Project` model. When an admin manually edits tags:
1. The flag is set to `True`
2. Future resyncs skip auto-tagging for that project
3. Manual edits persist permanently (until changed again by admin)

## API Endpoint

### `PATCH /api/v1/projects/{id}/update-tags/`

**Admin only** - Update project tags and lock them from auto-updates.

**Request:**
```json
{
  "tools": [1, 2, 3],           // Array of tool IDs
  "categories": [4, 5],          // Array of taxonomy/category IDs
  "topics": ["python", "ai"]     // Array of topic strings
}
```

**Response:**
```json
{
  "id": 123,
  "title": "Project Title",
  "tools": [
    {"id": 1, "name": "Python", "slug": "python"},
    {"id": 2, "name": "ChatGPT", "slug": "chatgpt"}
  ],
  "categories": [
    {"id": 4, "name": "AI Development", "slug": "ai-development"}
  ],
  "topics": ["python", "ai"],
  "tags_manually_edited": true,
  ...
}
```

**Permissions:**
- Requires admin role (`user.role == 'admin'`)
- Non-admins receive `403 Forbidden`

**Validation:**
- `tools`: Must be array of valid Tool IDs
- `categories`: Must be array of valid Taxonomy IDs (type='category')
- `topics`: Must be array of strings, limited to 15 topics, 50 chars each

## Database Schema

### Project Model Addition

```python
class Project(models.Model):
    # ... existing fields ...
    
    tags_manually_edited = models.BooleanField(
        default=False,
        help_text='If True, tools/categories/topics were manually edited by admin '
                  'and should not be auto-updated during resync',
    )
```

**Migration:** `core/migrations/0020_add_tags_manually_edited.py`

## Sync Service Logic

The sync service now checks the flag before auto-tagging:

```python
# In RedditSyncService._update_thread()
if not project.tags_manually_edited and not project.tools.exists() and not project.topics:
    cls._auto_tag_project(project, metrics, subreddit, agent)
```

**Behavior:**
- `tags_manually_edited=False`: Auto-tagging runs normally
- `tags_manually_edited=True`: Auto-tagging is skipped

## Usage Examples

### Manual Tag Editing (API)

```bash
curl -X PATCH http://localhost:8000/api/v1/projects/123/update-tags/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tools": [1, 2],
    "categories": [3],
    "topics": ["python", "ai_agents", "tutorial"]
  }'
```

### Get Available Tools & Categories

```bash
# Get all tools
curl http://localhost:8000/api/v1/tools/

# Get all categories
curl http://localhost:8000/api/v1/taxonomy/?taxonomy_type=category
```

### Unlock Auto-Tagging

To re-enable auto-tagging for a project (e.g., to test new AI extraction):

```python
project = Project.objects.get(id=123)
project.tags_manually_edited = False
project.save()
```

Or via Django admin at `/admin/core/project/123/change/`

## Frontend Integration

### Requirements for UI Implementation

1. **Admin Detection**
   - Check `user.role === 'admin'` in frontend
   - Only show edit UI for admins

2. **Inline Editing UI**
   - Add "Edit Tags" button next to tag sections
   - Show multi-select for tools/categories
   - Show tag input for topics
   - Visual indicator when `tags_manually_edited=true`

3. **Tag Selection Components**
   - Fetch available tools: `GET /api/v1/tools/`
   - Fetch available categories: `GET /api/v1/taxonomy/?taxonomy_type=category`
   - Use multi-select dropdowns or autocomplete

4. **API Integration**
   ```typescript
   // Update tags
   const response = await fetch(`/api/v1/projects/${projectId}/update-tags/`, {
     method: 'PATCH',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       tools: [1, 2, 3],
       categories: [4],
       topics: ['python', 'ai'],
     }),
   });
   ```

5. **Visual Feedback**
   - Show lock icon when `tags_manually_edited=true`
   - Tooltip: "Tags manually curated by admin"
   - Success message after saving

### Example UI Flow

```
[ Tools ]  [ Categories ]  [ Topics ]  [✏️ Edit] (admin only)

↓ Click Edit

[ Tools ▼ ]  [ Categories ▼ ]  [ Topics + ]  [💾 Save] [✖️ Cancel]
  ☑ Python      ☑ AI Dev           python
  ☐ Rust        ☐ Web Dev          ai_agents
  ☐ ChatGPT     ☐ Data Science     [+ Add topic]

↓ Click Save

API Call → tags_manually_edited = true → 🔒 Locked from auto-updates
```

## Testing

Run the test suite:

```bash
pytest core/projects/tests/test_manual_tag_editing.py -v
```

Tests cover:
- Admin can edit tags
- Non-admin cannot edit tags
- Manually edited tags persist through resync
- Auto-tagging still works for non-edited projects
- Validation errors

## Benefits

### For Admins
- **Full control**: Curate tags for better discovery
- **Fix AI errors**: Correct misclassified content
- **Persistent edits**: Changes won't be overwritten
- **Quality assurance**: Ensure high-value posts are properly tagged

### For Users
- **Better discovery**: More accurate tags improve search/filter
- **Curated content**: Hand-picked tags for important posts
- **Consistent tagging**: Admin oversight maintains quality

## Edge Cases

### Scenario 1: Admin Edits, Then Resync
- ✅ Manual tags persist
- ✅ Project metadata (score, comments) still updates
- ✅ No auto-tagging runs

### Scenario 2: New Project (Never Tagged)
- ✅ Auto-tagging runs normally
- ✅ `tags_manually_edited` remains `False`
- ✅ Can be manually edited later

### Scenario 3: Admin Clears All Tags
- ✅ Project has no tags
- ✅ `tags_manually_edited` is `True`
- ✅ Resync won't re-add tags

### Scenario 4: Unlocking for Re-tagging
- Admin sets `tags_manually_edited=False` in Django admin
- Next resync will run auto-tagging
- Tags will be regenerated based on current content

## Monitoring

### Logs

```
INFO: Admin admin_user manually edited tags for project 123 (user/slug)
```

### Django Admin

View/edit tags at:
- `/admin/core/project/`
- Filter by `tags_manually_edited=True` to see curated projects
- Edit tags directly in admin interface

### Database Query

```sql
-- Find all manually curated projects
SELECT id, title, user_id, tags_manually_edited
FROM core_project
WHERE tags_manually_edited = true;

-- Count curated vs auto-tagged
SELECT tags_manually_edited, COUNT(*)
FROM core_project
WHERE type = 'reddit_thread'
GROUP BY tags_manually_edited;
```

## Future Enhancements

Potential improvements:
- Bulk tag editing for multiple projects
- Tag templates/presets for common patterns
- Tag suggestion UI (show AI suggestions, let admin approve)
- Tag history/audit log (who edited, when, what changed)
- Partially locked tags (lock tools, allow topics to auto-update)

## Related Documentation

- [Reddit Curation AI Agents](./REDDIT_CURATION_BOTS.md)
- [Reddit Deletion Tracking](./REDDIT_DELETION_TRACKING.md)
- [Topic Extraction Service](./REDDIT_TOPIC_EXTRACTION.md)
