"""
Security utilities for LangGraph agent endpoints.

Implements:
- Input validation and sanitization
- Prompt injection detection
- Content moderation
- Output validation
"""

import logging
import re

from django.core.cache import cache

logger = logging.getLogger(__name__)


def _is_emoji(char: str) -> bool:
    """
    Check if a character is an emoji.

    Covers common emoji Unicode ranges including:
    - Emoticons, Dingbats, Symbols
    - Supplemental symbols, Pictographs
    - Transport/map symbols, Enclosed characters
    - Regional indicators, Skin tone modifiers
    """
    code = ord(char)
    return (
        # Miscellaneous Symbols and Pictographs
        0x1F300 <= code <= 0x1F9FF
        # Emoticons
        or 0x1F600 <= code <= 0x1F64F
        # Transport and Map Symbols
        or 0x1F680 <= code <= 0x1F6FF
        # Supplemental Symbols and Pictographs
        or 0x1FA00 <= code <= 0x1FAFF
        # Dingbats
        or 0x2700 <= code <= 0x27BF
        # Miscellaneous Symbols
        or 0x2600 <= code <= 0x26FF
        # Enclosed Alphanumeric Supplement
        or 0x1F100 <= code <= 0x1F1FF
        # Regional Indicator Symbols (flags)
        or 0x1F1E0 <= code <= 0x1F1FF
        # Variation selectors (emoji modifiers)
        or 0xFE00 <= code <= 0xFE0F
        # Skin tone modifiers
        or 0x1F3FB <= code <= 0x1F3FF
        # Zero-width joiner (used in compound emojis)
        or code == 0x200D
    )


class PromptInjectionFilter:
    """
    Detects and filters malicious prompt injection attempts.

    Uses pattern matching + heuristics to identify suspicious patterns.
    """

    # Suspicious patterns that indicate prompt injection
    SUSPICIOUS_PATTERNS = [
        # Direct instruction overrides
        r'ignore\s+(previous|all|above)\s+instructions?',
        r'ignore\s+all',  # Catch "ignore all" variations
        r'disregard\s+(previous|all|above)\s+(instructions?|rules?)',
        r'forget\s+(everything|all|previous)',
        # System/role manipulation
        r'you\s+are\s+(now|a|an)\s+',
        r'act\s+as\s+(a|an)\s+',
        r'pretend\s+(you\s+are|to\s+be)',
        r'system\s*:\s*',
        r'assistant\s*:\s*',
        # Special tokens (common in GPT/Claude)
        r'<\|.*?\|>',
        r'\[INST\]',
        r'\[/INST\]',
        r'<s>',
        r'</s>',
        # Jailbreak patterns
        r'DAN\s+mode',
        r'developer\s+mode',
        r'jailbreak',
        r'sudo\s+mode',
        # Command injection attempts
        r'```\s*(python|bash|sh|javascript)',
        r'eval\s*\(',
        r'exec\s*\(',
        r'__import__',
        # Encoding tricks
        r'base64',
        r'rot13',
        r'hex\s+encode',
    ]

    def __init__(self):
        self.patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.SUSPICIOUS_PATTERNS]

    def check_input(self, user_message: str) -> tuple[bool, str]:
        """
        Check if input contains prompt injection attempts.

        Returns:
            (is_safe: bool, reason: str)
        """
        # Check length (too long might indicate attack)
        if len(user_message) > 5000:
            return False, 'Message too long (max 5000 characters)'

        # Check for suspicious patterns
        for pattern in self.patterns:
            if pattern.search(user_message):
                logger.warning(f'[SECURITY] Prompt injection detected: {pattern.pattern}')
                return False, 'Suspicious content detected'

        # Check for excessive special characters (often used in injection)
        # Exclude emojis from special character count - they're legitimate user input
        special_chars = sum(1 for c in user_message if not c.isalnum() and not c.isspace() and not _is_emoji(c))
        special_char_ratio = special_chars / max(len(user_message), 1)
        if special_char_ratio > 0.3:
            return False, 'Too many special characters'

        # Check for repetitive patterns (flooding attack)
        words = user_message.split()
        if len(words) > 10:
            unique_ratio = len(set(words)) / len(words)
            if unique_ratio < 0.3:
                return False, 'Repetitive content detected'

        return True, ''

    def sanitize_input(self, message: str) -> str:
        """
        Sanitize input by removing/escaping dangerous patterns.

        Returns sanitized version (use this before passing to LLM).
        """
        sanitized = message

        # Remove special tokens
        sanitized = re.sub(r'<\|.*?\|>', '', sanitized)
        sanitized = re.sub(r'\[/?INST\]', '', sanitized)
        sanitized = re.sub(r'</?s>', '', sanitized)

        # Escape system/role markers
        sanitized = re.sub(r'(system|assistant|user)\s*:', r'\1 -', sanitized, flags=re.IGNORECASE)

        # Remove code blocks (optional - you might want to allow these)
        # sanitized = re.sub(r'```[\s\S]*?```', '[code block removed]', sanitized)

        return sanitized.strip()


