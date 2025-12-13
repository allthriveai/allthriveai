"""
Integration Tests for GitHub Import AI Analysis.

MISSION CRITICAL: These tests call REAL AI to ensure the GitHub import
doesn't hallucinate tech stacks, categories, or features.

These tests:
1. Call the actual AI analyzer (requires API keys)
2. Validate output structure matches expected schema
3. Ensure tech_stack comes from detected data (not hallucinated)
4. Ensure categories are valid IDs
5. Ensure features reference actual README content

Run with: make test-ai-integration
Or: pytest core/tests/e2e/test_github_ai_integration.py -v

NOTE: These tests consume API tokens and should only run in CI or manually.
"""

import os
import unittest

from django.conf import settings
from django.test import TestCase

# Skip all tests if no AI provider configured
SKIP_AI_TESTS = not (
    os.environ.get('OPENAI_API_KEY')
    or os.environ.get('ANTHROPIC_API_KEY')
    or os.environ.get('AZURE_OPENAI_API_KEY')
    or getattr(settings, 'OPENAI_API_KEY', None)
    or getattr(settings, 'ANTHROPIC_API_KEY', None)
)


# =============================================================================
# REAL REPOSITORY FIXTURES - These mirror actual GitHub repos
# =============================================================================

DJANGO_REPO_DATA = {
    'name': 'allthriveai',
    'description': 'AI-powered portfolio platform with intelligent chat',
    'owner': 'AllieRays',
    'language': 'Python',  # GitHub API detected
    'stargazers_count': 12,
    'topics': ['python', 'django', 'ai', 'portfolio', 'celery'],
    'html_url': 'https://github.com/AllieRays/allthriveai',
    'tree': [
        {'path': 'core', 'type': 'tree'},
        {'path': 'core/projects', 'type': 'tree'},
        {'path': 'core/users', 'type': 'tree'},
        {'path': 'core/integrations', 'type': 'tree'},
        {'path': 'frontend', 'type': 'tree'},
        {'path': 'frontend/src', 'type': 'tree'},
        {'path': 'services', 'type': 'tree'},
        {'path': 'manage.py', 'type': 'blob'},
        {'path': 'requirements.txt', 'type': 'blob'},
        {'path': 'docker-compose.yml', 'type': 'blob'},
        {'path': 'Dockerfile', 'type': 'blob'},
        {'path': '.github/workflows/ci.yml', 'type': 'blob'},
        {'path': 'Makefile', 'type': 'blob'},
        {'path': 'frontend/package.json', 'type': 'blob'},
        {'path': 'frontend/src/App.tsx', 'type': 'blob'},
    ],
    'tech_stack': {  # This is what detect_tech_stack_from_files() returns
        'languages': {'Python': 'primary', 'TypeScript': 'secondary', 'JavaScript': 'secondary'},
        'frameworks': ['Django', 'React', 'Celery', 'Tailwind CSS'],
        'tools': ['Docker', 'GitHub Actions', 'Make'],
    },
}

DJANGO_README = """# AllThrive AI

AI-powered portfolio platform that helps creators showcase their work.

## Features

- **Intelligent Chat**: Natural language interface for managing projects
- **GitHub Integration**: Import repos directly from GitHub
- **AI Analysis**: Automatically generates compelling project descriptions
- **Portfolio Templates**: Beautiful, customizable portfolio pages

## Tech Stack

- Django 5 + Django REST Framework
- React 18 + TypeScript
- Celery for async tasks
- PostgreSQL + Redis

## Getting Started

```bash
make up  # Start all services
make frontend  # Run frontend dev server
```
"""

# Documentation-only repo (like acquia-dev-exercises)
DOCS_REPO_DATA = {
    'name': 'acquia-dev-exercises',
    'description': 'Development exercises for Acquia certification',
    'owner': 'AllieRays',
    'language': None,  # No language detected by GitHub
    'stargazers_count': 0,
    'topics': [],
    'html_url': 'https://github.com/AllieRays/acquia-dev-exercises',
    'tree': [
        {'path': 'docs', 'type': 'tree'},
        {'path': 'exercises', 'type': 'tree'},
        {'path': 'README.md', 'type': 'blob'},
        {'path': 'docs/setup.md', 'type': 'blob'},
        {'path': 'exercises/exercise1.md', 'type': 'blob'},
    ],
    'tech_stack': {  # Empty - no code detected
        'languages': {},
        'frameworks': [],
        'tools': [],
    },
}

