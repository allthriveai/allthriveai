"""Service for syncing RSS feeds and creating projects."""

import html as html_module
import logging
import re
from datetime import datetime

import defusedxml.ElementTree as ET
import requests
from django.db import transaction
from django.utils import timezone

from core.integrations.rss_models import RSSFeedAgent, RSSFeedItem
from core.projects.models import Project
from core.taxonomy.models import Taxonomy
from services.ai import AIProvider
from services.ai.topic_extraction import TopicExtractionService
from services.integrations.storage.storage_service import get_storage_service

logger = logging.getLogger(__name__)

# Category mapping from common variations to canonical taxonomy names
CATEGORY_MAPPING = {
    'web development': 'Web Development',
    'web dev': 'Web Development',
    'frontend': 'Web Development',
    'backend': 'Web Development',
    'mobile development': 'Mobile Development',
    'mobile dev': 'Mobile Development',
    'ios': 'Mobile Development',
    'android': 'Mobile Development',
    'data science': 'Data Science',
    'data analytics': 'Data Science',
    'ai/ml': 'AI & Machine Learning',
    'artificial intelligence': 'AI & Machine Learning',
    'machine learning': 'AI & Machine Learning',
    'llm': 'AI & Machine Learning',
    'generative ai': 'AI & Machine Learning',
    'deep learning': 'AI & Machine Learning',
    'design': 'Design',
    'ui/ux': 'Design',
    'ux design': 'Design',
    'ui design': 'Design',
    'devops': 'DevOps',
    'cloud computing': 'Cloud',
    'cloud': 'Cloud',
    'aws': 'Cloud',
    'azure': 'Cloud',
    'gcp': 'Cloud',
    'game development': 'Game Development',
    'gamedev': 'Game Development',
    'content creation': 'Content Creation',
    'tutorial': 'Tutorial',
    'project showcase': 'Project Showcase',
    'security': 'Security',
    'cybersecurity': 'Security',
    'blockchain': 'Blockchain',
    'crypto': 'Blockchain',
    'web3': 'Blockchain',
}

# Visual style prompts for curator-specific hero image generation
# Each style is either PHOTOREALISTIC or ABSTRACT - no AI slop middle ground
VISUAL_STYLE_PROMPTS = {
    'neo_brutalism': """
STYLE: Abstract geometric art (flat vector style)
- Bold, saturated flat colors (hot pink, electric blue, bright yellow, lime green)
- Thick black outlines, hard edges
- Simple geometric shapes - circles, squares, triangles
- High contrast, no gradients, no 3D effects
- Like a bold poster or album cover
- Think: Bauhaus meets punk rock zine
""",
    'dark_academia': """
STYLE: Steampunk mechanical art with Victorian engineering aesthetic
- Color palette: aged brass, copper patina, mahogany wood, leather brown, iron gray, amber glass
- Dramatic warm lighting from gas lamps or glowing vacuum tubes
- AVOID: books, libraries, desks, candles, coffee, spectacles - these are cliché
- PREFER: Intricate clockwork mechanisms, brass gears and cogs, pressure gauges,
  Victorian-era scientific instruments, mechanical computing engines, steam pipes
- Texture: polished brass, riveted metal plates, worn leather, etched glass dials
- Atmosphere: warm steam, soft lens flares from amber light sources
- Composition: complex layered machinery, depth through overlapping mechanical elements
- Think: Jules Verne meets Victorian patent drawings meets Myst game aesthetics
- Objects: brass telescopes, mechanical calculators, vacuum tubes, pressure valves, gyroscopes
""",
    'cyberpunk': """
STYLE: Hyper-realistic night photography or abstract data visualization
- Neon accent colors (cyan, magenta) against pure black
- If realistic: wet city streets, reflections, lens flares
- If abstract: clean data streams, minimal circuit patterns
- High contrast, deep blacks
- Think: Blade Runner cinematography or Bloomberg terminal aesthetics
""",
    'organic_nature': """
STYLE: Fine art nature photography (National Geographic quality)
- Photorealistic macro or landscape photography
- Earth tones: sage, terracotta, forest green
- Golden hour or soft diffused lighting
- Shallow depth of field, bokeh
- Think: award-winning nature documentary still
""",
    'scandinavian_calm': """
STYLE: Minimalist product photography or abstract gradient art
- Muted pastels: soft gray, blush, pale blue, cream
- Either clean studio photography with soft shadows
- Or simple abstract gradients and shapes
- Lots of negative space, very minimal
- Think: Apple product photography or Dieter Rams design
""",
    'editorial_magazine': """
STYLE: High-end editorial photography
- Bold, dramatic lighting and composition
- Strong shadows, high contrast
- Photorealistic, magazine-cover quality
- Dynamic angles, intentional cropping
- Think: Vogue, Wired, or Bloomberg Businessweek covers
""",
    'corporate_clean': """
STYLE: Clean isometric illustration or infographic style
- Flat colors: navy, teal, white, gray
- Simple geometric shapes, clean lines
- Isometric perspective if 3D elements
- Minimal, professional, trustworthy
- Think: Stripe or Linear website illustrations
""",
    'constructivist_bauhaus': """
STYLE: Bold abstract geometric art
- Primary colors only: red, blue, yellow, black, white
- Hard-edge geometric shapes
- Flat, no gradients, no textures
- Strong diagonals, asymmetric balance
- Think: actual Bauhaus posters, Kandinsky, El Lissitzky
""",
    'zen_monochrome': """
STYLE: Black and white fine art or ink wash painting
- Pure black, white, gray only
- Either photorealistic B&W photography
- Or abstract ink wash / sumi-e style
- Abundant negative space
- Single focal point
- Think: Hiroshi Sugimoto photography or traditional calligraphy
""",
    'glass_neon': """
STYLE: Abstract light photography or minimal neon art
- Dark/black background
- Clean neon light trails or glass refractions
- Long exposure light painting aesthetic
- Simple, elegant, not busy
- Think: James Turrell light installations or minimal neon signage
""",
}