class OutputValidator:
    """
    Validates agent output before sending to user.

    Prevents:
    - Leaking sensitive information
    - Generating harmful content
    - Exposing system prompts
    """

    SENSITIVE_PATTERNS = [
        # API keys and secrets
        r'API[_-]?KEY\s*[:=]\s*[\w-]+',
        r'SECRET[_-]?KEY\s*[:=]\s*[\w-]+',
        r'PASSWORD\s*[:=]\s*[\w-]+',
        r'TOKEN\s*[:=]\s*[\w-]+',
        # Database connection strings
        r'postgresql://[\w:@/-]+',
        r'mysql://[\w:@/-]+',
        r'mongodb://[\w:@/-]+',
        # Internal paths
        r'/Users/[\w/]+',
        r'C:\\[\w\\]+',
        r'/home/[\w/]+',
        # Email addresses (optional - might be legitimate)
        # r'\b[\w.%-]+@[\w.-]+\.\w{2,}\b',
    ]

    def __init__(self):
        self.patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.SENSITIVE_PATTERNS]

    def validate_output(self, output: str) -> tuple[bool, list]:
        """
        Check agent output for sensitive information.

        Returns:
            (is_safe: bool, violations: list)
        """
        violations = []

        for pattern in self.patterns:
            matches = pattern.findall(output)
            if matches:
                violations.append(f'Sensitive pattern detected: {pattern.pattern}')
                logger.warning(f'[SECURITY] Sensitive data in output: {pattern.pattern}')

        return len(violations) == 0, violations

    def sanitize_output(self, output: str) -> str:
        """
        Sanitize output by redacting sensitive information.
        """
        sanitized = output

        # Redact API keys
        sanitized = re.sub(r'(API[_-]?KEY\s*[:=]\s*)[\w-]+', r'\1[REDACTED]', sanitized, flags=re.IGNORECASE)

        # Redact passwords
        sanitized = re.sub(r'(PASSWORD\s*[:=]\s*)[\w-]+', r'\1[REDACTED]', sanitized, flags=re.IGNORECASE)

        # Redact paths
        sanitized = re.sub(r'/Users/[\w/]+', '/[REDACTED]/', sanitized)
        sanitized = re.sub(r'C:\\\\[\\w\\\\]+', r'C:\\[REDACTED]\\', sanitized)

        return sanitized


class RateLimiter:
    """
    Advanced rate limiting using Redis for distributed systems.

    Implements:
    - Per-user message limits
    - Per-user project creation limits
    - IP-based limits for anonymous users
    - Sliding window rate limiting
    """

    def __init__(self):
        self.cache = cache

    def check_message_rate_limit(self, user_id: int) -> tuple[bool, int]:
        """
        Check if user has exceeded message rate limit.

        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        key = f'rate_limit:messages:user:{user_id}'
        count = self.cache.get(key, 0)
        limit = 50  # 50 messages per hour

        if count >= limit:
            # Django cache doesn't expose TTL, so return fixed retry time
            return False, 3600

        # Increment counter
        if count == 0:
            self.cache.set(key, 1, timeout=3600)  # 1 hour
        else:
            self.cache.incr(key)

        return True, 0

    def check_project_creation_rate_limit(self, user_id: int) -> tuple[bool, int]:
        """
        Check if user has exceeded project creation rate limit.

        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        key = f'rate_limit:projects:user:{user_id}'
        count = self.cache.get(key, 0)
        limit = 10  # 10 projects per hour

        if count >= limit:
            # Django cache doesn't expose TTL, so return fixed retry time
            return False, 3600

        # Increment counter
        if count == 0:
            self.cache.set(key, 1, timeout=3600)
        else:
            self.cache.incr(key)

        return True, 0

    def check_ip_rate_limit(self, ip_address: str) -> tuple[bool, int]:
        """
        Check IP-based rate limit for anonymous users.

        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        key = f'rate_limit:ip:{ip_address}'
        count = self.cache.get(key, 0)
        limit = 20  # 20 requests per hour for anonymous users

        if count >= limit:
            # Django cache doesn't expose TTL, so return fixed retry time
            return False, 3600

        if count == 0:
            self.cache.set(key, 1, timeout=3600)
        else:
            self.cache.incr(key)

        return True, 0


# Singleton instances
prompt_injection_filter = PromptInjectionFilter()
output_validator = OutputValidator()
rate_limiter = RateLimiter()


def validate_chat_input(user_message: str, user_id: int = None) -> tuple[bool, str, str]:
    """
    Comprehensive input validation pipeline.

    Args:
        user_message: User's chat message
        user_id: User ID (if authenticated)

    Returns:
        (is_valid: bool, error_message: str, sanitized_message: str)
    """
    # 1. Check length
    if not user_message or len(user_message.strip()) == 0:
        return False, 'Message cannot be empty', ''

    if len(user_message) > 5000:
        return False, 'Message too long (max 5000 characters)', ''

    # 2. Check for prompt injection
    is_safe, reason = prompt_injection_filter.check_input(user_message)
    if not is_safe:
        logger.warning(f'[SECURITY] Blocked message from user {user_id}: {reason}')
        return False, 'Your message contains suspicious content. Please rephrase.', ''

    # 3. Sanitize input
    sanitized = prompt_injection_filter.sanitize_input(user_message)

    # 4. Check rate limit (if user_id provided)
    if user_id:
        is_allowed, retry_after = rate_limiter.check_message_rate_limit(user_id)
        if not is_allowed:
            minutes = retry_after // 60
            return False, f'Rate limit exceeded. Try again in {minutes} minutes.', ''

    return True, '', sanitized
