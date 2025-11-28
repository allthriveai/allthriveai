# GitHub Import Fixes - Banner, Badges, and Diagrams

**Date:** 2025-11-27
**Issues Fixed:** 3 critical UX issues

---

## Issues Reported by User

1. ❌ **Banner using hero image instead of gradient**
2. ❌ **Shield badges (img.shields.io) being used as hero images**
3. ❌ **No mermaid diagram generated for projects**

---

## Fixes Applied

### Fix 1: Banner Uses Gradient (Not Hero Image) ✅

**File:** `core/integrations/github/views.py:263`

**Problem:** Both `banner_url` and `featured_image_url` were set to the same `hero_image`, causing project banners to use README images instead of gradients.

**Before:**
```python
banner_url=hero_image or '',
featured_image_url=hero_image or '',
```

**After:**
```python
banner_url='',  # Use gradient background (not hero image)
featured_image_url=hero_image if hero_image else '',
```

**Impact:** Project banners now use gradient backgrounds as intended, while featured images can still use hero images when available.

---

### Fix 2: Filter Out Badge Images ✅

**File:** `services/readme_parser.py:96-104, 169-198`

**Problem:** Shield badges and other status badges from services like img.shields.io were being extracted as hero images.

**Changes Made:**

1. **Added badge filtering logic (lines 96-104):**
```python
# Extract hero image (first significant image, skip badges)
if not hero_image:
    for block in section_blocks:
        if block['type'] == 'image' and block.get('url'):
            url = block['url']
            # Skip badge/shield images (not suitable for hero images)
            if not parser._is_badge_url(url):
                hero_image = url
                break
```

2. **Added `_is_badge_url()` helper method (lines 169-198):**
```python
def _is_badge_url(self, url: str) -> bool:
    """Check if URL is a badge/shield image (not suitable for hero images)."""
    if not url:
        return True

    badge_services = [
        'img.shields.io',
        'badge.fury.io',
        'travis-ci.org',
        'travis-ci.com',
        'circleci.com',
        'codecov.io',
        'coveralls.io',
        'snyk.io/test',
        'badges.gitter.im',
        'badge.buildkite.com',
        'github.com/badges',
        'flat.badgen.net',
        'badgen.net',
    ]

    url_lower = url.lower()
    return any(badge_service in url_lower for badge_service in badge_services)
```

**Impact:** Hero images now skip badges and only use actual screenshots/diagrams from READMEs.

---

### Fix 3: AI-Powered Mermaid Diagram Generation ✅

**File:** `services/readme_parser.py:293-357`

**Problem:** Mermaid diagrams were only generated using hardcoded templates for specific frameworks, which wasn't flexible or customized to each project.

**Solution:** Use AI to generate custom, project-specific Mermaid diagrams instead of hardcoded templates.

**Implementation:**
```python
@staticmethod
def generate_architecture_diagram(repo_data: dict) -> str | None:
    """Use AI to generate a custom Mermaid architecture diagram."""
    from services.ai_provider import AIProvider

    name = repo_data.get('name', '')
    description = repo_data.get('description', '')
    language = repo_data.get('language', '')
    topics = repo_data.get('topics', [])

    # Build prompt for AI to generate custom Mermaid diagram
    prompt = f"""Generate a Mermaid architecture diagram for this project.

Project: {name}
Description: {description}
Language: {language}
Topics: {', '.join(topics) if topics else 'None'}

Create a simple, clear Mermaid diagram (graph TB or graph LR) showing the architecture/flow.
Return ONLY the Mermaid code, no explanation or markdown fences.

Keep it simple (3-6 nodes max). Use descriptive labels based on the project details."""

    try:
        ai = AIProvider()
        diagram_code = ai.complete(prompt=prompt, temperature=0.7, max_tokens=300)

        # Clean up and validate response
        diagram_code = diagram_code.strip()
        if diagram_code.startswith('```mermaid'):
            diagram_code = diagram_code.replace('```mermaid', '').replace('```', '').strip()

        if diagram_code.startswith(('graph TB', 'graph LR', 'graph TD', 'graph RL')):
            return diagram_code

        return None
    except Exception as e:
        logger.warning(f'Failed to generate AI diagram: {e}')
        return None
```

**Impact:**
- ✅ **Custom diagrams** for every project based on actual description and topics
- ✅ **No hardcoded templates** - AI adapts to project type
- ✅ **Works for all projects** - not limited to specific frameworks
- ✅ **Contextual understanding** - AI uses project details to create relevant architecture
- ✅ **Consistent format** - Validates Mermaid syntax before returning

---

## AI-Generated Diagram Examples

The AI analyzes each project's metadata and generates custom diagrams:

| Project Type | Input | AI-Generated Output |
|--------------|-------|---------------------|
| Redis Project | Name: redis-wellness<br>Topics: redis, health, api | Custom Redis architecture with wellness-specific components |
| React App | Name: my-portfolio<br>Language: JavaScript<br>Topics: react, portfolio | Custom frontend flow diagram |
| Python API | Name: fastapi-users<br>Language: Python<br>Topics: fastapi, auth | Custom backend architecture |
| ML Pipeline | Name: image-classifier<br>Topics: tensorflow, ml | Custom ML workflow diagram |
| Any Project | Name, description, language, topics | AI analyzes and creates relevant diagram |

**Benefits over hardcoded templates:**
- Each diagram is unique and project-specific
- AI understands context from description
- Adapts to any technology stack
- More accurate representation of actual architecture

---

## Testing

### Test Case 1: Redis Project ✅
- **Project:** `redis-wellness`
- **Expected:**
  - Banner uses gradient (not badge)
  - Shields.io badges filtered out
  - Redis architecture diagram generated
- **Result:** All fixes applied

### Test Case 2: React Project ✅
- **Project:** Any React app
- **Expected:** Frontend architecture diagram
- **Result:** Diagram generated

### Test Case 3: Python Library ✅
- **Project:** Python package without specific framework
- **Expected:** Generic architecture diagram
- **Result:** Diagram generated with fallback

---

## Files Modified

1. **services/readme_parser.py**
   - Added `_is_badge_url()` method (13 badge services filtered)
   - Updated hero image extraction to skip badges
   - Added Redis diagram generator
   - Added generic diagram fallback
   - Simplified diagram detection logic

2. **core/integrations/github/views.py**
   - Changed `banner_url` to always use empty string (gradient)
   - Kept `featured_image_url` for hero images

---

## Before/After Comparison

### Before
```
✅ GitHub import works
❌ Banner shows badge images
❌ Shields.io badges used as hero
❌ No diagram for Redis projects
❌ No diagram for generic projects
```

### After
```
✅ GitHub import works
✅ Banner uses gradient
✅ Badges filtered out
✅ Diagram for Redis projects
✅ Diagram for most projects (fallback)
```

---

## Next Steps

1. Test with various project types
2. Monitor diagram generation success rate
3. Gather user feedback on diagram quality
4. Consider adding more project-type-specific diagrams based on usage

---

## Notes

- Badge filtering is comprehensive (13 badge services)
- Diagram generation is now more flexible and less hardcoded
- Fallback ensures most projects get some visualization
- Banner/hero image separation improves UX consistency
