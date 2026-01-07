"""
Markdown generation utilities for project context files.

Used by the context-md endpoint to generate downloadable markdown
representations of projects for LLM/AI tool consumption.
"""

from typing import Any

from django.conf import settings


def generate_project_markdown(project, request) -> str:
    """Generate a markdown representation of a project.

    Args:
        project: The Project model instance
        request: The HTTP request (for building absolute URLs)

    Returns:
        Formatted markdown string
    """
    lines = []

    # Title
    lines.append(f'# {project.title}')
    lines.append('')

    # Description as blockquote
    if project.description:
        # Clean up description for markdown
        desc = project.description.replace('\n', '\n> ')
        lines.append(f'> {desc}')
        lines.append('')

    # Metadata section - use FRONTEND_URL for user-facing URLs
    creator_name = project.user.get_full_name() or project.user.username
    base_url = settings.FRONTEND_URL
    profile_url = f'{base_url}/{project.user.username}'
    project_url = f'{base_url}/{project.user.username}/{project.slug}'

    lines.append(f'**Creator:** [{creator_name}]({profile_url})')
    lines.append(f'**Type:** {project.type}')

    if project.difficulty_taxonomy:
        lines.append(f'**Difficulty:** {project.difficulty_taxonomy.name}')

    if project.time_investment:
        lines.append(f'**Time Investment:** {project.time_investment.name}')

    lines.append(f'**URL:** {project_url}')
    lines.append('')

    # Tech Stack (Tools)
    tools = list(project.tools.all())
    if tools:
        lines.append('## Tech Stack')
        for tool in tools:
            lines.append(f'- {tool.name}')
        lines.append('')

    # Categories
    categories = list(project.categories.all())
    if categories:
        lines.append('## Categories')
        category_names = ', '.join(cat.name for cat in categories)
        lines.append(category_names)
        lines.append('')

    # Topics
    topics = list(project.topics.all())
    if topics:
        lines.append('## Topics')
        topic_names = ', '.join(topic.name for topic in topics)
        lines.append(topic_names)
        lines.append('')

    # Content sections (structured content from project.content JSON)
    if project.content:
        content_md = _render_content_to_markdown(project.content)
        if content_md:
            lines.append(content_md)
            lines.append('')

    # External URL
    if project.external_url:
        lines.append(f'**External Link:** [{project.external_url}]({project.external_url})')
        lines.append('')

    # Footer
    lines.append('---')
    lines.append(f'*Generated from AllThrive AI - {project_url}*')
    if project.updated_at:
        lines.append(f'*Last updated: {project.updated_at.isoformat()}*')

    return '\n'.join(lines)


def _render_content_to_markdown(content: dict | list | None) -> str:
    """Render project content JSON to markdown.

    Handles the various content block formats used in projects.
    """
    if not content:
        return ''

    lines = []

    # Handle different content structures
    if isinstance(content, dict):
        # Check for blocks array
        blocks = content.get('blocks', [])
        if blocks:
            for block in blocks:
                block_md = _render_block(block)
                if block_md:
                    lines.append(block_md)

        # Check for sections array (sorted by order)
        sections = content.get('sections', [])
        if sections:
            # Sort by 'order' field if present
            sorted_sections = sorted(sections, key=lambda s: s.get('order', 0))
            for section in sorted_sections:
                section_md = _render_section(section)
                if section_md:
                    lines.append(section_md)

        # Top-level links (resources)
        links = content.get('links', {})
        if links and isinstance(links, dict):
            link_lines = ['## Resources', '']
            for label, url in links.items():
                # Convert key to title case (e.g., 'github' -> 'Github')
                title = label.replace('_', ' ').title()
                link_lines.append(f'- [{title}]({url})')
            lines.append('\n'.join(link_lines))

        # Direct text content
        if 'text' in content:
            lines.append(content['text'])

        # Description/body content
        if 'body' in content:
            lines.append(content['body'])

    elif isinstance(content, list):
        # Content is directly a list of blocks
        for item in content:
            if isinstance(item, dict):
                block_md = _render_block(item)
                if block_md:
                    lines.append(block_md)

    return '\n\n'.join(lines)


