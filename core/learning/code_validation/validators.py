"""
Code validation utilities (Tier 2: Server-side regex validation).
"""

import re
from typing import Any


def get_line_number(code: str, match: re.Match | None) -> int | None:
    """Get the line number where a regex match occurs."""
    if not match:
        return None
    return code[: match.start()].count('\n') + 1


def validate_patterns(
    code: str,
    required_patterns: list[str],
    language: str,
) -> dict[str, Any]:
    """
    Validate that code contains all required patterns.

    Args:
        code: The user's code to validate
        required_patterns: List of regex patterns that must be present
        language: The programming language (for future language-specific checks)

    Returns:
        dict with:
            - passed: bool - True if all patterns found
            - pattern_results: list of results per pattern
            - issues: list of error messages for missing patterns
            - ambiguous: bool - True if patterns passed but AI should double-check
    """
    if not code.strip():
        return {
            'passed': False,
            'pattern_results': [],
            'issues': [
                {
                    'type': 'error',
                    'message': 'No code provided',
                    'explanation': 'Please write some code to validate.',
                }
            ],
            'ambiguous': False,
        }

    results = []
    issues = []

    for pattern in required_patterns:
        try:
            match = re.search(pattern, code, re.IGNORECASE | re.MULTILINE)
            line_num = get_line_number(code, match) if match else None

            results.append(
                {
                    'pattern': pattern,
                    'found': bool(match),
                    'line': line_num,
                }
            )

            if not match:
                # Try to generate a human-readable message for common patterns
                friendly_message = _get_friendly_pattern_message(pattern, language)
                issues.append(
                    {
                        'type': 'error',
                        'message': friendly_message,
                        'explanation': f'Your code should include: {pattern}',
                    }
                )
        except re.error as e:
            # Invalid regex pattern - log but don't fail
            results.append(
                {
                    'pattern': pattern,
                    'found': False,
                    'line': None,
                    'error': str(e),
                }
            )

    passed = all(r['found'] for r in results)

    # If all patterns pass, it might still need AI review for logic errors
    # Mark as ambiguous if the code is very short or has unusual structure
    ambiguous = passed and (
        len(code.strip().split('\n')) < 3  # Very short code
        or len(results) == 0  # No patterns to check
    )

    return {
        'passed': passed,
        'pattern_results': results,
        'issues': issues,
        'ambiguous': ambiguous,
    }


def _get_friendly_pattern_message(pattern: str, language: str) -> str:
    """Convert a regex pattern to a human-readable message."""
    # Common pattern translations
    pattern_messages = {
        # Python
        r'def\s+\w+\s*\(': 'Missing function definition (def ...)',
        r'print\s*\(': 'Missing print() call',
        r'for\s+\w+\s+in\s+': 'Missing for loop',
        r'while\s+.+:': 'Missing while loop',
        r'if\s+.+:': 'Missing if statement',
        r'class\s+\w+': 'Missing class definition',
        r'return\s+': 'Missing return statement',
        r'import\s+\w+': 'Missing import statement',
        # JavaScript
        r'function\s+\w+\s*\(': 'Missing function declaration',
        r'const\s+\w+\s*=': 'Missing const declaration',
        r'let\s+\w+\s*=': 'Missing let declaration',
        r'console\.log\s*\(': 'Missing console.log() call',
        r'=>\s*[{(]?': 'Missing arrow function',
        # HTML
        r'<!DOCTYPE\s+html>': 'Missing DOCTYPE declaration',
        r'<html[^>]*>': 'Missing <html> tag',
        r'<head[^>]*>': 'Missing <head> tag',
        r'<body[^>]*>': 'Missing <body> tag',
    }

    # Check for exact or similar matches
    for known_pattern, message in pattern_messages.items():
        if pattern == known_pattern or pattern.replace(r'\s+', r'\s*') == known_pattern:
            return message

    # Fallback: try to extract meaningful info from the pattern
    if r'\s+\w+' in pattern:
        # Looks like it's looking for a keyword followed by an identifier
        keyword = pattern.split(r'\s+')[0].replace('\\', '')
        return f'Missing {keyword} statement or declaration'

    return 'Missing required code pattern'


