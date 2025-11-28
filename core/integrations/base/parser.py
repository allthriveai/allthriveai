"""Base parser for README and documentation content.

This is SHARED across all integrations - GitHub, GitLab, npm all use markdown READMEs.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class BaseParser:
    """Parse README markdown content into structured blocks.

    This parser is generic and works for any markdown content.
    Platform-specific customizations can be added via subclassing if needed.
    """

    # Regex patterns
    HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    CODE_BLOCK_PATTERN = re.compile(r'```(\w+)?\n(.*?)```', re.DOTALL)
    MERMAID_PATTERN = re.compile(r'```mermaid\n(.*?)```', re.DOTALL)
    IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\]\(([^\)]+)\)')
    LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^\)]+)\)')
    LIST_PATTERN = re.compile(r'^[-*+]\s+(.+)$', re.MULTILINE)
    ORDERED_LIST_PATTERN = re.compile(r'^\d+\.\s+(.+)$', re.MULTILINE)

    # Section keywords for smart categorization
    DEMO_KEYWORDS = ['demo', 'live site', 'preview', 'try it', 'website']
    FEATURES_KEYWORDS = ['features', 'highlights', 'capabilities', 'what it does']
    TECH_STACK_KEYWORDS = ['tech stack', 'built with', 'technologies', 'dependencies', 'tools used']
    INSTALLATION_KEYWORDS = ['installation', 'setup', 'getting started', 'quick start']
    USAGE_KEYWORDS = ['usage', 'how to use', 'examples', 'api']
    ARCHITECTURE_KEYWORDS = ['architecture', 'design', 'structure', 'how it works']
    SCREENSHOT_KEYWORDS = ['screenshots', 'gallery', 'images', 'visuals']

    # Sections to minimize or skip for beautiful portfolios
    SKIP_KEYWORDS = [
        'installation',
        'install',
        'setup',
        'getting started',
        'quick start',
        'contributing',
        'contribution',
        'contributors',
        'code of conduct',
        'license',
        'licensing',
        'copyright',
        'api reference',
        'api documentation',
        'api docs',
        'documentation',
        'changelog',
        'release notes',
        'version history',
        'testing',
        'tests',
        'test suite',
        'running tests',
        'development',
        'dev setup',
        'local development',
        'deployment',
        'deploy',
        'hosting',
        'troubleshooting',
        'faq',
        'known issues',
        'requirements',
        'prerequisites',
        'dependencies',
    ]

    def __init__(self, platform_data: dict[str, Any] | None = None):
        """Initialize parser with optional platform-specific data.

        Args:
            platform_data: Platform metadata (e.g., GitHub repo owner/name for URL normalization)
        """
        self.platform_data = platform_data or {}

    @classmethod
    def parse(cls, readme_content: str, platform_data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Parse README content into structured blocks.

        This is the main entry point - called by all integrations.

        Args:
            readme_content: Raw markdown content
            platform_data: Optional platform metadata for URL normalization

        Returns:
            dict with:
                - blocks: List of block dictionaries
                - hero_image: Suggested hero image URL
                - hero_quote: Suggested hero quote
                - mermaid_diagrams: List of detected diagrams
                - demo_urls: List of detected demo URLs
        """
        if not readme_content or not readme_content.strip():
            return {
                'blocks': [],
                'hero_image': None,
                'hero_quote': None,
                'mermaid_diagrams': [],
                'demo_urls': [],
                'demo_videos': [],
            }

        parser = cls(platform_data)
        blocks = []
        hero_image = None
        hero_quote = None
        mermaid_diagrams = []
        demo_urls = []

        # Split content into sections
        sections = parser._split_into_sections(readme_content)

        for section in sections:
            heading = section.get('heading', '')
            content = section.get('content', '')
            level = section.get('level', 1)

            # Detect section type
            section_type = parser._categorize_section(heading)

            # Extract Mermaid diagrams
            mermaid_matches = parser.MERMAID_PATTERN.findall(content)
            if mermaid_matches:
                for mermaid_code in mermaid_matches:
                    mermaid_diagrams.append(mermaid_code.strip())
                    blocks.append(
                        {
                            'type': 'mermaid',
                            'code': mermaid_code.strip(),
                            'caption': heading if heading else 'Diagram',
                        }
                    )
                content = parser.MERMAID_PATTERN.sub('', content)

            # Add section heading
            if heading and level > 1:
                blocks.append({'type': 'text', 'style': 'heading', 'content': heading, 'markdown': True})

            # Parse section content
            section_blocks = parser._parse_section_content(content, section_type, heading)

            # Extract hero image (skip badges)
            if not hero_image:
                for block in section_blocks:
                    if block['type'] == 'image' and block.get('url'):
                        if not parser._is_badge_url(block['url']):
                            hero_image = block['url']
                            break

            # Extract hero quote
            if not hero_quote:
                for block in section_blocks:
                    if block['type'] == 'text' and block['style'] == 'body':
                        text = block['content']
                        if 20 < len(text) < 200:
                            hero_quote = text
                            break

            # Check for columns layout
            if parser._should_use_columns(section_type, section_blocks):
                column_block = parser._group_into_columns(section_blocks, section_type)
                if column_block:
                    blocks.append(column_block)
                else:
                    blocks.extend(section_blocks)
            else:
                blocks.extend(section_blocks)

        # Group consecutive badge images into rows
        blocks = parser._group_badge_images(blocks)

        # Extract demo videos (YouTube, Vimeo, GIFs)
        demo_videos = cls.extract_demo_videos(readme_content)

        # Extract demo URLs from badges
        badge_demo_urls = cls.extract_demo_urls_from_badges(readme_content)
        demo_urls.extend(badge_demo_urls)

        return {
            'blocks': blocks,
            'hero_image': hero_image,
            'hero_quote': hero_quote,
            'mermaid_diagrams': mermaid_diagrams,
            'demo_urls': demo_urls,
            'demo_videos': demo_videos,
        }

    def _split_into_sections(self, content: str) -> list[dict[str, Any]]:
        """Split README into sections by headings."""
        sections = []
        lines = content.split('\n')
        current_section = {'heading': '', 'content': '', 'level': 0}

        for line in lines:
            heading_match = self.HEADING_PATTERN.match(line)
            if heading_match:
                # Save previous section if it has content
                if current_section['content'].strip():
                    sections.append(current_section)

                # Start new section
                level = len(heading_match.group(1))
                heading = heading_match.group(2).strip()
                current_section = {'heading': heading, 'content': '', 'level': level}
            else:
                current_section['content'] += line + '\n'

        # Add final section
        if current_section['content'].strip():
            sections.append(current_section)

        return sections

    def _categorize_section(self, heading: str | None) -> str:
        """Categorize section based on heading keywords."""
        if not heading:
            return 'overview'
        heading_lower = heading.lower()

        if any(kw in heading_lower for kw in self.DEMO_KEYWORDS):
            return 'demo'
        if any(kw in heading_lower for kw in self.FEATURES_KEYWORDS):
            return 'features'
        if any(kw in heading_lower for kw in self.TECH_STACK_KEYWORDS):
            return 'tech_stack'
        if any(kw in heading_lower for kw in self.INSTALLATION_KEYWORDS):
            return 'installation'
        if any(kw in heading_lower for kw in self.USAGE_KEYWORDS):
            return 'usage'
        if any(kw in heading_lower for kw in self.ARCHITECTURE_KEYWORDS):
            return 'architecture'
        if any(kw in heading_lower for kw in self.SCREENSHOT_KEYWORDS):
            return 'screenshots'

        return 'overview'

    def _parse_section_content(self, content: str, section_type: str, heading: str) -> list[dict[str, Any]]:
        """Parse section content into blocks."""
        blocks = []

        # Remove code blocks temporarily (we'll add them back)
        code_blocks = []
        code_placeholders = []

        def replace_code_block(match):
            language = match.group(1) or 'text'
            code = match.group(2).strip()
            placeholder = f'__CODE_BLOCK_{len(code_blocks)}__'
            code_blocks.append({'language': language, 'code': code})
            code_placeholders.append(placeholder)
            return placeholder

        content = self.CODE_BLOCK_PATTERN.sub(replace_code_block, content)

        # Extract images
        images = []
        all_image_matches = self.IMAGE_PATTERN.findall(content)
        logger.debug(f'🖼️  Found {len(all_image_matches)} total images in section "{heading}"')

        for alt_text, url in all_image_matches:
            # Normalize relative URLs to absolute URLs
            normalized_url = self.normalize_image_url(url)
            logger.debug(f'   Image: {normalized_url} (alt: {alt_text})')
            images.append({'url': normalized_url, 'caption': alt_text})
            # Replace relative URLs with normalized absolute URLs in markdown
            # This keeps images as markdown so they're editable
            content = content.replace(f'![{alt_text}]({url})', f'![{alt_text}]({normalized_url})')

        # For screenshot sections with multiple images, create an image grid block
        # For other sections, keep images inline as markdown (more editable)
        if section_type == 'screenshots' and len(images) > 1:
            blocks.append({'type': 'imageGrid', 'images': images, 'caption': heading})
            logger.debug(f'   Added image grid with {len(images)} images')
            # Remove the markdown images since we created a grid block
            for alt_text, url in all_image_matches:
                normalized_url = self.normalize_image_url(url)
                content = content.replace(f'![{alt_text}]({normalized_url})', '')

        # Parse paragraphs
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        for paragraph in paragraphs:
            # Check if it's a code block placeholder
            if '__CODE_BLOCK_' in paragraph:
                # Extract index using regex to handle mixed content
                match = re.search(r'__CODE_BLOCK_(\d+)__', paragraph)
                if match:
                    idx = int(match.group(1))
                    if idx < len(code_blocks):
                        code_block = code_blocks[idx]

                        # Skip installation/setup code blocks (too technical for portfolio)
                        if section_type not in ['installation', 'usage']:
                            blocks.append(
                                {
                                    'type': 'code_snippet',
                                    'code': code_block['code'],
                                    'language': code_block['language'],
                                    'filename': None,
                                }
                            )
            # Check if it's a list
            elif paragraph.startswith(('-', '*', '+')) or re.match(r'^\d+\.', paragraph):
                # Normalize links in paragraph
                normalized_paragraph = self._normalize_markdown_links(paragraph)
                # Convert list to text block
                blocks.append({'type': 'text', 'style': 'body', 'content': normalized_paragraph, 'markdown': True})
            # Regular paragraph
            elif len(paragraph) > 10:  # Ignore very short lines
                # Normalize links in paragraph
                normalized_paragraph = self._normalize_markdown_links(paragraph)
                # Check if it's a quote
                if paragraph.startswith('>'):
                    quote_text = normalized_paragraph.replace('>', '').strip()
                    blocks.append({'type': 'text', 'style': 'quote', 'content': quote_text, 'markdown': True})
                else:
                    blocks.append({'type': 'text', 'style': 'body', 'content': normalized_paragraph, 'markdown': True})

        return blocks

    def _should_use_columns(self, section_type: str, blocks: list) -> bool:
        """Determine if section should use multi-column layout."""
        # Multi-column sections
        multi_column_types = ['features', 'tech_stack']
        if section_type not in multi_column_types:
            return False

        # Need at least 2 text blocks to make columns worthwhile
        text_blocks = [b for b in blocks if b['type'] == 'text' and b['style'] == 'body']

        # Check if blocks contain lists (markdown lists should often be columnar)
        has_lists = any(
            b['type'] == 'text'
            and b['style'] == 'body'
            and (
                b.get('content', '').strip().startswith(('-', '*', '+'))
                or re.match(r'^\d+\.', b.get('content', '').strip())
            )
            for b in blocks
        )

        return len(text_blocks) >= 2 or has_lists

    def _group_into_columns(self, blocks: list[dict], section_type: str) -> dict:
        """Group blocks into a multi-column layout.

        Args:
            blocks: List of blocks to group
            section_type: Type of section (features, tech_stack, etc.)

        Returns:
            Column block with nested blocks
        """
        # Filter to text blocks only (exclude headings)
        text_blocks = [b for b in blocks if b['type'] == 'text' and b['style'] == 'body']

        if len(text_blocks) < 2:
            return None

        # Determine column count based on number of items
        if len(text_blocks) <= 2:
            column_count = 2
        elif len(text_blocks) <= 6:
            column_count = 3
        else:
            column_count = 3  # Max 3 columns for readability

        # Split blocks into columns
        items_per_column = len(text_blocks) // column_count
        remainder = len(text_blocks) % column_count

        columns = []
        start_idx = 0

        for col_idx in range(column_count):
            # Add extra item to first columns if there's a remainder
            items_in_col = items_per_column + (1 if col_idx < remainder else 0)
            end_idx = start_idx + items_in_col

            column_blocks = text_blocks[start_idx:end_idx]
            if column_blocks:
                columns.append({'blocks': column_blocks})

            start_idx = end_idx

        logger.debug(
            f'📐 Created {column_count}-column layout with {len(text_blocks)} items ' f'for {section_type} section'
        )

        return {
            'type': 'columns',
            'columnCount': column_count,
            'columns': columns,
            'containerWidth': 'full',
        }

    def _is_badge_url(self, url: str) -> bool:
        """Check if URL is a badge/shield image."""
        if not url:
            return True

        badge_services = [
            'img.shields.io',
            'badge.fury.io',
            'travis-ci.org',
            'travis-ci.com',
            'circleci.com',
            'codecov.io',
            'coveralls.io',
            'snyk.io/test',
            'badges.gitter.im',
            'badge.buildkite.com',
            'github.com/badges',
            'flat.badgen.net',
            'badgen.net',
        ]

        url_lower = url.lower()
        return any(badge_service in url_lower for badge_service in badge_services)

    def _group_badge_images(self, blocks: list[dict]) -> list[dict]:
        """Group consecutive badge images into horizontal rows."""
        if not blocks:
            return blocks

        grouped_blocks = []
        badge_group = []

        for block in blocks:
            if block.get('type') == 'image' and self._is_badge_url(block.get('url', '')):
                badge_group.append(block)
            else:
                if badge_group:
                    if len(badge_group) == 1:
                        grouped_blocks.append(badge_group[0])
                    else:
                        grouped_blocks.append(
                            {
                                'type': 'badgeRow',
                                'badges': badge_group,
                            }
                        )
                    badge_group = []
                grouped_blocks.append(block)

        # Handle remaining badges
        if badge_group:
            if len(badge_group) == 1:
                grouped_blocks.append(badge_group[0])
            else:
                grouped_blocks.append(
                    {
                        'type': 'badgeRow',
                        'badges': badge_group,
                    }
                )

        return grouped_blocks

    def normalize_image_url(self, url: str) -> str:
        """Convert relative image URLs to absolute URLs.

        Args:
            url: Image URL (can be relative or absolute)

        Returns:
            Absolute URL
        """
        if not url:
            return url

        # Already absolute URL
        if url.startswith(('http://', 'https://')):
            return url

        # Relative path - platform-specific implementations can override
        # For GitHub: convert to raw.githubusercontent.com
        # Default: return as-is
        if self.platform_data:
            owner = self.platform_data.get('owner')
            repo = self.platform_data.get('repo')
            default_branch = self.platform_data.get('default_branch', 'main')

            if owner and repo:
                # Remove leading slash if present
                url = url.lstrip('/')
                github_raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}/{url}'
                logger.debug(f'🔗 Normalized relative image URL: {url} → {github_raw_url}')
                return github_raw_url

        # Can't normalize, return as-is
        logger.warning(f'⚠️  Could not normalize relative image URL: {url}')
        return url

    def normalize_link_url(self, url: str) -> str:
        """Convert relative markdown links to absolute URLs.

        Args:
            url: Link URL (can be relative or absolute)

        Returns:
            Absolute URL
        """
        if not url:
            return url

        # Already absolute URL or anchor link
        if url.startswith(('http://', 'https://', '#', 'mailto:')):
            return url

        # Relative path - platform-specific implementations can override
        # For GitHub: convert to github.com/owner/repo/blob/branch/path
        # Default: return as-is
        if self.platform_data:
            owner = self.platform_data.get('owner')
            repo = self.platform_data.get('repo')
            default_branch = self.platform_data.get('default_branch', 'main')

            if owner and repo:
                # Remove leading slash if present
                url = url.lstrip('/')
                # Use blob for file links (not raw)
                github_blob_url = f'https://github.com/{owner}/{repo}/blob/{default_branch}/{url}'
                logger.debug(f'🔗 Normalized relative link: {url} → {github_blob_url}')
                return github_blob_url

        # Can't normalize, return as-is
        logger.warning(f'⚠️  Could not normalize relative link URL: {url}')
        return url

    def _normalize_markdown_links(self, content: str) -> str:
        """Normalize all relative links in markdown content to absolute URLs.

        Args:
            content: Markdown content with potential relative links

        Returns:
            Content with normalized links
        """
        if not content:
            return content

        def replace_link(match):
            link_text = match.group(1)
            link_url = match.group(2)
            normalized_url = self.normalize_link_url(link_url)
            return f'[{link_text}]({normalized_url})'

        # Replace all markdown links: [text](url)
        normalized_content = self.LINK_PATTERN.sub(replace_link, content)
        return normalized_content

    @classmethod
    def optimize_layout_with_ai(cls, blocks: list, platform_data: dict) -> list:
        """Use AI to suggest layout improvements for blocks.

        Args:
            blocks: Current list of blocks
            platform_data: Platform metadata

        Returns:
            Optimized blocks with better layouts
        """
        from services.ai_provider import AIProvider

        # Don't optimize if we have very few blocks
        if len(blocks) < 5:
            return blocks

        name = platform_data.get('name', '')
        logger.info(f'🎨 AI Layout Optimization for {name}')

        # Create a summary of current blocks for AI
        block_summary = []
        for i, block in enumerate(blocks[:20]):  # Limit to first 20 for prompt size
            block_type = block.get('type', 'unknown')
            if block_type == 'text':
                content_preview = block.get('content', '')[:100]
                style = block.get('style', 'body')
                block_summary.append(f'{i}: text/{style} - {content_preview}...')
            elif block_type == 'image':
                block_summary.append(f"{i}: image - {block.get('caption', 'no caption')}")
            elif block_type == 'mermaid':
                block_summary.append(f'{i}: mermaid diagram')
            elif block_type == 'code_snippet':
                block_summary.append(f"{i}: code - {block.get('language', 'unknown')}")
            else:
                block_summary.append(f'{i}: {block_type}')

        prompt = f"""Analyze this project's content blocks and suggest which consecutive blocks
should be grouped into multi-column layouts.

Project: {name}

Current blocks:
{chr(10).join(block_summary[:15])}

Suggest column groupings as JSON:
{{
  "groupings": [
    {{"start": 3, "end": 6, "columns": 3, "reason": "Feature list items"}},
    {{"start": 8, "end": 10, "columns": 2, "reason": "Tech stack comparison"}}
  ]
}}

Rules:
- Only group 2-6 consecutive text/body blocks
- Use 2 columns for comparisons, 3 for features/lists
- Don't group code, images, or diagrams
- Return empty array if no good groupings

Return ONLY the JSON, no explanation."""

        try:
            ai = AIProvider()
            response = ai.complete(
                prompt=prompt,
                model=None,
                temperature=0.3,
                max_tokens=400,
            )

            # Parse AI response
            response = response.strip()
            if response.startswith('```json'):
                response = response.replace('```json', '').replace('```', '').strip()
            elif response.startswith('```'):
                response = response.replace('```', '').strip()

            suggestions = json.loads(response)
            groupings = suggestions.get('groupings', [])

            if not groupings:
                logger.info(f'✅ AI suggested no layout changes for {name}')
                return blocks

            logger.info(f'💡 AI suggested {len(groupings)} layout groupings for {name}')

            # Apply groupings (process in reverse to avoid index shifting)
            optimized_blocks = blocks.copy()
            for grouping in reversed(groupings):
                start = grouping.get('start', 0)
                end = grouping.get('end', 0)
                columns = grouping.get('columns', 2)
                reason = grouping.get('reason', '')

                # Validate indices
                if start < 0 or end > len(optimized_blocks) or start >= end:
                    continue

                # Extract blocks to group
                blocks_to_group = optimized_blocks[start:end]

                # Only group text blocks
                if not all(b.get('type') == 'text' and b.get('style') == 'body' for b in blocks_to_group):
                    continue

                # Create column block with proper distribution
                # Adjust column count if there are fewer blocks than columns
                actual_columns = min(columns, len(blocks_to_group))

                items_per_column = len(blocks_to_group) // actual_columns
                remainder = len(blocks_to_group) % actual_columns

                column_list = []
                block_idx = 0

                for col_idx in range(actual_columns):
                    # Distribute extra items to first columns
                    items_in_col = items_per_column + (1 if col_idx < remainder else 0)
                    column_blocks = blocks_to_group[block_idx : block_idx + items_in_col]

                    # Ensure each column has at least one block
                    if column_blocks:
                        column_list.append({'blocks': column_blocks})
                    block_idx += items_in_col

                # Only create column layout if we have multiple columns
                if len(column_list) < 2:
                    logger.debug(f'Skipping column layout - only {len(column_list)} column(s) with content')
                    continue

                column_block = {
                    'type': 'columns',
                    'columnCount': len(column_list),  # Use actual column count
                    'columns': column_list,
                    'containerWidth': 'full',
                }

                # Replace blocks with column block
                optimized_blocks[start:end] = [column_block]
                logger.debug(f'📐 Grouped blocks {start}-{end} into {columns} columns: {reason}')

            logger.info(f'✅ Layout optimization complete for {name}: {len(blocks)} → {len(optimized_blocks)} blocks')
            return optimized_blocks

        except Exception as e:
            logger.warning(f'⚠️  AI layout optimization failed for {name}: {e}')
            return blocks

    @staticmethod
    def _sanitize_mermaid_diagram(diagram_code: str) -> str:
        """Sanitize Mermaid diagram code to fix common AI generation issues.

        Args:
            diagram_code: Raw Mermaid diagram code

        Returns:
            Sanitized diagram code
        """
        if not diagram_code:
            return diagram_code

        lines = diagram_code.split('\n')
        sanitized_lines = []

        for line in lines:
            # Keep directive line as-is
            if line.strip().startswith(('graph ', 'flowchart ')):
                sanitized_lines.append(line)
                continue

            # Fix line breaks inside labels by removing them
            # Example: A[Multi\nLine] -> A[Multi Line]
            if '[' in line and ']' in line:
                # Extract content between brackets and remove newlines
                def replace_label(match):
                    label_content = match.group(1)
                    # Replace newlines and multiple spaces with single space
                    cleaned = ' '.join(label_content.split())
                    # Remove any HTML line breaks
                    cleaned = cleaned.replace('<br/>', ' ').replace('<br>', ' ')
                    return f'[{cleaned}]'

                line = re.sub(r'\[([^\]]+)\]', replace_label, line)

            # Remove any remaining newlines within the line
            line = ' '.join(line.split())

            # Only add non-empty lines
            if line.strip():
                sanitized_lines.append(line)

        return '\n'.join(sanitized_lines)

    @staticmethod
    def _validate_mermaid_syntax(diagram_code: str) -> tuple[bool, str]:
        """Validate Mermaid diagram syntax.

        Args:
            diagram_code: Mermaid diagram code to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not diagram_code or not diagram_code.strip():
            return False, 'Empty diagram code'

        # Must start with valid graph directive
        valid_starts = ['graph TB', 'graph LR', 'graph TD', 'graph RL', 'flowchart TB', 'flowchart LR']
        if not any(diagram_code.startswith(start) for start in valid_starts):
            return False, f'Must start with graph directive (graph TB/LR/TD/RL), got: {diagram_code[:30]}'

        # Check for common syntax errors
        lines = diagram_code.split('\n')

        # Must have at least 2 lines (directive + at least one node/edge)
        if len(lines) < 2:
            return False, 'Diagram must have at least one node or edge'

        # Check for invalid characters in node IDs (only in edges)
        for i, line in enumerate(lines[1:], start=2):  # Skip first line (directive)
            line = line.strip()
            if not line:
                continue

            # Check for arrows/connections
            if '-->' in line or '---' in line:
                # Validate edge syntax: A[Label] --> B[Label]
                # Allow various bracket types: [], (), {}, (())
                parts = re.split(r'-->|---', line)
                if len(parts) != 2:
                    return False, f'Line {i}: Invalid edge syntax (must have exactly one arrow)'

                # Each part should have node ID with optional label
                for part in parts:
                    part = part.strip()
                    # Must have node ID (can have brackets with label or just ID)
                    if not part or len(part) < 1:
                        return False, f'Line {i}: Missing node ID'

                    # Check for unmatched brackets
                    bracket_pairs = [('[', ']'), ('(', ')'), ('{', '}')]
                    for open_b, close_b in bracket_pairs:
                        if part.count(open_b) != part.count(close_b):
                            return False, f'Line {i}: Unmatched brackets: {part}'

        # Check for special characters that might break rendering
        dangerous_chars = ['<script', 'javascript:', 'onerror=', 'onclick=']
        for char in dangerous_chars:
            if char in diagram_code.lower():
                return False, f'Contains dangerous content: {char}'

        return True, ''

    @classmethod
    def transform_readme_content_with_ai(cls, blocks: list[dict], platform_data: dict) -> list[dict]:
        """Transform README blocks into compelling portfolio content using AI.

        This method analyzes the FULL project (not just README) and rewrites
        content into engaging, comprehensive portfolio copy.

        Args:
            blocks: List of parsed content blocks from README
            platform_data: Platform metadata including:
                - name, description, language, topics (basic info)
                - tree (file structure)
                - dependencies (package.json, requirements.txt, etc.)
                - tech_stack (detected technologies)

        Returns:
            Transformed blocks with rewritten, enhanced content
        """
        from services.ai_provider import AIProvider

        name = platform_data.get('name', '')
        description = platform_data.get('description', '')
        language = platform_data.get('language', '')
        topics = platform_data.get('topics', [])
        tech_stack = platform_data.get('tech_stack', {})
        dependencies = platform_data.get('dependencies', {})
        tree = platform_data.get('tree', [])

        if not blocks or not name:
            return blocks

        logger.info(f'✨ Starting FULL PROJECT AI analysis for {name}')
        logger.info(f'📂 Project has {len(tree)} files, {len(tech_stack)} tech stack items')

        # Extract text blocks that need transformation
        text_blocks = [b for b in blocks if b.get('type') == 'text' and b.get('content')]
        if not text_blocks:
            logger.info(f'No text blocks to transform for {name}')
            return blocks

        # Prepare content for AI transformation
        readme_text = '\n\n'.join([b.get('content', '') for b in text_blocks])

        # Build comprehensive project context
        file_summary = ''
        if tree:
            key_files = [f for f in tree if isinstance(f, dict) and f.get('path')][:20]
            file_list = '\n'.join([f.get('path', '') for f in key_files])
            file_summary = f'\n\nKey Project Files:\n{file_list}'

        deps_summary = ''
        if dependencies:
            deps_str = ', '.join([f'{k}: {v}' for k, v in list(dependencies.items())[:10]])
            deps_summary = f'\n\nDependencies:\n{deps_str}'

        tech_summary = ''
        if tech_stack:
            tech_str = ', '.join([f'{k}: {v}' for k, v in list(tech_stack.items())[:10]])
            tech_summary = f'\n\nTech Stack:\n{tech_str}'

        prompt = f"""Transform this project into BEAUTIFUL, CONCISE portfolio content.

