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

    def test_extract_youtube_embed_urls(self):
        """Test YouTube embed URL extraction."""
        readme = """# Demo

<iframe src="https://www.youtube.com/embed/abc123XYZ-_"></iframe>
"""
        result = BaseParser.extract_demo_videos(readme)

        # Should find YouTube embed URL
        youtube_videos = [v for v in result if v['type'] == 'youtube']
        self.assertGreaterEqual(len(youtube_videos), 1)
        # Verify video ID format
        self.assertEqual(len(youtube_videos[0]['id']), 11)

    def test_extract_demo_videos_handles_mixed_formats(self):
        """Test extract_demo_videos accurately parses YouTube, Vimeo, and GIF URLs from README content."""
        readme = """# Comprehensive Demo

## Video Demos

Watch on YouTube: https://www.youtube.com/watch?v=dQw4w9WgXcQ
Short link: https://youtu.be/abc123defgh
Embedded: https://www.youtube.com/embed/xyz987ABCDE

Vimeo demo: https://vimeo.com/123456789
Another Vimeo: https://vimeo.com/987654321

## GIF Demos

![Demo Animation](https://example.com/demo.gif)
![Feature showcase](assets/feature.GIF)
![Walkthrough](./demo-walkthrough.gif)
"""
        result = BaseParser.extract_demo_videos(readme)

        # Verify YouTube videos
        youtube_videos = [v for v in result if v['type'] == 'youtube']
        self.assertEqual(len(youtube_videos), 3)
        # Verify structure of YouTube videos
        for video in youtube_videos:
            self.assertIn('type', video)
            self.assertIn('id', video)
            self.assertIn('url', video)
            self.assertIn('embed_url', video)
            self.assertEqual(video['type'], 'youtube')
            self.assertEqual(len(video['id']), 11)  # YouTube IDs are 11 chars

        # Verify Vimeo videos
        vimeo_videos = [v for v in result if v['type'] == 'vimeo']
        self.assertEqual(len(vimeo_videos), 2)
        # Verify structure of Vimeo videos
        for video in vimeo_videos:
            self.assertIn('type', video)
            self.assertIn('id', video)
            self.assertIn('url', video)
            self.assertIn('embed_url', video)
            self.assertEqual(video['type'], 'vimeo')
            self.assertTrue(video['id'].isdigit())  # Vimeo IDs are numeric

        # Verify GIFs
        gif_videos = [v for v in result if v['type'] == 'gif']
        self.assertEqual(len(gif_videos), 3)
        # Verify structure of GIF videos
        for video in gif_videos:
            self.assertIn('type', video)
            self.assertIn('url', video)
            self.assertIn('alt', video)
            self.assertEqual(video['type'], 'gif')
            self.assertTrue(video['url'].lower().endswith('.gif'))

        # Total should be 8 videos (3 YouTube + 2 Vimeo + 3 GIFs)
        self.assertEqual(len(result), 8)

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

    def test_extract_demo_urls_from_badges_comprehensive(self):
        """Test extract_demo_urls_from_badges correctly identifies and extracts demo URLs from badge markdown."""
        readme = """# Project Badges

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://demo.example.com)
[![Website](https://img.shields.io/badge/website-online-blue)](https://www.myproject.com)
[![Try it now](https://img.shields.io/badge/try-now-brightgreen)](https://try.myproject.com)
[![Preview App](https://img.shields.io/badge/preview-app-orange)](https://preview.myapp.io)
[![App Store](https://img.shields.io/badge/app-store-black)](https://apps.apple.com/app/123)

## Non-demo badges (should be ignored)

[![Build Status](https://img.shields.io/badge/build-passing-green)](https://ci.example.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/user/repo/releases)
[![Coverage](https://img.shields.io/badge/coverage-95%25-green)](https://codecov.io/repo)
"""
        result = BaseParser.extract_demo_urls_from_badges(readme)

        # Should find all demo-related URLs (5 demo keywords: demo, website, try, preview, app)
        self.assertEqual(len(result), 5)

        # Verify specific demo URLs are found
        self.assertIn('https://demo.example.com', result)
        self.assertIn('https://www.myproject.com', result)
        self.assertIn('https://try.myproject.com', result)
        self.assertIn('https://preview.myapp.io', result)
        self.assertIn('https://apps.apple.com/app/123', result)

        # Verify non-demo URLs are NOT found
        self.assertNotIn('https://ci.example.com', result)
        self.assertNotIn('https://opensource.org/licenses/MIT', result)
        self.assertNotIn('https://github.com/user/repo/releases', result)
        self.assertNotIn('https://codecov.io/repo', result)

    def test_extract_demo_urls_case_insensitive(self):
        """Test badge demo extraction is case-insensitive."""
        readme = """# Badges

[![DEMO](https://img.shields.io/badge/DEMO-link)](https://demo1.com)
[![Live](https://img.shields.io/badge/Live-Site)](https://demo2.com)
[![WEBSITE](https://img.shields.io/badge/WEBSITE-link)](https://demo3.com)
"""
        result = BaseParser.extract_demo_urls_from_badges(readme)

        # Should find all URLs despite case variations
        self.assertGreaterEqual(len(result), 3)
        self.assertIn('https://demo1.com', result)
        self.assertIn('https://demo2.com', result)
        self.assertIn('https://demo3.com', result)

    def test_extract_demo_urls_from_badges_empty(self):
        """Test badge extraction with no badges."""
        readme = """# Project

This is a project with no badges at all.
"""
        result = BaseParser.extract_demo_urls_from_badges(readme)

        # Should return empty list
        self.assertEqual(len(result), 0)

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

