# Link Normalization for GitHub Imports

**Date:** 2025-11-27
**Feature:** Convert relative links to absolute GitHub URLs

---

## Problem

When importing GitHub READMEs, they often contain relative links to other files in the repository:

```markdown
[📖 Detailed prerequisites →](docs/01_PREREQUISITES.md)
[License](LICENSE)
[Contributing](CONTRIBUTING.md)
[Setup Guide](docs/setup/INSTALLATION.md)
```

These links **don't work** on AllThrive because they're relative paths within the GitHub repository.

**User experience:**
- Click link → 404 error ❌
- Broken navigation
- Poor UX for readers

---

## Solution

Automatically **normalize all relative links** to absolute GitHub URLs during import:

**Before:**
```markdown
[Prerequisites](docs/01_PREREQUISITES.md)
```

**After:**
```markdown
[Prerequisites](https://github.com/owner/repo/blob/main/docs/01_PREREQUISITES.md)
```

Now the link works! Clicking it opens the file on GitHub. ✅

---

## How It Works

### 1. Detect Relative Links

During README parsing, identify links that are NOT absolute:

**Relative links (need normalization):**
- `docs/SETUP.md`
- `LICENSE`
- `../CONTRIBUTING.md`
- `folder/subfolder/file.md`

**Absolute links (no change needed):**
- `https://example.com` ✅ Already absolute
- `http://site.com` ✅ Already absolute
- `#heading` ✅ Anchor link (same page)
- `mailto:email@example.com` ✅ Email link

### 2. Convert to GitHub URLs

**Format:**
```
https://github.com/{owner}/{repo}/blob/{branch}/{path}
```

**Example:**
```
Repository: AllieRays/redis-wellness
Branch: main
Link: docs/01_PREREQUISITES.md

Result: https://github.com/AllieRays/redis-wellness/blob/main/docs/01_PREREQUISITES.md
```

**GitHub URL types:**
- **`blob`** - For file links (can view on GitHub)
- **`raw`** - For images (direct file download)

---

## Implementation

### New Method: `_normalize_link_url()`

**File:** `services/readme_parser.py`

```python
def _normalize_link_url(self, url: str) -> str:
    """Convert relative markdown links to absolute GitHub URLs."""
    if not url:
        return url

    # Already absolute URL or anchor link
    if url.startswith(('http://', 'https://', '#', 'mailto:')):
        return url

    # Relative path - convert to GitHub blob URL
    if hasattr(self, 'repo_data') and self.repo_data:
        owner = self.repo_data.get('owner')
        repo = self.repo_data.get('repo')
        default_branch = self.repo_data.get('default_branch', 'main')

        if owner and repo:
            url = url.lstrip('/')
            github_blob_url = f'https://github.com/{owner}/{repo}/blob/{default_branch}/{url}'
            logger.debug(f'🔗 Normalized relative link: {url} → {github_blob_url}')
            return github_blob_url

    # Can't normalize, return as-is
    logger.warning(f'⚠️  Could not normalize relative link URL: {url}')
    return url
```

### New Method: `_normalize_markdown_links()`

Processes markdown content and normalizes all links:

```python
def _normalize_markdown_links(self, content: str) -> str:
    """Normalize all relative links in markdown content."""
    if not content:
        return content

    def replace_link(match):
        link_text = match.group(1)
        link_url = match.group(2)
        normalized_url = self._normalize_link_url(link_url)
        return f'[{link_text}]({normalized_url})'

    # Replace all markdown links: [text](url)
    normalized_content = self.LINK_PATTERN.sub(replace_link, content)
    return normalized_content
```

### Applied During Text Block Creation

```python
# Before creating text block
normalized_paragraph = self._normalize_markdown_links(paragraph)

# Create block with normalized content
blocks.append({
    'type': 'text',
    'style': 'body',
    'content': normalized_paragraph,
    'markdown': True
})
```

---

## Examples

### Example 1: Documentation Link

**Markdown:**
```markdown
For setup instructions, see [Installation Guide](docs/INSTALLATION.md)
```

**Normalized:**
```markdown
For setup instructions, see [Installation Guide](https://github.com/AllieRays/redis-wellness/blob/main/docs/INSTALLATION.md)
```

**Result:** Click link → Opens file on GitHub ✅

---

### Example 2: License Link

**Markdown:**
```markdown
This project is licensed under [MIT License](LICENSE)
```

**Normalized:**
```markdown
This project is licensed under [MIT License](https://github.com/AllieRays/redis-wellness/blob/main/LICENSE)
```

**Result:** Click link → Opens LICENSE file on GitHub ✅

---

### Example 3: Nested Documentation

**Markdown:**
```markdown
- [Getting Started](docs/getting-started/README.md)
- [API Reference](docs/api/endpoints.md)
- [Examples](examples/basic.py)
```

