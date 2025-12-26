"""
AI-powered code validation (Tier 3).

Uses Claude to provide intelligent feedback on code correctness,
explaining WHY code is wrong rather than just THAT it's wrong.
"""

import hashlib
import json
import logging
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache TTL for AI validation results (1 hour)
VALIDATION_CACHE_TTL = 3600

AI_VALIDATION_PROMPT = """You are Sage, a patient and encouraging coding tutor reviewing student code.

EXERCISE CONTEXT:
- Language: {language}
- Skill level: {skill_level}

STUDENT CODE:
```{language}
{code}
```

Analyze the code and provide feedback. Respond with ONLY valid JSON (no markdown, no explanation outside JSON):

{{
  "isCorrect": true or false,
  "status": "correct" | "almost_there" | "needs_work" | "major_issues",
  "issues": [
    {{
      "type": "error" | "warning" | "suggestion",
      "line": line number or null,
      "message": "brief description of the issue",
      "explanation": "WHY this is a problem (educational, {skill_level}-appropriate)",
      "hint": "guiding question or partial solution to help them fix it"
    }}
  ],
  "positives": ["things they did well - be encouraging!"],
  "nextStep": "what to focus on first to improve the code"
}}

IMPORTANT GUIDELINES for {skill_level} learners:
- beginner: Very detailed explanations, encouraging tone, step-by-step hints, celebrate small wins
- intermediate: Concise explanations, assume basic knowledge, focus on best practices
- advanced: Brief feedback, focus on edge cases, performance, and advanced patterns

If the code is correct:
- Set isCorrect to true
- Set status to "correct"
- Leave issues empty
- Still provide positives to encourage them

Be encouraging even when pointing out issues. Remember this is a learning experience!
"""


def get_cache_key(code: str, language: str, skill_level: str) -> str:
    """Generate a cache key for the validation result."""
    code_hash = hashlib.sha256(code.encode()).hexdigest()[:32]  # noqa: S324
    return f'code_validation:{language}:{skill_level}:{code_hash}'


def validate_with_ai(
    code: str,
    language: str,
    skill_level: str,
    use_cache: bool = True,
) -> dict[str, Any]:
    """
    Validate code using AI for semantic understanding.

    Args:
        code: The user's code to validate
        language: Programming language (python, javascript, etc.)
        skill_level: User's skill level (beginner, intermediate, advanced)
        use_cache: Whether to use cached results for identical code

    Returns:
        dict with validation feedback
    """
    # Check cache first
    if use_cache:
        cache_key = get_cache_key(code, language, skill_level)
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.debug(f'Using cached AI validation result for {cache_key}')
            return cached_result

    try:
        # Import here to avoid circular imports
        from services.ai.provider import AIProvider

        prompt = AI_VALIDATION_PROMPT.format(
            language=language,
            skill_level=skill_level,
            code=code,
        )

        response = AIProvider.complete(
            messages=[{'role': 'user', 'content': prompt}],
            model='claude-sonnet-4-20250514',
            max_tokens=1000,
        )

        result = _parse_ai_response(response.content)
        result['aiUsed'] = True

        # Cache the result
        if use_cache and result:
            cache.set(cache_key, result, timeout=VALIDATION_CACHE_TTL)

        return result

    except Exception as e:
        logger.error(f'AI validation failed: {e}')
        return {
            'isCorrect': False,
            'status': 'needs_work',
            'issues': [
                {
                    'type': 'warning',
                    'message': 'Could not get AI feedback',
                    'explanation': 'The AI service is temporarily unavailable. Your code passed basic checks.',
                }
            ],
            'positives': [],
            'nextStep': 'Try again to get detailed feedback.',
            'aiUsed': False,
            'error': str(e),
        }


def _parse_ai_response(content: str) -> dict[str, Any]:
    """Parse the AI response JSON."""
    try:
        # Try to extract JSON from the response
        # Sometimes the AI adds markdown code blocks
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]

        result = json.loads(content.strip())

        # Validate expected fields
        return {
            'isCorrect': result.get('isCorrect', False),
            'status': result.get('status', 'needs_work'),
            'issues': result.get('issues', []),
            'positives': result.get('positives', []),
            'nextStep': result.get('nextStep', ''),
            'aiUsed': True,
        }

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse AI response: {e}')
        logger.debug(f'Raw content: {content}')

        # Return a fallback response
        return {
            'isCorrect': False,
            'status': 'needs_work',
            'issues': [
                {
                    'type': 'warning',
                    'message': 'Could not parse AI feedback',
                    'explanation': 'There was an issue processing the feedback. Your code passed basic checks.',
                }
            ],
            'positives': [],
            'nextStep': 'Try submitting again.',
            'aiUsed': True,
        }


def should_use_ai_validation(
    code: str,
    tier2_result: dict[str, Any],
    user_tier: str = 'seedling',
) -> bool:
    """
    Determine if AI validation should be used.

    Conditions to skip AI:
    - Tier 2 found definitive syntax errors
    - Code is too short to be meaningful
    - User has exceeded rate limits (handled at view level)
    """
    # Skip if Tier 2 found errors
    if not tier2_result.get('passed', True) and not tier2_result.get('ambiguous', False):
        return False

    # Skip if code is too short
    if len(code.strip()) < 10:
        return False

    # Use AI if Tier 2 passed or was ambiguous
    return True


def merge_validation_results(
    tier2_result: dict[str, Any],
    ai_result: dict[str, Any],
) -> dict[str, Any]:
    """
    Merge Tier 2 (regex) and Tier 3 (AI) validation results.

    AI result takes precedence for overall correctness,
    but we keep pattern results from Tier 2 for transparency.
    """
    # Start with AI result as base
    merged = {
        'isCorrect': ai_result.get('isCorrect', False),
        'status': ai_result.get('status', 'needs_work'),
        'issues': ai_result.get('issues', []),
        'positives': ai_result.get('positives', []),
        'nextStep': ai_result.get('nextStep', ''),
        'aiUsed': ai_result.get('aiUsed', True),
    }

    # Add pattern results from Tier 2
    merged['patternResults'] = tier2_result.get('pattern_results', [])

    # If Tier 2 found missing patterns that AI didn't catch, add them
    tier2_issues = tier2_result.get('issues', [])
    ai_issue_messages = {issue.get('message', '') for issue in merged['issues']}

    for issue in tier2_issues:
        if issue.get('message') not in ai_issue_messages:
            merged['issues'].append(issue)

    return merged
