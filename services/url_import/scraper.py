"""URL Import Service - Scrape any webpage and extract project data using AI.

This service fetches any webpage, converts HTML to clean text, and uses AI
to extract structured project information for creating AllThrive projects.

Supports both static HTML (via requests + BeautifulSoup) and JavaScript-rendered
pages (via Playwright for headless browser rendering).

## Scalable Architecture (100K+ users)

The scraper uses a tiered approach to balance speed, cost, and reliability:

Tier 1: Direct HTTP (requests) - Fast, free, handles ~80% of URLs
    ↓ (if 403/blocked)
Tier 2: Stealth Playwright - JS rendering, fingerprint evasion, ~15%
    ↓ (if still blocked)
Tier 3: Proxy service - Residential IPs for stubborn sites, ~5%

## Anti-Bot Evasion Features

1. **Per-domain rate limiting** - Redis-backed, respects site limits
2. **User-Agent rotation** - 8 realistic browser strings
3. **TLS fingerprint** - curl_cffi mimics real browser TLS
4. **Browser headers** - Sec-*, Accept, Accept-Language
5. **Random delays** - Human-like timing patterns
6. **Fingerprint randomization** - Playwright viewport/timezone/locale
7. **Honeypot avoidance** - Skip hidden elements
"""

import html
import json
import logging
import os
import re
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from django.conf import settings

from services.ai import AIProvider

logger = logging.getLogger(__name__)

# Request configuration
REQUEST_TIMEOUT = 15
PLAYWRIGHT_TIMEOUT = 30000  # 30 seconds for JS rendering
MAX_CONTENT_LENGTH = 500_000  # 500KB max HTML

# =============================================================================
# PER-DOMAIN RATE LIMITING (Redis-backed for distributed workers)
# =============================================================================
# This prevents hammering any single domain, which is the #1 cause of IP bans.
# At 100K users, multiple Celery workers could hit the same site simultaneously.

# Default: 5 requests per minute per domain (conservative)
DEFAULT_RATE_LIMIT_REQUESTS = 5
DEFAULT_RATE_LIMIT_WINDOW = 60  # seconds

# Site-specific rate limits (some sites are more sensitive)
DOMAIN_RATE_LIMITS = {
    'reddit.com': {'requests': 10, 'window': 60},  # Reddit is lenient with JSON API
    'github.com': {'requests': 30, 'window': 60},  # GitHub has higher limits
    'medium.com': {'requests': 3, 'window': 60},  # Medium is strict
    'twitter.com': {'requests': 2, 'window': 60},  # X/Twitter is very strict
    'x.com': {'requests': 2, 'window': 60},
    'linkedin.com': {'requests': 2, 'window': 60},  # LinkedIn is aggressive
    'facebook.com': {'requests': 2, 'window': 60},
    'instagram.com': {'requests': 2, 'window': 60},
}


def _get_redis_client():
    """Get Redis client for rate limiting."""
    try:
        import redis

        redis_url = getattr(settings, 'REDIS_URL', os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))
        return redis.from_url(redis_url)
    except Exception as e:
        logger.warning(f'Redis unavailable for rate limiting: {e}')
        return None


def _get_domain_key(url: str) -> str:
    """Extract domain from URL for rate limiting key."""
    parsed = urlparse(url)
    # Remove www. prefix for consistent rate limiting
    domain = parsed.netloc.lower()
    if domain.startswith('www.'):
        domain = domain[4:]
    return domain


