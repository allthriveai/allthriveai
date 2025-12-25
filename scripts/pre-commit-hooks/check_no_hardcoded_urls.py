#!/usr/bin/env python3
"""Pre-commit hook to check for hardcoded URLs in Python and TypeScript files."""

import re
import sys
from pathlib import Path

# Patterns to detect hardcoded URLs
URL_PATTERNS = [
    r'http://localhost:\d+',
    r'https://localhost:\d+',
    r'http://127\.0\.0\.1:\d+',
    r'https://127\.0\.0\.1:\d+',
    r'getattr\(settings,\s*[\'"][A-Z_]+[\'"]\s*,\s*[\'"]https?://',  # getattr with URL default
    # Production domain URLs (should use relative paths or settings.FRONTEND_URL)
    r'[\'"]https?://(?:www\.)?allthriveai\.com[/\'"?]',  # allthriveai.com URLs
    r'[\'"]https?://(?:www\.)?allthrive\.ai[/\'"?]',  # allthrive.ai URLs (when in string literals)
]

# Allowed patterns (exceptions) - order matters, checked first
ALLOWED_PATTERNS = [
    r'#.*http',  # Python comments
    r'""".*http.*"""',  # Python docstrings (single line)
    r"'''.*http.*'''",  # Python docstrings (single line)
    r'//.*http',  # JS/TS single-line comments
    r'/\*.*http.*\*/',  # JS/TS multi-line comments
    r'import\.meta\.env\.\w+\s*\|\|\s*[\'"]http',  # Vite env var fallback
    r'process\.env\.\w+\s*\|\|\s*[\'"]http',  # Node env var fallback
    r'VITE_\w+.*http',  # Vite config with env vars
    r're\.sub\(.*allthrive',  # Regex patterns for URL sanitization
    r'❌',  # Example text showing what NOT to do (in prompts/docs)
    r'WRONG',  # Example text showing what NOT to do
    r'mailto:',  # Email addresses are OK
    r'@allthrive\.ai',  # Email addresses
]

# Files to skip entirely (contain intentional domain references)
SKIP_FILES = [
    'check_no_hardcoded_urls.py',  # This file itself
    'prompts.py',  # AI agent prompts with examples
    'platform_knowledge.py',  # Agent platform knowledge
]


def check_file(filepath: Path) -> list[tuple[int, str]]:
    """Check a file for hardcoded URLs.

    Returns:
        List of (line_number, line_content) tuples for violations
    """
    # Skip files that intentionally contain domain references
    if filepath.name in SKIP_FILES:
        return []

    violations = []

    try:
        with open(filepath, encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                # Skip if line matches allowed patterns
                if any(re.search(pattern, line) for pattern in ALLOWED_PATTERNS):
                    continue

                # Check for URL patterns
                for pattern in URL_PATTERNS:
                    if re.search(pattern, line):
                        violations.append((line_num, line.strip()))
                        break

    except Exception as e:
        print(f'Error reading {filepath}: {e}', file=sys.stderr)

    return violations


def main(filenames: list[str]) -> int:
    """Main entry point for pre-commit hook.

    Returns:
        0 if no violations, 1 if violations found
    """
    has_violations = False

    for filename in filenames:
        filepath = Path(filename)
        violations = check_file(filepath)

        if violations:
            has_violations = True
            print(f'\n❌ Hardcoded URLs found in {filepath}:')
            for line_num, line in violations:
                print(f'  Line {line_num}: {line}')
            print('\n  Fix: Use settings.FRONTEND_URL or settings.BACKEND_URL instead')
            print('  Example: base_url = settings.FRONTEND_URL')

    if has_violations:
        print('\n' + '=' * 60)
        print('FAIL: Hardcoded URLs detected')
        print('=' * 60)
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
