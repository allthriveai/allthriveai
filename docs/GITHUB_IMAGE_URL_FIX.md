# GitHub Image URL Normalization Fix

**Date:** 2025-11-27
**Issue:** Hero images not displaying because they are relative paths instead of absolute URLs

---

## Problem Identified

From log analysis of `redis-wellness` import:

```
✨ Found hero image: docs/images/homepage.png
Featured image: docs/images/homepage.png
```

**Issue:** The image URL is a relative path (`docs/images/homepage.png`) instead of an absolute URL.

The frontend cannot display relative paths - it needs a full URL like:
```
https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png
```

---

## Root Cause

When parsing README markdown, the `ReadmeParser` was extracting image URLs as-is from the markdown:
```markdown
![Homepage](docs/images/homepage.png)
```

This relative path was saved to the database without being converted to an absolute GitHub raw URL.

---

## Solution

Added URL normalization to convert relative image paths to absolute GitHub raw URLs.

### Changes Made

#### 1. `services/readme_parser.py`

**Added URL normalization method:**
```python
def _normalize_image_url(self, url: str) -> str:
    """Convert relative image URLs to absolute GitHub raw URLs."""
    if not url:
        return url

    # Already absolute URL
    if url.startswith(('http://', 'https://')):
        return url

    # Relative path - convert to GitHub raw URL
    if hasattr(self, 'repo_data') and self.repo_data:
        owner = self.repo_data.get('owner')
        repo = self.repo_data.get('repo')
        default_branch = self.repo_data.get('default_branch', 'main')

        if owner and repo:
            # Remove leading slash if present
            url = url.lstrip('/')
            github_raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}/{url}'
            logger.debug(f'🔗 Normalized relative URL: {url} → {github_raw_url}')
            return github_raw_url

    # Can't normalize, return as-is
    logger.warning(f'⚠️  Could not normalize relative image URL: {url}')
    return url
```

**Updated image extraction to normalize URLs:**
```python
for alt_text, url in all_image_matches:
    # Normalize relative URLs to absolute GitHub raw URLs
    normalized_url = self._normalize_image_url(url)
    logger.debug(f'   Image: {normalized_url} (alt: {alt_text})')
    images.append({'url': normalized_url, 'caption': alt_text})
```

**Store repo_data on parser instance:**
```python
parser = ReadmeParser()
parser.repo_data = repo_data  # Store repo_data for URL normalization
```

#### 2. `services/github_helpers.py`

**Added missing fields to normalized repo data:**
```python
result = {
    # ... existing fields ...
    'owner': owner,
    'repo': repo,
    'default_branch': data.get('default_branch', 'main'),
}
```

**Fallback case also updated:**
```python
return {
    # ... existing fields ...
    'owner': owner,
    'repo': repo,
    'default_branch': 'main',
}
```

#### 3. `services/project_agent/tools.py`

**Fixed async function call:**
```python
# Before (incorrect):
repo_summary = normalize_github_repo_data(owner, repo, url, repo_files)

# After (correct):
import asyncio
repo_summary = asyncio.run(normalize_github_repo_data(owner, repo, url, repo_files))
```

This was already correct in `core/integrations/github/views.py` but was missing in the agent tool.

---

## How It Works

1. **GitHub Import** fetches README from repository
2. **README Parser** extracts images from markdown:
   - Finds: `![Homepage](docs/images/homepage.png)`
   - Detects it's a relative URL (no `http://` or `https://`)
3. **URL Normalization** converts to absolute URL:
   - Input: `docs/images/homepage.png`
   - Output: `https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png`
4. **Database** saves the absolute URL
5. **Frontend** can now display the image correctly

---

## Example Transformation

**Before:**
```json
{
  "featured_image_url": "docs/images/homepage.png"
}
```

**After:**
```json
{
  "featured_image_url": "https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png"
}
```

---

## Testing

To test, import any GitHub repo with relative image paths in the README:

```bash
curl -X POST http://localhost:8000/api/v1/github/import/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/AllieRays/redis-wellness"}'
```

**Expected logs:**
```
🖼️  Found 1 total images in section "Redis Wellness"
🔗 Normalized relative URL: docs/images/homepage.png → https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png
✨ Found hero image: https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png
Featured image: https://raw.githubusercontent.com/AllieRays/redis-wellness/main/docs/images/homepage.png
```

**Database verification:**
```sql
SELECT featured_image_url FROM projects WHERE slug = 'redis-wellness-5';
```

Should return absolute GitHub raw URL, not relative path.

---

## Edge Cases Handled

1. **Already absolute URLs**: Passed through unchanged
   - `https://example.com/image.png` → `https://example.com/image.png`

2. **Relative paths with leading slash**: Normalized correctly
   - `/docs/image.png` → `https://raw.githubusercontent.com/.../docs/image.png`

3. **Relative paths without leading slash**: Normalized correctly
   - `docs/image.png` → `https://raw.githubusercontent.com/.../docs/image.png`

4. **Missing repo_data**: Warning logged, URL returned as-is
   - Fallback behavior prevents errors

5. **Non-main branches**: Uses `default_branch` from GitHub API
   - Respects repository's actual default branch

---

## Benefits

✅ **Hero images now display** - Absolute URLs work in frontend
✅ **All content images normalized** - Not just hero images
✅ **Badge filtering still works** - Applied before normalization
✅ **Backward compatible** - Existing absolute URLs unchanged
✅ **Logging added** - Easy to debug URL transformations

---

## Summary

The fix ensures that all image URLs extracted from GitHub READMEs are converted to absolute GitHub raw URLs, allowing the frontend to display them correctly. This solves the issue of empty hero images caused by relative paths.

Next import of `redis-wellness` should show the hero image! 🎉
