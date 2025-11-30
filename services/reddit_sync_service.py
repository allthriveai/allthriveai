"""Service for syncing Reddit threads via RSS feeds."""

import html
import logging
import re
from datetime import datetime
from urllib.parse import urlparse

import defusedxml.ElementTree as ET
import requests
from django.db import transaction
from django.utils import timezone

from core.integrations.reddit_models import RedditCommunityBot, RedditThread
from core.projects.models import Project

logger = logging.getLogger(__name__)


def clean_html(text: str) -> str:
    """Remove HTML tags and decode HTML entities from text."""
    if not text:
        return ''
    # Decode HTML entities first
    text = html.unescape(text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class RedditRSSParser:
    """Parse Reddit Atom/RSS feeds."""

    NAMESPACES = {
        'atom': 'http://www.w3.org/2005/Atom',
        'media': 'http://search.yahoo.com/mrss/',
    }

    @classmethod
    def parse_feed(cls, xml_content: str) -> list[dict]:
        """Parse Reddit RSS/Atom XML and return list of post data.

        Args:
            xml_content: Raw XML content from Reddit RSS feed

        Returns:
            List of dictionaries containing post data
        """
        try:
            root = ET.fromstring(xml_content)
            posts = []

            # Reddit uses Atom format
            for entry in root.findall('atom:entry', cls.NAMESPACES):
                post_data = cls._parse_entry(entry)
                if post_data:
                    posts.append(post_data)

            return posts

        except ET.ParseError as e:
            logger.error(f'Failed to parse Reddit RSS feed: {e}')
            raise

    @classmethod
    def _parse_entry(cls, entry: ET.Element) -> dict | None:
        """Parse a single Atom entry into post data."""
        try:
            # Extract post ID from the id tag (e.g., "t3_1pa4e7t")
            post_id_elem = entry.find('atom:id', cls.NAMESPACES)
            if post_id_elem is None or not post_id_elem.text:
                return None

            # Reddit ID is in format: tag:reddit.com,2005:t3_XXXXX
            post_id_parts = post_id_elem.text.split(':')
            reddit_post_id = post_id_parts[-1] if post_id_parts else None

            if not reddit_post_id:
                return None

            # Get title
            title_elem = entry.find('atom:title', cls.NAMESPACES)
            title = title_elem.text if title_elem is not None else 'Untitled'

            # Get author
            author_elem = entry.find('atom:author/atom:name', cls.NAMESPACES)
            author = author_elem.text if author_elem is not None else '[deleted]'

            # Get link/permalink
            link_elem = entry.find('atom:link[@href]', cls.NAMESPACES)
            permalink = link_elem.get('href') if link_elem is not None else ''

            # Get content/body - but for Reddit, the content is messy HTML
            # We'll just use a simple message instead
            content = f'Discussion thread from r/{cls._extract_subreddit_from_url(permalink)} by {author}'

            # Get published date
            published_elem = entry.find('atom:published', cls.NAMESPACES)
            published_utc = None
            if published_elem is not None and published_elem.text:
                try:
                    # Parse ISO 8601 format: 2025-11-30T00:30:13+00:00
                    published_utc = datetime.fromisoformat(published_elem.text.replace('Z', '+00:00'))
                    if timezone.is_naive(published_utc):
                        published_utc = timezone.make_aware(published_utc)
                except ValueError as e:
                    logger.warning(f'Failed to parse published date: {e}')

            # Get thumbnail
            thumbnail_elem = entry.find('media:thumbnail', cls.NAMESPACES)
            thumbnail_url = thumbnail_elem.get('url') if thumbnail_elem is not None else ''

            # Extract subreddit from permalink
            subreddit = cls._extract_subreddit_from_url(permalink)

            return {
                'reddit_post_id': reddit_post_id,
                'title': title,
                'author': author,
                'permalink': permalink,
                'content': content,
                'published_utc': published_utc,
                'thumbnail_url': thumbnail_url,
                'subreddit': subreddit,
            }

        except Exception as e:
            logger.error(f'Error parsing entry: {e}', exc_info=True)
            return None

    @staticmethod
    def _extract_subreddit_from_url(url: str) -> str:
        """Extract subreddit name from Reddit URL."""
        try:
            parsed = urlparse(url)
            path_parts = parsed.path.split('/')
            # URL format: /r/subreddit/comments/...
            if len(path_parts) >= 3 and path_parts[1] == 'r':
                return path_parts[2]
        except Exception as e:
            logger.warning(f'Failed to extract subreddit from URL {url}: {e}')
        return ''


class RedditSyncService:
    """Service for syncing Reddit threads from RSS feeds."""

    USER_AGENT = 'Mozilla/5.0 (compatible; AllThrive/1.0; +https://allthrive.ai)'

    @classmethod
    def sync_bot(cls, bot: RedditCommunityBot, full_sync: bool = False) -> dict:
        """Sync a single Reddit bot's threads.

        Args:
            bot: RedditCommunityBot instance
            full_sync: If True, process all posts; if False, only new ones

        Returns:
            Dict with sync results: created, updated, errors
        """
        logger.info(f'Starting sync for bot: {bot.name} (r/{bot.subreddit})')

        results = {
            'created': 0,
            'updated': 0,
            'errors': 0,
            'error_messages': [],
        }

        try:
            # Fetch RSS feed
            feed_url = bot.rss_feed_url
            logger.debug(f'Fetching RSS feed: {feed_url}')

            response = requests.get(
                feed_url,
                headers={'User-Agent': cls.USER_AGENT},
                timeout=30,
            )
            response.raise_for_status()

            # Parse feed
            posts = RedditRSSParser.parse_feed(response.text)
            logger.info(f'Found {len(posts)} posts in feed for r/{bot.subreddit}')

            # Note: RSS doesn't provide score/comments, so we can't filter here
            # We store all posts and let users filter in the UI

            # Process each post
            for post_data in posts:
                try:
                    # Skip posts that don't meet minimum thresholds
                    # Note: RSS doesn't give us score/comments, so we can't filter here
                    # We'll store all and let users filter in the UI, or we'd need API access

                    created, updated = cls._process_post(bot, post_data)
                    if created:
                        results['created'] += 1
                    elif updated:
                        results['updated'] += 1
                except Exception as e:
                    logger.error(f'Error processing post {post_data.get("reddit_post_id")}: {e}', exc_info=True)
                    results['errors'] += 1
                    results['error_messages'].append(str(e))

            # Update bot sync status
            bot.last_synced_at = timezone.now()
            bot.last_sync_status = f'Success: {results["created"]} created, {results["updated"]} updated'
            if results['errors'] > 0:
                bot.status = RedditCommunityBot.Status.ERROR
                bot.last_sync_error = f'{results["errors"]} errors occurred'
            else:
                bot.status = RedditCommunityBot.Status.ACTIVE
                bot.last_sync_error = ''
            bot.save()

            logger.info(f'Sync complete for {bot.name}: {results}')

        except requests.RequestException as e:
            logger.error(f'Failed to fetch RSS feed for {bot.name}: {e}')
            bot.status = RedditCommunityBot.Status.ERROR
            bot.last_sync_error = f'RSS fetch failed: {str(e)}'
            bot.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        except Exception as e:
            logger.error(f'Unexpected error syncing {bot.name}: {e}', exc_info=True)
            bot.status = RedditCommunityBot.Status.ERROR
            bot.last_sync_error = f'Sync failed: {str(e)}'
            bot.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        return results

    @classmethod
    @transaction.atomic
    def _process_post(cls, bot: RedditCommunityBot, post_data: dict) -> tuple[bool, bool]:
        """Process a single Reddit post: create or update thread/project.

        Returns:
            Tuple of (created, updated) booleans
        """
        reddit_post_id = post_data['reddit_post_id']

        # Check if thread already exists
        try:
            thread = RedditThread.objects.select_related('project').get(reddit_post_id=reddit_post_id)
            # Update existing thread
            cls._update_thread(thread, post_data)
            return False, True

        except RedditThread.DoesNotExist:
            # Create new thread + project
            cls._create_thread(bot, post_data)
            return True, False

    @classmethod
    def _create_thread(cls, bot: RedditCommunityBot, post_data: dict):
        """Create a new Project and RedditThread."""
        # Create project
        project = Project.objects.create(
            user=bot.bot_user,
            title=post_data['title'],
            description=post_data['content'][:5000] if post_data['content'] else '',  # Truncate if too long
            type=Project.ProjectType.REDDIT_THREAD,
            external_url=post_data['permalink'],
            featured_image_url=post_data['thumbnail_url'],
            is_showcase=True,
            is_published=True,
            is_private=False,
        )

        # Prepare metadata (convert datetime to string for JSON storage)
        metadata = post_data.copy()
        if metadata.get('published_utc'):
            metadata['published_utc'] = metadata['published_utc'].isoformat()

        # Create Reddit thread metadata
        RedditThread.objects.create(
            project=project,
            bot=bot,
            reddit_post_id=post_data['reddit_post_id'],
            subreddit=post_data['subreddit'] or bot.subreddit,
            author=post_data['author'],
            permalink=post_data['permalink'],
            score=0,  # RSS doesn't provide score directly
            num_comments=0,  # RSS doesn't provide comment count directly
            thumbnail_url=post_data['thumbnail_url'],
            created_utc=post_data['published_utc'] or timezone.now(),
            reddit_metadata=metadata,
        )

        logger.info(f'Created new thread: {project.slug} (r/{post_data["subreddit"]})')

    @classmethod
    def _update_thread(cls, thread: RedditThread, post_data: dict):
        """Update existing RedditThread with fresh data."""
        # Update project fields that might change
        project = thread.project
        project.featured_image_url = post_data['thumbnail_url']
        project.save(update_fields=['featured_image_url'])

        # Prepare metadata (convert datetime to string for JSON storage)
        metadata = post_data.copy()
        if metadata.get('published_utc'):
            metadata['published_utc'] = metadata['published_utc'].isoformat()

        # Update thread metadata
        thread.thumbnail_url = post_data['thumbnail_url']
        thread.reddit_metadata = metadata
        thread.save(update_fields=['thumbnail_url', 'reddit_metadata', 'last_synced_at'])

        logger.debug(f'Updated thread: {thread.reddit_post_id}')

    @classmethod
    def sync_all_active_bots(cls) -> dict:
        """Sync all active Reddit bots.

        Returns:
            Dict with overall sync statistics
        """
        active_bots = RedditCommunityBot.objects.filter(status=RedditCommunityBot.Status.ACTIVE)

        overall_results = {
            'bots_synced': 0,
            'total_created': 0,
            'total_updated': 0,
            'total_errors': 0,
        }

        for bot in active_bots:
            results = cls.sync_bot(bot)
            overall_results['bots_synced'] += 1
            overall_results['total_created'] += results['created']
            overall_results['total_updated'] += results['updated']
            overall_results['total_errors'] += results['errors']

        logger.info(f'Synced {overall_results["bots_synced"]} bots: {overall_results}')
        return overall_results
