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

logger = logging.getLogger(__name__)


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
        """Create a new RSS feed item and project."""
        with transaction.atomic():
            # Build content structure for RSS article
            content = cls._build_rss_article_content(item_data, agent)

            # Extract topics from article content
            topics = cls._extract_topics_from_article(item_data)

            # Detect difficulty level
            difficulty = cls._detect_difficulty_level(item_data)

            # Create project
            project = Project.objects.create(
                user=agent.agent_user,
                title=item_data['title'],
                description=item_data['description'][:500] if item_data['description'] else '',
                type=Project.ProjectType.RSS_ARTICLE,
                external_url=item_data['permalink'],
                featured_image_url=item_data['thumbnail_url'],
                content=content,
                topics=topics,
                difficulty_level=difficulty,
                is_showcased=True,
                is_private=False,
            )
            project.ensure_unique_slug()
            project.save()

            # Add categories from RSS feed categories (if they exist in taxonomy)
            if item_data.get('categories'):
                cls._add_categories_to_project(project, item_data['categories'])

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

        if item_data['thumbnail_url'] and project.featured_image_url != item_data['thumbnail_url']:
            project.featured_image_url = item_data['thumbnail_url']
            updated = True

        # Update content structure if empty or content changed
        if not project.content or not project.content.get('sections'):
            project.content = cls._build_rss_article_content(item_data, agent)
            updated = True

        # Update topics if empty
        if not project.topics:
            topics = cls._extract_topics_from_article(item_data)
            project.topics = topics
            updated = True

            # Add categories if not already set
            if item_data.get('categories') and not project.categories.exists():
                cls._add_categories_to_project(project, item_data['categories'])

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
    def _build_rss_article_content(cls, item_data: dict, agent: RSSFeedAgent) -> dict:
        """Build structured content for RSS article project.

        Creates a rich project page with sections for overview, image, and link back to source.
        """
        import uuid

        sections = []

        # 1. Overview Section
        overview_section = {
            'id': str(uuid.uuid4()),
            'type': 'overview',
            'enabled': True,
            'order': 0,
            'content': {
                'headline': item_data['title'],
                'description': item_data['description'] or '',
                'metrics': [],
            },
        }

        # Add publish date and author as metrics if available
        if item_data.get('published_at'):
            overview_section['content']['metrics'].append(
                {'icon': 'clock', 'label': 'Published', 'value': format_article_date(item_data['published_at'])}
            )

        if item_data.get('author'):
            overview_section['content']['metrics'].append(
                {'icon': 'user', 'label': 'Author', 'value': item_data['author']}
            )

        # Add preview image if available
        if item_data.get('thumbnail_url'):
            overview_section['content']['previewImage'] = item_data['thumbnail_url']

        sections.append(overview_section)

        # 2. Links Section - Prominent CTA to read full article
        links_section = {
            'id': str(uuid.uuid4()),
            'type': 'links',
            'enabled': True,
            'order': 1,
            'content': {
                'links': [
                    {
                        'label': 'Read Full Article',
                        'url': item_data['permalink'],
                        'icon': 'external',
                        'description': f'Read the complete article on {agent.source_name}',
                    }
                ]
            },
        }
        sections.append(links_section)

        # 3. Custom Section - Additional metadata (categories, tags)
        if item_data.get('categories'):
            custom_blocks = []

            # Add categories/tags as a text block
            tags_text = ', '.join([f'`{cat}`' for cat in item_data['categories']])
            custom_blocks.append({'id': str(uuid.uuid4()), 'type': 'text', 'content': f'**Topics:** {tags_text}'})

            custom_section = {
                'id': str(uuid.uuid4()),
                'type': 'custom',
                'enabled': True,
                'order': 2,
                'content': {'title': 'Article Info', 'blocks': custom_blocks},
            }
            sections.append(custom_section)

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
    def _add_categories_to_project(cls, project: Project, rss_categories: list[str]):
        """Match RSS categories to existing Taxonomy categories and add them to project."""
        if not rss_categories:
            return

        # Try to match RSS categories to existing taxonomy categories
        matched_categories = []
        for rss_cat in rss_categories:
            # Case-insensitive match
            taxonomy_cat = Taxonomy.objects.filter(
                taxonomy_type='category', is_active=True, name__iexact=rss_cat
            ).first()

            if taxonomy_cat:
                matched_categories.append(taxonomy_cat)
                logger.debug(f'Matched RSS category "{rss_cat}" to taxonomy "{taxonomy_cat.name}"')

        if matched_categories:
            project.categories.add(*matched_categories)
            logger.info(f'Added {len(matched_categories)} categories to project "{project.title}"')

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
