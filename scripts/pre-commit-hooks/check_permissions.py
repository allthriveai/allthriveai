#!/usr/bin/env python3
"""Pre-commit hook to ensure ViewSets have explicit permission_classes."""

import re
import sys
from pathlib import Path


def check_file(filepath: Path) -> list[tuple[str, int]]:
    """Check a file for ViewSets without permission_classes.

    Returns:
        List of (class_name, line_number) tuples for violations
    """
    violations = []

    try:
        with open(filepath, encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        # Find all ViewSet class definitions
        viewset_pattern = r'class\s+(\w+)\([^)]*ViewSet[^)]*\):'

        for match in re.finditer(viewset_pattern, content):
            class_name = match.group(1)
            start_pos = match.start()

            # Find the line number
            line_num = content[:start_pos].count('\n') + 1

            # Find the class body (indented block after class definition)
            match.end()

            # Look for permission_classes in the next ~20 lines of the class
            check_lines = lines[line_num : line_num + 20]
            class_body = '\n'.join(check_lines)

            # Check if permission_classes is defined
            if not re.search(r'permission_classes\s*=', class_body):
                violations.append((class_name, line_num))

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
            print(f'\n❌ ViewSets without explicit permission_classes in {filepath}:')
            for class_name, line_num in violations:
                print(f'  Line {line_num}: {class_name}')
            print('\n  Fix: Add explicit permission_classes to each ViewSet')
            print('  Example:')
            print('    from rest_framework.permissions import IsAuthenticated')
            print('    ')
            print('    class MyViewSet(viewsets.ModelViewSet):')
            print('        permission_classes = [IsAuthenticated]')

    if has_violations:
        print('\n' + '=' * 60)
        print('FAIL: ViewSets missing explicit permissions')
        print('=' * 60)
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
