# Implementation Plan: Enhanced Content Extraction + Comprehensive Test Suite

## Overview
This plan covers two major improvements to the GitHub/integration import system:
1. **Phase 1**: Enhanced Content Extraction (2-3 hours)
2. **Phase 2**: Comprehensive Test Suite (3-4 hours)

**Total Estimated Time**: 5-7 hours

---

## Phase 1: Enhanced Content Extraction

### Goal
Improve what we extract from repositories to create richer, more visually appealing portfolio projects.

### Current State
- ✅ Extracts hero_image from first README image
- ✅ Extracts demo_urls from links
- ✅ Extracts mermaid diagrams
- ✅ Has file tree access via `get_repository_tree()`
- ❌ Doesn't scan for screenshots in `/screenshots`, `/docs/images`, etc.
- ❌ Doesn't detect project logos
- ❌ Doesn't find demo videos (YouTube, GIFs)
- ❌ Doesn't extract live demo URLs from badges
- ❌ Doesn't scan for additional visual assets

### Implementation Tasks

#### 1.1 Enhanced Screenshot Detection
**File**: `core/integrations/base/parser.py` (new method)

**Add new method**: `scan_repository_for_images(tree: list[dict]) -> dict`

Extract images from repository file tree by scanning common paths:
- `/screenshots/*.{png,jpg,jpeg,gif,webp}`
- `/docs/images/*.{png,jpg,jpeg,gif,webp}`
- `/assets/images/*.{png,jpg,jpeg,gif,webp}`
- `/.github/*.{png,jpg,jpeg,gif,webp}`
- `/public/*.{png,jpg,jpeg,gif,webp}`

Return dict with:
```python
{
    'screenshots': [...],  # Screenshots for gallery
    'logo': '...',         # Project logo if found
    'banner': '...',       # Banner/hero image if found
}
```

#### 1.2 Demo Video Detection
**File**: `core/integrations/base/parser.py` (enhance existing method)

**Update method**: `parse()` to extract video URLs

Detect:
- YouTube/Vimeo embed URLs in README
- GIF files as demo animations
- Video files in `/demo`, `/videos` directories

Pattern matching for:
```python
YOUTUBE_PATTERN = re.compile(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)')
VIMEO_PATTERN = re.compile(r'vimeo\.com/(\d+)')
GIF_PATTERN = re.compile(r'!\[.*?\]\((.*?\.gif)\)')
```

Add to return dict:
```python
{
    'demo_videos': [
        {'type': 'youtube', 'id': '...', 'url': '...'},
        {'type': 'gif', 'url': '...'},
    ]
}
```

#### 1.3 Enhanced Logo Detection
**File**: `core/integrations/github/service.py` (new method)

**Add method**: `find_logo(tree: list[dict]) -> str | None`

Search for logo files in common locations:
- `/logo.{png,svg,jpg}`
- `/assets/logo.{png,svg,jpg}`
- `/.github/logo.{png,svg,jpg}`
- `/public/logo.{png,svg,jpg}`

Priority: SVG > PNG > JPG

#### 1.4 Badge URL Parsing
**File**: `core/integrations/base/parser.py` (enhance existing)

**Enhance**: Badge detection to extract demo URLs from badges

Parse badge links like:
```markdown
[![Demo](https://img.shields.io/badge/demo-live-green)](https://my-demo.com)
```

Extract the link URL as a demo_url if badge text contains: `demo`, `live`, `preview`, `website`

#### 1.5 Integration with AI Analyzer
**File**: `core/integrations/github/ai_analyzer.py`

**Update**: `analyze_github_repo()` to use new extraction

```python
# After fetching repo data, scan for additional assets
visual_assets = BaseParser.scan_repository_for_images(repo_data.get('tree', []))

# Use logo as featured image if no hero_image from README
if not hero_image and visual_assets.get('logo'):
    hero_image = visual_assets['logo']

# Add screenshots to blocks
if visual_assets.get('screenshots'):
    validated['readme_blocks'].append({
        'type': 'imageGrid',
        'images': [{'url': url} for url in visual_assets['screenshots'][:6]],
        'caption': 'Project Screenshots'
    })

# Add demo videos
if demo_videos:
    validated['demo_videos'] = demo_videos
```

#### 1.6 Update Project Content Schema
**File**: `core/projects/models.py` (documentation)

Document new content fields:
```python
content = {
    'blocks': [...],
    'github': {...},
    'demo_urls': [...],
    'demo_videos': [...]  # NEW
    'visual_assets': {     # NEW
        'logo': '...',
        'screenshots': [...],
        'banner': '...'
    }
}
```

### Acceptance Criteria - Phase 1
- [x] Can extract screenshots from `/screenshots` directory
- [x] Can detect project logo from common locations
- [x] Can extract YouTube/Vimeo URLs from README
- [x] Can detect GIF demo animations
- [x] Can extract demo URLs from badge links
- [x] Logo used as featured_image_url if no README hero image
- [x] Screenshots added to project as imageGrid blocks
- [x] Demo videos stored in project content