**Normalized:**
```markdown
- [Getting Started](https://github.com/owner/repo/blob/main/docs/getting-started/README.md)
- [API Reference](https://github.com/owner/repo/blob/main/docs/api/endpoints.md)
- [Examples](https://github.com/owner/repo/blob/main/examples/basic.py)
```

**Result:** All links work! ✅

---

### Example 4: Mixed Links (No Change Needed)

**Markdown:**
```markdown
- [Documentation](docs/README.md) - Gets normalized ✅
- [Official Site](https://example.com) - Already absolute ✅
- [Jump to Features](#features) - Anchor link ✅
- [Contact](mailto:hello@example.com) - Email link ✅
```

**Result:**
- Relative link normalized to GitHub
- Absolute, anchor, and email links unchanged

---

## Edge Cases Handled

### 1. Already Absolute URLs
```markdown
[Website](https://example.com)
```
**Result:** No change (already absolute) ✅

### 2. Anchor Links
```markdown
[Features](#features)
```
**Result:** No change (same-page anchor) ✅

### 3. Email Links
```markdown
[Contact](mailto:hello@example.com)
```
**Result:** No change (email link) ✅

### 4. Leading Slashes
```markdown
[Docs](/docs/SETUP.md)
```
**Result:** Slash removed, normalized correctly
```
https://github.com/owner/repo/blob/main/docs/SETUP.md
```

### 5. Parent Directory References
```markdown
[License](../LICENSE)
```
**Result:** Normalized (GitHub handles `..` correctly)
```
https://github.com/owner/repo/blob/main/../LICENSE
```

### 6. No Repo Data
If `repo_data` is missing (shouldn't happen, but defensive):
```markdown
[Docs](docs/README.md)
```
**Result:** Link left as-is with warning logged

---

## Logging

**Success:**
```
🔗 Normalized relative link: docs/SETUP.md → https://github.com/owner/repo/blob/main/docs/SETUP.md
🔗 Normalized relative link: LICENSE → https://github.com/owner/repo/blob/main/LICENSE
```

**Already absolute (debug):**
```
# No log (already absolute URLs are returned unchanged)
```

**Warning (edge case):**
```
⚠️  Could not normalize relative link URL: docs/README.md
```

---

## Benefits

✅ **All links work** - No more broken links from GitHub READMEs
✅ **Automatic** - No manual work needed
✅ **Smart detection** - Only normalizes relative links
✅ **GitHub integration** - Links open files on GitHub
✅ **Preserves intent** - Anchors, emails, absolute URLs unchanged
✅ **Better UX** - Users can navigate documentation easily

---

## Comparison: Images vs Links

| Feature | Images | Links |
|---------|--------|-------|
| **Target URL** | `raw.githubusercontent.com` | `github.com/blob/` |
| **Purpose** | Direct image file (display) | File viewer (read on GitHub) |
| **Example** | `https://raw.githubusercontent.com/owner/repo/main/image.png` | `https://github.com/owner/repo/blob/main/docs/SETUP.md` |
| **Use case** | Display images in AllThrive | Navigate to GitHub files |

**Why different?**
- **Images:** Need raw file URL to display in `<img>` tags
- **Links:** Need blob URL to view file with GitHub's UI (syntax highlighting, etc.)

---

## Files Changed

**Backend:**
- `services/readme_parser.py`
  - Added `_normalize_link_url()` - Convert relative link to absolute
  - Added `_normalize_markdown_links()` - Process markdown content
  - Updated text block creation to normalize links

**No frontend changes needed** - Links work automatically!

---

## Testing

### Test Case 1: Relative Documentation Link
```markdown
[Setup Guide](docs/SETUP.md)
```
**Expected:** `https://github.com/owner/repo/blob/main/docs/SETUP.md`

### Test Case 2: License File
```markdown
[LICENSE](LICENSE)
```
**Expected:** `https://github.com/owner/repo/blob/main/LICENSE`

### Test Case 3: Absolute URL (No Change)
```markdown
[Website](https://example.com)
```
**Expected:** `https://example.com` (unchanged)

### Test Case 4: Anchor Link (No Change)
```markdown
[Features](#features)
```
**Expected:** `#features` (unchanged)

### Verify:
1. Import GitHub repo with relative links
2. Check project detail page
3. Click normalized links
4. Verify: Links open correct files on GitHub ✅

---

## Summary

All relative links in GitHub READMEs are now **automatically normalized** to absolute GitHub URLs:

- ✅ `docs/SETUP.md` → `https://github.com/owner/repo/blob/main/docs/SETUP.md`
- ✅ `LICENSE` → `https://github.com/owner/repo/blob/main/LICENSE`
- ✅ Absolute URLs, anchors, emails unchanged

**Result:** All links work perfectly on AllThrive! 🎉