def _render_block(block: dict) -> str:
    """Render a single content block to markdown."""
    if not isinstance(block, dict):
        return ''

    block_type = block.get('type', '')

    if block_type == 'paragraph':
        return block.get('text', block.get('content', ''))

    elif block_type == 'heading':
        level = block.get('level', 2)
        text = block.get('text', block.get('content', ''))
        return f'{"#" * level} {text}'

    elif block_type == 'code':
        lang = block.get('language', '')
        code = block.get('code', block.get('content', ''))
        return f'```{lang}\n{code}\n```'

    elif block_type == 'list':
        items = block.get('items', [])
        ordered = block.get('ordered', False)
        result = []
        for i, item in enumerate(items, 1):
            prefix = f'{i}.' if ordered else '-'
            item_text = item if isinstance(item, str) else item.get('text', '')
            result.append(f'{prefix} {item_text}')
        return '\n'.join(result)

    elif block_type == 'quote':
        text = block.get('text', block.get('content', ''))
        return f'> {text}'

    elif block_type == 'image':
        url = block.get('url', block.get('src', ''))
        alt = block.get('alt', block.get('caption', 'Image'))
        return f'![{alt}]({url})'

    elif block_type == 'link':
        url = block.get('url', block.get('href', ''))
        text = block.get('text', block.get('title', url))
        return f'[{text}]({url})'

    elif block_type == 'video':
        url = block.get('url', block.get('src', ''))
        return f'[Video]({url})'

    elif block_type == 'embed':
        url = block.get('url', '')
        return f'[Embed: {url}]({url})'

    # Default: try to extract text content
    text = block.get('text', block.get('content', ''))
    if text:
        return text

    return ''


def _render_section(section: dict) -> str:
    """Render a content section to markdown.

    Handles the structured section types used in AllThrive projects:
    - overview: headline, description, previewImage
    - features: list of features with title, description, icon
    - demo: CTAs with url, label, style
    - gallery: images with url, alt
    - resources: links to external resources
    """
    if not isinstance(section, dict):
        return ''

    # Skip disabled sections
    if not section.get('enabled', True):
        return ''

    section_type = section.get('type', '')
    content = section.get('content', {})
    lines = []

    # Handle structured section types
    if section_type == 'overview':
        headline = content.get('headline', '')
        description = content.get('description', '')
        preview_image = content.get('previewImage', '')

        if headline:
            lines.append('## Overview')
            lines.append('')
            lines.append(f'### {headline}')
        if description:
            lines.append('')
            lines.append(description)
        if preview_image:
            lines.append('')
            lines.append(f'![Project preview]({preview_image})')

    elif section_type == 'features':
        features = content.get('features', [])
        if features:
            lines.append('## Key Features')
            lines.append('')
            for feature in features:
                title = feature.get('title', '')
                desc = feature.get('description', '')
                if title:
                    lines.append(f'#### {title}')
                    if desc:
                        lines.append(desc)
                    lines.append('')

    elif section_type == 'demo':
        ctas = content.get('ctas', [])
        if ctas:
            lines.append('## Demo')
            lines.append('')
            for cta in ctas:
                url = cta.get('url', '')
                label = cta.get('label', 'View Demo')
                if url:
                    lines.append(f'[{label}]({url})')

    elif section_type == 'gallery':
        images = content.get('images', [])
        if images:
            lines.append('## Gallery')
            lines.append('')
            for img in images:
                url = img.get('url', '')
                alt = img.get('alt', 'Image')
                if url:
                    lines.append(f'![{alt}]({url})')

    elif section_type == 'resources':
        links = content.get('links', [])
        if links:
            lines.append('## Resources')
            lines.append('')
            for link in links:
                url = link.get('url', '')
                title = link.get('title', link.get('label', url))
                description = link.get('description', '')
                if url:
                    lines.append(f'- [{title}]({url})')
                    if description:
                        lines.append(f'  {description}')

    else:
        # Fallback: generic section handling
        title = section.get('title', section.get('heading', ''))
        if title:
            lines.append(f'### {title}')

        # Section content
        if content:
            if isinstance(content, str):
                lines.append(content)
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        block_md = _render_block(item)
                        if block_md:
                            lines.append(block_md)
                    elif isinstance(item, str):
                        lines.append(item)

        # Section blocks
        blocks = section.get('blocks', [])
        for block in blocks:
            block_md = _render_block(block)
            if block_md:
                lines.append(block_md)

    return '\n'.join(lines)


def extract_code_from_content(content: dict | list | None) -> list[dict[str, Any]]:
    """Extract code blocks from content JSON.

    Returns a list of dicts with 'language' and 'code' keys.
    """
    if not content:
        return []

    snippets = []

    def extract_from_block(block: dict):
        if not isinstance(block, dict):
            return
        if block.get('type') == 'code':
            snippets.append(
                {
                    'language': block.get('language', ''),
                    'code': block.get('code', block.get('content', '')),
                }
            )

    def process_content(c):
        if isinstance(c, dict):
            # Check if this is a code block itself
            extract_from_block(c)

            # Check blocks array
            for block in c.get('blocks', []):
                extract_from_block(block)

            # Check sections
            for section in c.get('sections', []):
                if isinstance(section, dict):
                    for block in section.get('blocks', []):
                        extract_from_block(block)
                    section_content = section.get('content', [])
                    if isinstance(section_content, list):
                        for item in section_content:
                            extract_from_block(item)

        elif isinstance(c, list):
            for item in c:
                process_content(item)

    process_content(content)
    return snippets
