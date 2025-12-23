# Learning Path Content Gap Fix

## Problem

When creating a learning path (e.g., "ai agents"), only a "Community" section was generated with no AI lessons, even though the topic clearly needed educational content.

## Root Cause

The `_has_content_gap()` function in `services/agents/learning/lesson_generator.py` was counting ALL projects toward the content threshold, but only specific content types (`video`, `article`, `code-repo`) actually get added as individual curriculum items.

**Example:**
- ContentFinder returns 10 projects about "ai agents"
- `_has_content_gap()` says: "10 >= 3, no gap!"
- But only 3 of those projects have `content_type: content-article`
- `_add_existing_content()` only adds those 3 articles
- No AI lessons are generated because "no gap"
- Result: Curriculum has only articles + "Community" section, no personalized lessons

**Second issue:** Content type matching used exact equality (`== 'article'`) but actual data has variants like `content-article`.

## Fix

### 1. Updated `_has_content_gap()` (lines 561-595)

Now only counts content that would actually become curriculum items:
- Tool overview (if exists)
- Projects with curriculum content types (video, article, code-repo)
- Quizzes and games

Generic projects (no content_type or other types) only appear in the "related_projects" section and no longer count toward the gap threshold.

```python
# Before
total_content = len(projects) + len(quizzes) + len(games)
return total_content < 3

# After
curriculum_content_types = {'video', 'article', 'code-repo'}
curriculum_projects = [
    p for p in projects
    if any(ct in (p.get('content_type') or '').lower() for ct in curriculum_content_types)
]
total_curriculum_items = (
    (1 if tool else 0)
    + len(curriculum_projects)
    + len(quizzes)
    + len(games)
)
return total_curriculum_items < 3
```

### 2. Updated `_add_existing_content()` (lines 449-454)

Now uses substring matching to handle content_type variants:

```python
# Before
video_projects = [p for p in projects if p.get('content_type') == 'video']
article_projects = [p for p in projects if p.get('content_type') == 'article']

# After
video_projects = [p for p in projects if 'video' in (p.get('content_type') or '').lower()]
article_projects = [p for p in projects if 'article' in (p.get('content_type') or '').lower()]
```

## Result

Now when creating a learning path for topics with few curated resources:
1. AI lessons are properly generated to fill the gap
2. Curated articles/videos are still included when available
3. "Community" section shows related projects at the end
4. Users get a complete, personalized learning experience

## Files Changed

- `services/agents/learning/lesson_generator.py`
