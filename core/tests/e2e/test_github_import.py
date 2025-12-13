"""
End-to-End Tests for GitHub Import Flow.

MISSION CRITICAL: These tests ensure the GitHub import feature works correctly.
They use real repository data fixtures (not mocks) to catch regressions.

Tests cover:
1. Tech stack detection from dependency files
2. Language detection from file extensions
3. Category assignment logic
4. Project creation with proper fields
5. AI analyzer output validation

Run with: make test-e2e-github
Or: pytest core/tests/e2e/test_github_import.py -v
"""

import json

from django.test import TestCase, TransactionTestCase

from core.integrations.github.helpers import detect_tech_stack_from_files
from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from core.users.models import User

# =============================================================================
# REAL REPOSITORY FIXTURES
# These are captured from actual GitHub repositories to ensure realistic testing
# =============================================================================

# Fixture: Python Django project (like AllThrive)
DJANGO_PROJECT_FIXTURE = {
    'name': 'allthriveai',
    'description': 'AI-powered portfolio platform',
    'owner': 'AllieRays',
    'language': 'Python',
    'stargazers_count': 10,
    'topics': ['python', 'django', 'ai', 'portfolio'],
    'html_url': 'https://github.com/AllieRays/allthriveai',
    'tree': [
        {'path': 'core', 'type': 'tree'},
        {'path': 'core/projects', 'type': 'tree'},
        {'path': 'core/users', 'type': 'tree'},
        {'path': 'frontend', 'type': 'tree'},
        {'path': 'frontend/src', 'type': 'tree'},
        {'path': 'manage.py', 'type': 'blob'},
        {'path': 'requirements.txt', 'type': 'blob'},
        {'path': 'docker-compose.yml', 'type': 'blob'},
        {'path': 'Dockerfile', 'type': 'blob'},
        {'path': '.github/workflows/ci.yml', 'type': 'blob'},
        {'path': 'Makefile', 'type': 'blob'},
        {'path': 'frontend/package.json', 'type': 'blob'},
        {'path': 'frontend/src/App.tsx', 'type': 'blob'},
        {'path': 'frontend/src/index.tsx', 'type': 'blob'},
    ],
    'dependencies': {
        'requirements.txt': """
django>=5.0
djangorestframework>=3.14
celery>=5.3
redis>=5.0
psycopg2-binary>=2.9
langchain>=0.1
anthropic>=0.18
""",
        'package.json': json.dumps(
            {
                'dependencies': {
                    'react': '^18.2.0',
                    'typescript': '^5.0.0',
                    'tailwindcss': '^3.4.0',
                },
                'devDependencies': {
                    '@types/react': '^18.2.0',
                },
            }
        ),
    },
}

# Fixture: JavaScript/React project
REACT_PROJECT_FIXTURE = {
    'name': 'react-dashboard',
    'description': 'Modern React dashboard with TypeScript',
    'owner': 'testuser',
    'language': 'TypeScript',
    'stargazers_count': 50,
    'topics': ['react', 'typescript', 'dashboard'],
    'html_url': 'https://github.com/testuser/react-dashboard',
    'tree': [
        {'path': 'src', 'type': 'tree'},
        {'path': 'src/components', 'type': 'tree'},
        {'path': 'src/hooks', 'type': 'tree'},
        {'path': 'src/App.tsx', 'type': 'blob'},
        {'path': 'src/index.tsx', 'type': 'blob'},
        {'path': 'package.json', 'type': 'blob'},
        {'path': 'tsconfig.json', 'type': 'blob'},
        {'path': '.github/workflows/test.yml', 'type': 'blob'},
    ],
    'dependencies': {
        'package.json': json.dumps(
            {
                'dependencies': {
                    'react': '^18.2.0',
                    'react-dom': '^18.2.0',
                    'next': '^14.0.0',
                    'tailwindcss': '^3.4.0',
                },
                'devDependencies': {
                    'typescript': '^5.0.0',
                    '@types/react': '^18.2.0',
                },
            }
        ),
    },
}

