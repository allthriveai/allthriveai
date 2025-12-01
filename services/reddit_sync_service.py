"""Service for syncing Reddit threads via RSS feeds."""

import html as html_module
import logging
import re
from datetime import datetime
from urllib.parse import urlparse
from xml.etree.ElementTree import Element

import defusedxml.ElementTree as ET
import requests
from django.db import transaction
from django.utils import timezone

from core.integrations.reddit_models import RedditCommunityBot, RedditThread
from core.projects.models import Project
from services.moderation import ContentModerator, ImageModerator

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
    def _parse_entry(cls, entry: Element) -> dict | None:
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
    def _moderate_content(
        cls, title: str, selftext: str, image_url: str, subreddit: str
    ) -> tuple[bool, str, dict]:
        """Moderate Reddit post content (text and image).

        Args:
            title: Post title
            selftext: Post body text
            image_url: URL of post image/thumbnail
            subreddit: Subreddit name for context

        Returns:
            Tuple of (approved, reason, moderation_data)
        """
        moderation_results = {'text': None, 'image': None}
        context = f'Reddit post from r/{subreddit}'

        # 1. Moderate text content (title + selftext)
        text_moderator = ContentModerator()
        combined_text = f'{title}\n\n{selftext}' if selftext else title

        text_result = text_moderator.moderate(combined_text, context=context)
        moderation_results['text'] = text_result

        if not text_result['approved']:
            logger.info(
                f'Reddit post text rejected by moderation: '
                f'subreddit=r/{subreddit}, reason={text_result["reason"]}'
            )
            return False, text_result['reason'], moderation_results

        # 2. Moderate image if present
        if image_url and image_url not in ['self', 'default', 'nsfw', 'spoiler']:
            image_moderator = ImageModerator()
            image_result = image_moderator.moderate_image(image_url, context=context)
            moderation_results['image'] = image_result

            if not image_result['approved']:
                logger.info(
                    f'Reddit post image rejected by moderation: '
                    f'subreddit=r/{subreddit}, reason={image_result["reason"]}, url={image_url}'
                )
                return False, image_result['reason'], moderation_results

        # All checks passed
        return True, 'Content approved', moderation_results

    @classmethod
    def fetch_post_metrics(cls, permalink: str) -> dict:
        """Fetch score, comment count, and full-size image from Reddit's JSON API.

        Reddit provides a .json endpoint for every post without authentication.
        Example: https://reddit.com/r/subreddit/comments/id/title.json

        Returns:
            Dict with 'score', 'num_comments', and 'image_url' (or defaults)
        """
        try:
            # Reddit has a .json endpoint for every post
            json_url = permalink.rstrip('/') + '.json'

            response = requests.get(
                json_url,
                headers={'User-Agent': cls.USER_AGENT},
                timeout=10,
            )
            response.raise_for_status()

            data = response.json()
            # Reddit returns an array with [post_data, comments_data]
            post_data = data[0]['data']['children'][0]['data']

            # Try to get full-size image
            image_url = ''

            # Check for preview images (most common)
            if 'preview' in post_data and 'images' in post_data['preview']:
                images = post_data['preview']['images']
                if images and len(images) > 0:
                    # Get the highest resolution image
                    source = images[0].get('source', {})
                    image_url = source.get('url', '')
                    # Reddit HTML-encodes the URLs, decode them
                    if image_url:
                        image_url = image_url.replace('&amp;', '&')

            # Fallback to url_overridden_by_dest (for direct image links)
            if not image_url and 'url_overridden_by_dest' in post_data:
                url = post_data['url_overridden_by_dest']
                # Check if it's an image URL
                if any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                    image_url = url

            # Fallback to thumbnail if no better option
            if not image_url:
                thumbnail = post_data.get('thumbnail', '')
                if thumbnail and thumbnail not in ['self', 'default', 'nsfw', 'spoiler']:
                    image_url = thumbnail

            # Extract video data if available
            video_url = ''
            video_duration = 0
            if 'secure_media' in post_data and post_data['secure_media']:
                reddit_video = post_data['secure_media'].get('reddit_video', {})
                if reddit_video:
                    video_url = reddit_video.get('fallback_url', '')
                    video_duration = reddit_video.get('duration', 0)

            # Extract gallery data if available
            gallery_images = []
            if 'gallery_data' in post_data and 'media_metadata' in post_data:
                gallery_data = post_data['gallery_data'].get('items', [])
                media_metadata = post_data['media_metadata']

                for item in gallery_data:
                    media_id = item.get('media_id')
                    if media_id and media_id in media_metadata:
                        media = media_metadata[media_id]
                        if 's' in media:  # 's' contains the source image
                            img_url = media['s'].get('u', '') or media['s'].get('gif', '')
                            if img_url:
                                gallery_images.append(img_url.replace('&amp;', '&'))

            # Decode HTML entities in selftext_html
            selftext_html = post_data.get('selftext_html', '')
            if selftext_html:
                selftext_html = html_module.unescape(selftext_html)

            return {
                'score': post_data.get('score', 0),
                'num_comments': post_data.get('num_comments', 0),
                'upvote_ratio': post_data.get('upvote_ratio', 0),
                'image_url': image_url,
                'selftext': post_data.get('selftext', ''),
                'selftext_html': selftext_html,
                'post_hint': post_data.get('post_hint', ''),
                'link_flair_text': post_data.get('link_flair_text', ''),
                'link_flair_background_color': post_data.get('link_flair_background_color', ''),
                'is_video': post_data.get('is_video', False),
                'video_url': video_url,
                'video_duration': video_duration,
                'is_gallery': bool(gallery_images),
                'gallery_images': gallery_images,
                'domain': post_data.get('domain', ''),
                'url': post_data.get('url', ''),
                'over_18': post_data.get('over_18', False),
                'spoiler': post_data.get('spoiler', False),
            }
        except Exception as e:
            logger.warning(f'Failed to fetch metrics for {permalink}: {e}')
            return {
                'score': 0,
                'num_comments': 0,
                'upvote_ratio': 0,
                'image_url': '',
                'selftext': '',
                'selftext_html': '',
                'post_hint': '',
                'link_flair_text': '',
                'link_flair_background_color': '',
                'is_video': False,
                'video_url': '',
                'video_duration': 0,
                'is_gallery': False,
                'gallery_images': [],
                'domain': '',
                'url': '',
                'over_18': False,
                'spoiler': False,
            }

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
    def _auto_tag_project(cls, project: Project, metrics: dict, subreddit: str, bot: RedditCommunityBot):
        """Automatically tag a Reddit project with tools, categories, and topics."""
        from core.taxonomy.models import Taxonomy
        from core.tools.models import Tool

        # Extract topics from link flair and subreddit
        topics = []

        # Add subreddit as a topic
        if subreddit:
            topics.append(subreddit.lower())

        # Get default tools from bot settings
        default_tool_slugs = bot.settings.get('default_tools', [])
        detected_tools = []

        # Add default tools from bot settings first
        for tool_slug in default_tool_slugs:
            try:
                tool = Tool.objects.filter(slug=tool_slug).first()
                if tool and tool not in detected_tools:
                    detected_tools.append(tool)
                    # Also add tool name as topic
                    topics.append(tool.name.lower())
            except Exception as e:
                logger.debug(f'Error adding default tool {tool_slug}: {e}')

        # Add link flair as topic if available
        link_flair = metrics.get('link_flair_text', '')
        if link_flair and link_flair.lower() not in ['discussion', 'question', 'showcase']:
            topics.append(link_flair.lower())

        # Try to identify additional tools mentioned in title/selftext (if not already added)
        text_to_analyze = (project.title + ' ' + metrics.get('selftext', '')).lower()

        # Common AI tools to look for
        tool_keywords = {
            'claude': 'claude',
            'chatgpt': 'chatgpt',
            'gpt-4': 'gpt-4',
            'copilot': 'github-copilot',
            'midjourney': 'midjourney',
            'stable diffusion': 'stable-diffusion',
            'dall-e': 'dall-e',
            'langchain': 'langchain',
            'openai': 'openai',
            'anthropic': 'claude',
        }

        for keyword, tool_slug in tool_keywords.items():
            if keyword in text_to_analyze:
                try:
                    tool = Tool.objects.filter(slug=tool_slug).first()
                    if tool and tool not in detected_tools:
                        detected_tools.append(tool)
                        if keyword not in topics:
                            topics.append(keyword)
                except Exception as e:
                    logger.debug(f'Error detecting tool {tool_slug}: {e}')

        # Assign tools to project
        if detected_tools:
            project.tools.set(detected_tools)

        # Add default categories from bot settings first
        default_category_slugs = bot.settings.get('default_categories', [])
        for cat_slug in default_category_slugs:
            try:
                category = Taxonomy.objects.filter(slug=cat_slug, taxonomy_type='category').first()
                if category:
                    project.categories.add(category)
            except Exception as e:
                logger.debug(f'Error adding default category {cat_slug}: {e}')

        # Try to assign category based on flair or content
        category_mapping = {
            'showcase': 'showcase',  # Try 'showcase' category first
            'question': 'ai-learning',
            'tutorial': 'ai-learning',
            'discussion': 'ai-discussion',
            'help': 'ai-learning',
            'news': 'ai-news',
            'project': 'showcase',
        }

        category_slug = None
        if link_flair:
            category_slug = category_mapping.get(link_flair.lower())

        if category_slug:
            try:
                category = Taxonomy.objects.filter(slug=category_slug, taxonomy_type='category').first()
                if category:
                    project.categories.add(category)
            except Exception as e:
                logger.debug(f'Error assigning category {category_slug}: {e}')

        # Clean and assign topics (limit to 10)
        topics = list(set(topics))[:10]  # Remove duplicates and limit
        project.topics = topics
        project.save()

    @classmethod
    def _create_thread(cls, bot: RedditCommunityBot, post_data: dict):
        """Create a new Project and RedditThread."""
        # Fetch current metrics (score, comments, full-size image) from Reddit
        metrics = cls.fetch_post_metrics(post_data['permalink'])

        # Check if post meets minimum score threshold from bot settings
        min_score = bot.settings.get('min_score', 0)
        if metrics['score'] < min_score:
            logger.info(
                f'Skipping post {post_data["reddit_post_id"]} - score {metrics["score"]} below minimum {min_score}'
            )
            return  # Skip this post

        # Skip NSFW content marked by Reddit
        if metrics.get('over_18', False):
            logger.info(
                f'Skipping post {post_data["reddit_post_id"]} - marked as NSFW (over_18) by Reddit'
            )
            return  # Skip NSFW posts

        # Moderate content (text + image) before creating
        image_url = post_data['thumbnail_url']
        if metrics.get('is_gallery') and metrics.get('gallery_images'):
            image_url = metrics['gallery_images'][0]
        elif metrics.get('image_url'):
            image_url = metrics['image_url']

        approved, reason, moderation_data = cls._moderate_content(
            title=post_data['title'],
            selftext=metrics.get('selftext', ''),
            image_url=image_url,
            subreddit=post_data.get('subreddit', ''),
        )

        if not approved:
            logger.warning(
                f'Skipping post {post_data["reddit_post_id"]} - failed moderation: {reason}'
            )
            return  # Skip posts that fail moderation

        # Prioritize gallery images, then full-size image, then RSS thumbnail
        image_url = post_data['thumbnail_url']
        if metrics.get('is_gallery') and metrics.get('gallery_images'):
            image_url = metrics['gallery_images'][0]  # Use first gallery image
        elif metrics.get('image_url'):
            image_url = metrics['image_url']

        # Create project
        project = Project.objects.create(
            user=bot.bot_user,
            title=post_data['title'],
            description=post_data['content'][:5000] if post_data['content'] else '',  # Truncate if too long
            type=Project.ProjectType.REDDIT_THREAD,
            external_url=post_data['permalink'],
            featured_image_url=image_url,
            is_showcase=True,
            is_published=True,
            is_private=False,
        )

        # Auto-tag the project
        cls._auto_tag_project(project, metrics, post_data.get('subreddit', ''), bot)

        # Prepare metadata with all Reddit data
        metadata = {
            **post_data,
            **metrics,  # Include all metrics data (selftext, video, gallery, etc.)
        }
        # Convert datetime to string for JSON storage
        if metadata.get('published_utc'):
            metadata['published_utc'] = metadata['published_utc'].isoformat()

        # Create Reddit thread metadata with fetched metrics and moderation data
        RedditThread.objects.create(
            project=project,
            bot=bot,
            reddit_post_id=post_data['reddit_post_id'],
            subreddit=post_data['subreddit'] or bot.subreddit,
            author=post_data['author'],
            permalink=post_data['permalink'],
            score=metrics['score'],
            num_comments=metrics['num_comments'],
            thumbnail_url=image_url,
            created_utc=post_data['published_utc'] or timezone.now(),
            reddit_metadata=metadata,
            moderation_status=RedditThread.ModerationStatus.APPROVED,
            moderation_reason=reason,
            moderation_data=moderation_data,
            moderated_at=timezone.now(),
        )

        logger.info(
            f'Created new thread: {project.slug} (r/{post_data["subreddit"]}) - '
            f'{metrics["score"]} score, {metrics["num_comments"]} comments'
        )

    @classmethod
    def _update_thread(cls, thread: RedditThread, post_data: dict):
        """Update existing RedditThread with fresh data."""
        # Fetch current metrics (score, comments, full-size image) from Reddit
        metrics = cls.fetch_post_metrics(post_data['permalink'])

        # Prioritize gallery images, then full-size image, then RSS thumbnail
        image_url = post_data['thumbnail_url']
        if metrics.get('is_gallery') and metrics.get('gallery_images'):
            image_url = metrics['gallery_images'][0]  # Use first gallery image
        elif metrics.get('image_url'):
            image_url = metrics['image_url']

        # Update project fields that might change
        project = thread.project
        project.featured_image_url = image_url
        project.save(update_fields=['featured_image_url'])

        # Update tags if project doesn't have any yet
        if not project.tools.exists() and not project.topics:
            cls._auto_tag_project(project, metrics, post_data.get('subreddit', ''), thread.bot)

        # Prepare metadata with all Reddit data
        metadata = {
            **post_data,
            **metrics,  # Include all metrics data (selftext, video, gallery, etc.)
        }
        # Convert datetime to string for JSON storage
        if metadata.get('published_utc'):
            metadata['published_utc'] = metadata['published_utc'].isoformat()

        # Update thread metadata with refreshed metrics
        thread.thumbnail_url = image_url
        thread.score = metrics['score']
        thread.num_comments = metrics['num_comments']
        thread.reddit_metadata = metadata
        thread.save(update_fields=['thumbnail_url', 'score', 'num_comments', 'reddit_metadata', 'last_synced_at'])

        logger.debug(
            f'Updated thread: {thread.reddit_post_id} - {metrics["score"]} score, {metrics["num_comments"]} comments'
        )

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
