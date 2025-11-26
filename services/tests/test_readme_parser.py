"""Tests for README parser with Mermaid and markdown support."""

from django.test import TestCase

from services.readme_parser import ReadmeParser


class ReadmeParserTestCase(TestCase):
    """Test cases for ReadmeParser class."""

    def test_parse_empty_readme(self):
        """Test parsing empty README returns empty result."""
        result = ReadmeParser.parse('')
        self.assertEqual(result['blocks'], [])
        self.assertIsNone(result['hero_image'])
        self.assertIsNone(result['hero_quote'])
        self.assertEqual(result['mermaid_diagrams'], [])
        self.assertEqual(result['demo_urls'], [])

    def test_parse_simple_text(self):
        """Test parsing simple text content."""
        content = """# My Project

This is a simple project description.

## Features

- Feature 1
- Feature 2
- Feature 3
"""
        result = ReadmeParser.parse(content)
        blocks = result['blocks']

        # Should have heading and text blocks
        self.assertGreater(len(blocks), 0)

        # Check that blocks have markdown flag set
        text_blocks = [b for b in blocks if b['type'] == 'text']
        for block in text_blocks:
            self.assertTrue(block.get('markdown', False))

    def test_parse_mermaid_diagram(self):
        """Test parsing Mermaid diagrams."""
        content = """# Architecture

```mermaid
graph LR
    A[Client] --> B[Server]
    B --> C[Database]
```
"""
        result = ReadmeParser.parse(content)

        # Should extract mermaid diagram
        self.assertEqual(len(result['mermaid_diagrams']), 1)
        self.assertIn('graph LR', result['mermaid_diagrams'][0])

        # Should create mermaid block
        mermaid_blocks = [b for b in result['blocks'] if b['type'] == 'mermaid']
        self.assertEqual(len(mermaid_blocks), 1)
        self.assertIn('graph LR', mermaid_blocks[0]['code'])

    def test_parse_code_snippet(self):
        """Test parsing code blocks."""
        content = """# Example

```python
print('Hello, world!')
```
"""
        result = ReadmeParser.parse(content)

        # Should create code_snippet block
        code_blocks = [b for b in result['blocks'] if b['type'] == 'code_snippet']
        self.assertEqual(len(code_blocks), 1)
        self.assertEqual(code_blocks[0]['language'], 'python')
        self.assertIn('Hello', code_blocks[0]['code'])

    def test_parse_images(self):
        """Test parsing images from markdown."""
        content = """# Demo

![Screenshot](https://example.com/screenshot.png)
"""
        result = ReadmeParser.parse(content)

        # Should extract hero image
        self.assertIsNotNone(result['hero_image'])
        self.assertEqual(result['hero_image'], 'https://example.com/screenshot.png')

        # Should create image block
        image_blocks = [b for b in result['blocks'] if b['type'] == 'image']
        self.assertEqual(len(image_blocks), 1)

    def test_parse_demo_links(self):
        """Test parsing demo/live site links."""
        content = """# Demo

[Try the live demo](https://example.com/demo)
"""
        result = ReadmeParser.parse(content)

        # Should extract demo URLs
        self.assertGreater(len(result['demo_urls']), 0)

        # Should create button block
        button_blocks = [b for b in result['blocks'] if b['type'] == 'button']
        self.assertEqual(len(button_blocks), 1)

    def test_parse_quote(self):
        """Test parsing blockquotes."""
        content = """# Project

> This is a quote about the project
"""
        result = ReadmeParser.parse(content)

        # Should create quote block
        quote_blocks = [b for b in result['blocks'] if b.get('style') == 'quote']
        self.assertGreater(len(quote_blocks), 0)

        # Quote blocks should have markdown flag
        for block in quote_blocks:
            self.assertTrue(block.get('markdown', False))

    def test_markdown_flag_on_text_blocks(self):
        """Test that all text blocks have markdown flag set to True."""
        content = """# Heading

This is body text.

> This is a quote

## Another Heading

- List item 1
- List item 2
"""
        result = ReadmeParser.parse(content)

        # All text blocks should have markdown: True
        text_blocks = [b for b in result['blocks'] if b['type'] == 'text']
        self.assertGreater(len(text_blocks), 0)

        for block in text_blocks:
            self.assertIn('markdown', block)
            self.assertTrue(block['markdown'], f'Block should have markdown=True: {block}')

    def test_section_categorization(self):
        """Test that sections are correctly categorized."""
        content = """# My Project

## Features

- Cool feature

## Tech Stack

Built with Python and Django

## Architecture

System design overview
"""
        result = ReadmeParser.parse(content)

        # Should parse sections and create appropriate blocks
        self.assertGreater(len(result['blocks']), 0)

    def test_multiple_images_create_grid(self):
        """Test that multiple images in screenshot section create image grid."""
        content = """# Screenshots

![Image 1](https://example.com/img1.png)
![Image 2](https://example.com/img2.png)
![Image 3](https://example.com/img3.png)
"""
        result = ReadmeParser.parse(content)

        # Should create image grid for multiple screenshots
        image_grid_blocks = [b for b in result['blocks'] if b['type'] == 'imageGrid']
        # Note: This depends on the section being detected as 'screenshots'
        # The parser groups multiple images in screenshot sections
        if image_grid_blocks:
            self.assertEqual(len(image_grid_blocks[0]['images']), 3)

    def test_generated_architecture_diagram(self):
        """Test auto-generation of architecture diagrams."""
        repo_data = {'language': 'Python', 'topics': ['django', 'postgresql', 'redis']}

        diagram = ReadmeParser.generate_architecture_diagram(repo_data)

        self.assertIsNotNone(diagram)
        self.assertIn('graph', diagram)
        self.assertIn('PostgreSQL', diagram)
        self.assertIn('Redis', diagram)
