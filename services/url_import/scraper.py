"""URL Import Service - Scrape any webpage and extract project data using AI.

This service fetches any webpage, converts HTML to clean text, and uses AI
to extract structured project information for creating AllThrive projects.
"""

import html
import json
import logging
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from services.ai import AIProvider

logger = logging.getLogger(__name__)

# Request configuration
REQUEST_TIMEOUT = 15
MAX_CONTENT_LENGTH = 500_000  # 500KB max HTML
USER_AGENT = 'AllThriveBot/1.0 (+https://allthrive.ai)'


@dataclass
class ExtractedProjectData:
    """Structured data extracted from a webpage."""

    title: str
    description: str
    tagline: str | None = None
    image_url: str | None = None
    creator: str | None = None
    organization: str | None = None
    topics: list[str] | None = None
    features: list[str] | None = None
    links: dict[str, str] | None = None  # e.g., {"github": "...", "docs": "..."}
    license: str | None = None
    source_url: str | None = None


class URLScraperError(Exception):
    """Base exception for URL scraping errors."""

    pass


class URLFetchError(URLScraperError):
    """Failed to fetch URL."""

    pass


class ContentExtractionError(URLScraperError):
    """Failed to extract content from page."""

    pass


class AIExtractionError(URLScraperError):
    """Failed to extract structured data via AI."""

    pass


def fetch_webpage(url: str) -> str:
    """Fetch webpage content with proper error handling.

    Args:
        url: URL to fetch

    Returns:
        HTML content as string

    Raises:
        URLFetchError: If the request fails
    """
    try:
        headers = {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }

        response = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        response.raise_for_status()

        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'text/html' not in content_type and 'application/xhtml' not in content_type:
            raise URLFetchError(f'URL does not return HTML content: {content_type}')

        # Check content length
        if len(response.content) > MAX_CONTENT_LENGTH:
            logger.warning(f'Content truncated for {url}: {len(response.content)} bytes')

        return response.text[:MAX_CONTENT_LENGTH]

    except requests.exceptions.Timeout as e:
        raise URLFetchError(f'Request timed out after {REQUEST_TIMEOUT}s') from e
    except requests.exceptions.ConnectionError as e:
        raise URLFetchError(f'Failed to connect to {urlparse(url).netloc}') from e
    except requests.exceptions.HTTPError as e:
        raise URLFetchError(f'HTTP error: {e.response.status_code}') from e
    except requests.exceptions.RequestException as e:
        raise URLFetchError(f'Request failed: {str(e)}') from e


def extract_metadata(soup: BeautifulSoup, url: str) -> dict:
    """Extract metadata from HTML using standard meta tags and Open Graph.

    Args:
        soup: BeautifulSoup parsed HTML
        url: Original URL for resolving relative URLs

    Returns:
        Dictionary of extracted metadata
    """
    metadata = {}

    # Title: try og:title, then twitter:title, then <title>
    og_title = soup.find('meta', property='og:title')
    twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
    title_tag = soup.find('title')

    if og_title and og_title.get('content'):
        metadata['title'] = og_title['content'].strip()
    elif twitter_title and twitter_title.get('content'):
        metadata['title'] = twitter_title['content'].strip()
    elif title_tag and title_tag.string:
        metadata['title'] = title_tag.string.strip()

    # Description: try og:description, meta description
    og_desc = soup.find('meta', property='og:description')
    meta_desc = soup.find('meta', attrs={'name': 'description'})

    if og_desc and og_desc.get('content'):
        metadata['description'] = og_desc['content'].strip()
    elif meta_desc and meta_desc.get('content'):
        metadata['description'] = meta_desc['content'].strip()

    # Image: try og:image
    og_image = soup.find('meta', property='og:image')
    if og_image and og_image.get('content'):
        image_url = og_image['content']
        # Resolve relative URLs
        if not image_url.startswith(('http://', 'https://')):
            image_url = urljoin(url, image_url)
        metadata['image_url'] = image_url

    # Author/creator
    author = soup.find('meta', attrs={'name': 'author'})
    if author and author.get('content'):
        metadata['creator'] = author['content'].strip()

    # Site name (organization)
    og_site_name = soup.find('meta', property='og:site_name')
    if og_site_name and og_site_name.get('content'):
        metadata['organization'] = og_site_name['content'].strip()

    return metadata


def html_to_text(html_content: str) -> str:
    """Convert HTML to clean readable text for AI processing.

    Args:
        html_content: Raw HTML string

    Returns:
        Clean text content
    """
    soup = BeautifulSoup(html_content, 'html.parser')

    # Remove script, style, nav, footer elements
    for element in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'iframe']):
        element.decompose()

    # Get text and clean up whitespace
    text = soup.get_text(separator='\n')

    # Clean up excessive whitespace
    lines = [line.strip() for line in text.split('\n')]
    lines = [line for line in lines if line]  # Remove empty lines
    text = '\n'.join(lines)

    # Decode HTML entities
    text = html.unescape(text)

    # Limit text length for AI processing
    max_text_length = 15000
    if len(text) > max_text_length:
        text = text[:max_text_length] + '\n...[truncated]'

    return text


