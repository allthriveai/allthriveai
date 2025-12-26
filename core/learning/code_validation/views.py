"""
Code Validation API Views.

Provides REST endpoints for code validation with tiered approach:
- Tier 2: Server-side regex pattern matching
- Tier 3: AI-powered semantic validation
"""

import logging
from typing import Any

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .ai_validator import merge_validation_results, should_use_ai_validation, validate_with_ai
from .validators import check_common_mistakes, validate_patterns

logger = logging.getLogger(__name__)


class CodeValidationThrottle(UserRateThrottle):
    """Rate limiter for code validation requests."""

    scope = 'code_validation'


class CodeValidationAIThrottle(UserRateThrottle):
    """Rate limiter specifically for AI-powered validation."""

    scope = 'code_validation_ai'

    def get_cache_key(self, request, view):
        """Include user tier in cache key for tier-based limits."""
        if request.user.is_authenticated:
            return f'throttle_code_ai_{request.user.id}'
        return None


class ValidateCodeView(APIView):
    """
    Validate user code for correctness.

    POST /api/v1/code/validate/

    Request Body:
    {
        "code": "def hello(): print('hi')",
        "language": "python",
        "expected_patterns": ["def\\s+\\w+", "print\\s*\\("],
        "skill_level": "beginner",
        "exercise_id": "optional-for-caching"
    }

    Response:
    {
        "isCorrect": true/false,
        "status": "correct" | "almost_there" | "needs_work" | "major_issues",
        "issues": [...],
        "positives": [...],
        "nextStep": "...",
        "aiUsed": true/false,
        "patternResults": [...]
    }
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [CodeValidationThrottle]

    def post(self, request) -> Response:
        """Handle code validation request."""
        # Extract and validate request data
        code = request.data.get('code', '')
        language = request.data.get('language', 'python')
        expected_patterns = request.data.get('expected_patterns', [])
        skill_level = request.data.get('skill_level', 'beginner')
        _exercise_id = request.data.get('exercise_id')  # Reserved for future use

        # Validate required fields
        if not code:
            return Response(
                {
                    'isCorrect': False,
                    'status': 'needs_work',
                    'issues': [
                        {
                            'type': 'error',
                            'message': 'No code provided',
                            'explanation': 'Please write some code to validate.',
                        }
                    ],
                    'aiUsed': False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if language not in ['python', 'javascript', 'typescript', 'html', 'css']:
            language = 'python'  # Default to Python

        if skill_level not in ['beginner', 'intermediate', 'advanced']:
            skill_level = 'beginner'

        # Tier 2: Pattern validation
        tier2_result = validate_patterns(code, expected_patterns, language)

        # Add common mistake checks
        mistake_issues = check_common_mistakes(code, language, skill_level)
        tier2_result['issues'].extend(mistake_issues)

        # Determine if we should use AI validation
        use_ai = should_use_ai_validation(code, tier2_result, request.user.tier)

        if use_ai and self._check_ai_rate_limit(request):
            # Tier 3: AI validation
            logger.info(
                f'Using AI validation for user {request.user.id}, ' f'language={language}, skill_level={skill_level}'
            )

            ai_result = validate_with_ai(code, language, skill_level)
            result = merge_validation_results(tier2_result, ai_result)
        else:
            # Return Tier 2 results only
            result = self._format_tier2_response(tier2_result)

        return Response(result)

    def _check_ai_rate_limit(self, request) -> bool:
        """Check if user is within AI validation rate limits."""
        # Tier-based limits
        tier_limits = {
            'seedling': 10,
            'sprout': 20,
            'blossom': 50,
            'bloom': 100,
            'evergreen': -1,  # Unlimited
        }

        user_tier = getattr(request.user, 'tier', 'seedling')
        limit = tier_limits.get(user_tier, 10)

        if limit == -1:
            return True

        # Check using Django cache
        from django.core.cache import cache

        cache_key = f'code_ai_count_{request.user.id}'
        current_count = cache.get(cache_key, 0)

        if current_count >= limit:
            logger.info(f'User {request.user.id} exceeded AI validation limit ' f'({current_count}/{limit})')
            return False

        # Increment counter (expires in 1 hour)
        cache.set(cache_key, current_count + 1, timeout=3600)
        return True

    def _format_tier2_response(self, tier2_result: dict[str, Any]) -> dict[str, Any]:
        """Format Tier 2 results for API response."""
        passed = tier2_result.get('passed', False)
        issues = tier2_result.get('issues', [])

        # Determine status based on issues
        if passed and not issues:
            status_val = 'correct'
        elif passed and all(i.get('type') != 'error' for i in issues):
            status_val = 'almost_there'
        elif len([i for i in issues if i.get('type') == 'error']) <= 2:
            status_val = 'needs_work'
        else:
            status_val = 'major_issues'

        return {
            'isCorrect': passed and not any(i.get('type') == 'error' for i in issues),
            'status': status_val,
            'issues': issues,
            'positives': [],
            'nextStep': issues[0].get('hint', '') if issues else '',
            'aiUsed': False,
            'patternResults': tier2_result.get('pattern_results', []),
        }