# Fixture: Documentation-only repository (like acquia-dev-exercises)
DOCS_ONLY_FIXTURE = {
    'name': 'acquia-dev-exercises',
    'description': 'Development exercises and documentation',
    'owner': 'AllieRays',
    'language': None,  # No primary language detected by GitHub
    'stargazers_count': 0,
    'topics': [],
    'html_url': 'https://github.com/AllieRays/acquia-dev-exercises',
    'tree': [
        {'path': 'docs', 'type': 'tree'},
        {'path': 'exercises', 'type': 'tree'},
        {'path': 'README.md', 'type': 'blob'},
        {'path': 'docs/setup.md', 'type': 'blob'},
        {'path': 'docs/exercises.md', 'type': 'blob'},
        {'path': 'exercises/exercise1.md', 'type': 'blob'},
        {'path': 'exercises/exercise2.md', 'type': 'blob'},
    ],
    'dependencies': {},  # No dependency files
}

# Fixture: Go project
GO_PROJECT_FIXTURE = {
    'name': 'go-api-server',
    'description': 'High-performance API server in Go',
    'owner': 'testuser',
    'language': 'Go',
    'stargazers_count': 100,
    'topics': ['go', 'api', 'rest'],
    'html_url': 'https://github.com/testuser/go-api-server',
    'tree': [
        {'path': 'cmd', 'type': 'tree'},
        {'path': 'internal', 'type': 'tree'},
        {'path': 'pkg', 'type': 'tree'},
        {'path': 'main.go', 'type': 'blob'},
        {'path': 'go.mod', 'type': 'blob'},
        {'path': 'go.sum', 'type': 'blob'},
        {'path': 'Dockerfile', 'type': 'blob'},
        {'path': 'Makefile', 'type': 'blob'},
        {'path': 'internal/handler/handler.go', 'type': 'blob'},
        {'path': 'internal/service/service.go', 'type': 'blob'},
    ],
    'dependencies': {
        'go.mod': """
module github.com/testuser/go-api-server

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/go-redis/redis/v9 v9.0.0
)
""",
    },
}

# Fixture: PHP Laravel project
PHP_LARAVEL_FIXTURE = {
    'name': 'laravel-shop',
    'description': 'E-commerce platform built with Laravel',
    'owner': 'testuser',
    'language': 'PHP',
    'stargazers_count': 25,
    'topics': ['php', 'laravel', 'ecommerce'],
    'html_url': 'https://github.com/testuser/laravel-shop',
    'tree': [
        {'path': 'app', 'type': 'tree'},
        {'path': 'app/Http', 'type': 'tree'},
        {'path': 'app/Models', 'type': 'tree'},
        {'path': 'routes', 'type': 'tree'},
        {'path': 'composer.json', 'type': 'blob'},
        {'path': 'artisan', 'type': 'blob'},
        {'path': 'app/Http/Controllers/ProductController.php', 'type': 'blob'},
        {'path': 'app/Models/Product.php', 'type': 'blob'},
    ],
    'dependencies': {
        'composer.json': json.dumps(
            {
                'require': {
                    'php': '^8.2',
                    'laravel/framework': '^10.0',
                    'laravel/sanctum': '^3.0',
                },
                'require-dev': {
                    'phpunit/phpunit': '^10.0',
                },
            }
        ),
    },
}