def clean_html(text: str) -> str:
    """Remove HTML tags and decode HTML entities from text."""
    if not text:
        return ''
    # Decode HTML entities first
    text = html_module.unescape(text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class RSSFeedParser:
    """Parse RSS/Atom feeds."""

    # Common namespaces
    NAMESPACES = {
        'atom': 'http://www.w3.org/2005/Atom',
        'content': 'http://purl.org/rss/1.0/modules/content/',
        'dc': 'http://purl.org/dc/elements/1.1/',
        'media': 'http://search.yahoo.com/mrss/',
    }

    @classmethod
    def parse_feed(cls, xml_content: str) -> list[dict]:
        """Parse RSS/Atom XML and return list of item data.

        Args:
            xml_content: Raw XML content from RSS/Atom feed

        Returns:
            List of dictionaries containing feed item data
        """
        try:
            root = ET.fromstring(xml_content)

            # Detect feed type (Atom or RSS)
            if root.tag == '{http://www.w3.org/2005/Atom}feed':
                return cls._parse_atom_feed(root)
            elif root.tag == 'rss' or root.tag == 'feed':
                return cls._parse_rss_feed(root)
            else:
                logger.warning(f'Unknown feed format: {root.tag}')
                return []

        except ET.ParseError as e:
            logger.error(f'Failed to parse RSS/Atom feed: {e}')
            raise

    @classmethod
    def _parse_atom_feed(cls, root) -> list[dict]:
        """Parse Atom feed format."""
        items = []

        for entry in root.findall('atom:entry', cls.NAMESPACES):
            item_data = cls._parse_atom_entry(entry)
            if item_data:
                items.append(item_data)

        return items

    @classmethod
    def _parse_atom_entry(cls, entry) -> dict | None:
        """Parse a single Atom entry."""
        try:
            # Get ID (required in Atom)
            id_elem = entry.find('atom:id', cls.NAMESPACES)
            if id_elem is None or not id_elem.text:
                return None
            item_id = id_elem.text

            # Get title
            title_elem = entry.find('atom:title', cls.NAMESPACES)
            title = clean_html(title_elem.text) if title_elem is not None else 'Untitled'

            # Get link
            link_elem = entry.find('atom:link[@href]', cls.NAMESPACES)
            link = link_elem.get('href') if link_elem is not None else ''

            # Get author
            author_elem = entry.find('atom:author/atom:name', cls.NAMESPACES)
            author = author_elem.text if author_elem is not None else ''

            # Get content/summary
            content_elem = entry.find('atom:content', cls.NAMESPACES)
            summary_elem = entry.find('atom:summary', cls.NAMESPACES)

            if content_elem is not None and content_elem.text:
                description = clean_html(content_elem.text)
            elif summary_elem is not None and summary_elem.text:
                description = clean_html(summary_elem.text)
            else:
                description = ''

            # Get published date
            published_elem = entry.find('atom:published', cls.NAMESPACES)
            updated_elem = entry.find('atom:updated', cls.NAMESPACES)

            published_at = cls._parse_date(
                published_elem.text
                if published_elem is not None
                else updated_elem.text
                if updated_elem is not None
                else None
            )

            # Get categories
            categories = []
            for cat_elem in entry.findall('atom:category', cls.NAMESPACES):
                term = cat_elem.get('term')
                if term:
                    categories.append(term)

            # Get thumbnail
            thumbnail_url = ''
            media_thumb = entry.find('media:thumbnail', cls.NAMESPACES)
            if media_thumb is not None:
                thumbnail_url = media_thumb.get('url', '')

            return {
                'feed_item_id': item_id,
                'title': title,
                'author': author,
                'permalink': link,
                'description': description,
                'published_at': published_at,
                'categories': categories,
                'thumbnail_url': thumbnail_url,
            }

        except Exception as e:
            logger.error(f'Error parsing Atom entry: {e}', exc_info=True)
            return None

    @classmethod
    def _parse_rss_feed(cls, root) -> list[dict]:
        """Parse RSS 2.0 feed format."""
        items = []

        # Find all item elements
        for item in root.findall('.//item'):
            item_data = cls._parse_rss_item(item)
            if item_data:
                items.append(item_data)

        return items

    @classmethod
    def _parse_rss_item(cls, item) -> dict | None:
        """Parse a single RSS item."""
        try:
            # Get guid or link as ID
            guid_elem = item.find('guid')
            link_elem = item.find('link')

            if guid_elem is not None and guid_elem.text:
                item_id = guid_elem.text
            elif link_elem is not None and link_elem.text:
                item_id = link_elem.text
            else:
                return None

            # Get title
            title_elem = item.find('title')
            title = clean_html(title_elem.text) if title_elem is not None else 'Untitled'

            # Get link
            link = link_elem.text if link_elem is not None else ''

            # Get author
            author_elem = item.find('author')
            dc_creator = item.find('dc:creator', cls.NAMESPACES)

            if author_elem is not None and author_elem.text:
                author = author_elem.text
            elif dc_creator is not None and dc_creator.text:
                author = dc_creator.text
            else:
                author = ''

            # Get description/content
            content_elem = item.find('content:encoded', cls.NAMESPACES)
            description_elem = item.find('description')

            if content_elem is not None and content_elem.text:
                description = clean_html(content_elem.text)
            elif description_elem is not None and description_elem.text:
                description = clean_html(description_elem.text)
            else:
                description = ''

            # Get published date
            pubdate_elem = item.find('pubDate')
            dc_date = item.find('dc:date', cls.NAMESPACES)

            published_at = cls._parse_date(
                pubdate_elem.text if pubdate_elem is not None else dc_date.text if dc_date is not None else None
            )

            # Get categories
            categories = []
            for cat_elem in item.findall('category'):
                if cat_elem.text:
                    categories.append(cat_elem.text)

            # Get thumbnail
            thumbnail_url = ''
            media_content = item.find('media:content', cls.NAMESPACES)
            media_thumb = item.find('media:thumbnail', cls.NAMESPACES)

            if media_thumb is not None:
                thumbnail_url = media_thumb.get('url', '')
            elif media_content is not None:
                thumbnail_url = media_content.get('url', '')

            return {
                'feed_item_id': item_id,
                'title': title,
                'author': author,
                'permalink': link,
                'description': description,
                'published_at': published_at,
                'categories': categories,
                'thumbnail_url': thumbnail_url,
            }

        except Exception as e:
            logger.error(f'Error parsing RSS item: {e}', exc_info=True)
            return None

    @staticmethod
    def _parse_date(date_str: str | None) -> datetime | None:
        """Parse various date formats from RSS/Atom feeds."""
        if not date_str:
            return None

        try:
            # Try ISO 8601 format (Atom)
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt
        except (ValueError, AttributeError):
            pass

        try:
            # Try RFC 822 format (RSS)
            from email.utils import parsedate_to_datetime

            dt = parsedate_to_datetime(date_str)
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            return dt
        except (ValueError, TypeError):
            pass

        logger.warning(f'Failed to parse date: {date_str}')
        return None


def format_article_date(dt: datetime | None) -> str:
    """Format datetime for display in articles."""
    if not dt:
        return ''
    return dt.strftime('%B %d, %Y')


class RSSFeedSyncService:
    """Service for syncing RSS feed agents."""

    USER_AGENT = 'Mozilla/5.0 (compatible; AllThrive/1.0; +https://allthrive.ai)'
    REQUEST_TIMEOUT = 30  # seconds

    @classmethod
    def sync_agent(cls, agent: RSSFeedAgent) -> dict:
        """Sync a single RSS feed agent.

        Args:
            agent: RSSFeedAgent instance to sync

        Returns:
            Dictionary with sync results: created, updated, errors, error_messages
        """
        results = {
            'created': 0,
            'updated': 0,
            'errors': 0,
            'error_messages': [],
        }

        try:
            # Fetch RSS feed
            logger.info(f'Fetching RSS feed: {agent.feed_url}')
            response = requests.get(
                agent.feed_url,
                headers={'User-Agent': cls.USER_AGENT},
                timeout=cls.REQUEST_TIMEOUT,
            )
            response.raise_for_status()

            # Parse feed
            feed_items = RSSFeedParser.parse_feed(response.text)
            logger.info(f'Parsed {len(feed_items)} items from {agent.source_name}')

            # Get max items from settings
            max_items = agent.settings.get('max_items', 20)
            feed_items = feed_items[:max_items]

            # Filter out items older than 2025 (only import recent content)
            min_year = agent.settings.get('min_publish_year', 2025)
            original_count = len(feed_items)
            feed_items = [
                item for item in feed_items if item.get('published_at') is None or item['published_at'].year >= min_year
            ]
            if len(feed_items) < original_count:
                skipped = original_count - len(feed_items)
                logger.info(f'Skipped {skipped} items published before {min_year}')

            # Process each item
            for item_data in feed_items:
                try:
                    created = cls._create_or_update_item(agent, item_data)
                    if created:
                        results['created'] += 1
                    else:
                        results['updated'] += 1
                except Exception as e:
                    logger.error(f'Error processing feed item: {e}', exc_info=True)
                    results['errors'] += 1
                    results['error_messages'].append(str(e))

            # Update agent sync status
            agent.last_synced_at = timezone.now()
            agent.last_sync_status = f'Success: {results["created"]} created, {results["updated"]} updated'
            agent.last_sync_error = ''
            agent.save()

        except Exception as e:
            logger.error(f'Error syncing RSS agent {agent.name}: {e}', exc_info=True)
            agent.last_sync_error = str(e)
            agent.status = RSSFeedAgent.Status.ERROR
            agent.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        return results

    @classmethod
    def _create_or_update_item(cls, agent: RSSFeedAgent, item_data: dict) -> bool:
        """Create or update a feed item project.

        Returns:
            True if created, False if updated
        """
        feed_item_id = item_data['feed_item_id']

        # Check if item already exists
        try:
            feed_item = RSSFeedItem.objects.get(feed_item_id=feed_item_id)
            # Item exists, update it
            cls._update_feed_item(feed_item, item_data)
            return False
        except RSSFeedItem.DoesNotExist:
            # Create new item
            cls._create_feed_item(agent, item_data)
            return True

    @classmethod
    def _create_feed_item(cls, agent: RSSFeedAgent, item_data: dict):
        """Create a new RSS feed item and project with expert review."""
        with transaction.atomic():
            # Generate expert review using agent's persona
            expert_review = cls._generate_expert_review(agent, item_data)

            # Build content structure with expert review
            content = cls._build_rss_article_content(item_data, agent, expert_review)

            # Extract topics from article content
            topics = cls._extract_topics_from_article(item_data)

            # Detect difficulty level
            difficulty = cls._detect_difficulty_level(item_data)

            # Determine featured image - use RSS thumbnail or generate with Gemini
            featured_image_url = item_data.get('thumbnail_url') or ''
            if not featured_image_url:
                # Generate a beautiful hero image using Gemini with curator's visual style
                generated_url = cls._generate_hero_image(item_data, topics, agent.visual_style)
                if generated_url:
                    featured_image_url = generated_url
                    logger.info(
                        f'Using AI-generated hero for "{item_data["title"][:40]}..." ' f'(style: {agent.visual_style})'
                    )

            # Use expert review as project description, fallback to original
            project_description = expert_review or (item_data['description'][:500] if item_data['description'] else '')

            # Create project
            project = Project.objects.create(
                user=agent.agent_user,
                title=item_data['title'],
                description=project_description,
                type=Project.ProjectType.RSS_ARTICLE,
                external_url=item_data['permalink'],
                featured_image_url=featured_image_url,
                content=content,
                topics=topics,
                difficulty_level=difficulty,
                is_showcased=True,
                is_private=False,
            )
            project.ensure_unique_slug()
            project.save()

            # Set created_at to the RSS published date so articles appear in correct order
            if item_data.get('published_at'):
                Project.objects.filter(pk=project.pk).update(created_at=item_data['published_at'])

            # Add categories from RSS feed categories (with AI fallback)
            cls._add_categories_to_project(project, item_data.get('categories', []), item_data)

            # Extract and add tools mentioned in article
            cls._add_tools_to_project(project, item_data)

            # Prepare metadata with serializable datetime
            metadata = dict(item_data)
            if metadata.get('published_at'):
                metadata['published_at'] = metadata['published_at'].isoformat()

            # Create feed item metadata
            feed_item = RSSFeedItem.objects.create(
                project=project,
                agent=agent,
                feed_item_id=item_data['feed_item_id'],
                source_name=agent.source_name,
                author=item_data['author'],
                permalink=item_data['permalink'],
                thumbnail_url=item_data['thumbnail_url'],
                categories=item_data['categories'],
                published_at=item_data['published_at'] or timezone.now(),
                rss_metadata=metadata,
            )

            logger.info(f'Created RSS feed item: {project.title} ({feed_item.feed_item_id})')

    @classmethod
    def _update_feed_item(cls, feed_item: RSSFeedItem, item_data: dict):
        """Update an existing RSS feed item."""
        # Update project if needed
        project = feed_item.project
        agent = feed_item.agent
        updated = False

        if project.title != item_data['title']:
            project.title = item_data['title']
            updated = True

        if item_data['description'] and project.description != item_data['description'][:500]:
            project.description = item_data['description'][:500]
            updated = True

        # Update featured image - use RSS thumbnail, or generate if missing
        if item_data['thumbnail_url'] and project.featured_image_url != item_data['thumbnail_url']:
            project.featured_image_url = item_data['thumbnail_url']
            updated = True
        elif not project.featured_image_url:
            # No image - try to generate one with curator's visual style
            topics = project.topics or cls._extract_topics_from_article(item_data)
            generated_url = cls._generate_hero_image(item_data, topics, agent.visual_style)
            if generated_url:
                project.featured_image_url = generated_url
                updated = True
                logger.info(
                    f'Generated hero image for existing article: {project.title[:40]}... '
                    f'(style: {agent.visual_style})'
                )

        # Update content structure if empty or content changed
        if not project.content or not project.content.get('sections'):
            project.content = cls._build_rss_article_content(item_data, agent)
            updated = True

        # Update topics if empty
        if not project.topics:
            topics = cls._extract_topics_from_article(item_data)
            project.topics = topics
            updated = True

            # Add categories if not already set (with AI fallback)
            if not project.categories.exists():
                cls._add_categories_to_project(project, item_data.get('categories', []), item_data)

        # Add tools if not already set
        if not project.tools.exists():
            cls._add_tools_to_project(project, item_data)

        # Update difficulty if empty
        if not project.difficulty_level:
            difficulty = cls._detect_difficulty_level(item_data)
            project.difficulty_level = difficulty
            updated = True

        if updated:
            project.save()

        # Prepare metadata with serializable datetime
        metadata = dict(item_data)
        if metadata.get('published_at'):
            metadata['published_at'] = metadata['published_at'].isoformat()

        # Update feed item metadata
        feed_item.categories = item_data['categories']
        feed_item.rss_metadata = metadata
        feed_item.save()

        logger.debug(f'Updated RSS feed item: {project.title}')

    @classmethod
    def _generate_expert_review(cls, agent: RSSFeedAgent, item_data: dict) -> str | None:
        """Generate an engaging expert review using the agent's persona.

        Creates a structured analysis with:
        - A compelling opening hook
        - Key insights with context
        - Actionable takeaways

        Args:
            agent: The RSS feed agent with persona configuration
            item_data: Article data including title and description

        Returns:
            Expert review text with Markdown formatting, or None if generation fails
        """
        try:
            ai = AIProvider(provider='openai')
            user = agent.agent_user
            persona = agent.settings.get('persona', {})
            source_name = agent.settings.get('source_name', agent.source_name)

            # Build persona context
            voice = persona.get('voice', 'analytical')
            expertise = ', '.join(persona.get('expertise_areas', ['technology', 'AI']))
            signature_phrases = persona.get('signature_phrases', [])

            # Build system prompt with persona for engaging content
            signature_note = (
                f"Your signature style includes: {', '.join(signature_phrases[:2])}" if signature_phrases else ''
            )
            system_prompt = f"""You are {user.first_name} {user.last_name}, a fun and knowledgeable curator "
                "who makes AI news accessible and exciting."

Your voice: {voice}
Your expertise: {expertise}

Write a thoughtful take that helps people understand why this matters.
You're an expert sharing genuine insights, not hyping something up.

FORMAT (use these exact markdown headers):

## The Big Picture
One paragraph (2-3 sentences) setting context. What problem does this solve or what opportunity does it create?

## Key Insight
One paragraph (2-3 sentences) on the most interesting or useful thing here. Be specific about what makes this notable.

## What This Means For You
One paragraph (2-3 sentences) on practical implications. How might someone actually use this? What should they know?

VOICE:
- Sound like a knowledgeable friend, not a press release or salesperson
- Use clear, direct language
- Be genuinely helpful, not performatively excited
- Share real insight, not empty enthusiasm
- NO jargon like "robust empirical data" or "nuanced perspective"
- NO academic speak like "practitioners should note" or "key contribution"
- NO corporate buzzwords like "leverage" or "synergy"
- NEVER start with "This article" or "The article discusses"

STRICT FORMATTING RULES:
- NEVER use em-dashes (—) or double hyphens (--)
- Use periods to separate thoughts, not dashes
- NO hype words: turbocharged, supercharged, game-changing, revolutionary,
  groundbreaking, mind-blowing, next-level, magic, magical
- Write like you're explaining something valuable, not selling it
- ALWAYS use the markdown headers exactly as shown above

{signature_note}"""

            prompt = f"""Curate this article from {source_name}:

Title: {item_data['title']}

Description: {item_data.get('description', '')[:1000] or 'No description available'}

Your expert curation:"""

            response = ai.complete(
                prompt=prompt,
                system_message=system_prompt,
                temperature=0.7,  # Balanced creativity for natural but focused voice
                max_tokens=800,  # Longer for structured sections with headers
            )

            review = response.strip()

            # Basic validation - ensure we got something substantive (4-6 sentences)
            if review and len(review) > 200:
                logger.info(f'Generated expert review for "{item_data["title"][:40]}..."')
                return review
            else:
                logger.warning(f'Expert review too short or empty for "{item_data["title"][:40]}..."')
                return None

        except Exception as e:
            logger.error(f'Error generating expert review: {e}', exc_info=True)
            return None

    @classmethod
    def _build_rss_article_content(cls, item_data: dict, agent: RSSFeedAgent, expert_review: str | None = None) -> dict:
        """Build structured content for RSS article project.

        Creates a review-first layout with the expert's analysis as the primary content
        and a subtle link to the original source at the end.
        """
        import uuid

        sections = []
        user = agent.agent_user
        source_name = agent.settings.get('source_name', agent.source_name)
        reviewer_name = f'{user.first_name} {user.last_name}'.strip() or source_name

        # 1. Overview Section - Expert review as primary description
        overview_section = {
            'id': str(uuid.uuid4()),
            'type': 'overview',
            'enabled': True,
            'order': 0,
            'content': {
                'headline': item_data['title'],
                'description': expert_review or item_data['description'] or '',
                'metrics': [
                    {'icon': 'user', 'label': 'Reviewed by', 'value': reviewer_name},
                ],
            },
        }

        # Add publish date
        if item_data.get('published_at'):
            overview_section['content']['metrics'].append(
                {'icon': 'clock', 'label': 'Published', 'value': format_article_date(item_data['published_at'])}
            )

        # Add original author if available
        if item_data.get('author'):
            overview_section['content']['metrics'].append(
                {'icon': 'pencil', 'label': 'Author', 'value': item_data['author']}
            )

        # Add preview image if available
        if item_data.get('thumbnail_url'):
            overview_section['content']['previewImage'] = item_data['thumbnail_url']

        sections.append(overview_section)

        # 2. Links Section - Subtle link at the end
        links_section = {
            'id': str(uuid.uuid4()),
            'type': 'links',
            'enabled': True,
            'order': 1,
            'content': {
                'style': 'subtle',  # Use subtle styling for expert review source links
                'links': [
                    {
                        'label': f'Read full article on {source_name}',
                        'url': item_data['permalink'],
                        'icon': 'external',
                        'description': '',  # Keep it minimal
                    }
                ],
            },
        }
        sections.append(links_section)

        return {'templateVersion': 2, 'sections': sections}

    @classmethod
    def _extract_topics_from_article(cls, item_data: dict) -> list[str]:
        """Extract topics from RSS article using AI.

        Uses the article title and description to identify relevant topics.
        """
        try:
            extractor = TopicExtractionService()

            # Use the topic extraction service (designed for Reddit, works for any text)
            topics = extractor.extract_topics_from_reddit_post(
                title=item_data['title'],
                selftext=item_data.get('description', ''),
                subreddit='',  # Not applicable for RSS
                link_flair='',  # Not applicable for RSS
                max_topics=10,
            )

            # Add RSS categories as topics if available
            if item_data.get('categories'):
                for category in item_data['categories']:
                    normalized = category.lower().strip()
                    if normalized not in topics:
                        topics.append(normalized)

            logger.info(f'Extracted topics for "{item_data["title"][:50]}...": {topics}')
            return topics[:10]  # Limit to 10 topics

        except Exception as e:
            logger.error(f'Error extracting topics: {e}', exc_info=True)
            # Fallback to RSS categories
            return [cat.lower().strip() for cat in item_data.get('categories', [])][:10]

    @classmethod
    def _extract_category_with_ai(cls, title: str, description: str) -> str | None:
        """Use AI to extract the best category from article title and description.

        Returns the canonical category name if found, None otherwise.
        """
        try:
            ai = AIProvider(provider='openai')

            # Get available categories from taxonomy
            available_categories = list(
                Taxonomy.objects.filter(taxonomy_type='category', is_active=True).values_list('name', flat=True)
            )

            if not available_categories:
                logger.warning('No active categories found in taxonomy')
                return None

            system_message = f"""You are an AI content categorizer for a tech/AI learning platform.
Analyze the article title and description, and classify it into ONE of these categories:

{', '.join(available_categories)}

Rules:
1. Choose the SINGLE most relevant category
2. If the content is about AI models, LLMs, or research papers, use "AI Models & Research"
3. If it's about AI agents or multi-tool systems, use "AI Agents & Multi-Tool Systems"
4. If it's about coding, programming, or developer tools, use "Developer & Coding"
5. If it's about automation or workflows, use "Workflows & Automation"
6. If it's about productivity tools or methods, use "Productivity"
7. If nothing fits well, default to "AI Models & Research"

Respond with ONLY the category name, exactly as written above."""

            combined_text = f"""Title: {title}

Description: {description[:800] if description else 'No description available'}"""

            response = ai.complete(
                prompt=combined_text,
                system_message=system_message,
                temperature=0.3,
                max_tokens=50,
            )

            category_name = response.strip()

            # Validate the response is one of the available categories
            if category_name in available_categories:
                logger.info(f'AI extracted category "{category_name}" for: {title[:50]}...')
                return category_name

            # Try case-insensitive match
            for cat in available_categories:
                if cat.lower() == category_name.lower():
                    logger.info(f'AI extracted category "{cat}" for: {title[:50]}...')
                    return cat

            logger.warning(f'AI returned invalid category "{category_name}", will try fallback')
            return None

        except Exception as e:
            logger.error(f'Error extracting category with AI: {e}', exc_info=True)
            return None

    @classmethod
    def _add_categories_to_project(cls, project: Project, rss_categories: list[str], item_data: dict | None = None):
        """Match RSS categories to existing Taxonomy categories and add them to project.

        Uses a multi-step approach:
        1. Try to match RSS categories using CATEGORY_MAPPING
        2. Try direct case-insensitive match
        3. If no match found, use AI to extract category from title/description
        """
        matched_categories = []

        # Step 1 & 2: Try to match RSS categories
        if rss_categories:
            for rss_cat in rss_categories:
                normalized = rss_cat.lower().strip()

                # Check mapping first
                canonical_name = CATEGORY_MAPPING.get(normalized)
                if canonical_name:
                    taxonomy_cat = Taxonomy.objects.filter(
                        taxonomy_type='category', is_active=True, name__iexact=canonical_name
                    ).first()
                    if taxonomy_cat and taxonomy_cat not in matched_categories:
                        matched_categories.append(taxonomy_cat)
                        logger.debug(f'Mapped RSS category "{rss_cat}" -> "{canonical_name}"')
                        continue

                # Try direct case-insensitive match
                taxonomy_cat = Taxonomy.objects.filter(
                    taxonomy_type='category', is_active=True, name__iexact=rss_cat
                ).first()

                if taxonomy_cat and taxonomy_cat not in matched_categories:
                    matched_categories.append(taxonomy_cat)
                    logger.debug(f'Matched RSS category "{rss_cat}" to taxonomy "{taxonomy_cat.name}"')

        # Step 3: If no categories matched, use AI extraction
        if not matched_categories and item_data:
            ai_category = cls._extract_category_with_ai(
                title=item_data.get('title', ''), description=item_data.get('description', '')
            )

            if ai_category:
                taxonomy_cat = Taxonomy.objects.filter(
                    taxonomy_type='category', is_active=True, name__iexact=ai_category
                ).first()

                if taxonomy_cat:
                    matched_categories.append(taxonomy_cat)
                    logger.info(f'AI-assigned category "{ai_category}" to project "{project.title}"')

        # Add matched categories to project
        if matched_categories:
            project.categories.add(*matched_categories)
            logger.info(f'Added {len(matched_categories)} categories to project "{project.title}"')
        else:
            # Final fallback: Assign a default category to ensure every article has at least one
            # Try "AI Models & Research" first (most relevant for our tech RSS feeds)
            default_category = Taxonomy.objects.filter(
                taxonomy_type='category', is_active=True, name__iexact='AI Models & Research'
            ).first()

            if not default_category:
                # Last resort: just pick the first active category
                default_category = Taxonomy.objects.filter(taxonomy_type='category', is_active=True).first()

            if default_category:
                project.categories.add(default_category)
                logger.info(f'Assigned default category "{default_category.name}" to project "{project.title}"')
            else:
                logger.warning(f'No categories matched and no default available for project "{project.title}"')

    @classmethod
    def _add_tools_to_project(cls, project: Project, item_data: dict):
        """Extract and add AI tools mentioned in the article.

        Uses a multi-step approach:
        1. Search for exact tool name matches in title/description
        2. If no matches found, use AI to infer relevant tools from taxonomy
        """
        import re

        from core.tools.models import Tool

        # Combine text for searching
        text = f"{item_data.get('title', '')} {item_data.get('description', '')}".lower()

        if not text.strip():
            return

        # Get all active tools
        tools = Tool.objects.filter(is_active=True)
        matched_tools = []

        # Step 1: Try exact name matching
        for tool in tools:
            tool_name_lower = tool.name.lower()

            # Check for word boundary match to avoid false positives
            # e.g., "GPT-4" should match but "script" shouldn't match "JavaScript"
            pattern = r'\b' + re.escape(tool_name_lower) + r'\b'
            if re.search(pattern, text):
                matched_tools.append(tool)
                logger.debug(f'Found tool "{tool.name}" in article "{project.title[:40]}..."')

        # Step 2: If no exact matches, use AI to infer relevant tools
        if not matched_tools:
            ai_tools = cls._extract_tools_with_ai(item_data, tools)
            if ai_tools:
                matched_tools = ai_tools

        if matched_tools:
            project.tools.add(*matched_tools)
            logger.info(
                f'Added {len(matched_tools)} tools to project "{project.title}": ' f'{[t.name for t in matched_tools]}'
            )

    @classmethod
    def _extract_tools_with_ai(cls, item_data: dict, available_tools) -> list:
        """Use AI to extract relevant tools from article content.

        Analyzes the article and suggests tools from the taxonomy that are
        most relevant to the content, even if not explicitly mentioned.

        Args:
            item_data: Article data including title and description
            available_tools: QuerySet of active Tool objects

        Returns:
            List of Tool objects that are relevant to the article
        """
        try:
            from core.tools.models import Tool

            ai = AIProvider(provider='openai')

            # Build tool list with descriptions for better matching
            tool_info = []
            for tool in available_tools[:50]:  # Limit to avoid token overflow
                desc = tool.description[:100] if tool.description else ''
                tool_info.append(f'- {tool.name}: {desc}')

            tool_list = '\n'.join(tool_info)

            system_message = f"""You are an AI content analyzer for a tech/AI learning platform.
Analyze the article and identify which AI tools from our taxonomy are MOST RELEVANT to the content.

Available tools:
{tool_list}

Rules:
1. Select 1-3 tools that are DIRECTLY relevant to the article's topic
2. Only select tools that someone reading this article would likely use or learn about
3. If the article is about a specific AI model/service (like Claude, GPT, etc), include it
4. If the article discusses concepts that relate to specific tool categories, include those tools
5. If NO tools are clearly relevant, respond with "NONE"
6. Be conservative - only select tools with clear relevance

Respond with ONLY the tool names (exactly as written above), separated by commas.
Example: "Claude, ChatGPT" or "Midjourney" or "NONE"
"""

            combined_text = f"""Title: {item_data.get('title', '')}

Description: {item_data.get('description', '')[:800] if item_data.get('description') else 'No description available'}"""

            response = ai.complete(
                prompt=combined_text,
                system_message=system_message,
                temperature=0.3,
                max_tokens=100,
            )

            result = response.strip()

            if result.upper() == 'NONE' or not result:
                logger.info(f'AI found no relevant tools for: {item_data.get("title", "")[:50]}...')
                return []

            # Parse the comma-separated tool names
            tool_names = [name.strip() for name in result.split(',')]
            matched_tools = []

            for name in tool_names:
                # Try exact match first
                tool = Tool.objects.filter(is_active=True, name__iexact=name).first()
                if tool:
                    matched_tools.append(tool)
                    logger.debug(f'AI matched tool "{tool.name}"')

            if matched_tools:
                logger.info(
                    f'AI extracted tools for "{item_data.get("title", "")[:50]}...": '
                    f'{[t.name for t in matched_tools]}'
                )

            return matched_tools

        except Exception as e:
            logger.error(f'Error extracting tools with AI: {e}', exc_info=True)
            return []

    @classmethod
    def _detect_difficulty_level(cls, item_data: dict) -> str:
        """Detect content difficulty level using AI.

        Analyzes the article title and description to determine if the content
        is beginner-friendly, intermediate, or advanced.

        Returns:
            One of: 'beginner', 'intermediate', 'advanced'
        """
        try:
            ai = AIProvider(provider='openai')

            system_message = """You are an AI content difficulty classifier.
Analyze technical content and classify it into one of three difficulty levels:

- **beginner**: Introductory content, minimal prerequisites, basic concepts
- **intermediate**: Some technical knowledge required, moderate complexity
- **advanced**: Deep technical content, research papers, complex implementations, ML/AI theory

Consider:
- Technical jargon and terminology depth
- Mathematical complexity
- Required prerequisite knowledge
- Target audience (general public vs researchers/engineers)

Respond with ONLY ONE WORD: beginner, intermediate, or advanced"""

            combined_text = f"""Title: {item_data['title']}

Description: {item_data.get('description', '')[:500]}"""

            response = ai.complete(
                prompt=combined_text,
                system_message=system_message,
                temperature=0.3,  # Low temperature for consistency
                max_tokens=10,
            )

            # Parse and validate response
            difficulty = response.strip().lower()
            valid_levels = ['beginner', 'intermediate', 'advanced']

            if difficulty in valid_levels:
                logger.info(f'Detected difficulty "{difficulty}" for article: {item_data["title"][:50]}...')
                return difficulty
            else:
                logger.warning(f'Invalid difficulty response "{difficulty}", defaulting to intermediate')
                return 'intermediate'

        except Exception as e:
            logger.error(f'Error detecting difficulty level: {e}', exc_info=True)
            # Default to intermediate if AI fails
            return 'intermediate'

    @classmethod
    def _generate_hero_image(cls, item_data: dict, topics: list[str], visual_style: str | None = None) -> str | None:
        """Generate a unique hero image for the article using Gemini.

        Creates a high-quality, meaningful image that visually represents the article's content.
        Each curator can have their own signature visual style.

        Args:
            item_data: Article data including title
            topics: Extracted topics for the article
            visual_style: Curator's visual style preference (e.g., 'dark_academia', 'cyberpunk')

        Returns:
            Public S3 URL of the generated image, or None if generation fails
        """
        try:
            ai = AIProvider(provider='gemini')

            # Build a creative prompt for the hero image
            title = item_data.get('title', '')

            # Get description for additional context
            description = item_data.get('description', '')[:500]

            # Get curator-specific style prompt or default to cyberpunk
            style_prompt = VISUAL_STYLE_PROMPTS.get(visual_style, VISUAL_STYLE_PROMPTS['cyberpunk'])

            prompt = (
                f"""Create a hero image for this AI/tech article. """
                f"""The image MUST visually represent the article's topic.

ARTICLE: "{title}"
{f'CONTEXT: {description}' if description else ''}

STEP 1 - UNDERSTAND THE TOPIC:
"""
                f"""First, identify what this article is actually about """
                f"""(AI alignment, machine learning, coding, security, etc.) """
                f"""and create imagery that represents THAT topic.

STEP 2 - APPLY VISUAL STYLE:
Render the topic-relevant imagery using this aesthetic:
{style_prompt}

CRITICAL REQUIREMENTS:
"""
                f"""1. The image MUST relate to the article's subject matter - """
                f"""if it's about AI alignment, show AI/neural concepts; """
                f"""if about coding, show code/development concepts
"""
                f"""2. Apply the visual style as an artistic treatment on the topic imagery, """
                f"""not as a replacement for it
3. FORMAT: VERTICAL 9:16 aspect ratio (portrait mode)
"""
                f"""4. AVOID: No text overlays, no human faces, no company logos, """
                f"""no generic library/office scenes unless directly relevant"""
            )

            # Generate image using Gemini
            image_bytes, mime_type, _text = ai.generate_image(prompt=prompt, timeout=120)

            if not image_bytes:
                logger.warning(f'No image generated for article: {title[:50]}...')
                return None

            # Determine file extension from mime type
            ext_map = {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/webp': 'webp',
            }
            extension = ext_map.get(mime_type, 'png')

            # Upload to S3 as public file
            storage = get_storage_service()
            url, error = storage.upload_file(
                file_data=image_bytes,
                filename=f'hero.{extension}',
                content_type=mime_type or 'image/png',
                folder='article-heroes',
                is_public=True,
            )

            if error:
                logger.error(f'Failed to upload hero image: {error}')
                return None

            logger.info(f'Generated hero image for "{title[:40]}...": {url}')
            return url

        except Exception as e:
            logger.error(f'Error generating hero image: {e}', exc_info=True)
            return None

    @classmethod
    def sync_all_active_agents(cls) -> dict:
        """Sync all active RSS feed agents.

        Returns:
            Dictionary with overall sync results
        """
        agents = RSSFeedAgent.objects.filter(status=RSSFeedAgent.Status.ACTIVE)

        total_results = {
            'agents_synced': 0,
            'total_created': 0,
            'total_updated': 0,
            'total_errors': 0,
        }

        for agent in agents:
            results = cls.sync_agent(agent)
            total_results['agents_synced'] += 1
            total_results['total_created'] += results['created']
            total_results['total_updated'] += results['updated']
            total_results['total_errors'] += results['errors']

        return total_results
