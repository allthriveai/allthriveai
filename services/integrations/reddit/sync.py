"""Service for syncing Reddit threads via RSS feeds."""

import html as html_module
import logging
import re
import time
from datetime import datetime
from urllib.parse import urlparse
from xml.etree.ElementTree import Element

import defusedxml.ElementTree as ET
import requests
from django.db import transaction
from django.utils import timezone

from core.integrations.reddit_models import RedditCommunityAgent, RedditThread
from core.projects.models import Project
from services.agents.moderation import ContentModerator, ImageModerator
from services.integrations.reddit.video_downloader import RedditVideoDownloader

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

    # Subreddits that require stricter moderation
    STRICT_MODERATION_SUBREDDITS = [
        'chatgpt',  # Frequently has NSFW "jailbreak" posts
        'openai',
        'artificialintelligence',
        'chatgptprompts',
    ]

    # Rate limiting settings - Reddit allows 100 requests per minute
    # We use conservative delays to avoid hitting rate limits
    RATE_LIMIT_DELAY = 1.0  # Delay between individual requests in seconds
    AGENT_SYNC_DELAY = 10.0  # Delay between syncing different agents
    MAX_RETRIES = 3  # Maximum number of retry attempts
    RETRY_BACKOFF = 30.0  # Initial backoff time for retries in seconds (rate limit resets in ~60s)

    @classmethod
    def _moderate_content(cls, title: str, selftext: str, image_url: str, subreddit: str) -> tuple[bool, str, dict]:
        """Moderate Reddit post content (text and image).

        Args:
            title: Post title
            selftext: Post body text
            image_url: URL of post image/thumbnail
            subreddit: Subreddit name for context

        Returns:
            Tuple of (approved, reason, moderation_data)
        """
        from services.agents.moderation.keyword_filter import KeywordFilter

        moderation_results = {'text': None, 'image': None, 'keyword': None}
        context = f'Reddit post from r/{subreddit}'
        combined_text = f'{title}\n\n{selftext}' if selftext else title

        # 0. Fast keyword filter check (runs locally, no API calls)
        # Use strict mode for subreddits known to have problematic content
        strict_mode = subreddit.lower() in [s.lower() for s in cls.STRICT_MODERATION_SUBREDDITS]
        keyword_filter = KeywordFilter(strict_mode=strict_mode)
        keyword_result = keyword_filter.check(combined_text, context=context)
        moderation_results['keyword'] = keyword_result

        if keyword_result['flagged']:
            logger.info(
                f'Reddit post rejected by keyword filter: '
                f'subreddit=r/{subreddit}, reason={keyword_result["reason"]}, '
                f'matched={len(keyword_result["matched_keywords"])} terms'
            )
            return False, keyword_result['reason'], moderation_results

        # 1. Moderate text content (title + selftext)
        text_moderator = ContentModerator()

        text_result = text_moderator.moderate(combined_text, context=context)
        moderation_results['text'] = text_result

        if not text_result['approved']:
            logger.info(
                f'Reddit post text rejected by moderation: subreddit=r/{subreddit}, reason={text_result["reason"]}'
            )
            return False, text_result['reason'], moderation_results

        # 2. Moderate image if present
        if image_url and image_url not in ['self', 'default', 'nsfw', 'spoiler']:
            image_moderator = ImageModerator()
            image_result = image_moderator.moderate_image(image_url, context=context)
            moderation_results['image'] = image_result

            if not image_result['approved']:
                # Only block if it's a true content issue, not an API/system error
                if image_result.get('skipped') or 'error' in image_result:
                    logger.warning(
                        f'Image moderation unavailable for r/{subreddit} post, allowing post: '
                        f'reason={image_result["reason"]}, url={image_url}'
                    )
                    # Continue with post creation despite moderation error
                else:
                    logger.info(
                        f'Reddit post image rejected by moderation: '
                        f'subreddit=r/{subreddit}, reason={image_result["reason"]}, url={image_url}'
                    )
                    return False, image_result['reason'], moderation_results

        # All checks passed
        return True, 'Content approved', moderation_results

    @classmethod
    def _make_reddit_request(cls, url: str, timeout: int = 30) -> requests.Response:
        """Make a rate-limited request to Reddit with exponential backoff retry.

        Args:
            url: The URL to fetch
            timeout: Request timeout in seconds

        Returns:
            Response object

        Raises:
            requests.RequestException: If all retry attempts fail
        """
        last_exception = None
        backoff_time = cls.RETRY_BACKOFF

        for attempt in range(cls.MAX_RETRIES):
            try:
                # Add delay before request (except first attempt)
                if attempt > 0:
                    logger.info(f'Retry attempt {attempt + 1}/{cls.MAX_RETRIES} after {backoff_time}s backoff')
                    time.sleep(backoff_time)
                else:
                    # Always add base rate limit delay
                    time.sleep(cls.RATE_LIMIT_DELAY)

                response = requests.get(
                    url,
                    headers={'User-Agent': cls.USER_AGENT},
                    timeout=timeout,
                )
                response.raise_for_status()
                return response

            except requests.exceptions.HTTPError as e:
                last_exception = e
                if e.response.status_code == 429:  # Rate limit
                    # Check for Retry-After header
                    retry_after = e.response.headers.get('Retry-After')
                    if retry_after:
                        try:
                            backoff_time = float(retry_after)
                        except ValueError:
                            pass
                    logger.warning(f'Rate limited (429) on attempt {attempt + 1}, backing off for {backoff_time}s')
                    # Exponential backoff for next attempt
                    backoff_time *= 2
                elif 500 <= e.response.status_code < 600:  # Server error
                    logger.warning(f'Server error {e.response.status_code} on attempt {attempt + 1}')
                    backoff_time *= 1.5
                else:
                    # For other HTTP errors, don't retry
                    raise

            except requests.exceptions.RequestException as e:
                last_exception = e
                logger.warning(f'Request failed on attempt {attempt + 1}: {e}')
                backoff_time *= 1.5

        # All retries exhausted
        logger.error(f'All {cls.MAX_RETRIES} retry attempts failed for {url}')
        raise last_exception

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

            response = cls._make_reddit_request(json_url, timeout=10)

            data = response.json()
            # Reddit returns an array with [post_data, comments_data]
            post_data = data[0]['data']['children'][0]['data']

            # Try to get full-size image
            image_url = ''

            # Check for preview images (most common)
            if 'preview' in post_data and 'images' in post_data['preview']:
                images = post_data['preview']['images']
                if images and len(images) > 0:
                    # Get the highest resolution image from source (full size)
                    source = images[0].get('source', {})
                    image_url = source.get('url', '')
                    source_width = source.get('width', 0)
                    source_height = source.get('height', 0)

                    # If source is available, use it (highest res)
                    # Otherwise, get the highest resolution from resolutions array
                    if not image_url:
                        resolutions = images[0].get('resolutions', [])
                        if resolutions:
                            # Resolutions are sorted by size, last one is largest
                            best_res = resolutions[-1]
                            image_url = best_res.get('url', '')
                            source_width = best_res.get('width', 0)
                            source_height = best_res.get('height', 0)

                    # Reddit HTML-encodes the URLs, decode them
                    if image_url:
                        image_url = image_url.replace('&amp;', '&')
                        logger.debug(f'Found preview image: {source_width}x{source_height} for {permalink}')

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
    def sync_agent(cls, agent: RedditCommunityAgent, full_sync: bool = False) -> dict:
        """Sync a single Reddit agent's threads.

        Args:
            agent: RedditCommunityAgent instance
            full_sync: If True, process all posts; if False, only new ones

        Returns:
            Dict with sync results: created, updated, errors
        """
        logger.info(f'Starting sync for agent: {agent.name} (r/{agent.subreddit})')

        results = {
            'created': 0,
            'updated': 0,
            'errors': 0,
            'error_messages': [],
        }

        try:
            # Fetch RSS feed with rate limiting and retry logic
            feed_url = agent.rss_feed_url
            logger.debug(f'Fetching RSS feed: {feed_url}')

            response = cls._make_reddit_request(feed_url, timeout=30)

            # Parse feed
            posts = RedditRSSParser.parse_feed(response.text)
            logger.info(f'Found {len(posts)} posts in feed for r/{agent.subreddit}')

            # Filter posts to only process new ones since last sync
            posts_to_process = []
            cutoff_time = agent.last_synced_at

            for post_data in posts:
                post_published = post_data.get('published_utc')
                # Include post if:
                # 1. No last sync (first time), OR
                # 2. Post was published after last sync time, OR
                # 3. Post doesn't have a timestamp (include to be safe)
                if not cutoff_time or not post_published or post_published > cutoff_time:
                    posts_to_process.append(post_data)
                else:
                    logger.debug(f'Skipping post {post_data.get("reddit_post_id")} - older than last sync')

            logger.info(
                f'Filtered to {len(posts_to_process)} new posts (from {len(posts)} total) for r/{agent.subreddit}'
            )

            # Process each post
            for post_data in posts_to_process:
                try:
                    # Skip posts that don't meet minimum thresholds
                    # Note: RSS doesn't give us score/comments, so we can't filter here
                    # We'll store all and let users filter in the UI, or we'd need API access

                    created, updated = cls._process_post(agent, post_data)
                    if created:
                        results['created'] += 1
                    elif updated:
                        results['updated'] += 1
                except Exception as e:
                    logger.error(f'Error processing post {post_data.get("reddit_post_id")}: {e}', exc_info=True)
                    results['errors'] += 1
                    results['error_messages'].append(str(e))

            # Update agent sync status
            agent.last_synced_at = timezone.now()
            agent.last_sync_status = f'Success: {results["created"]} created, {results["updated"]} updated'
            if results['errors'] > 0:
                agent.status = RedditCommunityAgent.Status.ERROR
                agent.last_sync_error = f'{results["errors"]} errors occurred'
            else:
                agent.status = RedditCommunityAgent.Status.ACTIVE
                agent.last_sync_error = ''
            agent.save()

            logger.info(f'Sync complete for {agent.name}: {results}')

        except requests.RequestException as e:
            logger.error(f'Failed to fetch RSS feed for {agent.name}: {e}')
            agent.status = RedditCommunityAgent.Status.ERROR
            agent.last_sync_error = f'RSS fetch failed: {str(e)}'
            agent.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        except Exception as e:
            logger.error(f'Unexpected error syncing {agent.name}: {e}', exc_info=True)
            agent.status = RedditCommunityAgent.Status.ERROR
            agent.last_sync_error = f'Sync failed: {str(e)}'
            agent.save()
            results['errors'] += 1
            results['error_messages'].append(str(e))

        return results

    @classmethod
    @transaction.atomic
    def _process_post(cls, agent: RedditCommunityAgent, post_data: dict) -> tuple[bool, bool]:
        """Process a single Reddit post: create or update thread/project.

        Returns:
            Tuple of (created, updated) booleans
        """
        from core.integrations.reddit_models import DeletedRedditThread

        reddit_post_id = post_data['reddit_post_id']

        # Check if this thread was previously deleted by an admin
        if DeletedRedditThread.objects.filter(reddit_post_id=reddit_post_id).exists():
            logger.debug(f'Skipping Reddit post {reddit_post_id} - was previously deleted by admin')
            return False, False  # Don't create or update

        # Check if thread already exists
        try:
            thread = RedditThread.objects.select_related('project').get(reddit_post_id=reddit_post_id)
            # Update existing thread
            cls._update_thread(thread, post_data)
            return False, True

        except RedditThread.DoesNotExist:
            # Create new thread + project
            cls._create_thread(agent, post_data)
            return True, False

    @classmethod
    def _auto_tag_project(cls, project: Project, metrics: dict, subreddit: str, agent: RedditCommunityAgent):
        """Automatically tag a Reddit project with tools, categories, and topics using AI."""
        from core.taxonomy.models import Taxonomy
        from core.tools.models import Tool
        from services.ai.topic_extraction import TopicExtractionService

        link_flair = metrics.get('link_flair_text', '')
        selftext = metrics.get('selftext', '')

        # Use AI-powered topic extraction
        try:
            topic_service = TopicExtractionService()
            topics = topic_service.extract_topics_from_reddit_post(
                title=project.title,
                selftext=selftext,
                subreddit=subreddit,
                link_flair=link_flair,
                max_topics=15,
            )
        except Exception as e:
            logger.warning(f'Error using AI topic extraction, falling back to basic: {e}')
            # Fallback to basic topic extraction
            topics = [subreddit.lower()] if subreddit else []
            if link_flair and link_flair.lower() not in ['discussion', 'question', 'showcase']:
                topics.append(link_flair.lower())

        # Get default tools from agent settings
        default_tool_slugs = agent.settings.get('default_tools', [])
        detected_tools = []

        # Add default tools from agent settings first
        for tool_slug in default_tool_slugs:
            try:
                tool = Tool.objects.filter(slug=tool_slug).first()
                if tool and tool not in detected_tools:
                    detected_tools.append(tool)
            except Exception as e:
                logger.debug(f'Error adding default tool {tool_slug}: {e}')

        # Match topics to existing tools using the service
        try:
            topic_service = TopicExtractionService()
            matched_tools = topic_service.match_tools(topics)
            for tool in matched_tools:
                if tool not in detected_tools:
                    detected_tools.append(tool)
        except Exception as e:
            logger.debug(f'Error matching tools from topics: {e}')

        # Assign tools to project
        if detected_tools:
            project.tools.set(detected_tools)
            logger.info(f'Assigned {len(detected_tools)} tools to project: {[t.name for t in detected_tools]}')

        # Get default categories from agent settings
        default_category_slugs = agent.settings.get('default_categories', [])
        detected_categories = []

        # Add default categories from agent settings first
        for cat_slug in default_category_slugs:
            try:
                category = Taxonomy.objects.filter(slug=cat_slug, taxonomy_type='category').first()
                if category and category not in detected_categories:
                    detected_categories.append(category)
            except Exception as e:
                logger.debug(f'Error adding default category {cat_slug}: {e}')

        # Match topics to existing categories using the service
        try:
            topic_service = TopicExtractionService()
            matched_categories = topic_service.match_categories(topics, link_flair)
            for category in matched_categories:
                if category not in detected_categories:
                    detected_categories.append(category)
        except Exception as e:
            logger.debug(f'Error matching categories from topics: {e}')

        # Assign categories to project
        if detected_categories:
            project.categories.set(detected_categories)
            logger.info(
                f'Assigned {len(detected_categories)} categories to project: {[c.name for c in detected_categories]}'
            )

        # Clean and assign topics (limit to 15)
        topics = list(set(topics))[:15]  # Remove duplicates and limit
        project.topics = topics
        project.save()

        logger.info(f'Assigned {len(topics)} topics to project: {topics}')

    @classmethod
    def _record_moderation_failure(
        cls, agent: RedditCommunityAgent, post_data: dict, reason: str, moderation_data: dict
    ):
        """Record a post that failed moderation to prevent re-attempting on every sync.

        Args:
            agent: The Reddit agent
            post_data: Post data from RSS feed
            reason: Moderation failure reason
            moderation_data: Full moderation results
        """
        from core.integrations.reddit_models import DeletedRedditThread

        try:
            # Use DeletedRedditThread to also track moderation failures
            # This prevents re-moderating the same content on every sync
            DeletedRedditThread.objects.get_or_create(
                reddit_post_id=post_data['reddit_post_id'],
                defaults={
                    'agent': agent,
                    'subreddit': post_data.get('subreddit', ''),
                    'deleted_by': None,  # System rejection, not admin deletion
                    'deletion_type': DeletedRedditThread.DeletionType.MODERATION_FAILED,
                    'deletion_reason': f'Failed moderation: {reason}',
                },
            )
            logger.info(
                f'Recorded moderation failure for {post_data["reddit_post_id"]} '
                f'(r/{post_data.get("subreddit", "")}) - will not re-attempt'
            )
        except Exception as e:
            logger.error(f'Failed to record moderation failure: {e}', exc_info=True)

    @classmethod
    def _select_best_image_url(cls, metrics: dict, thumbnail_fallback: str) -> str:
        """Select the best image URL from metrics.

        Prioritize: gallery images > full-size image > RSS thumbnail.

        Args:
            metrics: Post metrics dict from fetch_post_metrics()
            thumbnail_fallback: Fallback thumbnail URL from RSS feed

        Returns:
            Best available image URL
        """
        if metrics.get('is_gallery') and metrics.get('gallery_images'):
            return metrics['gallery_images'][0]  # Use first gallery image
        elif metrics.get('image_url'):
            return metrics['image_url']
        return thumbnail_fallback

    @classmethod
    def _prepare_reddit_metadata(cls, post_data: dict, metrics: dict) -> dict:
        """Prepare combined metadata for JSON storage.

        Args:
            post_data: Post data from RSS feed
            metrics: Post metrics from Reddit API

        Returns:
            Combined metadata dict with datetime converted to ISO string
        """
        metadata = {
            **post_data,
            **metrics,  # Include all metrics data (selftext, video, gallery, etc.)
        }
        # Convert datetime to string for JSON storage
        if metadata.get('published_utc'):
            metadata['published_utc'] = metadata['published_utc'].isoformat()
        return metadata

    @classmethod
    def _create_thread(cls, agent: RedditCommunityAgent, post_data: dict):
        """Create a new Project and RedditThread."""
        # Fetch current metrics (score, comments, full-size image) from Reddit
        metrics = cls.fetch_post_metrics(post_data['permalink'])

        # Check if post meets minimum score threshold from agent settings
        min_score = agent.settings.get('min_score', 0)
        if metrics['score'] < min_score:
            logger.info(
                f'Skipping post {post_data["reddit_post_id"]} - score {metrics["score"]} below minimum {min_score}'
            )
            return  # Skip this post

        # Skip NSFW content marked by Reddit
        if metrics.get('over_18', False):
            logger.info(f'Skipping post {post_data["reddit_post_id"]} - marked as NSFW (over_18) by Reddit')
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
            # Record this moderation failure to prevent re-attempting on every sync
            cls._record_moderation_failure(agent, post_data, reason, moderation_data)
            logger.warning(f'Skipping post {post_data["reddit_post_id"]} - failed moderation: {reason}')
            return  # Skip posts that fail moderation

        # Select best image URL
        image_url = cls._select_best_image_url(metrics, post_data['thumbnail_url'])

        # Build project content - check for video hero display mode
        project_content = {}
        hero_display_mode = agent.settings.get('hero_display_mode', '')

        # If agent is configured for video hero and post has a video, set video hero
        video_url = None
        if hero_display_mode == 'video' and (
            metrics.get('is_video') or metrics.get('url', '').startswith('https://v.redd.it/')
        ):
            # Try to download video with audio using yt-dlp
            downloader = RedditVideoDownloader()
            if downloader.check_yt_dlp_installed():
                downloaded_path = downloader.download_video(post_data['permalink'], post_data['reddit_post_id'])
                if downloaded_path:
                    video_url = downloader.get_video_url(post_data['reddit_post_id'])
                    logger.info(f'Downloaded Reddit video with audio: {video_url}')
                else:
                    logger.warning('Failed to download video, using fallback URL')
                    video_url = metrics.get('video_url') or metrics.get('url')
            else:
                logger.warning('yt-dlp not installed, using fallback video URL')
                video_url = metrics.get('video_url') or metrics.get('url')

            if video_url:
                project_content = {
                    'heroDisplayMode': 'video',
                    'heroVideoUrl': video_url,
                    'redditPermalink': post_data['permalink'],
                }
                logger.info(f'Setting video hero display for post {post_data["reddit_post_id"]}')

        # Create project
        project = Project.objects.create(
            user=agent.agent_user,
            title=post_data['title'],
            description=post_data['content'][:5000] if post_data['content'] else '',  # Truncate if too long
            type=Project.ProjectType.REDDIT_THREAD,
            external_url=post_data['permalink'],
            featured_image_url=image_url,
            content=project_content or {},  # Use empty dict instead of None
            is_showcased=True,
            is_private=False,
        )

        # Auto-tag the project
        cls._auto_tag_project(project, metrics, post_data.get('subreddit', ''), agent)

        # Prepare metadata with all Reddit data
        metadata = cls._prepare_reddit_metadata(post_data, metrics)

        # Create Reddit thread metadata with fetched metrics and moderation data
        RedditThread.objects.create(
            project=project,
            agent=agent,
            reddit_post_id=post_data['reddit_post_id'],
            subreddit=post_data['subreddit'] or agent.subreddit,
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

        # Select best image URL
        image_url = cls._select_best_image_url(metrics, post_data['thumbnail_url'])

        # Update project fields that might change
        project = thread.project
        project.featured_image_url = image_url

        # Check if we should set video hero display (if not already set)
        hero_display_mode = thread.agent.settings.get('hero_display_mode', '')
        update_fields = ['featured_image_url']

        if hero_display_mode == 'video' and not project.content:
            # Set video hero if post has a video
            if metrics.get('is_video') and metrics.get('video_url'):
                project.content = {
                    'heroDisplayMode': 'video',
                    'heroVideoUrl': metrics['video_url'],
                }
                update_fields.append('content')
                logger.info(f'Setting video hero display for existing thread {thread.reddit_post_id}')
            elif metrics.get('url', '').startswith('https://v.redd.it/'):
                project.content = {
                    'heroDisplayMode': 'video',
                    'heroVideoUrl': metrics['url'],
                }
                update_fields.append('content')
                logger.info(f'Setting video hero display (v.redd.it) for existing thread {thread.reddit_post_id}')

        project.save(update_fields=update_fields)

        # Update tags if project doesn't have any yet AND hasn't been manually edited
        if not project.tags_manually_edited and not project.tools.exists() and not project.topics:
            cls._auto_tag_project(project, metrics, post_data.get('subreddit', ''), thread.agent)

        # Prepare metadata with all Reddit data
        metadata = cls._prepare_reddit_metadata(post_data, metrics)

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
    def sync_all_active_agents(cls) -> dict:
        """Sync all active Reddit agents.

        Returns:
            Dict with overall sync statistics
        """
        active_agents = RedditCommunityAgent.objects.filter(status=RedditCommunityAgent.Status.ACTIVE)

        overall_results = {
            'agents_synced': 0,
            'total_created': 0,
            'total_updated': 0,
            'total_errors': 0,
        }

        for i, agent in enumerate(active_agents):
            # Add delay between agents (except for first agent) to avoid Reddit rate limits
            if i > 0:
                logger.info(f'Waiting {cls.AGENT_SYNC_DELAY}s before syncing next agent...')
                time.sleep(cls.AGENT_SYNC_DELAY)

            results = cls.sync_agent(agent)
            overall_results['agents_synced'] += 1
            overall_results['total_created'] += results['created']
            overall_results['total_updated'] += results['updated']
            overall_results['total_errors'] += results['errors']

        logger.info(f'Synced {overall_results["agents_synced"]} agents: {overall_results}')
        return overall_results