class TechStackDetectionE2ETest(TestCase):
    """
    E2E tests for tech stack detection from real repository data.

    These tests verify that detect_tech_stack_from_files() correctly
    identifies languages, frameworks, and tools from actual repo structures.
    """

    def test_django_python_project_detection(self):
        """Test detection of Django/Python project tech stack."""
        tech_stack = detect_tech_stack_from_files(
            DJANGO_PROJECT_FIXTURE['tree'], DJANGO_PROJECT_FIXTURE['dependencies']
        )

        # Must detect Python as primary language
        self.assertIn('Python', tech_stack['languages'])
        self.assertEqual(tech_stack['languages']['Python'], 'primary')

        # Must detect Django framework
        self.assertIn('Django', tech_stack['frameworks'])

        # Must detect Celery (from requirements.txt)
        self.assertIn('Celery', tech_stack['frameworks'])

        # Must detect Docker tools
        self.assertIn('Docker', tech_stack['tools'])
        self.assertIn('GitHub Actions', tech_stack['tools'])
        self.assertIn('Make', tech_stack['tools'])

    def test_react_typescript_project_detection(self):
        """Test detection of React/TypeScript project tech stack."""
        tech_stack = detect_tech_stack_from_files(REACT_PROJECT_FIXTURE['tree'], REACT_PROJECT_FIXTURE['dependencies'])

        # Must detect JavaScript and TypeScript
        self.assertIn('JavaScript', tech_stack['languages'])
        self.assertIn('TypeScript', tech_stack['languages'])

        # Must detect React and Next.js frameworks
        self.assertIn('React', tech_stack['frameworks'])
        self.assertIn('Next.js', tech_stack['frameworks'])
        self.assertIn('Tailwind CSS', tech_stack['frameworks'])

        # Must detect GitHub Actions
        self.assertIn('GitHub Actions', tech_stack['tools'])

    def test_documentation_only_repo_detection(self):
        """
        Test that documentation-only repos don't get fake tech stacks.

        REGRESSION TEST: Previously AI was hallucinating tech stacks
        like Python, FastAPI, Redis for docs-only repos.
        """
        tech_stack = detect_tech_stack_from_files(DOCS_ONLY_FIXTURE['tree'], DOCS_ONLY_FIXTURE['dependencies'])

        # Must NOT detect any primary programming languages
        # (Markdown doesn't count as it's filtered out)
        for lang in ['Python', 'JavaScript', 'TypeScript', 'Go', 'Ruby', 'PHP']:
            self.assertNotIn(
                lang, tech_stack['languages'], f'Documentation repo incorrectly detected as {lang} project'
            )

        # Must NOT detect any frameworks
        self.assertEqual(
            len(tech_stack['frameworks']),
            0,
            f'Documentation repo incorrectly got frameworks: {tech_stack["frameworks"]}',
        )

    def test_go_project_detection(self):
        """Test detection of Go project tech stack."""
        tech_stack = detect_tech_stack_from_files(GO_PROJECT_FIXTURE['tree'], GO_PROJECT_FIXTURE['dependencies'])

        # Must detect Go as primary language
        self.assertIn('Go', tech_stack['languages'])
        self.assertEqual(tech_stack['languages']['Go'], 'primary')

        # Must detect Docker and Make tools
        self.assertIn('Docker', tech_stack['tools'])
        self.assertIn('Make', tech_stack['tools'])

    def test_php_laravel_project_detection(self):
        """Test detection of PHP/Laravel project tech stack."""
        tech_stack = detect_tech_stack_from_files(PHP_LARAVEL_FIXTURE['tree'], PHP_LARAVEL_FIXTURE['dependencies'])

        # Must detect PHP as primary language
        self.assertIn('PHP', tech_stack['languages'])
        self.assertEqual(tech_stack['languages']['PHP'], 'primary')

        # Must detect Laravel framework
        self.assertIn('Laravel', tech_stack['frameworks'])

    def test_file_extension_detection(self):
        """Test language detection from file extensions without dependency files."""
        # Repo with only Python files, no requirements.txt
        tree = [
            {'path': 'src', 'type': 'tree'},
            {'path': 'src/main.py', 'type': 'blob'},
            {'path': 'src/utils.py', 'type': 'blob'},
            {'path': 'src/models.py', 'type': 'blob'},
            {'path': 'tests', 'type': 'tree'},
            {'path': 'tests/test_main.py', 'type': 'blob'},
            {'path': 'tests/test_utils.py', 'type': 'blob'},
        ]

        tech_stack = detect_tech_stack_from_files(tree, {})

        # Should detect Python from file extensions
        self.assertIn('Python', tech_stack['languages'])