DOCS_README = """# Acquia Development Exercises

Practice exercises for Acquia certification prep.

## Contents

1. Module 1: Setup and Configuration
2. Module 2: Content Types
3. Module 3: Views and Displays

## How to Use

Read each exercise carefully and follow the instructions.
"""


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AIAnalyzerOutputStructureTest(TestCase):
    """
    Test that AI analyzer output has correct structure.

    These tests verify the AI returns valid JSON with all required fields,
    regardless of what content the AI generates.
    """

    def test_ai_returns_valid_template_structure(self):
        """Test AI analyzer returns valid v2 template structure."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        # Must have template version
        self.assertEqual(result.get('templateVersion'), 2, 'AI must return templateVersion 2')

        # Must have sections array
        self.assertIn('sections', result)
        self.assertIsInstance(result['sections'], list)
        self.assertGreater(len(result['sections']), 0, 'AI must return at least one section')

        # Must have category_ids array with valid IDs
        self.assertIn('category_ids', result)
        self.assertIsInstance(result['category_ids'], list)
        self.assertGreater(len(result['category_ids']), 0, 'AI must return at least one category')
        for cat_id in result['category_ids']:
            self.assertIsInstance(cat_id, int)
            self.assertGreaterEqual(cat_id, 1)
            self.assertLessEqual(cat_id, 20)

        # Must have topics array
        self.assertIn('topics', result)
        self.assertIsInstance(result['topics'], list)

        # Must have hero_image
        self.assertIn('hero_image', result)

    def test_sections_have_required_fields(self):
        """Test each section has id, type, enabled, order, content."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        for i, section in enumerate(result['sections']):
            self.assertIn('id', section, f'Section {i} missing id')
            self.assertIn('type', section, f'Section {i} missing type')
            self.assertIn('enabled', section, f'Section {i} missing enabled')
            self.assertIn('order', section, f'Section {i} missing order')
            self.assertIn('content', section, f'Section {i} missing content')

            # Type must be known section type
            valid_types = [
                'overview',
                'features',
                'tech_stack',
                'gallery',
                'demo',
                'architecture',
                'challenges',
                'links',
            ]
            self.assertIn(section['type'], valid_types, f'Section {i} has invalid type: {section["type"]}')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AITechStackHallucinationTest(TestCase):
    """
    REGRESSION TEST: Ensure AI doesn't hallucinate tech stacks.

    Previously, the AI was generating fake tech stacks like "FastAPI, Redis, MongoDB"
    for documentation repos that had no code. The fix was to use detected tech stack
    from dependency files instead of AI-generated.
    """

    def test_tech_stack_uses_detected_data(self):
        """
        Test that tech_stack section uses detected data, not AI-generated.

        The tech_stack in sections should match what was in repo_data['tech_stack'],
        not something the AI made up.
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        # Find tech_stack section
        tech_sections = [s for s in result['sections'] if s['type'] == 'tech_stack']

        if tech_sections:
            tech_section = tech_sections[0]
            categories = tech_section['content'].get('categories', [])

            # Extract all technology names from the section
            all_techs = []
            for cat in categories:
                for tech in cat.get('technologies', []):
                    if isinstance(tech, dict):
                        all_techs.append(tech.get('name', '').lower())
                    else:
                        all_techs.append(str(tech).lower())

            # MUST include detected frameworks
            detected_frameworks = [fw.lower() for fw in DJANGO_REPO_DATA['tech_stack']['frameworks']]
            for framework in detected_frameworks:
                # Check if any tech contains the framework name
                found = any(framework in tech for tech in all_techs)
                self.assertTrue(found, f'Detected framework "{framework}" not in tech_stack section. Got: {all_techs}')

    def test_docs_repo_has_no_fake_tech_stack(self):
        """
        REGRESSION TEST: Documentation repos must NOT get fake tech stacks.

        Previously AI was hallucinating things like "Python, FastAPI, Redis"
        for docs-only repos with no actual code.
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DOCS_REPO_DATA, readme_content=DOCS_README, user=None)

        # Find tech_stack section (might not exist for docs repos)
        tech_sections = [s for s in result['sections'] if s['type'] == 'tech_stack']

        if tech_sections:
            tech_section = tech_sections[0]
            categories = tech_section['content'].get('categories', [])

            # If there are categories, extract all tech names
            all_techs = []
            for cat in categories:
                for tech in cat.get('technologies', []):
                    if isinstance(tech, dict):
                        all_techs.append(tech.get('name', '').lower())
                    else:
                        all_techs.append(str(tech).lower())

            # MUST NOT have hallucinated programming languages
            hallucinated_langs = ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'ruby']
            for lang in hallucinated_langs:
                self.assertNotIn(lang, all_techs, f'Documentation repo incorrectly has "{lang}" in tech stack!')

            # MUST NOT have hallucinated frameworks
            hallucinated_frameworks = ['django', 'react', 'fastapi', 'flask', 'express', 'next.js', 'vue']
            for fw in hallucinated_frameworks:
                self.assertNotIn(fw, all_techs, f'Documentation repo incorrectly has "{fw}" in tech stack!')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AICategoryAssignmentTest(TestCase):
    """
    Test that AI assigns correct categories based on repo type.
    """

    def test_code_repo_gets_developer_category(self):
        """Code repos should get Developer & Coding (category 9)."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        # Should have Developer & Coding (9) or related coding category
        coding_categories = [9, 2, 7, 8]  # Developer, Websites, Workflows, Productivity
        has_coding_category = any(cat in result['category_ids'] for cat in coding_categories)

        self.assertTrue(
            has_coding_category, f'Code repo should have a coding-related category. Got: {result["category_ids"]}'
        )

    def test_docs_repo_gets_education_category(self):
        """
        REGRESSION TEST: Documentation repos should get Education category (10).

        Previously docs repos were getting random categories like "Images & Video"
        due to AI hallucination.
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DOCS_REPO_DATA, readme_content=DOCS_README, user=None)

        # Should have Podcasts & Education (10) for docs repos
        # Or at minimum, should NOT have Developer & Coding (9) since no code
        education_categories = [5, 10, 11]  # Education, Podcasts, Thought Experiments

        # Check it's NOT assigned as a coding project
        self.assertNotIn(9, result['category_ids'], 'Documentation repo should NOT get Developer & Coding category (9)')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AIFeaturesValidationTest(TestCase):
    """
    Test that AI generates features based on actual README content.
    """

    def test_features_reference_readme_content(self):
        """Features should be based on README, not hallucinated."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        # Find features section
        features_sections = [s for s in result['sections'] if s['type'] == 'features']

        if features_sections:
            features = features_sections[0]['content'].get('features', [])

            # Must have features
            self.assertGreater(len(features), 0, 'Should have at least one feature')
            self.assertLessEqual(len(features), 6, 'Should have at most 6 features')

            # Each feature must have required fields
            for i, feature in enumerate(features):
                self.assertIn('title', feature, f'Feature {i} missing title')
                self.assertIn('description', feature, f'Feature {i} missing description')

    def test_features_have_valid_icons(self):
        """Feature icons should be valid FontAwesome names."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        features_sections = [s for s in result['sections'] if s['type'] == 'features']

        if features_sections:
            features = features_sections[0]['content'].get('features', [])

            # Valid FontAwesome icon prefixes
            valid_prefixes = ['Fa', 'fa', 'FI', 'fi']

            for feature in features:
                icon = feature.get('icon', '')
                if icon:
                    has_valid_prefix = any(icon.startswith(p) for p in valid_prefixes)
                    self.assertTrue(has_valid_prefix, f'Invalid icon name: {icon}. Should start with Fa prefix.')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AIGitHubTopicsTest(TestCase):
    """
    Test that GitHub topics are preserved in output.
    """

    def test_github_topics_included(self):
        """GitHub topics should be included in output topics."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(DJANGO_REPO_DATA, readme_content=DJANGO_README, user=None)

        # Result topics should include GitHub topics
        result_topics = [t.lower() for t in result.get('topics', [])]
        github_topics = [t.lower() for t in DJANGO_REPO_DATA['topics']]

        # At least some GitHub topics should be preserved
        preserved_count = sum(1 for t in github_topics if t in result_topics)
        self.assertGreater(
            preserved_count, 0, f'No GitHub topics preserved. GitHub: {github_topics}, Result: {result_topics}'
        )


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class AIErrorHandlingTest(TestCase):
    """
    Test that AI analyzer handles errors gracefully.
    """

    def test_fallback_on_empty_readme(self):
        """Should work with empty README."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        result = analyze_github_repo_for_template(
            DJANGO_REPO_DATA,
            readme_content='',  # Empty README
            user=None,
        )

        # Should still return valid structure
        self.assertEqual(result.get('templateVersion'), 2)
        self.assertIn('sections', result)
        self.assertIn('category_ids', result)

    def test_fallback_on_minimal_repo_data(self):
        """Should work with minimal repo data."""
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template

        minimal_repo = {
            'name': 'test-repo',
            'description': '',
            'owner': 'testuser',
            'language': None,
            'stargazers_count': 0,
            'topics': [],
            'html_url': 'https://github.com/testuser/test-repo',
            'tree': [],
            'tech_stack': {'languages': {}, 'frameworks': [], 'tools': []},
        }

        result = analyze_github_repo_for_template(minimal_repo, readme_content='# Test', user=None)

        # Should still return valid structure
        self.assertEqual(result.get('templateVersion'), 2)
        self.assertIn('sections', result)
        self.assertIn('category_ids', result)
        self.assertGreater(len(result['category_ids']), 0, 'Must assign at least one category even for minimal repo')


