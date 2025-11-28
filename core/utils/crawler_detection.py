"""Crawler detection utilities for SSR."""

import re

# List of known LLM and search engine crawlers
CRAWLER_USER_AGENTS = [
    # LLM Crawlers
    'GPTBot',
    'ChatGPT-User',
    'ClaudeBot',
    'anthropic-ai',
    'Claude-Web',
    'CCBot',
    'PerplexityBot',
    'Applebot-Extended',
    'Google-Extended',
    'Omgilibot',
    'FacebookBot',
    # Traditional Search Engines
    'Googlebot',
    'Bingbot',
    'Slurp',  # Yahoo
    'DuckDuckBot',
    'Baiduspider',
    'YandexBot',
]

# Compile regex pattern once for performance
_CRAWLER_PATTERN = re.compile('|'.join(CRAWLER_USER_AGENTS), re.IGNORECASE)


def is_crawler(request) -> bool:
    """
    Detect if the request is from a crawler/bot.

    Uses case-insensitive regex matching to catch variations like:
    - "GPTBot/1.0", "gptbot", "GPTBOT"
    - "ClaudeBot/2.0 (+http://anthropic.com)"

    Args:
        request: Django HttpRequest object

    Returns:
        bool: True if request is from a known crawler, False otherwise
    """
    user_agent = request.headers.get('user-agent', '')

    if not user_agent:
        return False

    # Use compiled regex for case-insensitive matching
    return bool(_CRAWLER_PATTERN.search(user_agent))


def is_llm_crawler(request) -> bool:
    """
    Detect if the request is specifically from an LLM crawler (not traditional search).

    Args:
        request: Django HttpRequest object

    Returns:
        bool: True if request is from LLM crawler (GPTBot, ClaudeBot, etc.)
    """
    llm_bots = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'CCBot', 'PerplexityBot']

    user_agent = request.headers.get('user-agent', '')

    if not user_agent:
        return False

    pattern = re.compile('|'.join(llm_bots), re.IGNORECASE)
    return bool(pattern.search(user_agent))