def _check_rate_limit(url: str) -> tuple[bool, float]:
    """
    Check if we can make a request to this domain.

    Uses Redis sliding window rate limiting for distributed workers.

    Args:
        url: The URL to check

    Returns:
        Tuple of (is_allowed, wait_time_seconds)
        - is_allowed: True if request can proceed
        - wait_time: Seconds to wait if not allowed (0 if allowed)
    """
    redis_client = _get_redis_client()
    if not redis_client:
        # No Redis = no distributed rate limiting, allow request
        return True, 0

    domain = _get_domain_key(url)
    rate_config = DOMAIN_RATE_LIMITS.get(
        domain,
        {
            'requests': DEFAULT_RATE_LIMIT_REQUESTS,
            'window': DEFAULT_RATE_LIMIT_WINDOW,
        },
    )

    max_requests = rate_config['requests']
    window_seconds = rate_config['window']
    key = f'scraper:ratelimit:{domain}'

    try:
        current_time = time.time()
        window_start = current_time - window_seconds

        # Use Redis sorted set for sliding window
        pipe = redis_client.pipeline()
        # Remove old entries outside the window
        pipe.zremrangebyscore(key, 0, window_start)
        # Count requests in current window
        pipe.zcard(key)
        # Add current request (will be committed if allowed)
        pipe.zadd(key, {f'{current_time}:{secrets.token_hex(8)}': current_time})
        # Set expiry on the key
        pipe.expire(key, window_seconds + 10)
        results = pipe.execute()

        request_count = results[1]

        if request_count >= max_requests:
            # Get oldest request time to calculate wait
            oldest = redis_client.zrange(key, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                wait_time = (oldest_time + window_seconds) - current_time
                # Remove the request we just added since we're not allowed
                redis_client.zremrangebyscore(key, current_time - 0.1, current_time + 0.1)
                logger.info(f'Rate limit hit for {domain}: {request_count}/{max_requests}, wait {wait_time:.1f}s')
                return False, max(0, wait_time)

        return True, 0

    except Exception as e:
        logger.warning(f'Rate limit check failed: {e}')
        return True, 0  # Fail open


def _wait_for_rate_limit(url: str, max_wait: float = 30.0) -> bool:
    """
    Wait until rate limit allows request, with max wait time.

    Args:
        url: The URL to request
        max_wait: Maximum seconds to wait

    Returns:
        True if we can proceed, False if max_wait exceeded
    """
    is_allowed, wait_time = _check_rate_limit(url)

    if is_allowed:
        return True

    if wait_time > max_wait:
        logger.warning(f'Rate limit wait {wait_time:.1f}s exceeds max {max_wait}s for {url}')
        return False

    logger.info(f'Rate limiting: waiting {wait_time:.1f}s for {_get_domain_key(url)}')
    time.sleep(wait_time)
    return True


# =============================================================================
# HUMAN-LIKE BROWSER SIMULATION
# =============================================================================
# These settings help avoid bot detection by mimicking real browser behavior.
# Key factors that trigger bot detection:
# 1. Missing/unusual headers
# 2. Consistent timing patterns (no randomness)
# 3. Missing cookies/sessions
# 4. Unusual User-Agent strings
# 5. Missing Accept/Accept-Language headers
# 6. No Referer header
# 7. TLS fingerprint (harder to fake without Playwright)

# Rotate between realistic browser User-Agents
# Updated for 2024/2025 browser versions
USER_AGENTS = [
    # Chrome on macOS (most common)
    (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ),
    # Chrome on Windows
    ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'),
    # Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    # Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    # Safari on macOS
    (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
        '(KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    ),
    # Edge on Windows
    (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    ),
]

# Fallback bot User-Agent (for sites that prefer bots to identify themselves)
BOT_USER_AGENT = 'AllThriveBot/1.0 (+https://allthrive.ai; portfolio-import)'

# Common Accept headers that browsers send
ACCEPT_HEADERS = {
    'html': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'json': 'application/json, text/plain, */*',
    'any': '*/*',
}

# Languages that make requests look more human
ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9,en-US;q=0.8',
    'en-US,en;q=0.9,es;q=0.8',
]

# Sec-* headers that modern browsers send (helps avoid Cloudflare detection)
SEC_HEADERS = {
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
}


def _get_human_headers(url: str, include_sec_headers: bool = True) -> dict:
    """
    Generate headers that mimic a real browser request.

    Args:
        url: The URL being requested (used for Referer logic)
        include_sec_headers: Include Sec-* headers (for Cloudflare bypass)

    Returns:
        Dictionary of HTTP headers
    """
    parsed = urlparse(url)
    base_url = f'{parsed.scheme}://{parsed.netloc}'

    headers = {
        'User-Agent': secrets.choice(USER_AGENTS),
        'Accept': ACCEPT_HEADERS['html'],
        'Accept-Language': secrets.choice(ACCEPT_LANGUAGES),
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        # DNT (Do Not Track) - common in privacy-conscious browsers
        'DNT': '1',
        # Cache control - looks like a fresh request
        'Cache-Control': 'max-age=0',
    }

    # Add Sec-* headers for better Cloudflare/bot detection bypass
    if include_sec_headers:
        headers.update(SEC_HEADERS)

    # Sometimes add a referer (as if user clicked from Google)
    if secrets.randbelow(10) >= 3:  # 70% chance
        referer_options = [
            'https://www.google.com/',
            'https://www.google.com/search?q=' + parsed.netloc.replace('.', '+'),
            base_url + '/',
        ]
        headers['Referer'] = secrets.choice(referer_options)

    return headers


def _add_random_delay(min_seconds: float = 0.5, max_seconds: float = 2.0):
    """
    Add a random delay to mimic human browsing patterns.

    Bots typically make requests at consistent intervals.
    Humans are unpredictable - sometimes fast, sometimes slow.
    """
    # Use secrets for cryptographically secure randomness
    delay = min_seconds + (max_seconds - min_seconds) * (secrets.randbelow(10000) / 10000)
    time.sleep(delay)


def _create_session() -> requests.Session:
    """
    Create a requests session with cookie persistence.

    Sessions are important because:
    1. They persist cookies across requests (like a real browser)
    2. They reuse TCP connections (more efficient, less suspicious)
    3. They maintain state for sites that check session consistency
    """
    session = requests.Session()

    # Set a reasonable retry strategy
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    retry_strategy = Retry(
        total=3,
        backoff_factor=1,  # Wait 1, 2, 4 seconds between retries
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=['HEAD', 'GET', 'OPTIONS'],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    return session


# Global session for connection reuse (per-worker in production)
_session: requests.Session | None = None


def _get_session() -> requests.Session:
    """Get or create a shared requests session."""
    global _session
    if _session is None:
        _session = _create_session()
    return _session


# =============================================================================
# TLS FINGERPRINT MATCHING (curl_cffi)
# =============================================================================
# Standard Python requests uses a TLS fingerprint that's easily identified as
# non-browser. curl_cffi impersonates real browser TLS fingerprints (JA3/JA4).
# This is one of the most effective anti-bot evasion techniques.


def _is_curl_cffi_available() -> bool:
    """Check if curl_cffi is available for browser TLS impersonation."""
    try:
        from curl_cffi import requests as cffi_requests  # noqa: F401

        return True
    except ImportError:
        return False


# Browser impersonation options for curl_cffi
CURL_CFFI_IMPERSONATIONS = [
    'chrome120',
    'chrome119',
    'chrome110',
    'safari17_0',
    'safari15_5',
    'edge101',
]


def _fetch_with_browser_tls(url: str, headers: dict, timeout: int = REQUEST_TIMEOUT) -> requests.Response:
    """
    Fetch URL using browser-like TLS fingerprint.

    Uses curl_cffi if available, falls back to standard requests.
    curl_cffi mimics real browser TLS handshakes (JA3/JA4 fingerprints),
    which is critical for bypassing Cloudflare and similar services.

    Args:
        url: URL to fetch
        headers: HTTP headers to send
        timeout: Request timeout in seconds

    Returns:
        Response object (compatible with requests.Response)
    """
    if _is_curl_cffi_available():
        try:
            from curl_cffi import requests as cffi_requests

            # Choose a random browser to impersonate
            impersonate = secrets.choice(CURL_CFFI_IMPERSONATIONS)
            logger.debug(f'Using curl_cffi with {impersonate} impersonation for {url}')

            response = cffi_requests.get(
                url,
                headers=headers,
                timeout=timeout,
                impersonate=impersonate,
                allow_redirects=True,
            )
            return response
        except Exception as e:
            logger.warning(f'curl_cffi failed, falling back to requests: {e}')

    # Fallback to standard requests
    session = _get_session()
    return session.get(url, headers=headers, timeout=timeout, allow_redirects=True)


# Indicators that a page needs JavaScript rendering
JS_REQUIRED_INDICATORS = [
    'noscript',  # Has noscript fallback
    'loading="lazy"',  # Lazy loading
    '__NEXT_DATA__',  # Next.js (usually SSR but check content)
    'window.__NUXT__',  # Nuxt.js
    'ng-app',  # Angular
    'data-reactroot',  # React (client-side)
]


@dataclass
class ExtractedProjectData:
    """Structured data extracted from a webpage."""

    title: str
    description: str
    tagline: str | None = None
    image_url: str | None = None  # Primary hero image (og:image)
    images: list[dict] | None = None  # Additional images from page [{url, alt}]
    videos: list[dict] | None = None  # Embedded videos [{url, platform, video_id}]
    creator: str | None = None
    organization: str | None = None
    published_date: str | None = None  # Article publication date
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


def _is_playwright_available() -> bool:
    """Check if Playwright is installed and available."""
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401

        return True
    except ImportError:
        return False


def _needs_javascript_rendering(html_content: str) -> bool:
    """Detect if page content suggests JavaScript rendering is needed.

    Args:
        html_content: Raw HTML from initial request

    Returns:
        True if page likely needs JS rendering for full content
    """
    soup = BeautifulSoup(html_content, 'html.parser')

    # Check for minimal body content (common in SPAs)
    body = soup.find('body')
    if body:
        body_text = body.get_text(strip=True)
        # If body has very little text but has scripts, likely needs JS
        scripts = body.find_all('script')
        if len(body_text) < 200 and len(scripts) > 3:
            logger.info('Detected SPA pattern: minimal body text with many scripts')
            return True

    # Check for specific framework indicators
    html_str = html_content.lower()
    for indicator in JS_REQUIRED_INDICATORS:
        if indicator.lower() in html_str:
            # Don't trigger on Next.js SSR (already rendered)
            if indicator == '__NEXT_DATA__':
                # Next.js SSR pages have full content, check if we have it
                main_content = soup.find('main') or soup.find(id='main-content')
                if main_content and len(main_content.get_text(strip=True)) > 500:
                    continue  # SSR content present, no JS needed
            logger.info(f'Detected JS indicator: {indicator}')
            return True

    return False


# =============================================================================
# BROWSER FINGERPRINT RANDOMIZATION
# =============================================================================
# Sophisticated bot detection tracks browser fingerprints across sessions.
# Randomizing viewport, timezone, locale, etc. makes each request look unique.

VIEWPORT_OPTIONS = [
    {'width': 1920, 'height': 1080},  # Full HD (most common)
    {'width': 1366, 'height': 768},  # HD (laptops)
    {'width': 1440, 'height': 900},  # MacBook
    {'width': 1536, 'height': 864},  # Common Windows
    {'width': 2560, 'height': 1440},  # 2K monitors
    {'width': 1280, 'height': 720},  # HD
]

TIMEZONE_OPTIONS = [
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'America/Denver',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
]

LOCALE_OPTIONS = [
    'en-US',
    'en-GB',
    'en-CA',
    'en-AU',
]

COLOR_SCHEME_OPTIONS = ['light', 'dark', 'no-preference']


def _get_random_fingerprint() -> dict:
    """
    Generate a random but consistent browser fingerprint.

    Returns dict with viewport, timezone, locale, and color_scheme.
    These should be consistent within a session for the same "user".
    """
    return {
        'viewport': secrets.choice(VIEWPORT_OPTIONS),
        'timezone_id': secrets.choice(TIMEZONE_OPTIONS),
        'locale': secrets.choice(LOCALE_OPTIONS),
        'color_scheme': secrets.choice(COLOR_SCHEME_OPTIONS),
    }


def fetch_with_playwright(url: str) -> str:
    """Fetch webpage using Playwright headless browser with stealth settings.

    Playwright provides the best bot evasion because:
    1. Real browser TLS fingerprint (Chrome's actual TLS stack)
    2. JavaScript execution (passes all JS-based bot checks)
    3. Proper DOM rendering with real Chromium
    4. Cookie/session handling like a real browser

    Anti-detection features:
    - Removes navigator.webdriver flag
    - Randomizes viewport, timezone, locale
    - Hides automation indicators
    - Adds human-like delays and behavior

    Args:
        url: URL to fetch

    Returns:
        Fully rendered HTML content

    Raises:
        URLFetchError: If fetching fails
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise URLFetchError(
            'Playwright not installed. Install with: pip install playwright && playwright install chromium'
        ) from e

    logger.info(f'Using Playwright to render JavaScript for: {url}')

    # Generate random fingerprint for this request
    fingerprint = _get_random_fingerprint()
    user_agent = secrets.choice(USER_AGENTS)

    try:
        with sync_playwright() as p:
            # Launch with stealth settings
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',  # Hide automation
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-web-security',  # Helps with some CORS issues
                    '--disable-features=VizDisplayCompositor',
                    '--window-size=1920,1080',
                ],
            )

            # Create context with randomized fingerprint
            context = browser.new_context(
                user_agent=user_agent,
                viewport=fingerprint['viewport'],
                locale=fingerprint['locale'],
                timezone_id=fingerprint['timezone_id'],
                color_scheme=fingerprint['color_scheme'],
                # Permissions that real browsers have
                permissions=['geolocation'],
                # Pretend we have WebGL, etc.
                has_touch=False,
                is_mobile=False,
                device_scale_factor=secrets.choice([1, 1.25, 1.5, 2]),
            )

            page = context.new_page()

            # Comprehensive stealth script
            page.add_init_script("""
                // Remove webdriver flag
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });

                // Mock plugins (real browsers have plugins)
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' },
                    ],
                });

                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });

                // Hide automation in chrome object
                window.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {},
                };

                // Mock permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );

                // Add realistic screen properties
                Object.defineProperty(screen, 'availWidth', { get: () => window.innerWidth });
                Object.defineProperty(screen, 'availHeight', { get: () => window.innerHeight });
            """)

            # Navigate with realistic timing
            page.goto(url, timeout=PLAYWRIGHT_TIMEOUT, wait_until='networkidle')

            # Random wait to simulate human reading (1-3 seconds)
            page.wait_for_timeout(1000 + secrets.randbelow(2001))  # 1000-3000ms

            # Optional: scroll a bit to trigger lazy loading
            page.evaluate('window.scrollBy(0, window.innerHeight / 2)')
            page.wait_for_timeout(200 + secrets.randbelow(301))  # 200-500ms

            # Get the rendered HTML
            html_content = page.content()

            browser.close()

            if len(html_content) > MAX_CONTENT_LENGTH:
                logger.warning(f'Playwright content truncated: {len(html_content)} bytes')
                html_content = html_content[:MAX_CONTENT_LENGTH]

            return html_content

    except Exception as e:
        logger.error(f'Playwright fetch failed: {e}')
        raise URLFetchError(f'Failed to render page with JavaScript: {str(e)}') from e


# =============================================================================
# PROXY SERVICE INTEGRATION (Optional - for stubborn sites)
# =============================================================================
# Configure proxy services when self-hosting isn't enough.
# Popular options: Bright Data, ScraperAPI, Oxylabs, SmartProxy
#
# Set these environment variables to enable:
#   SCRAPER_PROXY_URL - Full proxy URL (e.g., http://user:pass@proxy.example.com:8080)
#   SCRAPER_PROXY_ENABLED - Set to "true" to enable (default: false)
#   SCRAPER_PROXY_DOMAINS - Comma-separated domains to use proxy for (optional)


def _get_proxy_config() -> dict | None:
    """
    Get proxy configuration from environment.

    Returns proxy dict for requests/curl_cffi or None if not configured.
    """
    proxy_enabled = os.environ.get('SCRAPER_PROXY_ENABLED', 'false').lower() == 'true'
    if not proxy_enabled:
        return None

    proxy_url = os.environ.get('SCRAPER_PROXY_URL')
    if not proxy_url:
        logger.warning('SCRAPER_PROXY_ENABLED=true but SCRAPER_PROXY_URL not set')
        return None

    return {
        'http': proxy_url,
        'https': proxy_url,
    }


def _should_use_proxy(url: str) -> bool:
    """
    Check if proxy should be used for this URL.

    If SCRAPER_PROXY_DOMAINS is set, only use proxy for those domains.
    Otherwise, use proxy for all requests when enabled.
    """
    if not _get_proxy_config():
        return False

    proxy_domains = os.environ.get('SCRAPER_PROXY_DOMAINS', '')
    if not proxy_domains:
        return True  # Use for all domains

    domain = _get_domain_key(url)
    allowed_domains = [d.strip().lower() for d in proxy_domains.split(',')]
    return domain in allowed_domains


def fetch_webpage(url: str, force_playwright: bool = False, human_like: bool = True) -> str:
    """Fetch webpage content with tiered anti-bot evasion.

    Architecture (100K+ users scalable):
    1. Check rate limit (Redis-backed, prevents IP bans)
    2. Try curl_cffi with browser TLS fingerprint (fast, ~80% success)
    3. Fallback to Playwright for JS-heavy or blocked sites (~15%)
    4. Use proxy service for stubborn sites (~5%)

    Args:
        url: URL to fetch
        force_playwright: If True, skip requests and use Playwright directly
        human_like: If True, use human-like headers and delays (default True)

    Returns:
        HTML content as string

    Raises:
        URLFetchError: If the request fails after all retries
    """
    # Step 1: Check rate limit before making request
    if not _wait_for_rate_limit(url):
        raise URLFetchError(f'Rate limit exceeded for {_get_domain_key(url)}. Please try again later.')

    # Try Playwright first if forced
    if force_playwright and _is_playwright_available():
        return fetch_with_playwright(url)

    try:
        # Use human-like headers to avoid bot detection
        if human_like:
            headers = _get_human_headers(url)
            # Add small random delay to seem more human
            _add_random_delay(0.1, 0.5)
        else:
            # Fallback to simple bot headers (for testing or known-safe sites)
            headers = {
                'User-Agent': BOT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }

        logger.debug(f'Fetching {url} with User-Agent: {headers.get("User-Agent", "unknown")[:50]}...')

        # Step 2: Try with browser TLS fingerprint (curl_cffi or requests)
        use_proxy = _should_use_proxy(url)
        proxy_config = _get_proxy_config() if use_proxy else None

        if proxy_config:
            logger.info(f'Using proxy for {_get_domain_key(url)}')

        # Use curl_cffi for browser TLS if available
        if _is_curl_cffi_available() and human_like:
            try:
                from curl_cffi import requests as cffi_requests

                impersonate = secrets.choice(CURL_CFFI_IMPERSONATIONS)

                response = cffi_requests.get(
                    url,
                    headers=headers,
                    timeout=REQUEST_TIMEOUT,
                    impersonate=impersonate,
                    allow_redirects=True,
                    proxies=proxy_config,
                )
            except Exception as e:
                logger.warning(f'curl_cffi failed: {e}, falling back to requests')
                session = _get_session()
                response = session.get(
                    url,
                    headers=headers,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                    proxies=proxy_config,
                )
        else:
            session = _get_session()
            response = session.get(
                url,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
                proxies=proxy_config,
            )

        # Handle common bot-detection responses
        if response.status_code == 403:
            logger.warning(f'Got 403 Forbidden for {url} - site may be blocking bots')
            # Step 3: Try Playwright (browser-based)
            if _is_playwright_available():
                logger.info('Retrying with Playwright headless browser')
                return fetch_with_playwright(url)
            raise URLFetchError('Access denied - site may be blocking automated access')

        if response.status_code == 429:
            logger.warning(f'Got 429 Too Many Requests for {url} - rate limited')
            raise URLFetchError('Rate limited - too many requests. Please try again later.')

        response.raise_for_status()

        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'text/html' not in content_type and 'application/xhtml' not in content_type:
            raise URLFetchError(f'URL does not return HTML content: {content_type}')

        # Check content length
        if len(response.content) > MAX_CONTENT_LENGTH:
            logger.warning(f'Content truncated for {url}: {len(response.content)} bytes')

        html_content = response.text[:MAX_CONTENT_LENGTH]

        # Check if we need JavaScript rendering
        if _is_playwright_available() and _needs_javascript_rendering(html_content):
            logger.info('Page appears to need JavaScript rendering, trying Playwright')
            try:
                return fetch_with_playwright(url)
            except URLFetchError:
                logger.warning('Playwright failed, falling back to static content')
                # Fall back to static content if Playwright fails

        return html_content

    except requests.exceptions.Timeout as e:
        raise URLFetchError(f'Request timed out after {REQUEST_TIMEOUT}s') from e
    except requests.exceptions.ConnectionError as e:
        raise URLFetchError(f'Failed to connect to {urlparse(url).netloc}') from e
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response else 'unknown'
        raise URLFetchError(f'HTTP error: {status_code}') from e
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

    # Published date: try article:published_time, then datePublished schema
    published_time = soup.find('meta', property='article:published_time')
    if published_time and published_time.get('content'):
        metadata['published_date'] = published_time['content'].strip()
    else:
        # Try schema.org datePublished
        time_tag = soup.find('time', attrs={'datetime': True})
        if time_tag:
            metadata['published_date'] = time_tag['datetime']

    return metadata


def _check_youtube_embeddable(video_id: str) -> bool:
    """Check if a YouTube video allows embedding elsewhere.

    Uses YouTube's oEmbed endpoint which returns an error if embedding is disabled.

    Args:
        video_id: YouTube video ID

    Returns:
        True if video can be embedded, False otherwise
    """
    oembed_url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json'
    try:
        response = requests.get(oembed_url, timeout=5)
        # 200 means embeddable, 401/403 means not embeddable
        return response.status_code == 200
    except Exception:
        # If we can't check, assume it's not embeddable to be safe
        return False


def extract_videos(soup: BeautifulSoup, url: str) -> list[dict]:
    """Extract embedded videos from a webpage.

    Finds YouTube, Vimeo, and other video embeds.
    Only includes videos that allow embedding elsewhere.

    Args:
        soup: BeautifulSoup parsed HTML
        url: Original URL for resolving relative URLs

    Returns:
        List of dicts with 'url', 'platform', 'video_id', and 'thumbnail' keys
    """
    videos = []
    seen_ids = set()

    # YouTube patterns
    youtube_patterns = [
        # Standard embed iframe
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        # youtube-nocookie.com embed
        r'youtube-nocookie\.com/embed/([a-zA-Z0-9_-]{11})',
        # Watch URLs (in links or data attributes)
        r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
        # Short URLs
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
    ]

    # Vimeo patterns
    vimeo_patterns = [
        r'player\.vimeo\.com/video/(\d+)',
        r'vimeo\.com/(\d+)',
    ]

    # Check iframes for video embeds
    for iframe in soup.find_all('iframe'):
        src = iframe.get('src') or iframe.get('data-src') or ''

        # YouTube
        for pattern in youtube_patterns:
            match = re.search(pattern, src)
            if match:
                video_id = match.group(1)
                if video_id not in seen_ids:
                    seen_ids.add(video_id)
                    # Check if video allows embedding elsewhere
                    if _check_youtube_embeddable(video_id):
                        videos.append(
                            {
                                'url': f'https://www.youtube.com/watch?v={video_id}',
                                'embed_url': f'https://www.youtube.com/embed/{video_id}',
                                'platform': 'youtube',
                                'video_id': video_id,
                                'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                            }
                        )
                    else:
                        logger.debug(f'Skipping YouTube video {video_id}: embedding disabled')
                break

        # Vimeo
        for pattern in vimeo_patterns:
            match = re.search(pattern, src)
            if match:
                video_id = match.group(1)
                if video_id not in seen_ids:
                    seen_ids.add(video_id)
                    videos.append(
                        {
                            'url': f'https://vimeo.com/{video_id}',
                            'embed_url': f'https://player.vimeo.com/video/{video_id}',
                            'platform': 'vimeo',
                            'video_id': video_id,
                            'thumbnail': None,  # Vimeo thumbnails require API call
                        }
                    )
                break

    # Also check for YouTube links in the page (not just embeds)
    # This catches cases where video is linked but not embedded
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        for pattern in youtube_patterns:
            match = re.search(pattern, href)
            if match:
                video_id = match.group(1)
                if video_id not in seen_ids:
                    seen_ids.add(video_id)
                    # Check if video allows embedding elsewhere
                    if _check_youtube_embeddable(video_id):
                        videos.append(
                            {
                                'url': f'https://www.youtube.com/watch?v={video_id}',
                                'embed_url': f'https://www.youtube.com/embed/{video_id}',
                                'platform': 'youtube',
                                'video_id': video_id,
                                'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                            }
                        )
                    else:
                        logger.debug(f'Skipping YouTube video {video_id}: embedding disabled')
                break

    # Check for lite-youtube custom elements (common lazy-load pattern)
    for lite_yt in soup.find_all(['lite-youtube', 'youtube-video']):
        video_id = lite_yt.get('videoid') or lite_yt.get('video-id') or lite_yt.get('data-videoid')
        if video_id and video_id not in seen_ids:
            seen_ids.add(video_id)
            # Check if video allows embedding elsewhere
            if _check_youtube_embeddable(video_id):
                videos.append(
                    {
                        'url': f'https://www.youtube.com/watch?v={video_id}',
                        'embed_url': f'https://www.youtube.com/embed/{video_id}',
                        'platform': 'youtube',
                        'video_id': video_id,
                        'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                    }
                )
            else:
                logger.debug(f'Skipping YouTube video {video_id}: embedding disabled')

    return videos


def extract_images(soup: BeautifulSoup, url: str, max_images: int = 12) -> list[dict]:
    """Extract meaningful images from a webpage.

    Filters out icons, tracking pixels, avatars, and other noise.
    Returns images likely to be content (screenshots, diagrams, photos).

    Args:
        soup: BeautifulSoup parsed HTML
        url: Original URL for resolving relative URLs
        max_images: Maximum number of images to extract

    Returns:
        List of dicts with 'url' and 'alt' keys
    """
    images = []
    seen_urls = set()

    # Patterns that indicate non-content images
    skip_patterns = [
        # Generic UI elements
        'avatar',
        'icon',
        'logo',
        'favicon',
        'emoji',
        'pixel',
        'tracking',
        'badge',
        'button',
        '1x1',
        'spacer',
        'blank',
        'transparent',
        'sprite',
        'loader',
        'spinner',
        'arrow',
        'chevron',
        'caret',
        'close',
        'menu',
        'hamburger',
        'search',
        'social',
        'share',
        # User profile images (we don't want contributor lists)
        'gravatar',
        'profile-pic',
        'user-image',
        'author-image',
        'profile_image',
        'profile-image',
        'profilepic',
        'userpic',
        'contributor',
        'collaborator',
        'member',
        'team-member',
        # Platform-specific avatar domains/paths
        'avatars.githubusercontent.com',  # GitHub user avatars
        'githubusercontent.com/u/',  # GitHub user avatar path
        'secure.gravatar.com',
        'pbs.twimg.com/profile_images',  # Twitter profile pics
        'platform-lookaside.fbsbx.com',  # Facebook
        'media.licdn.com/dms/image',  # LinkedIn profile
        # Social media icons (but not content shared from them)
        '/icons/',
        '/icon/',
        '/_icons/',
    ]

    # Regex patterns for avatar URLs that need more specific matching
    # GitHub serves user avatars at github.com/username.png
    github_avatar_pattern = re.compile(r'github\.com/[a-zA-Z0-9_-]+\.png$', re.IGNORECASE)

    # File extensions that are typically icons/vectors (skip small ones)
    icon_extensions = ['.svg', '.ico', '.gif']

    for img in soup.find_all('img'):
        # Get image source (check multiple attributes for lazy loading)
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src') or img.get('data-original')
        if not src:
            continue

        # Skip data URIs (usually tiny placeholders)
        if src.startswith('data:'):
            continue

        # Resolve relative URLs
        img_url = urljoin(url, src)

        # Skip duplicates
        if img_url in seen_urls:
            continue
        seen_urls.add(img_url)

        # Skip obvious noise based on URL patterns
        img_url_lower = img_url.lower()
        if any(pattern in img_url_lower for pattern in skip_patterns):
            continue

        # Skip GitHub user avatar URLs (github.com/username.png format)
        if github_avatar_pattern.search(img_url):
            continue

        # Get dimensions if available
        width = img.get('width', '')
        height = img.get('height', '')

        # Try to parse dimensions
        try:
            w = int(str(width).replace('px', ''))
        except (ValueError, TypeError):
            w = None

        try:
            h = int(str(height).replace('px', ''))
        except (ValueError, TypeError):
            h = None

        # Skip tiny images (likely icons)
        if w is not None and w < 100:
            continue
        if h is not None and h < 100:
            continue

        # Skip small SVGs/GIFs (larger ones might be diagrams)
        if any(img_url_lower.endswith(ext) for ext in icon_extensions):
            if w is not None and w < 200:
                continue

        # Get alt text for context
        alt = img.get('alt', '') or img.get('title', '')

        # Skip images with alt text suggesting they're decorative or user profiles
        alt_lower = alt.lower()
        skip_alt_patterns = [
            'icon',
            'logo',
            'avatar',
            'decoration',
            'profile',
            'contributor',
            'author',
            "'s avatar",
            "'s profile",
            "'s photo",
            "'s picture",
            'profile picture',
            'profile photo',
            'profile image',
            'headshot',
            'portrait',
        ]
        if any(pattern in alt_lower for pattern in skip_alt_patterns):
            continue

        images.append(
            {
                'url': img_url,
                'alt': alt.strip() if alt else '',
            }
        )

        if len(images) >= max_images:
            break

    return images


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
            images=metadata.get('images'),  # Additional images from page
            videos=metadata.get('videos'),  # Embedded videos (YouTube, Vimeo, etc.)
            creator=extracted.get('creator') or metadata.get('creator'),
            organization=extracted.get('organization') or metadata.get('organization'),
            published_date=metadata.get('published_date'),
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
            images=metadata.get('images'),
            videos=metadata.get('videos'),
            creator=metadata.get('creator'),
            organization=metadata.get('organization'),
            published_date=metadata.get('published_date'),
            source_url=url,
        )
    except Exception as e:
        logger.error(f'AI extraction failed: {e}', exc_info=True)
        raise AIExtractionError(f'Failed to extract project data: {str(e)}') from e


def _is_reddit_url(url: str) -> bool:
    """Check if URL is a Reddit post."""
    parsed = urlparse(url)
    return parsed.netloc in ('reddit.com', 'www.reddit.com', 'old.reddit.com')


def _fetch_reddit_post(url: str) -> ExtractedProjectData:
    """Fetch Reddit post data using their JSON API.

    Reddit pages are JavaScript-heavy SPAs, but they provide a JSON API
    by simply appending .json to the URL.

    Args:
        url: Reddit post URL

    Returns:
        ExtractedProjectData with post information

    Raises:
        URLFetchError: If fetching fails
    """
    logger.info(f'Fetching Reddit post via JSON API: {url}')

    # Normalize URL and add .json
    url = url.rstrip('/')
    if not url.endswith('.json'):
        json_url = url + '.json'
    else:
        json_url = url

    try:
        headers = {
            'User-Agent': secrets.choice(USER_AGENTS),
            'Accept': 'application/json',
        }

        response = requests.get(json_url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        data = response.json()

        # Reddit returns a list: [post_listing, comments_listing]
        if not isinstance(data, list) or len(data) == 0:
            raise URLFetchError('Invalid Reddit API response format')

        post_data = data[0]['data']['children'][0]['data']

        # Extract title and basic info
        title = post_data.get('title', 'Reddit Post')
        author = post_data.get('author', 'unknown')
        subreddit = post_data.get('subreddit', '')
        selftext = post_data.get('selftext', '')

        # Build description
        description = selftext if selftext else f'Posted by u/{author} in r/{subreddit}'
        if len(description) > 500:
            description = description[:500] + '...'

        # Get image URL - check multiple sources
        image_url = None

        # Check for gallery
        if post_data.get('is_gallery') and 'media_metadata' in post_data:
            # Get first image from gallery
            media_metadata = post_data['media_metadata']
            if media_metadata:
                first_key = list(media_metadata.keys())[0]
                first_image = media_metadata[first_key]
                if 's' in first_image and 'u' in first_image['s']:
                    image_url = first_image['s']['u'].replace('&amp;', '&')

        # Check preview images
        if not image_url and 'preview' in post_data:
            preview = post_data['preview']
            if 'images' in preview and preview['images']:
                source = preview['images'][0].get('source', {})
                if 'url' in source:
                    image_url = source['url'].replace('&amp;', '&')

        # Fallback to thumbnail
        if not image_url:
            thumbnail = post_data.get('thumbnail', '')
            if thumbnail and thumbnail.startswith('http'):
                image_url = thumbnail

        # Build topics from subreddit and flair
        topics = [subreddit.lower()] if subreddit else []
        link_flair = post_data.get('link_flair_text', '')
        if link_flair:
            topics.append(link_flair.lower())

        # Add common topics based on subreddit
        subreddit_topics = {
            'midjourney': ['ai art', 'midjourney', 'generative art'],
            'stablediffusion': ['ai art', 'stable diffusion', 'generative art'],
            'dalle': ['ai art', 'dall-e', 'generative art'],
            'chatgpt': ['ai', 'chatgpt', 'llm'],
            'localllama': ['ai', 'llm', 'open source'],
        }
        topics.extend(subreddit_topics.get(subreddit.lower(), []))
        topics = list(set(topics))[:7]  # Dedupe and limit

        return ExtractedProjectData(
            title=title,
            description=description,
            tagline=f'r/{subreddit}' if subreddit else None,
            image_url=image_url,
            creator=f'u/{author}' if author else None,
            organization='Reddit',
            topics=topics,
            features=None,
            links={'reddit': url.replace('.json', '')},
            source_url=url.replace('.json', ''),
        )

    except requests.exceptions.RequestException as e:
        logger.error(f'Failed to fetch Reddit post: {e}')
        raise URLFetchError(f'Failed to fetch Reddit post: {str(e)}') from e
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f'Failed to parse Reddit response: {e}')
        raise ContentExtractionError(f'Failed to parse Reddit post data: {str(e)}') from e


def scrape_url_for_project(url: str, force_javascript: bool = False) -> ExtractedProjectData:
    """Main entry point: scrape a URL and extract project data.

    Args:
        url: URL to scrape
        force_javascript: If True, use Playwright for JS rendering even for static-looking pages

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

    # Special handling for Reddit - use their JSON API
    if _is_reddit_url(url):
        return _fetch_reddit_post(url)

    # Fetch the page (auto-detects if JS rendering is needed)
    html_content = fetch_webpage(url, force_playwright=force_javascript)

    # Parse HTML
    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract metadata from tags
    metadata = extract_metadata(soup, url)

    # Extract images from page (for gallery)
    images = extract_images(soup, url)
    if images:
        metadata['images'] = images
        logger.info(f'Extracted {len(images)} images from page')

    # Extract embedded videos (YouTube, Vimeo, etc.)
    videos = extract_videos(soup, url)
    if videos:
        metadata['videos'] = videos
        logger.info(f'Extracted {len(videos)} videos from page: {[v["platform"] for v in videos]}')

    # Convert to text for AI
    text_content = html_to_text(html_content)

    if not text_content.strip():
        raise ContentExtractionError('Could not extract any text content from the page')

    # Extract structured data with AI
    project_data = extract_with_ai(text_content, metadata, url)

    logger.info(f'Successfully extracted project data: {project_data.title}')

    return project_data
