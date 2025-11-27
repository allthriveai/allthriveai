"""Unit tests for BaseParser."""

from django.test import TestCase

from core.integrations.base.parser import BaseParser


class BaseParserTestCase(TestCase):
    """Test BaseParser functionality."""

    def test_parse_empty_content(self):
        """Test parsing empty content returns empty result."""
        result = BaseParser.parse('')

        self.assertEqual(result['blocks'], [])
        self.assertIsNone(result['hero_image'])
        self.assertIsNone(result['hero_quote'])
        self.assertEqual(result['mermaid_diagrams'], [])
        self.assertEqual(result['demo_urls'], [])

    def test_parse_simple_markdown(self):
        """Test parsing simple markdown creates blocks."""
        markdown = """# Test Project

This is a simple description.

## Features
- Feature 1
- Feature 2
"""
        result = BaseParser.parse(markdown)

        # Should have blocks
        self.assertGreater(len(result['blocks']), 0)

        # Should have standard keys
        self.assertIn('blocks', result)
        self.assertIn('hero_image', result)
        self.assertIn('hero_quote', result)
        self.assertIn('mermaid_diagrams', result)
        self.assertIn('demo_urls', result)

    def test_badge_grouping(self):
        """Test consecutive badge images are grouped into badgeRow."""
        markdown = """# Project

![Badge1](https://img.shields.io/badge/test-1-blue.svg)
![Badge2](https://img.shields.io/badge/test-2-green.svg)
![Badge3](https://img.shields.io/badge/test-3-red.svg)

Some text here.
"""
        result = BaseParser.parse(markdown)

        # Should have at least one badgeRow block
        badge_rows = [b for b in result['blocks'] if b.get('type') == 'badgeRow']
        self.assertGreater(len(badge_rows), 0)

        # BadgeRow should have multiple badges
        if badge_rows:
            self.assertIn('badges', badge_rows[0])
            self.assertGreater(len(badge_rows[0]['badges']), 1)

    def test_is_badge_url(self):
        """Test badge URL detection."""
        parser = BaseParser()

        # Should detect badge URLs
        self.assertTrue(parser._is_badge_url('https://img.shields.io/badge/test-badge-blue.svg'))
        self.assertTrue(parser._is_badge_url('https://badge.fury.io/py/package.svg'))
        self.assertTrue(parser._is_badge_url('https://travis-ci.org/user/repo.svg'))

        # Should not detect regular image URLs
        self.assertFalse(parser._is_badge_url('https://example.com/screenshot.png'))
        self.assertFalse(parser._is_badge_url('https://github.com/user/repo/raw/main/image.jpg'))

    def test_mermaid_diagram_extraction(self):
        """Test Mermaid diagram extraction."""
        markdown = """# Architecture

```mermaid
graph TB
    A[User] --> B[API]
    B --> C[Database]
```

Some description.
"""
        result = BaseParser.parse(markdown)

        # Should extract mermaid diagram
        self.assertEqual(len(result['mermaid_diagrams']), 1)
        self.assertIn('graph TB', result['mermaid_diagrams'][0])

        # Should create mermaid block
        mermaid_blocks = [b for b in result['blocks'] if b.get('type') == 'mermaid']
        self.assertEqual(len(mermaid_blocks), 1)

    def test_normalize_image_url_with_platform_data(self):
        """Test image URL normalization with GitHub platform data."""
        platform_data = {'owner': 'testuser', 'repo': 'testproject', 'default_branch': 'main'}
        parser = BaseParser(platform_data)

        # Relative URL should be converted to absolute GitHub raw URL
        relative_url = 'images/screenshot.png'
        normalized = parser.normalize_image_url(relative_url)
        self.assertIn('raw.githubusercontent.com', normalized)
        self.assertIn('testuser', normalized)
        self.assertIn('testproject', normalized)

        # Absolute URL should remain unchanged
        absolute_url = 'https://example.com/image.png'
        normalized = parser.normalize_image_url(absolute_url)
        self.assertEqual(normalized, absolute_url)

    def test_normalize_link_url_with_platform_data(self):
        """Test link URL normalization with GitHub platform data."""
        platform_data = {'owner': 'testuser', 'repo': 'testproject', 'default_branch': 'main'}
        parser = BaseParser(platform_data)

        # Relative URL should be converted to absolute GitHub blob URL
        relative_url = 'docs/guide.md'
        normalized = parser.normalize_link_url(relative_url)
        self.assertIn('github.com', normalized)
        self.assertIn('blob', normalized)
        self.assertIn('testuser', normalized)
        self.assertIn('testproject', normalized)

        # Absolute URL should remain unchanged
        absolute_url = 'https://example.com/page'
        normalized = parser.normalize_link_url(absolute_url)
        self.assertEqual(normalized, absolute_url)

        # Anchor links should remain unchanged
        anchor_url = '#section-name'
        normalized = parser.normalize_link_url(anchor_url)
        self.assertEqual(normalized, anchor_url)

    def test_split_into_sections(self):
        """Test markdown splitting by headings."""
        markdown = """# Title

Intro text.

## Section 1

Content 1.

## Section 2

Content 2.
"""
        parser = BaseParser()
        sections = parser._split_into_sections(markdown)

        # Should have multiple sections
        self.assertGreaterEqual(len(sections), 2)

        # Each section should have heading and content
        for section in sections:
            self.assertIn('heading', section)
            self.assertIn('content', section)
            self.assertIn('level', section)

    def test_categorize_section(self):
        """Test section categorization by heading keywords."""
        parser = BaseParser()

        # Test various section types
        self.assertEqual(parser._categorize_section('Features'), 'features')
        self.assertEqual(parser._categorize_section('Installation'), 'installation')
        self.assertEqual(parser._categorize_section('Tech Stack'), 'tech_stack')
        self.assertEqual(parser._categorize_section('Demo'), 'demo')
        self.assertEqual(parser._categorize_section('Random Heading'), 'overview')
        self.assertEqual(parser._categorize_section(None), 'overview')