Project: {name}
Description: {description}
Language: {language}
Topics: {', '.join(topics[:10]) if topics else 'None'}{file_summary}{deps_summary}{tech_summary}

README Content:
{readme_text[:1500]}

YOUR MISSION: Create visually stunning, concise portfolio copy that sells the project.

STYLE RULES:
✅ SHORT and punchy - max 2-3 sentences per section
✅ Lead with IMPACT and benefits, not technical details
✅ Use **bold** for key terms (languages, tech, features)
✅ Remove installation instructions, setup steps, technical docs
✅ Remove redundant or boring content
✅ Focus on WHAT IT DOES and WHY IT'S COOL
✅ Use emotive, exciting language
✅ Think "landing page" not "technical documentation"

STRUCTURE:
- Hero section: 1-2 powerful sentences about the project's purpose
- Key features: 2-4 bullet points maximum (use markdown lists)
- Tech stack: Brief mention of impressive tech (in bold)
- Skip: Installation, setup, usage examples, API docs, contribution guidelines

EXAMPLE TRANSFORMATION:
❌ BAD (verbose): "This project is a Redis-based wellness tracking application.
It uses FastAPI for the backend and TypeScript for the frontend.
The project implements both stateless and stateful RAG comparison using LangChain
and Ollama models. Users can install it by running npm install and python -m venv..."