def check_common_mistakes(
    code: str,
    language: str,
    skill_level: str,
) -> list[dict[str, Any]]:
    """
    Check for common beginner mistakes in code.

    Returns a list of warning/suggestion issues.
    """
    issues = []
    lines = code.split('\n')

    if language == 'python':
        issues.extend(_check_python_mistakes(lines, skill_level))
    elif language in ('javascript', 'typescript'):
        issues.extend(_check_javascript_mistakes(lines, skill_level))
    elif language == 'html':
        issues.extend(_check_html_mistakes(code, skill_level))

    return issues


def _check_python_mistakes(lines: list[str], skill_level: str) -> list[dict[str, Any]]:
    """Check for common Python mistakes."""
    issues = []

    for i, line in enumerate(lines):
        line_num = i + 1
        stripped = line.strip()

        # Single = in condition
        if re.match(r'^(if|elif|while)\s+', stripped):
            # Look for = that's not ==, <=, >=, !=
            if re.search(r'[^=!<>]=[^=]', stripped):
                issues.append(
                    {
                        'type': 'warning',
                        'line': line_num,
                        'message': 'Possible assignment in condition',
                        'explanation': 'Did you mean to use == for comparison?',
                        'hint': 'Use == to compare values, = is for assignment.',
                    }
                )

        # Missing colon after control statements
        control_keywords = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'try', 'except', 'finally', 'with']
        for keyword in control_keywords:
            if re.match(rf'^{keyword}\s', stripped) or stripped == keyword:
                if not stripped.endswith(':') and not stripped.endswith('\\'):
                    issues.append(
                        {
                            'type': 'error',
                            'line': line_num,
                            'message': f"Missing colon after '{keyword}'",
                            'explanation': f'In Python, {keyword} statements must end with a colon (:).',
                            'hint': f'Add : at the end of line {line_num}.',
                        }
                    )

    return issues


def _check_javascript_mistakes(lines: list[str], skill_level: str) -> list[dict[str, Any]]:
    """Check for common JavaScript mistakes."""
    issues = []

    for i, line in enumerate(lines):
        line_num = i + 1
        stripped = line.strip()

        # var usage (suggest let/const)
        if re.search(r'\bvar\s+', stripped) and skill_level != 'advanced':
            issues.append(
                {
                    'type': 'suggestion',
                    'line': line_num,
                    'message': 'Consider using let or const instead of var',
                    'explanation': 'Modern JavaScript prefers let/const for better scoping.',
                    'hint': "Use const for values that don't change, let for values that do.",
                }
            )

        # == instead of ===
        if re.search(r'[^=!]==[^=]', stripped) and '===' not in stripped:
            issues.append(
                {
                    'type': 'warning',
                    'line': line_num,
                    'message': 'Consider using === instead of ==',
                    'explanation': '=== is stricter and avoids type coercion issues.',
                    'hint': 'Use === for strict equality comparison.',
                }
            )

    return issues


def _check_html_mistakes(code: str, skill_level: str) -> list[dict[str, Any]]:
    """Check for common HTML mistakes."""
    issues = []

    # Missing DOCTYPE
    if not re.search(r'<!DOCTYPE\s+html>', code, re.IGNORECASE):
        issues.append(
            {
                'type': 'warning',
                'line': 1,
                'message': 'Missing DOCTYPE declaration',
                'explanation': 'HTML documents should start with <!DOCTYPE html>.',
                'hint': 'Add <!DOCTYPE html> at the very beginning.',
            }
        )

    # Check for unclosed tags (basic check)
    tags_to_check = ['html', 'head', 'body', 'div', 'p', 'span', 'ul', 'ol', 'li']
    for tag in tags_to_check:
        open_count = len(re.findall(rf'<{tag}[^/>]*>', code, re.IGNORECASE))
        close_count = len(re.findall(rf'</{tag}>', code, re.IGNORECASE))

        if open_count > close_count:
            issues.append(
                {
                    'type': 'error',
                    'message': f'Unclosed <{tag}> tag',
                    'explanation': f'Found {open_count} opening <{tag}> tags but only {close_count} closing tags.',
                    'hint': f'Add </{tag}> to close the tag.',
                }
            )

    return issues