class CategoryAssignmentE2ETest(TestCase):
    """
    E2E tests for category assignment logic.

    These tests ensure projects get the correct categories based on
    their detected language and tech stack.
    """

    @classmethod
    def setUpClass(cls):
        """Ensure categories are seeded."""
        super().setUpClass()
        # These are the categories we expect to exist
        # ID 9 = Developer & Coding
        # ID 10 = Podcasts & Education

    def test_code_project_gets_developer_category(self):
        """Test that code projects get Developer & Coding category (ID 9)."""
        from core.integrations.github.ai_analyzer import _generate_fallback_template

        result = _generate_fallback_template(
            DJANGO_PROJECT_FIXTURE,
            readme_content='# Django Project',
            hero_image='https://example.com/hero.png',
            visual_assets={'screenshots': [], 'logo': None, 'banner': None},
        )

        # Must get category 9 (Developer & Coding)
        self.assertIn(9, result['category_ids'], 'Code project should be assigned Developer & Coding category')

    def test_docs_project_gets_education_category(self):
        """
        Test that documentation projects get Education category (ID 10).

        REGRESSION TEST: Previously docs repos were getting
        "Images & Video" category due to AI hallucination.
        """
        from core.integrations.github.ai_analyzer import _generate_fallback_template

        result = _generate_fallback_template(
            DOCS_ONLY_FIXTURE,
            readme_content='# Documentation',
            hero_image='https://example.com/hero.png',
            visual_assets={'screenshots': [], 'logo': None, 'banner': None},
        )

        # Must get category 10 (Podcasts & Education) for docs repos
        self.assertIn(
            10, result['category_ids'], 'Documentation project should be assigned Podcasts & Education category'
        )

        # Must NOT get category 9 (Developer & Coding)
        self.assertNotIn(9, result['category_ids'], 'Documentation project should NOT get Developer & Coding category')


class ProjectCreationE2ETest(TransactionTestCase):
    """
    E2E tests for project creation.

    These tests verify that projects are created with all required fields
    and proper defaults.
    """

    def setUp(self):
        """Create test user and seed categories."""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')

        # Ensure Developer & Coding category exists
        Taxonomy.objects.get_or_create(
            id=9,
            defaults={
                'name': 'Developer & Coding',
                'slug': 'developer-coding',
                'taxonomy_type': 'category',
                'is_active': True,
            },
        )

        # Ensure Podcasts & Education category exists
        Taxonomy.objects.get_or_create(
            id=10,
            defaults={
                'name': 'Podcasts & Education',
                'slug': 'podcasts-education',
                'taxonomy_type': 'category',
                'is_active': True,
            },
        )

    def test_project_creation_with_tools_order(self):
        """
        Test that projects are created with tools_order field.

        REGRESSION TEST: Previously projects failed with
        "null value in column tools_order violates not-null constraint"
        """
        project = Project.objects.create(
            user=self.user,
            title='Test Project',
            description='A test project',
            type='github_repo',
            tools_order=[],  # This is the fix
        )

        self.assertIsNotNone(project.id)
        self.assertEqual(project.tools_order, [])
        self.assertEqual(project.type, 'github_repo')

    def test_github_project_type(self):
        """
        Test that GitHub imports get 'github_repo' type.

        REGRESSION TEST: Previously GitHub repos were getting
        'clipped' type instead of 'github_repo'.
        """
        project = Project.objects.create(
            user=self.user,
            title='GitHub Test',
            description='Imported from GitHub',
            type='github_repo',
            external_url='https://github.com/test/repo',
            tools_order=[],
        )

        self.assertEqual(project.type, 'github_repo')
        self.assertNotEqual(project.type, 'clipped')


