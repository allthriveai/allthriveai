"""
Keyword-based content filter for pre-screening NSFW content.

This provides a fast, local filter to catch obviously inappropriate content
before making API calls to external moderation services.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


class KeywordFilter:
    """
    Fast keyword-based filter for catching explicitly inappropriate content.

    This is a fail-fast filter that runs before expensive API calls.
    It's designed to catch obvious NSFW content that should never make it
    to the platform, even if external APIs miss it.
    """

    # Explicit sexual content keywords
    EXPLICIT_SEXUAL = [
        r'\btits\b',
        r'\bass\b',
        r'\bcock\b',
        r'\bcumshot',
        r'\bgangbang',
        r'\bnsfw\b',
        r'\bxxx\b',
        r'\bfuck\b',
        r'\bsex\b',
        r'\bnude',
        r'\bnaked\b',
        r'\berotic\b',
        r'\bblowjob',
        r'\bhandjob',
        r'\bmasturbat',
        r'\borgasm',
        r'\bpenis\b',
        r'\bvagina\b',
        r'\bgenitals\b',
        r'\bfetish',
        r'\bkinky\b',
        r'\bbdsm\b',
        r'\bdirty\s+fantasies',
        r'\bfilthiest\s+shit',
    ]

    # Legitimate uses of "porn" as metaphor (e.g., "food porn", "success porn")
    # These should be checked BEFORE flagging content with "porn" in it
    PORN_EXCEPTIONS = [
        r'\b(success|failure|food|earth|map|room|design|architecture|data|career)\s+porn\b',
        r'\bporn\s+(addiction|industry)\b',  # Discussing the topic, not promoting it
    ]

    # Explicit porn patterns (only match when not in exception list)
    # This will be checked after exceptions are ruled out
    EXPLICIT_PORN_PATTERNS = [
        r'\bporn\b(?!\s+(addiction|industry))',  # "porn" not followed by discussion terms
        r'\bpornography\b',
    ]

    # Violent/graphic content keywords
    VIOLENT_GRAPHIC = [
        r'\bgore\b',
        r'\bbeheading',
        r'\bmutilat',
        r'\btorture',
        r'\bsnuff\b',
        r'\bexecut(e|ion)',
    ]

    # Hate speech keywords
    HATE_SPEECH = [
        r'\bnigger',
        r'\bfaggot',
        r'\bkike\b',
        r'\btranny\b',
    ]

    # Child safety / minors keywords
    # These are ALWAYS flagged regardless of mode (zero tolerance)
    CHILD_SAFETY = [
        r'\bchild\s+porn',
        r'\bcp\b',  # common abbreviation
        r'\bpedo',
        r'\bunderage\s+(sex|porn|nude)',
        r'\bminor\s+(sex|porn|nude)',
        r'\bpreteen',
        r'\bjailbait',
        r'\bloli\b',
        r'\bshota\b',
        r'\bkid(s|die)?\s+(porn|sex|nude)',
        r'\bteen\s+porn',  # Note: "teen" alone is too broad, need context
        r'\byoung\s+(porn|sex|nude)',
    ]

    # Combined patterns - higher threshold needed if multiple categories match
    # This helps reduce false positives for legitimate content
    COMBINATION_THRESHOLD = 2  # Number of categories that must match

    def __init__(self, strict_mode: bool = False):
        """
        Initialize the keyword filter.

        Args:
            strict_mode: If True, flags content more aggressively (lower threshold)
        """
        self.strict_mode = strict_mode

        # Compile regex patterns for performance
        self.sexual_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.EXPLICIT_SEXUAL]
        self.violent_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.VIOLENT_GRAPHIC]
        self.hate_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.HATE_SPEECH]
        self.child_safety_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.CHILD_SAFETY]
        self.porn_exception_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.PORN_EXCEPTIONS]
        self.explicit_porn_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.EXPLICIT_PORN_PATTERNS]

    def check(self, content: str, context: str = '') -> dict[str, Any]:
        """
        Check content against keyword filters.

        Args:
            content: Text content to check
            context: Optional context about the content source

        Returns:
            Dictionary with filter results:
            - flagged: bool - Whether content was flagged
            - categories: list - List of flagged categories
            - matched_keywords: list - Keywords that triggered the flag
            - reason: str - Human-readable explanation
        """
        if not content or not content.strip():
            return {
                'flagged': False,
                'categories': [],
                'matched_keywords': [],
                'reason': 'No content to check',
            }

        matched_categories = []
        matched_keywords = []

        # First, check if content contains legitimate "porn" metaphors
        # If it does, we'll skip porn-specific checks
        has_porn_exception = False
        for pattern in self.porn_exception_patterns:
            if pattern.search(content):
                has_porn_exception = True
                break

        # Check sexual content
        sexual_matches = []
        for pattern in self.sexual_patterns:
            match = pattern.search(content)
            if match:
                sexual_matches.append(match.group(0))

        # Check explicit porn patterns (only if no exception found)
        if not has_porn_exception:
            for pattern in self.explicit_porn_patterns:
                match = pattern.search(content)
                if match:
                    sexual_matches.append(match.group(0))

        if sexual_matches:
            matched_categories.append('sexual')
            matched_keywords.extend(sexual_matches)

        # Check violent content
        violent_matches = []
        for pattern in self.violent_patterns:
            match = pattern.search(content)
            if match:
                violent_matches.append(match.group(0))

        if violent_matches:
            matched_categories.append('violence')
            matched_keywords.extend(violent_matches)

        # Check hate speech
        hate_matches = []
        for pattern in self.hate_patterns:
            match = pattern.search(content)
            if match:
                hate_matches.append(match.group(0))

        if hate_matches:
            matched_categories.append('hate')
            matched_keywords.extend(hate_matches)

        # Check child safety (CRITICAL - zero tolerance)
        child_safety_matches = []
        for pattern in self.child_safety_patterns:
            match = pattern.search(content)
            if match:
                child_safety_matches.append(match.group(0))

        if child_safety_matches:
            matched_categories.append('child_safety')
            matched_keywords.extend(child_safety_matches)

        # Determine if content should be flagged
        # In strict mode, any category match is a flag
        # In normal mode, require multiple explicit indicators OR hate speech
        is_flagged = False
        reason = ''

        # CRITICAL: Always flag child safety content (zero tolerance)
        if 'child_safety' in matched_categories:
            is_flagged = True
        elif self.strict_mode:
            is_flagged = len(matched_categories) > 0
        else:
            # Always flag hate speech
            if 'hate' in matched_categories:
                is_flagged = True
            # Flag if we have strong explicit sexual language
            elif 'sexual' in matched_categories:
                # More than 2 sexual keywords or really explicit ones indicate NSFW
                if len(sexual_matches) >= 3:
                    is_flagged = True
            # Flag if multiple categories match
            elif len(matched_categories) >= self.COMBINATION_THRESHOLD:
                is_flagged = True

        if is_flagged:
            category_text = ', '.join(matched_categories)
            context_msg = f' in {context}' if context else ''
            reason = (
                f'Content flagged by keyword filter: contains explicit {category_text} content{context_msg}. '
                f'Matched terms: {len(matched_keywords)}'
            )
            logger.warning(
                f'Keyword filter flagged content: context={context}, '
                f'categories={matched_categories}, keywords={len(matched_keywords)}'
            )
        else:
            reason = 'Content passed keyword filter'

        return {
            'flagged': is_flagged,
            'categories': matched_categories,
            'matched_keywords': matched_keywords,
            'reason': reason,
        }

    def should_skip_api_moderation(self, content: str) -> bool:
        """
        Quick check if content is so obviously inappropriate that we can
        skip API moderation and reject immediately.

        Args:
            content: Text content to check

        Returns:
            True if content should be rejected without API check
        """
        result = self.check(content)
        return result['flagged']