✅ GOOD (beautiful): "**AI-powered wellness insights** from your health data -
100% private, 100% local.

Built with **FastAPI**, **Redis**, and **Ollama** to explore how AI agents use memory.
Compare stateless vs stateful RAG approaches while keeping your health data secure
on your machine."

Return the transformed content as JSON with each section:
{{
  "sections": [
    {{"original": "first few words...", "transformed": "Short, impactful rewrite..."}},
    {{"original": "next section...", "transformed": "Concise, visual version..."}}
  ]
}}

Return ONLY the JSON, no explanation."""

        try:
            ai = AIProvider()
            response = ai.complete(
                prompt=prompt,
                model=None,
                temperature=0.9,  # Higher creativity for beautiful marketing copy
                max_tokens=3000,  # More tokens for comprehensive transformation
            )

            logger.info(f'✅ AI transformation response received for {name}')

            # Parse response
            response = response.strip()
            if response.startswith('```json'):
                response = response.replace('```json', '').replace('```', '').strip()
            elif response.startswith('```'):
                response = response.replace('```', '').strip()

            result = json.loads(response)
            sections = result.get('sections', [])

            if not sections:
                logger.info(f'No transformations returned for {name}, using original')
                return blocks

            logger.info(f'💫 Applying {len(sections)} content transformations for {name}')

            # Apply transformations to blocks
            transformed_blocks = []
            section_idx = 0

            for block in blocks:
                if block.get('type') != 'text' or not block.get('content'):
                    # Keep non-text blocks as-is
                    transformed_blocks.append(block)
                    continue

                # Try to match this block with a transformation
                if section_idx < len(sections):
                    section = sections[section_idx]
                    transformed_content = section.get('transformed', block.get('content'))

                    # Create transformed block
                    transformed_block = block.copy()
                    transformed_block['content'] = transformed_content
                    transformed_block['original_content'] = block.get('content')  # Keep original
                    transformed_blocks.append(transformed_block)

                    logger.debug(
                        f'Transformed block {section_idx}: {block.get("content")[:50]}... → '
                        f'{transformed_content[:50]}...'
                    )
                    section_idx += 1
                else:
                    transformed_blocks.append(block)

            logger.info(f'✅ Content transformation complete for {name}')

            # Filter out verbose technical sections for beautiful portfolio
            filtered_blocks = cls._filter_verbose_sections(transformed_blocks)
            logger.info(f'📐 Filtered {len(transformed_blocks)} → {len(filtered_blocks)} blocks for portfolio beauty')

            return filtered_blocks

        except Exception as e:
            logger.warning(f'⚠️  AI content transformation failed for {name}: {e}')
            return blocks

    @classmethod
    def _filter_verbose_sections(cls, blocks: list[dict]) -> list[dict]:
        """Filter out verbose technical sections that don't belong in a beautiful portfolio.

        Args:
            blocks: List of content blocks

        Returns:
            Filtered list with verbose sections removed
        """
        filtered = []

        for block in blocks:
            # Keep non-text blocks (images, mermaid, etc.)
            if block.get('type') != 'text':
                filtered.append(block)
                continue

            content = block.get('content', '').lower()

            # Check if this is a verbose technical section to skip
            is_verbose = any(keyword in content[:100] for keyword in cls.SKIP_KEYWORDS)

            # Also check if it's a heading for a skip section
            if block.get('style') == 'heading':
                is_verbose = is_verbose or any(keyword in content for keyword in cls.SKIP_KEYWORDS)

            if is_verbose:
                logger.debug(f'Skipping verbose section: {content[:50]}...')
                continue

            # Keep the block
            filtered.append(block)

        return filtered

    @classmethod
    def generate_architecture_diagram(cls, platform_data: dict) -> str | None:
        """Use AI to generate a custom Mermaid architecture diagram.

        Args:
            platform_data: Platform metadata including language, topics, description, etc.

        Returns:
            Mermaid diagram code or None if generation fails
        """
        from services.ai_provider import AIProvider

        name = platform_data.get('name', '')
        description = platform_data.get('description', '')
        language = platform_data.get('language', '')
        topics = platform_data.get('topics', [])

        logger.info('🎨 AI Diagram Generation Input:')
        logger.info(f'   - Name: {name}')
        logger.info(f'   - Description: {description}')
        logger.info(f'   - Language: {language}')
        logger.info(f'   - Topics: {topics}')

        if not name:
            logger.warning('❌ No project name provided, skipping diagram generation')
            return None

        # Build prompt for AI to generate custom Mermaid diagram
        prompt = f"""Generate a Mermaid architecture diagram for this project.

