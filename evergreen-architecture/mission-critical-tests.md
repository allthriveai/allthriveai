# Mission Critical Tests

Mission critical tests are high-value end-to-end tests that validate core business functionality. They follow proper TDD methodology: tests are written to fail first, then implementation makes them pass.

## Philosophy

These tests are **not** run in CI/CD by default. They:
- Cost AI tokens (for AI-powered features)
- Take longer to run than unit tests
- Test full user flows, not isolated units

Run them locally when:
- Developing a new mission-critical feature
- Debugging a reported bug in a critical flow
- Before deploying changes to critical systems

## Running Mission Critical Tests

```bash
# Run all E2E tests
RUN_E2E_TESTS=1 pytest core/tests/e2e/ -v

# Run specific test file
RUN_E2E_TESTS=1 pytest core/tests/e2e/test_prompt_battles.py -v

# Run a single test
RUN_E2E_TESTS=1 pytest core/tests/e2e/test_prompt_battles.py::BattleShareLinkTest::test_share_link_generates_valid_url -v

# Inside Docker
RUN_E2E_TESTS=1 docker-compose exec web python -m pytest core/tests/e2e/test_prompt_battles.py -v
```

## Test File Structure

All mission critical tests live in `core/tests/e2e/`:

```
core/tests/e2e/
├── __init__.py
├── test_auth_gate.py        # Beta code gate tests
├── test_prompt_battles.py   # Prompt battle flow tests
├── test_github_import.py    # GitHub import tests
└── test_intelligent_chat.py # AI chat tests (uses tokens)
```

## Writing a New Mission Critical Test

### Step 1: Create Test File with Skip Logic

```python
"""
End-to-End Tests for [Feature Name].

MISSION CRITICAL: [Why this feature matters for the business]

These tests are SKIPPED by default in regular test runs and CI.
Run explicitly with: RUN_E2E_TESTS=1 pytest core/tests/e2e/test_your_feature.py -v
"""

import os

import pytest
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.users.models import User

# Skip these tests unless explicitly enabled
SKIP_E2E = os.environ.get('RUN_E2E_TESTS', '').lower() not in ('1', 'true', 'yes')
SKIP_REASON = 'E2E tests skipped by default. Set RUN_E2E_TESTS=1 to run.'


def setUpModule():
    """Print section header when this module runs."""
    if SKIP_E2E:
        return
    print('\n')
    print('=' * 70)
    print('  [FEATURE NAME] - Mission Critical Tests')
    print('=' * 70)
    print()
```

### Step 2: Write Tests Using the Scenario Pattern

Each test class should document:
- **SCENARIO**: The user action being tested
- **EXPECTED**: What should happen
- **FAILURE**: What breaks if this doesn't work

```python
@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class YourFeatureTest(TestCase):
    """
    Test [specific flow].

    SCENARIO: when [user does X] then [Y happens]
    EXPECTED: [detailed expected outcome]
    FAILURE: [what breaks if this fails]
    """

    def setUp(self):
        """Create test fixtures."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    def test_feature_does_expected_thing(self):
        """
        CRITICAL: [One sentence describing what MUST work]

        SCENARIO: [User action]
        EXPECTED: [Expected API response or behavior]
        FAILURE: [What this guards against]
        """
        # Arrange
        self.client.force_authenticate(user=self.user)

        # Act
        response = self.client.post(
            '/api/v1/your/endpoint/',
            {'key': 'value'},
            format='json',
        )

        # Assert with CRITICAL message
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            f'CRITICAL: [Feature] failed with {response.status_code}. '
            f'Response: {response.data}',
        )

        # Assert specific data
        self.assertIn(
            'expected_key',
            response.data,
            'CRITICAL: Response must contain expected_key for [reason]',
        )
```

### Step 3: Write the Test BEFORE Implementation (TDD)

The proper TDD workflow:

1. **Write the failing test first**
   ```bash
   RUN_E2E_TESTS=1 pytest core/tests/e2e/test_your_feature.py -v
   # Should FAIL - feature doesn't exist yet
   ```

2. **Implement the minimum code to pass**
   ```bash
   RUN_E2E_TESTS=1 pytest core/tests/e2e/test_your_feature.py -v
   # Should PASS now
   ```

3. **Refactor while keeping tests green**
   ```bash
   RUN_E2E_TESTS=1 pytest core/tests/e2e/test_your_feature.py -v
   # Should still PASS
   ```

## Test Categories

### Source Verification Tests (No AI Tokens)

These tests verify source code contains required patterns. They run fast and don't cost tokens:

```python
class SourceVerificationTest(TestCase):
    """
    CRITICAL: Verify [feature] exists in source code.
    These tests run without needing external services.
    """

    def get_source_file(self):
        """Read the source file."""
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        file_path = base_dir / 'frontend' / 'src' / 'pages' / 'YourPage.tsx'

        if not file_path.exists():
            self.skipTest(f'File not found at {file_path}')

        return file_path.read_text()

    def test_critical_pattern_exists_in_source(self):
        """
        CRITICAL: Source MUST contain [pattern].
        If this fails, someone removed critical functionality!
        """
        source = self.get_source_file()

        self.assertIn(
            'CRITICAL_CONSTANT',
            source,
            'CRITICAL: CRITICAL_CONSTANT must exist in source. '
            'The [feature] has been removed!',
        )
```

### API Integration Tests (May Use AI Tokens)

These tests hit actual API endpoints and may trigger AI calls:

```python
@pytest.mark.skipif(SKIP_E2E, reason=SKIP_REASON)
class AIFeatureTest(TestCase):
    """
    Test AI-powered feature.

    WARNING: These tests may consume AI tokens.
    """

    def test_ai_feature_returns_valid_response(self):
        """
        CRITICAL: AI feature must return valid structured data.
        """
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/api/v1/ai/generate/',
            {'prompt': 'test prompt'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('result', response.data)
```

### Frontend Page Tests (Requires Running Frontend)

These tests check the frontend is serving expected content:

```python
class FrontendPageTest(TestCase):
    """
    Test frontend page content.
    These tests require the frontend to be running.
    """

    def test_page_contains_required_elements(self):
        """
        CRITICAL: Page MUST show required UI elements.
        """
        try:
            response = requests.get(
                f'{settings.FRONTEND_URL_DEFAULT}/your-page',
                timeout=5
            )
        except requests.RequestException:
            self.skipTest('Frontend not running')

        self.assertEqual(response.status_code, 200)
        self.assertIn('required-element', response.text.lower())
```

## Best Practices

### 1. One Assertion Per Test (When Possible)

```python
# Good - focused test
def test_share_link_returns_invite_url(self):
    response = self.client.post('/api/v1/generate-link/')
    self.assertIn('invite_url', response.data)

def test_share_link_creates_invitation_record(self):
    self.client.post('/api/v1/generate-link/')
    self.assertEqual(BattleInvitation.objects.count(), 1)

# Avoid - multiple unrelated assertions
def test_share_link_everything(self):
    response = self.client.post('/api/v1/generate-link/')
    self.assertIn('invite_url', response.data)
    self.assertEqual(BattleInvitation.objects.count(), 1)
    self.assertEqual(response.data['status'], 'pending')
    # etc...
```

### 2. Use Descriptive Failure Messages

```python
# Good - tells you exactly what broke
self.assertEqual(
    response.status_code,
    status.HTTP_201_CREATED,
    f'CRITICAL: Generate link failed with {response.status_code}. '
    f'Expected 201 Created. Response: {response.data}',
)

# Bad - generic failure
self.assertEqual(response.status_code, 201)
```

### 3. Test the Contract, Not Implementation

```python
# Good - tests API contract
def test_api_returns_required_fields(self):
    response = self.client.get('/api/v1/battle/123/')
    self.assertIn('id', response.data)
    self.assertIn('status', response.data)
    self.assertIn('participants', response.data)

# Bad - tests implementation details
def test_battle_uses_correct_serializer(self):
    # Don't test internal implementation
    pass
```

### 4. Clean Up After Tests

```python
def setUp(self):
    self.client = APIClient()
    self.user = User.objects.create_user(...)

def tearDown(self):
    # Clean up any created files, external resources, etc.
    # Django's TestCase handles database cleanup automatically
    pass
```

## Example: Complete Test File

See `core/tests/e2e/test_prompt_battles.py` for a complete example with:
- Skip logic for CI
- Module header printing
- Multiple test classes for different flows
- Proper SCENARIO/EXPECTED/FAILURE documentation
- Descriptive failure messages

## Adding to Existing Test Files

When adding tests to existing files:

1. Add your test class with the `@pytest.mark.skipif` decorator
2. Follow the existing patterns in that file
3. Run locally to verify:
   ```bash
   RUN_E2E_TESTS=1 pytest core/tests/e2e/test_existing.py::YourNewTest -v
   ```

## Debugging Failed Tests

```bash
# Run with verbose output
RUN_E2E_TESTS=1 pytest core/tests/e2e/test_file.py -v -s

# Run with debugger on failure
RUN_E2E_TESTS=1 pytest core/tests/e2e/test_file.py --pdb

# Run specific test with maximum verbosity
RUN_E2E_TESTS=1 pytest core/tests/e2e/test_file.py::TestClass::test_method -vvv
```