---

## Phase 2: Comprehensive Test Suite

### Goal
Ensure system stability and prevent regressions as we add new integrations.

### Current State
- ✅ Basic parser tests exist (`test_parser.py`)
- ❌ No tests for GitHub integration
- ❌ No tests for utils (lock, slug, error responses)
- ❌ No tests for AI analyzer
- ❌ No integration tests for full import flow
- ❌ No tests for new content extraction features

### Testing Strategy

#### 2.1 Unit Tests for Utilities
**File**: `core/integrations/tests/test_utils.py` (NEW)

Test coverage:
- `normalize_slug()` - underscores, special chars, unicode
- `acquire_import_lock()` / `release_import_lock()` - atomicity, expiry
- `get_integration_token()` - null handling, missing accounts
- `check_duplicate_project()` - URL matching, normalization
- Error response builders - format, status codes

```python
class UtilsTestCase(TestCase):
    def test_normalize_slug_underscores(self):
        """Test underscore replacement in slugs."""
        self.assertEqual(normalize_slug('my_project'), 'my-project')

    def test_acquire_lock_atomic(self):
        """Test lock acquisition is atomic."""
        # First acquire should succeed
        self.assertTrue(acquire_import_lock(1))
        # Second acquire should fail
        self.assertFalse(acquire_import_lock(1))

    def test_acquire_lock_expiry(self):
        """Test lock auto-expires after timeout."""
        acquire_import_lock(1, timeout=1)
        time.sleep(2)
        # Lock should be released
        self.assertTrue(acquire_import_lock(1))
```

#### 2.2 Unit Tests for GitHub Service
**File**: `core/integrations/github/tests/test_service.py` (NEW)

Mock GitHub API calls, test:
- `get_readme()` - success, 404, network errors
- `get_repository_tree()` - large repos, empty repos
- `get_repository_info_sync()` - data normalization
- Token handling - invalid, expired tokens
- Rate limiting - headers, warnings

```python
class GitHubServiceTestCase(TestCase):
    @patch('httpx.AsyncClient.get')
    def test_get_readme_success(self, mock_get):
        """Test successful README fetch."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'content': base64.b64encode(b'# Test').decode(),
            'encoding': 'base64'
        }
        mock_get.return_value = mock_response

        service = GitHubService('test_token')
        readme = service.get_readme_sync('owner', 'repo')
        self.assertEqual(readme, '# Test')
```

#### 2.3 Unit Tests for Enhanced Content Extraction
**File**: `core/integrations/tests/test_parser.py` (ENHANCE)

Add tests for new extraction features:
- `test_scan_repository_for_screenshots()`
- `test_find_logo_svg_priority()`
- `test_extract_youtube_urls()`
- `test_extract_demo_from_badges()`
- `test_gif_detection()`

```python
def test_scan_repository_for_screenshots(self):
    """Test screenshot extraction from file tree."""
    tree = [
        {'path': 'screenshots/demo1.png', 'type': 'blob'},
        {'path': 'screenshots/demo2.png', 'type': 'blob'},
        {'path': 'logo.svg', 'type': 'blob'},
    ]

    result = BaseParser.scan_repository_for_images(tree)

    self.assertEqual(len(result['screenshots']), 2)
    self.assertIn('logo.svg', result['logo'])
```

#### 2.4 Unit Tests for AI Analyzer
**File**: `core/integrations/github/tests/test_ai_analyzer.py` (NEW)

Mock AI calls, test:
- `analyze_github_repo()` - with README, without README
- Fallback behavior - AI errors, timeouts
- Content generation - blocks from repo structure
- Hero image selection - README vs generated vs logo
- Architecture diagram generation

```python
class AIAnalyzerTestCase(TestCase):
    @patch('services.ai_provider.AIProvider.complete')
    def test_analyze_with_readme(self, mock_ai):
        """Test analysis with README content."""
        mock_ai.return_value = json.dumps({
            'description': 'Test description',
            'category_ids': [9],
            'topics': ['python', 'django'],
            'tool_names': []
        })

        repo_data = {'name': 'test', 'language': 'Python'}
        result = analyze_github_repo(repo_data, readme_content='# Test')

        self.assertEqual(result['description'], 'Test description')
        self.assertIn('python', result['topics'])
```

#### 2.5 Integration Tests for Full Import Flow
**File**: `core/integrations/tests/test_import_flow.py` (NEW)

Test complete import pipeline:
- Valid GitHub URL → successful import
- Invalid URL → proper error
- Duplicate import → error with existing project
- Private repo → auth check
- Import with lock → concurrent handling

