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
        # Mock AI response
        mock_ai.return_value = json.dumps(
            {
                'description': 'A test Python repository for testing',
                'category_ids': [9],
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
        }

        mock_transform.return_value = [{'type': 'text', 'content': 'Transformed content'}]

        mock_optimize.return_value = [{'type': 'text', 'content': 'Optimized content'}]

        # Analyze
        result = analyze_github_repo(self.repo_data, readme_content='# Test README')

        # Verify
        self.assertEqual(result['description'], 'A test Python repository for testing')
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


# TODO: Add tests for:
# - Screenshot detection and imageGrid block creation
# - Demo video extraction
# - Logo as hero image fallback
# - Mermaid diagram generation
