"""Content moderation utilities for user-generated content."""

import re

# Basic profanity filter - extend this list as needed
BLOCKED_WORDS = {
    'fuck',
    'shit',
    'damn',
    'bitch',
    'ass',
    'asshole',
    'bastard',
    'cunt',
    'dick',
    'pussy',
    'cock',
    'nigger',
    'nigga',
    'fag',
    'faggot',
    'retard',
    'slut',
    'whore',
    # Add more as needed
}

# Common leetspeak substitutions
LEETSPEAK_MAP = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',
    '$': 's',
}


def normalize_text(text: str) -> str:
    """Normalize text for moderation checking.

    Converts to lowercase, removes special chars, handles leetspeak.
    """
    text = text.lower()

    # Replace leetspeak characters
    for leet, char in LEETSPEAK_MAP.items():
        text = text.replace(leet, char)

    # Remove special characters and spaces
    text = re.sub(r'[^a-z0-9]', '', text)

    return text


def contains_profanity(text: str) -> bool:
    """Check if text contains profanity or inappropriate content.

    Args:
        text: Text to check

    Returns:
        True if profanity is detected, False otherwise
    """
    normalized = normalize_text(text)

    # Check for exact matches
    for word in BLOCKED_WORDS:
        if word in normalized:
            return True

    return False


def moderate_tags(tags: list[str], max_length: int = 50, max_count: int = 20) -> tuple[list[str], list[str]]:
    """Moderate a list of user-generated tags.

    Args:
        tags: List of tags to moderate
        max_length: Maximum length per tag
        max_count: Maximum number of tags

    Returns:
        Tuple of (approved_tags, rejected_tags)
    """
    approved = []
    rejected = []

    for tag in tags[:max_count]:  # Limit to max_count
        tag = tag.strip()

        # Skip empty tags
        if not tag:
            continue

        # Check length
        if len(tag) > max_length:
            rejected.append(tag)
            continue

        # Check for profanity
        if contains_profanity(tag):
            rejected.append(tag)
            continue

        # Check for suspicious patterns (all caps, excessive special chars)
        if tag.isupper() and len(tag) > 3:
            # Allow acronyms like "API", "HTML" but reject "SPAM"
            if not re.match(r'^[A-Z]{2,5}$', tag):
                rejected.append(tag)
                continue

        # Check for excessive special characters
        special_char_count = len(re.findall(r'[^a-zA-Z0-9\s-]', tag))
        if special_char_count > len(tag) * 0.3:  # More than 30% special chars
            rejected.append(tag)
            continue

        approved.append(tag)

    return approved, rejected


def sanitize_tag(tag: str) -> str:
    """Sanitize a single tag.

    Removes excessive whitespace, normalizes case, etc.
    """
    # Remove leading/trailing whitespace
    tag = tag.strip()

    # Replace multiple spaces with single space
    tag = re.sub(r'\s+', ' ', tag)

    # Limit length
    if len(tag) > 50:
        tag = tag[:50].strip()

    return tag