```python
class ImportFlowTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com'
        )
        # Mock GitHub OAuth
        SocialAccount.objects.create(
            user=self.user,
            provider='github'
        )

    @patch('core.integrations.github.service.GitHubService')
    def test_successful_import(self, mock_service):
        """Test complete import flow."""
        # Setup mocks
        mock_service.return_value.get_repository_info_sync.return_value = {
            'readme': '# Test',
            'tree': [],
            'dependencies': {}
        }

        # Import
        url = 'https://github.com/test/repo'
        result = GitHubIntegration().import_project(
            self.user.id,
            url,
            is_showcase=True
        )

        # Verify
        self.assertTrue(result['success'])
        self.assertEqual(Project.objects.count(), 1)
```

#### 2.6 View Tests
**File**: `core/integrations/tests/test_views.py` (NEW)

Test API endpoints:
- `/api/integrations/import-from-url/` - success, errors, throttling
- `/api/integrations/tasks/{id}/` - status checking
- `/api/integrations/` - list integrations
- URL validation - schemes, malformed URLs
- Lock handling - acquire, release on error
- Duplicate detection - proper response format

```python
class IntegrationViewsTestCase(TestCase):
    def test_import_from_url_success(self):
        """Test successful import via API."""
        self.client.force_login(self.user)

        response = self.client.post('/api/integrations/import-from-url/', {
            'url': 'https://github.com/test/repo',
            'is_showcase': True
        })

        self.assertEqual(response.status_code, 202)
        self.assertIn('task_id', response.json())

    def test_import_duplicate_error(self):
        """Test duplicate import returns proper error."""
        # Create existing project
        Project.objects.create(
            user=self.user,
            title='Test',
            external_url='https://github.com/test/repo'
        )

        response = self.client.post('/api/integrations/import-from-url/', {
            'url': 'https://github.com/test/repo'
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error_code'], 'DUPLICATE_IMPORT')
```

### Test Organization

```
core/integrations/tests/
├── __init__.py
├── test_parser.py           # Enhanced with new extraction tests
├── test_utils.py            # NEW - Utils tests
├── test_views.py            # NEW - API endpoint tests
├── test_import_flow.py      # NEW - End-to-end integration tests
└── github/
    ├── __init__.py
    ├── test_service.py      # NEW - GitHub API service tests
    ├── test_integration.py  # NEW - GitHub integration tests
    └── test_ai_analyzer.py  # NEW - AI analyzer tests
```

### Acceptance Criteria - Phase 2
- [x] All utility functions have unit tests
- [x] GitHub service methods have tests with mocked API
- [x] Enhanced content extraction has comprehensive tests
- [x] AI analyzer has tests with mocked AI calls
- [x] Views have tests for success and error cases
- [x] Integration tests cover full import flow
- [x] Test coverage > 80% for integration code
- [x] All tests pass with `python manage.py test core.integrations`

---

## Implementation Order

### Phase 1: Enhanced Content Extraction (2-3 hours)
1. Add `scan_repository_for_images()` to BaseParser (30 min)
2. Add video detection patterns and extraction (30 min)
3. Add logo finding to GitHubService (20 min)
4. Enhance badge parsing for demo URLs (20 min)
5. Update AI analyzer to use new extraction (30 min)
6. Test manually with real repos (30 min)

### Phase 2: Comprehensive Test Suite (3-4 hours)
1. Create test file structure (10 min)
2. Write utils tests (40 min)
3. Write parser enhancement tests (40 min)
4. Write GitHub service tests (50 min)
5. Write AI analyzer tests (40 min)
6. Write view tests (50 min)
7. Write integration flow tests (30 min)
8. Run full test suite and fix issues (30 min)

---

## Success Metrics

### Phase 1
- ✅ Projects without READMEs have logos as featured images
- ✅ Projects with screenshots show image galleries
- ✅ Projects with demo videos have embedded players
- ✅ Badge demo links automatically detected
- ✅ Visual richness improved for all imports

### Phase 2
- ✅ Test coverage > 80%
- ✅ All critical paths tested
- ✅ Fast test suite (< 30 seconds)
- ✅ Clear test organization
- ✅ Easy to add tests for future integrations

---

## Risks & Mitigations

### Risk: Large file trees slow down scanning
**Mitigation**: Limit scan to first 1000 files, prioritize common paths

### Risk: External image URLs may be broken
**Mitigation**: Validate URLs are accessible, fallback to generated image

### Risk: AI mocking complexity in tests
**Mitigation**: Use simple JSON fixtures, focus on data flow not AI quality

### Risk: Tests become flaky
**Mitigation**: Use freezegun for time, mock all external services

---

## Future Enhancements (Not in this plan)

- WebSocket progress notifications during import
- Batch import multiple repos
- Import preview before committing
- Screenshot quality analysis and selection
- Automatic demo GIF generation from screenshots
- Video thumbnail extraction
- Social media card generation
