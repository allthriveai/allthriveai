#!/usr/bin/env python3
"""Pre-commit hook to ensure ForeignKey to User uses settings.AUTH_USER_MODEL."""

import re
import sys
from pathlib import Path


def check_file(filepath: Path) -> list[tuple[int, str]]:
    """Check a file for direct User model references in ForeignKeys.

    Returns:
        List of (line_number, line_content) tuples for violations
    """
    violations = []

    try:
        with open(filepath, encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        # Check if file imports User directly
        has_user_import = re.search(r'from\s+.*\.users\.models\s+import.*\bUser\b', content)

        if has_user_import:
            # Check for ForeignKey/OneToOneField/ManyToManyField with User
            for line_num, line in enumerate(lines, 1):
                if re.search(r'(ForeignKey|OneToOneField|ManyToManyField)\s*\(\s*User\s*,', line):
                    violations.append((line_num, line.strip()))

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
            print(f'\n❌ Direct User references in ForeignKey found in {filepath}:')
            for line_num, line in violations:
                print(f'  Line {line_num}: {line}')
            print('\n  Fix: Use settings.AUTH_USER_MODEL instead')
            print('  Example:')
            print('    from django.conf import settings')
            print('    ')
            print('    user = models.ForeignKey(')
            print('        settings.AUTH_USER_MODEL,')
            print('        on_delete=models.CASCADE')
            print('    )')

    if has_violations:
        print('\n' + '=' * 60)
        print('FAIL: Direct User model references in ForeignKey')
        print('Use settings.AUTH_USER_MODEL for swappable user models')
        print('=' * 60)
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