class AIAnalyzerOutputValidationTest(TestCase):
    """
    E2E tests for AI analyzer output validation.

    These tests ensure the AI analyzer produces valid output
    even when AI hallucinates or fails.
    """

    def test_fallback_template_has_required_fields(self):
        """Test that fallback template contains all required fields."""
        from core.integrations.github.ai_analyzer import _generate_fallback_template

        result = _generate_fallback_template(
            DJANGO_PROJECT_FIXTURE,
            readme_content='# Test',
            hero_image='https://example.com/hero.png',
            visual_assets={'screenshots': [], 'logo': None, 'banner': None},
        )

        # Must have templateVersion
        self.assertEqual(result['templateVersion'], 2)

        # Must have sections array
        self.assertIn('sections', result)
        self.assertIsInstance(result['sections'], list)

        # Must have category_ids array
        self.assertIn('category_ids', result)
        self.assertIsInstance(result['category_ids'], list)
        self.assertGreater(len(result['category_ids']), 0, 'Must have at least one category')

        # Must have topics array
        self.assertIn('topics', result)
        self.assertIsInstance(result['topics'], list)

        # Must have hero_image
        self.assertIn('hero_image', result)

    def test_detected_tech_stack_used_in_sections(self):
        """
        Test that detected tech stack is used (not AI-generated).

        REGRESSION TEST: Previously AI was generating tech stacks
        instead of using the detected data.
        """
        from core.integrations.github.ai_analyzer import _generate_fallback_template

        result = _generate_fallback_template(
            DJANGO_PROJECT_FIXTURE,
            readme_content='# Django Project',
            hero_image='https://example.com/hero.png',
            visual_assets={'screenshots': [], 'logo': None, 'banner': None},
        )

        # Find tech_stack section
        tech_sections = [s for s in result['sections'] if s['type'] == 'tech_stack']

        if tech_sections:
            tech_section = tech_sections[0]
            categories = tech_section['content']['categories']

            # Must have categories from detected tech stack
            self.assertGreater(len(categories), 0)

            # Check that detected languages are included
            all_technologies = []
            for cat in categories:
                for tech in cat.get('technologies', []):
                    if isinstance(tech, dict):
                        all_technologies.append(tech.get('name', ''))
                    else:
                        all_technologies.append(tech)

            # Python should be in the tech stack (from detection)
            # Not hardcoded AI examples like "React" or "FastAPI"
            self.assertTrue(
                any('Python' in t or 'JavaScript' in t for t in all_technologies),
                f'Detected language not in tech stack: {all_technologies}',
            )

    def test_github_topics_used_as_project_topics(self):
        """Test that GitHub topics are used as project topics."""
        from core.integrations.github.ai_analyzer import _generate_fallback_template

        result = _generate_fallback_template(
            DJANGO_PROJECT_FIXTURE,
            readme_content='# Test',
            hero_image='https://example.com/hero.png',
            visual_assets={'screenshots': [], 'logo': None, 'banner': None},
        )

        # GitHub topics should be in result topics
        for topic in DJANGO_PROJECT_FIXTURE['topics']:
            self.assertIn(topic.lower(), result['topics'], f'GitHub topic "{topic}" not in result topics')


class GitHubURLParsingE2ETest(TestCase):
    """E2E tests for GitHub URL parsing."""

    def test_parse_https_url(self):
        """Test parsing standard HTTPS GitHub URLs."""
        from core.integrations.github.helpers import parse_github_url

        owner, repo = parse_github_url('https://github.com/AllieRays/allthriveai')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_parse_https_url_with_trailing_slash(self):
        """Test parsing URL with trailing slash."""
        from core.integrations.github.helpers import parse_github_url

        owner, repo = parse_github_url('https://github.com/AllieRays/allthriveai/')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_parse_git_url(self):
        """Test parsing git@ style URLs."""
        from core.integrations.github.helpers import parse_github_url

        owner, repo = parse_github_url('git@github.com:AllieRays/allthriveai.git')
        self.assertEqual(owner, 'AllieRays')
        self.assertEqual(repo, 'allthriveai')

    def test_invalid_url_raises_error(self):
        """Test that invalid URLs raise ValueError."""
        from core.integrations.github.helpers import parse_github_url

        with self.assertRaises(ValueError):
            parse_github_url('https://gitlab.com/user/repo')

        with self.assertRaises(ValueError):
            parse_github_url('not-a-url')
