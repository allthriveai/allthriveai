"""Tests for AI-powered GitHub repository analyzer."""

import json
from unittest.mock import patch

from django.test import TestCase

from core.integrations.github.ai_analyzer import analyze_github_repo, generate_blocks_from_repo_structure


class AIAnalyzerTestCase(TestCase):
    """Test AI analyzer functionality."""

    def setUp(self):
        """Set up test data."""
        self.repo_data = {
            'name': 'test-repo',
            'description': 'A test repository',
            'owner': 'testowner',
            'language': 'Python',
            'stargazers_count': 100,
            'topics': ['python', 'testing'],
            'tree': [
                {'path': 'src/main.py', 'type': 'blob'},
                {'path': 'tests/test_main.py', 'type': 'blob'},
                {'path': 'README.md', 'type': 'blob'},
            ],
            'dependencies': {},
        }

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.parse')
    @patch('core.integrations.base.parser.BaseParser.transform_readme_content_with_ai')
    @patch('core.integrations.base.parser.BaseParser.optimize_layout_with_ai')
    def test_analyze_with_readme(self, mock_optimize, mock_transform, mock_parse, mock_ai):
        """Test analysis with README content."""
        # Mock AI response - must match what test expects
        mock_ai.return_value = json.dumps(
            {
                'description': 'A test Python repository for testing',
                'category_ids': [1, 9],  # Include category 1 that test expects
                'topics': ['python', 'testing', 'unittest'],
                'tool_names': [],
            }
        )

        # Mock README parsing
        mock_parse.return_value = {
            'blocks': [{'type': 'text', 'content': 'Test README'}],
            'hero_image': 'https://example.com/hero.png',
            'hero_quote': 'Test quote',
            'mermaid_diagrams': [],
            'demo_urls': [],
            'demo_videos': [],
        }

        # Transform and optimize return the same blocks structure
        mock_transform.return_value = [{'type': 'text', 'content': 'Transformed content'}]
        mock_optimize.return_value = [{'type': 'text', 'content': 'Optimized content'}]

        # Analyze
        result = analyze_github_repo(self.repo_data, readme_content='# Test README')

        # Verify
        self.assertEqual(result['description'], 'A test Python repository for testing')
        self.assertIn(1, result['category_ids'])  # From AI mock
        self.assertIn(9, result['category_ids'])
        self.assertIn('python', result['topics'])
        self.assertEqual(result['hero_image'], 'https://example.com/hero.png')

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.generate_architecture_diagram')
    def test_analyze_without_readme(self, mock_diagram, mock_ai):
        """Test analysis without README (generates blocks from repo structure)."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'A Python project', 'category_ids': [9], 'topics': ['python'], 'tool_names': []}
        )

        mock_diagram.return_value = 'graph TD\n  A --> B'

        # Analyze without README
        result = analyze_github_repo(self.repo_data, readme_content='')

        # Verify blocks were generated from structure
        self.assertGreater(len(result['readme_blocks']), 0)
        # Should have generated a hero image
        self.assertIn('opengraph.githubassets.com', result['hero_image'])

    def test_generate_blocks_from_repo_structure(self):
        """Test block generation from repository structure."""
        blocks = generate_blocks_from_repo_structure(self.repo_data)

        # Should have at least overview section
        self.assertGreater(len(blocks), 0)

        # First block should be heading
        self.assertEqual(blocks[0]['type'], 'text')
        self.assertEqual(blocks[0]['style'], 'heading')

    @patch('services.ai_provider.AIProvider.complete')
    def test_analyze_handles_ai_error(self, mock_ai):
        """Test fallback when AI fails."""
        # Mock AI error
        mock_ai.side_effect = Exception('AI service error')

        # Should fall back to basic metadata
        result = analyze_github_repo(self.repo_data, readme_content='')

        # Verify fallback data
        self.assertIn('description', result)
        self.assertEqual(result['category_ids'], [9])  # Default to Developer & Coding

    @patch('services.ai_provider.AIProvider.complete')
    def test_analyze_validates_category_ids(self, mock_ai):
        """Test category ID validation."""
        # Mock AI with invalid category IDs
        mock_ai.return_value = json.dumps(
            {
                'description': 'Test',
                'category_ids': [1, 999, -1, 9],  # 999 and -1 are invalid
                'topics': [],
                'tool_names': [],
            }
        )

        result = analyze_github_repo(self.repo_data, readme_content='')

        # Only valid IDs should be included
        self.assertIn(1, result['category_ids'])
        self.assertIn(9, result['category_ids'])
        self.assertNotIn(999, result['category_ids'])
        self.assertNotIn(-1, result['category_ids'])

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.scan_repository_for_images')
    @patch('core.integrations.base.parser.BaseParser.parse')
    @patch('core.integrations.base.parser.BaseParser.transform_readme_content_with_ai')
    @patch('core.integrations.base.parser.BaseParser.optimize_layout_with_ai')
    def test_analyze_uses_logo_as_hero_when_no_og_image(
        self, mock_optimize, mock_transform, mock_parse, mock_scan, mock_ai
    ):
        """Test analyze_github_repo uses extracted logo/banner as hero image when no open graph image."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'Test repo', 'category_ids': [9], 'topics': ['test'], 'tool_names': []}
        )

        # Mock visual assets with logo and banner
        mock_scan.return_value = {
            'screenshots': [],
            'logo': 'https://raw.githubusercontent.com/testowner/test-repo/HEAD/logo.svg',
            'banner': 'https://raw.githubusercontent.com/testowner/test-repo/HEAD/banner.png',
        }

        # Mock README parsing (no hero image in README)
        mock_parse.return_value = {
            'blocks': [{'type': 'text', 'content': 'Test'}],
            'hero_image': None,
            'hero_quote': None,
            'mermaid_diagrams': [],
            'demo_urls': [],
            'demo_videos': [],
        }

        mock_transform.return_value = [{'type': 'text', 'content': 'Test'}]
        mock_optimize.return_value = [{'type': 'text', 'content': 'Test'}]

        # Remove open_graph_image_url from repo data
        repo_data_no_og = self.repo_data.copy()
        repo_data_no_og.pop('open_graph_image_url', None)

        result = analyze_github_repo(repo_data_no_og, readme_content='# Test')

        # Should use logo as hero image (logo preferred over banner)
        self.assertEqual(result['hero_image'], 'https://raw.githubusercontent.com/testowner/test-repo/HEAD/logo.svg')

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.scan_repository_for_images')
    @patch('core.integrations.base.parser.BaseParser.parse')
    @patch('core.integrations.base.parser.BaseParser.transform_readme_content_with_ai')
    @patch('core.integrations.base.parser.BaseParser.optimize_layout_with_ai')
    def test_analyze_uses_banner_as_hero_when_no_logo(
        self, mock_optimize, mock_transform, mock_parse, mock_scan, mock_ai
    ):
        """Test analyze_github_repo uses banner when no logo available."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'Test repo', 'category_ids': [9], 'topics': ['test'], 'tool_names': []}
        )

        # Mock visual assets with only banner (no logo)
        mock_scan.return_value = {
            'screenshots': [],
            'logo': None,
            'banner': 'https://raw.githubusercontent.com/testowner/test-repo/HEAD/banner.png',
        }

        # Mock README parsing
        mock_parse.return_value = {
            'blocks': [{'type': 'text', 'content': 'Test'}],
            'hero_image': None,
            'hero_quote': None,
            'mermaid_diagrams': [],
            'demo_urls': [],
            'demo_videos': [],
        }

        mock_transform.return_value = [{'type': 'text', 'content': 'Test'}]
        mock_optimize.return_value = [{'type': 'text', 'content': 'Test'}]

        # Remove open_graph_image_url
        repo_data_no_og = self.repo_data.copy()
        repo_data_no_og.pop('open_graph_image_url', None)

        result = analyze_github_repo(repo_data_no_og, readme_content='# Test')

        # Should use banner as hero image
        self.assertEqual(result['hero_image'], 'https://raw.githubusercontent.com/testowner/test-repo/HEAD/banner.png')

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.scan_repository_for_images')
    @patch('core.integrations.base.parser.BaseParser.parse')
    @patch('core.integrations.base.parser.BaseParser.transform_readme_content_with_ai')
    @patch('core.integrations.base.parser.BaseParser.optimize_layout_with_ai')
    def test_analyze_adds_screenshots_as_image_grid(
        self, mock_optimize, mock_transform, mock_parse, mock_scan, mock_ai
    ):
        """Test analyze_github_repo correctly adds extracted screenshots as an imageGrid block."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'Test repo', 'category_ids': [9], 'topics': ['test'], 'tool_names': []}
        )

        # Mock scan to be called with correct args
        mock_scan.return_value = {
            'screenshots': [
                'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo1.png',
                'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo2.png',
                'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo3.png',
            ],
            'logo': None,
            'banner': None,
        }

        # Mock README parsing
        mock_parse.return_value = {
            'blocks': [{'type': 'text', 'content': 'Test content'}],
            'hero_image': 'https://example.com/hero.png',
            'hero_quote': None,
            'mermaid_diagrams': [],
            'demo_urls': [],
            'demo_videos': [],
        }

        # Transform and optimize mocks - screenshots will be appended after optimization
        mock_transform.return_value = [{'type': 'text', 'content': 'Test content'}]
        # Note: the actual code appends screenshots AFTER optimization
        mock_optimize.return_value = [{'type': 'text', 'content': 'Test content'}]

        result = analyze_github_repo(self.repo_data, readme_content='# Test')

        # Should have imageGrid block added (appended after optimization)
        image_grid_blocks = [b for b in result['readme_blocks'] if b.get('type') == 'imageGrid']
        self.assertEqual(len(image_grid_blocks), 1)

        # Verify imageGrid structure
        image_grid = image_grid_blocks[0]
        self.assertIn('images', image_grid)
        self.assertEqual(len(image_grid['images']), 3)
        self.assertEqual(image_grid['caption'], 'Project Screenshots')

        # Verify image URLs are correct
        for img in image_grid['images']:
            self.assertIn('url', img)
            self.assertIn('screenshots', img['url'])

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.scan_repository_for_images')
    @patch('core.integrations.base.parser.BaseParser.generate_architecture_diagram')
    def test_analyze_without_readme_adds_screenshots(self, mock_diagram, mock_scan, mock_ai):
        """Test analyze_github_repo adds screenshots even without README."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'Test repo', 'category_ids': [9], 'topics': ['test'], 'tool_names': []}
        )

        # Mock visual assets
        mock_scan.return_value = {
            'screenshots': [
                'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo1.png',
                'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo2.png',
            ],
            'logo': None,
            'banner': None,
        }

        mock_diagram.return_value = None

        # Analyze without README
        result = analyze_github_repo(self.repo_data, readme_content='')

        # Should have imageGrid block
        image_grid_blocks = [b for b in result['readme_blocks'] if b.get('type') == 'imageGrid']
        self.assertEqual(len(image_grid_blocks), 1)
        self.assertEqual(len(image_grid_blocks[0]['images']), 2)

    @patch('services.ai_provider.AIProvider.complete')
    @patch('core.integrations.base.parser.BaseParser.scan_repository_for_images')
    def test_analyze_limits_screenshots_to_six(self, mock_scan, mock_ai):
        """Test analyze_github_repo limits screenshots in imageGrid to 6."""
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {'description': 'Test repo', 'category_ids': [9], 'topics': ['test'], 'tool_names': []}
        )

        # Mock visual assets with more than 6 screenshots
        mock_scan.return_value = {
            'screenshots': [
                f'https://raw.githubusercontent.com/testowner/test-repo/HEAD/screenshots/demo{i}.png' for i in range(10)
            ],
            'logo': None,
            'banner': None,
        }

        result = analyze_github_repo(self.repo_data, readme_content='')

        # Should limit to 6 screenshots
        image_grid_blocks = [b for b in result['readme_blocks'] if b.get('type') == 'imageGrid']
        self.assertEqual(len(image_grid_blocks), 1)
        self.assertEqual(len(image_grid_blocks[0]['images']), 6)
