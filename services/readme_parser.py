"""Parse README markdown files into structured ProjectBlocks with Mermaid support."""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class ReadmeParser:
    """Parse markdown README content into structured blocks for portfolio projects."""

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

    @staticmethod
    def parse(readme_content: str, repo_data: dict | None = None) -> dict[str, Any]:
        """Parse README content into structured ProjectBlocks.

        Args:
            readme_content: Raw markdown content
            repo_data: Optional repository metadata for enhanced parsing

        Returns:
            dict with:
                - blocks: List of ProjectBlock dictionaries
                - hero_image: Suggested hero image URL (first prominent image)
                - hero_quote: Suggested hero quote (from first blockquote or tagline)
                - mermaid_diagrams: List of detected Mermaid diagrams
                - demo_urls: List of detected demo/live site URLs
        """
        if not readme_content or not readme_content.strip():
            return {
                'blocks': [],
                'hero_image': None,
                'hero_quote': None,
                'mermaid_diagrams': [],
                'demo_urls': [],
            }

        parser = ReadmeParser()
        blocks = []
        hero_image = None
        hero_quote = None
        mermaid_diagrams = []
        demo_urls = []

        # Split content into sections by headers
        sections = parser._split_into_sections(readme_content)

        for section in sections:
            heading = section.get('heading', '')
            content = section.get('content', '')
            level = section.get('level', 1)

            # Detect section type
            section_type = parser._categorize_section(heading)

            # Extract Mermaid diagrams from this section
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
                # Remove mermaid blocks from content for further processing
                content = parser.MERMAID_PATTERN.sub('', content)

            # Add section heading as block (except for title)
            if heading and level > 1:
                blocks.append({'type': 'text', 'style': 'heading', 'content': heading, 'markdown': True})

            # Parse section content
            section_blocks = parser._parse_section_content(content, section_type, heading)

            # Extract hero image (first significant image)
            if not hero_image:
                for block in section_blocks:
                    if block['type'] == 'image' and block.get('url'):
                        hero_image = block['url']
                        break

            # Extract hero quote (first quote or project tagline)
            if not hero_quote and section_type == 'overview' and level == 1:
                # Look for first paragraph as potential tagline
                for block in section_blocks:
                    if block['type'] == 'text' and block['style'] == 'body':
                        text = block['content']
                        if len(text) < 200 and len(text) > 20:  # Tagline length
                            hero_quote = text
                            break

            # Extract demo URLs
            if section_type == 'demo':
                links = parser.LINK_PATTERN.findall(content)
                for link_text, link_url in links:
                    if any(kw in link_text.lower() for kw in ['demo', 'live', 'website', 'try']):
                        demo_urls.append(link_url)
                        blocks.append(
                            {
                                'type': 'button',
                                'text': link_text,
                                'url': link_url,
                                'icon': 'ExternalLink',
                                'style': 'primary',
                                'size': 'large',
                            }
                        )

            blocks.extend(section_blocks)

        return {
            'blocks': blocks,
            'hero_image': hero_image,
            'hero_quote': hero_quote,
            'mermaid_diagrams': mermaid_diagrams,
            'demo_urls': demo_urls,
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

    def _categorize_section(self, heading: str) -> str:
        """Categorize section based on heading keywords."""
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
        for alt_text, url in self.IMAGE_PATTERN.findall(content):
            images.append({'url': url, 'caption': alt_text})
            # Remove image markdown from content
            content = content.replace(f'![{alt_text}]({url})', '')

        # Add images as blocks (group multiple images as image grid)
        if section_type == 'screenshots' and len(images) > 1:
            blocks.append({'type': 'imageGrid', 'images': images, 'caption': heading})
        elif images:
            for img in images:
                blocks.append({'type': 'image', 'url': img['url'], 'caption': img.get('caption', '')})

        # Parse paragraphs
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        for paragraph in paragraphs:
            # Check if it's a code block placeholder
            if '__CODE_BLOCK_' in paragraph:
                idx = int(paragraph.replace('__CODE_BLOCK_', '').replace('__', ''))
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
                # Convert list to text block
                blocks.append({'type': 'text', 'style': 'body', 'content': paragraph, 'markdown': True})
            # Regular paragraph
            elif len(paragraph) > 10:  # Ignore very short lines
                # Check if it's a quote
                if paragraph.startswith('>'):
                    quote_text = paragraph.replace('>', '').strip()
                    blocks.append({'type': 'text', 'style': 'quote', 'content': quote_text, 'markdown': True})
                else:
                    blocks.append({'type': 'text', 'style': 'body', 'content': paragraph, 'markdown': True})

        return blocks

    @staticmethod
    def generate_architecture_diagram(repo_data: dict) -> str | None:
        """Generate a Mermaid architecture diagram from repository structure.

        Args:
            repo_data: Repository metadata including language, topics, etc.

        Returns:
            Mermaid diagram code or None
        """
        language = repo_data.get('language', '').lower()
        topics = [t.lower() for t in repo_data.get('topics', [])]

        # Detect project type and generate appropriate diagram
        if 'django' in topics or 'flask' in topics or 'fastapi' in topics:
            return ReadmeParser._generate_backend_diagram(language, topics)
        elif 'react' in topics or 'vue' in topics or 'angular' in topics:
            return ReadmeParser._generate_frontend_diagram(language, topics)
        elif 'fullstack' in topics or ('react' in topics and 'django' in topics):
            return ReadmeParser._generate_fullstack_diagram(topics)
        elif 'ml' in topics or 'ai' in topics or 'machine-learning' in topics:
            return ReadmeParser._generate_ml_pipeline_diagram(topics)

        return None

    @staticmethod
    def _generate_backend_diagram(language: str, topics: list[str]) -> str:
        """Generate backend architecture diagram."""
        db = 'PostgreSQL' if 'postgresql' in topics else 'MongoDB' if 'mongodb' in topics else 'Database'
        cache = 'Redis' if 'redis' in topics else 'Cache'

        return f"""graph LR
    A[Client] --> B[API Gateway]
    B --> C[Backend Service]
    C --> D[{db}]
    C --> E[{cache}]
    C --> F[Queue/Celery]
"""

    @staticmethod
    def _generate_frontend_diagram(language: str, topics: list[str]) -> str:
        """Generate frontend architecture diagram."""
        return """graph TB
    A[User Interface] --> B[Component Layer]
    B --> C[State Management]
    C --> D[API Client]
    D --> E[Backend API]
"""

    @staticmethod
    def _generate_fullstack_diagram(topics: list[str]) -> str:
        """Generate full-stack architecture diagram."""
        return """graph TB
    subgraph Frontend
        A[React UI] --> B[Redux Store]
        B --> C[API Client]
    end

    subgraph Backend
        D[Django REST API] --> E[PostgreSQL]
        D --> F[Redis Cache]
        D --> G[Celery Tasks]
    end

    C --> D
"""

    @staticmethod
    def _generate_ml_pipeline_diagram(topics: list[str]) -> str:
        """Generate ML pipeline architecture diagram."""
        return """graph LR
    A[Data Collection] --> B[Preprocessing]
    B --> C[Model Training]
    C --> D[Evaluation]
    D --> E[Deployment]
    E --> F[Inference API]
"""