def extract_with_ai(text_content: str, metadata: dict, url: str) -> ExtractedProjectData:
    """Use AI to extract structured project data from webpage content.

    Args:
        text_content: Clean text extracted from webpage
        metadata: Pre-extracted metadata (title, description, image)
        url: Source URL

    Returns:
        ExtractedProjectData with AI-enhanced extraction

    Raises:
        AIExtractionError: If AI extraction fails
    """
    ai = AIProvider()

    system_prompt = """You are an expert at analyzing webpages and extracting structured
information about projects, products, tools, or organizations.

Given the text content of a webpage, extract the following information in JSON format:
{
    "title": "The name of the project/product/tool",
    "tagline": "A short catchy tagline or subtitle (if found)",
    "description": "A 2-3 sentence description of what this is",
    "creator": "The person who created this (name only, if found)",
    "organization": "The company or organization behind this (if found)",
    "topics": ["relevant", "topic", "tags"],
    "features": ["key feature 1", "key feature 2", "key feature 3"],
    "links": {"github": "url", "docs": "url", "demo": "url"},
    "license": "The license type if mentioned (e.g., MIT, Apache 2.0)"
}

Rules:
- Only include fields where you found actual information
- topics should be 3-7 relevant tags (lowercase, no special characters)
- features should be the top 3-5 key features or capabilities
- links should only include URLs actually found in the content
- Keep descriptions concise but informative
- If you can't determine something with confidence, omit it

Return ONLY valid JSON, no other text."""

    user_prompt = f"""Analyze this webpage and extract project information.

URL: {url}

Pre-extracted metadata:
{json.dumps(metadata, indent=2)}

Page content:
{text_content}

Extract structured project data as JSON:"""

    try:
        response = ai.complete(
            prompt=user_prompt,
            system_message=system_prompt,
            temperature=0.3,  # Lower temperature for more consistent extraction
            max_tokens=1000,
        )

        # Parse JSON response
        # Handle potential markdown code blocks
        response = response.strip()
        if response.startswith('```'):
            response = re.sub(r'^```(?:json)?\n?', '', response)
            response = re.sub(r'\n?```$', '', response)

        extracted = json.loads(response)

        # Merge with pre-extracted metadata (prefer AI extraction but use metadata as fallback)
        return ExtractedProjectData(
            title=extracted.get('title') or metadata.get('title', 'Untitled Project'),
            description=extracted.get('description') or metadata.get('description', ''),
            tagline=extracted.get('tagline'),
            image_url=metadata.get('image_url'),  # Use metadata image (og:image is usually best)
            creator=extracted.get('creator') or metadata.get('creator'),
            organization=extracted.get('organization') or metadata.get('organization'),
            topics=extracted.get('topics', []),
            features=extracted.get('features', []),
            links=extracted.get('links', {}),
            license=extracted.get('license'),
            source_url=url,
        )

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse AI response as JSON: {e}')
        # Fall back to metadata only
        return ExtractedProjectData(
            title=metadata.get('title', 'Untitled Project'),
            description=metadata.get('description', ''),
            image_url=metadata.get('image_url'),
            creator=metadata.get('creator'),
            organization=metadata.get('organization'),
            source_url=url,
        )
    except Exception as e:
        logger.error(f'AI extraction failed: {e}', exc_info=True)
        raise AIExtractionError(f'Failed to extract project data: {str(e)}') from e


def scrape_url_for_project(url: str) -> ExtractedProjectData:
    """Main entry point: scrape a URL and extract project data.

    Args:
        url: URL to scrape

    Returns:
        ExtractedProjectData with all extracted information

    Raises:
        URLScraperError: If scraping or extraction fails
    """
    logger.info(f'Scraping URL for project data: {url}')

    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise URLFetchError('Invalid URL format')

    if parsed.scheme not in ('http', 'https'):
        raise URLFetchError('Only HTTP and HTTPS URLs are supported')

    # Fetch the page
    html_content = fetch_webpage(url)

    # Parse HTML
    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract metadata from tags
    metadata = extract_metadata(soup, url)

    # Convert to text for AI
    text_content = html_to_text(html_content)

    if not text_content.strip():
        raise ContentExtractionError('Could not extract any text content from the page')

    # Extract structured data with AI
    project_data = extract_with_ai(text_content, metadata, url)

    logger.info(f'Successfully extracted project data: {project_data.title}')

    return project_data