Project: {name}
Description: {description}
Language: {language}
Topics: {', '.join(topics) if topics else 'None'}

IMPORTANT SYNTAX RULES:
1. Start with EXACTLY "graph TB" (top-to-bottom)
2. Use simple node IDs (A, B, C, D) without special characters
3. Use square brackets for labels: A[Label Text]
4. NO line breaks inside labels
5. Use --> for arrows
6. Keep it simple: 3-6 nodes maximum

CORRECT Example:
graph TB
    A[User Input] --> B[Processing Engine]
    B --> C[Data Storage]
    B --> D[Results Display]

INCORRECT (DO NOT DO THIS):
- graph TB A[Multi
  Line Label]  ❌ NO line breaks in labels
- graph TB node-1[Test] ❌ NO hyphens in node IDs
- A[Label] -> B[Label] ❌ Use --> not ->

Return ONLY the Mermaid code starting with "graph TB". No explanation."""

        logger.debug(f'📋 AI Diagram Prompt:\n{prompt}')

        try:
            ai = AIProvider()
            diagram_code = ai.complete(
                prompt=prompt,
                model=None,
                temperature=0.7,
                max_tokens=300,
            )

            logger.info(f'✅ AI diagram response received, length: {len(diagram_code)} chars')
            logger.info(f'📨 Raw AI diagram response:\n{diagram_code}')

            # Clean up response (remove markdown fences if present)
            diagram_code = diagram_code.strip()
            if diagram_code.startswith('```mermaid'):
                diagram_code = diagram_code.replace('```mermaid', '').replace('```', '').strip()
                logger.debug('🧹 Removed mermaid code fences')
            elif diagram_code.startswith('```'):
                diagram_code = diagram_code.replace('```', '').strip()
                logger.debug('🧹 Removed generic code fences')

            # Sanitize diagram code to fix common issues
            diagram_code = cls._sanitize_mermaid_diagram(diagram_code)
            logger.debug('🧹 Sanitized diagram code')

            # Validate syntax
            is_valid, error_msg = cls._validate_mermaid_syntax(diagram_code)
            if is_valid:
                logger.info(f'✅ Valid Mermaid diagram generated for {name}')
                logger.debug(f'Final diagram:\n{diagram_code}')
                return diagram_code
            else:
                logger.warning(f'❌ AI generated invalid Mermaid diagram for {name}: {error_msg}')
                logger.warning(f'Invalid diagram content:\n{diagram_code}')
                return None

        except Exception as e:
            logger.error(f'❌ Failed to generate AI diagram for {name}: {type(e).__name__}: {e}')
            import traceback

            logger.debug(f'Traceback:\n{traceback.format_exc()}')
            return None

    @classmethod
    def scan_repository_for_images(cls, tree: list[dict], owner: str = '', repo: str = '') -> dict[str, Any]:
        """Scan repository file tree for visual assets.

        Searches for screenshots, logos, banners, and other images in common locations.

        Args:
            tree: Repository file tree from GitHub API
            owner: Repository owner (for URL construction)
            repo: Repository name (for URL construction)

        Returns:
            dict with:
                - screenshots: List of screenshot URLs
                - logo: Logo URL (SVG preferred)
                - banner: Banner/hero image URL
        """
        screenshots = []
        logo = None
        banner = None

        # Image extensions to search for
        image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}

        # Screenshot directories (in priority order)
        screenshot_paths = [
            'screenshots/',
            'docs/images/',
            'docs/screenshots/',
            '.github/screenshots/',
            'assets/screenshots/',
            'public/screenshots/',
            'images/screenshots/',
        ]

        # Logo files (SVG preferred)
        logo_paths = [
            'logo.svg',
            'assets/logo.svg',
            '.github/logo.svg',
            'public/logo.svg',
            'logo.png',
            'assets/logo.png',
            '.github/logo.png',
            'public/logo.png',
        ]

        # Banner files
        banner_paths = [
            'banner.png',
            'banner.jpg',
            'assets/banner.png',
            '.github/banner.png',
            'public/banner.png',
        ]

        # Scan tree for images - collect all candidates first
        logo_candidates = {}
        banner_candidates = {}

        for item in tree:
            if item.get('type') != 'blob':
                continue

            path = item.get('path', '').lower()

            # Check for screenshots
            for screenshot_dir in screenshot_paths:
                if path.startswith(screenshot_dir) and any(path.endswith(ext) for ext in image_extensions):
                    # Construct GitHub raw URL
                    raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{item["path"]}'
                    screenshots.append(raw_url)
                    logger.debug(f'📸 Found screenshot: {item["path"]}')
                    break

            # Check for logo and store with priority
            for priority, logo_path in enumerate(logo_paths):
                if path == logo_path:
                    raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{item["path"]}'
                    logo_candidates[priority] = raw_url
                    logger.debug(f'🎨 Found logo candidate: {item["path"]} (priority {priority})')
                    break

            # Check for banner and store with priority
            for priority, banner_path in enumerate(banner_paths):
                if path == banner_path:
                    raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{item["path"]}'
                    banner_candidates[priority] = raw_url
                    logger.debug(f'🖼️  Found banner candidate: {item["path"]} (priority {priority})')
                    break

        # Select logo with highest priority (lowest priority number)
        if logo_candidates:
            best_priority = min(logo_candidates.keys())
            logo = logo_candidates[best_priority]
            logger.info(f'🎨 Selected logo: {logo}')

        # Select banner with highest priority
        if banner_candidates:
            best_priority = min(banner_candidates.keys())
            banner = banner_candidates[best_priority]
            logger.info(f'🖼️  Selected banner: {banner}')

        # Limit screenshots to first 10
        screenshots = screenshots[:10]

        logger.info(
            f'✅ Image scan complete: {len(screenshots)} screenshots, '
            f'{"logo found" if logo else "no logo"}, '
            f'{"banner found" if banner else "no banner"}'
        )

        return {
            'screenshots': screenshots,
            'logo': logo,
            'banner': banner,
        }

    @classmethod
    def extract_demo_videos(cls, readme_content: str) -> list[dict[str, str]]:
        """Extract demo video URLs from README content.

        Detects YouTube, Vimeo, and GIF animations.

        Args:
            readme_content: README markdown content

        Returns:
            List of dicts with type and URL for each video
        """
        videos = []

        # YouTube patterns
        youtube_patterns = [
            re.compile(r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})'),
            re.compile(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})'),
        ]

        for pattern in youtube_patterns:
            for match in pattern.finditer(readme_content):
                video_id = match.group(1)
                videos.append(
                    {
                        'type': 'youtube',
                        'id': video_id,
                        'url': f'https://www.youtube.com/watch?v={video_id}',
                        'embed_url': f'https://www.youtube.com/embed/{video_id}',
                    }
                )
                logger.debug(f'🎥 Found YouTube video: {video_id}')

        # Vimeo pattern
        vimeo_pattern = re.compile(r'vimeo\.com/(\d+)')
        for match in vimeo_pattern.finditer(readme_content):
            video_id = match.group(1)
            videos.append(
                {
                    'type': 'vimeo',
                    'id': video_id,
                    'url': f'https://vimeo.com/{video_id}',
                    'embed_url': f'https://player.vimeo.com/video/{video_id}',
                }
            )
            logger.debug(f'🎥 Found Vimeo video: {video_id}')

        # GIF animations (from markdown images)
        gif_pattern = re.compile(r'!\[([^\]]*)\]\((.*?\.gif)\)', re.IGNORECASE)
        for match in gif_pattern.finditer(readme_content):
            alt_text = match.group(1)
            gif_url = match.group(2)
            videos.append(
                {
                    'type': 'gif',
                    'url': gif_url,
                    'alt': alt_text,
                }
            )
            logger.debug(f'🎞️  Found GIF animation: {gif_url}')

        logger.info(f'✅ Found {len(videos)} demo videos/GIFs')
        return videos

    @classmethod
    def extract_demo_urls_from_badges(cls, readme_content: str) -> list[str]:
        """Extract demo/live site URLs from badge links.

        Parses badge markdown like: [![Demo](badge_url)](demo_url)

        Args:
            readme_content: README markdown content

        Returns:
            List of demo URLs extracted from badges
        """
        demo_urls = []

        # Pattern: [![text](badge_url)](link_url)
        badge_link_pattern = re.compile(r'\[!\[([^\]]*)\]\([^\)]+\)\]\(([^\)]+)\)')

        demo_keywords = ['demo', 'live', 'preview', 'website', 'app', 'try']

        for match in badge_link_pattern.finditer(readme_content):
            badge_text = match.group(1).lower()
            link_url = match.group(2)

            # Check if badge text indicates a demo
            if any(keyword in badge_text for keyword in demo_keywords):
                demo_urls.append(link_url)
                logger.debug(f'🔗 Found demo URL from badge: {link_url}')

        logger.info(f'✅ Found {len(demo_urls)} demo URLs from badges')
        return demo_urls