Watch the demo: https://www.youtube.com/watch?v=dQw4w9WgXcQ
"""
        result = BaseParser.parse(readme)

        # Should include demo_videos key
        self.assertIn('demo_videos', result)
        self.assertGreater(len(result['demo_videos']), 0)

    def test_scan_repository_identifies_screenshots_logos_banners(self):
        """Test scan_repository_for_images correctly identifies and extracts screenshots, logos, and banners."""
        tree = [
            # Screenshots in various directories
            {'path': 'screenshots/demo1.png', 'type': 'blob'},
            {'path': 'screenshots/demo2.jpg', 'type': 'blob'},
            {'path': 'docs/images/app-view.png', 'type': 'blob'},
            {'path': 'docs/screenshots/feature.png', 'type': 'blob'},
            {'path': '.github/screenshots/ui.png', 'type': 'blob'},
            {'path': 'assets/screenshots/screen1.webp', 'type': 'blob'},
            # Logo files (SVG and PNG)
            {'path': 'logo.svg', 'type': 'blob'},
            {'path': 'assets/logo.png', 'type': 'blob'},
            # Banner file
            {'path': 'banner.png', 'type': 'blob'},
            {'path': 'assets/banner.jpg', 'type': 'blob'},
            # Non-image files (should be ignored)
            {'path': 'src/main.py', 'type': 'blob'},
            {'path': 'README.md', 'type': 'blob'},
            # Directory (should be ignored)
            {'path': 'screenshots', 'type': 'tree'},
        ]

        result = BaseParser.scan_repository_for_images(tree, owner='testuser', repo='testrepo')

        # Verify screenshots were found
        self.assertEqual(len(result['screenshots']), 6)
        # Verify all screenshot paths contain correct URLs
        for screenshot_url in result['screenshots']:
            self.assertIn('raw.githubusercontent.com', screenshot_url)
            self.assertIn('testuser', screenshot_url)
            self.assertIn('testrepo', screenshot_url)
        # Verify specific screenshots
        screenshot_paths = [url.split('/')[-1] for url in result['screenshots']]
        self.assertIn('demo1.png', screenshot_paths)
        self.assertIn('app-view.png', screenshot_paths)

        # Verify logo was found (SVG preferred over PNG)
        self.assertIsNotNone(result['logo'])
        self.assertIn('logo.svg', result['logo'])
        self.assertIn('raw.githubusercontent.com', result['logo'])

        # Verify banner was found
        self.assertIsNotNone(result['banner'])
        self.assertIn('banner.png', result['banner'])
        self.assertIn('raw.githubusercontent.com', result['banner'])

    def test_scan_repository_logo_priority(self):
        """Test scan_repository_for_images prioritizes SVG logos over PNG."""
        tree_with_svg = [
            {'path': 'logo.png', 'type': 'blob'},
            {'path': 'logo.svg', 'type': 'blob'},
            {'path': 'assets/logo.png', 'type': 'blob'},
        ]

        result = BaseParser.scan_repository_for_images(tree_with_svg, owner='test', repo='repo')

        # Should prefer logo.svg (appears first in priority list)
        self.assertIsNotNone(result['logo'])
        self.assertIn('logo.svg', result['logo'])

    def test_scan_repository_no_images(self):
        """Test scan_repository_for_images with no images in tree."""
        tree = [
            {'path': 'src/main.py', 'type': 'blob'},
            {'path': 'README.md', 'type': 'blob'},
            {'path': 'package.json', 'type': 'blob'},
        ]

        result = BaseParser.scan_repository_for_images(tree, owner='test', repo='repo')

        # Should return empty results
        self.assertEqual(len(result['screenshots']), 0)
        self.assertIsNone(result['logo'])
        self.assertIsNone(result['banner'])

    def test_scan_repository_limits_screenshots(self):
        """Test scan_repository_for_images limits screenshots to 10."""
        tree = [{'path': f'screenshots/demo{i}.png', 'type': 'blob'} for i in range(15)]

        result = BaseParser.scan_repository_for_images(tree, owner='test', repo='repo')

        # Should limit to 10 screenshots
        self.assertEqual(len(result['screenshots']), 10)
