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


class EnhancedExtractionTestCase(TestCase):
    """Test enhanced content extraction features (Phase 1)."""

    def test_scan_repository_for_screenshots(self):
        """Test screenshot extraction from file tree."""
        tree = [
            {'path': 'screenshots/demo1.png', 'type': 'blob'},
            {'path': 'screenshots/demo2.png', 'type': 'blob'},
            {'path': 'docs/images/screenshot.jpg', 'type': 'blob'},
            {'path': 'src/main.py', 'type': 'blob'},
        ]

        result = BaseParser.scan_repository_for_images(tree, owner='test', repo='repo')

        # Should find screenshots
        self.assertEqual(len(result['screenshots']), 3)
        self.assertIn('demo1.png', result['screenshots'][0])
        self.assertIn('demo2.png', result['screenshots'][1])

    def test_scan_repository_for_logo(self):
        """Test logo detection with SVG priority."""
        tree = [
            {'path': 'logo.png', 'type': 'blob'},
            {'path': 'logo.svg', 'type': 'blob'},
            {'path': 'assets/logo.jpg', 'type': 'blob'},
        ]

        result = BaseParser.scan_repository_for_images(tree, owner='test', repo='repo')

        # Should prefer SVG logo
        self.assertIsNotNone(result['logo'])
        self.assertIn('logo.svg', result['logo'])

    def test_scan_repository_for_logo_png_fallback(self):
        """Test logo detection falls back to PNG when no SVG."""
        tree = [
            {'path': 'logo.png', 'type': 'blob'},
            {'path': 'assets/logo.jpg', 'type': 'blob'},
        ]

        result = BaseParser.scan_repository_for_images(tree, owner='test', repo='repo')

        # Should use PNG
        self.assertIsNotNone(result['logo'])
        self.assertIn('logo.png', result['logo'])

    def test_extract_youtube_urls(self):
        """Test YouTube URL extraction from README."""
        readme = """# Project

Check out the demo: https://www.youtube.com/watch?v=dQw4w9WgXcQ

Also available: https://youtu.be/dQw4w9WgXcQ
"""
        result = BaseParser.extract_demo_videos(readme)

        # Should find both YouTube URLs
        youtube_videos = [v for v in result if v['type'] == 'youtube']
        self.assertEqual(len(youtube_videos), 2)
        self.assertEqual(youtube_videos[0]['id'], 'dQw4w9WgXcQ')

    def test_extract_vimeo_urls(self):
        """Test Vimeo URL extraction."""
        readme = """# Project

Demo: https://vimeo.com/123456789
"""
        result = BaseParser.extract_demo_videos(readme)

        # Should find Vimeo URL
        vimeo_videos = [v for v in result if v['type'] == 'vimeo']
        self.assertEqual(len(vimeo_videos), 1)
        self.assertEqual(vimeo_videos[0]['id'], '123456789')

    def test_extract_gif_demos(self):
        """Test GIF detection as demo animations."""
        readme = """# Project

![Demo](https://example.com/demo.gif)
![Another](demo-animation.gif)
"""
        result = BaseParser.extract_demo_videos(readme)

        # Should find GIFs
        gif_videos = [v for v in result if v['type'] == 'gif']
        self.assertGreaterEqual(len(gif_videos), 1)

    def test_extract_demo_urls_from_badges(self):
        """Test demo URL extraction from badge links."""
        readme = """# Project

[![Demo](https://img.shields.io/badge/demo-live-green)](https://my-demo.com)
[![Website](https://img.shields.io/badge/website-online-blue)](https://my-site.com)
[![Preview](https://img.shields.io/badge/preview-click-red)](https://preview.example.com)
"""
        result = BaseParser.extract_demo_urls_from_badges(readme)

        # Should find demo URLs
        self.assertGreaterEqual(len(result), 2)
        self.assertIn('https://my-demo.com', result)
        self.assertIn('https://my-site.com', result)

    def test_extract_demo_urls_ignores_non_demo_badges(self):
        """Test that non-demo badges are ignored."""
        readme = """# Project

[![Build](https://img.shields.io/badge/build-passing-green)](https://ci.example.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://license.com)
"""
        result = BaseParser.extract_demo_urls_from_badges(readme)

        # Should not extract build/license badge links
        self.assertEqual(len(result), 0)

    def test_parse_includes_demo_videos(self):
        """Test parse() method includes demo_videos in result."""
        readme = """# Project

Watch the demo: https://www.youtube.com/watch?v=test123
"""
        result = BaseParser.parse(readme)

        # Should include demo_videos key
        self.assertIn('demo_videos', result)
        self.assertGreater(len(result['demo_videos']), 0)