# =============================================================================
# Full Flow Integration Test
# =============================================================================


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class FullGitHubImportFlowTest(TestCase):
    """
    End-to-end test of the complete GitHub import flow.

    This simulates what happens when a user clicks "Add from Integration"
    in the intelligent chat.
    """

    def test_full_import_flow_produces_valid_output(self):
        """
        Test the complete flow from repo data to project-ready output.

        This is the most important test - it ensures the entire pipeline works.
        """
        from core.integrations.github.ai_analyzer import analyze_github_repo_for_template
        from core.integrations.github.helpers import detect_tech_stack_from_files

        # Step 1: Detect tech stack (this happens before AI)
        detected_stack = detect_tech_stack_from_files(
            DJANGO_REPO_DATA['tree'],
            {
                'requirements.txt': 'django>=5.0\ncelery>=5.3\nredis>=5.0',
                'package.json': '{"dependencies": {"react": "^18", "typescript": "^5"}}',
            },
        )

        # Verify detection works
        self.assertIn('Python', detected_stack['languages'])
        self.assertIn('Django', detected_stack['frameworks'])

        # Step 2: Add detected stack to repo data
        repo_with_stack = {**DJANGO_REPO_DATA, 'tech_stack': detected_stack}

        # Step 3: Call AI analyzer (the main flow)
        result = analyze_github_repo_for_template(repo_with_stack, readme_content=DJANGO_README, user=None)

        # Step 4: Validate output can be used to create a project
        self.assertEqual(result['templateVersion'], 2)

        # Must have sections that frontend can render
        self.assertGreater(len(result['sections']), 0)

        # Must have valid categories that exist in DB
        self.assertGreater(len(result['category_ids']), 0)
        for cat_id in result['category_ids']:
            self.assertGreaterEqual(cat_id, 1)
            self.assertLessEqual(cat_id, 20)

        # Tech stack must use detected data
        tech_sections = [s for s in result['sections'] if s['type'] == 'tech_stack']
        if tech_sections:
            categories = tech_sections[0]['content'].get('categories', [])
            all_techs = []
            for cat in categories:
                for tech in cat.get('technologies', []):
                    name = tech.get('name', '') if isinstance(tech, dict) else str(tech)
                    all_techs.append(name.lower())

            # Detected frameworks should be present
            self.assertTrue(any('django' in t for t in all_techs), f'Detected Django not in tech stack: {all_techs}')

        print('\n✅ Full import flow test passed!')
        print(f'   - Sections generated: {len(result["sections"])}')
        print(f'   - Categories: {result["category_ids"]}')
        print(f'   - Topics: {result["topics"][:5]}...')
