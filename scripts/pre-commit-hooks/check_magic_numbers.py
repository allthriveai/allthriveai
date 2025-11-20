#!/usr/bin/env python3
"""Pre-commit hook to detect magic numbers in Python files."""

import re
import sys
from pathlib import Path

# Numbers that are commonly acceptable
ALLOWED_NUMBERS = {0, 1, 2, -1, 100, 1000}

# Patterns to ignore
IGNORE_PATTERNS = [
    r'#.*',  # Comments
    r'""".*"""',  # Docstrings
    r"'''.*'''",  # Docstrings
    r'range\(',  # range() calls
    r'sleep\(',  # sleep() calls
    r'random\.',  # random module calls
]


def is_magic_number(line: str) -> list[str]:
    """Check if line contains magic numbers.

    Returns:
        List of magic numbers found
    """
    # Skip lines matching ignore patterns
    for pattern in IGNORE_PATTERNS:
        if re.search(pattern, line):
            return []

    # Find numeric literals (but not in variable names or strings)
    # This is a simplified check - may have false positives
    number_pattern = r'\b(\d+)\b'

    magic_numbers = []
    for match in re.finditer(number_pattern, line):
        num_str = match.group(1)
        try:
            num = int(num_str)
            if num not in ALLOWED_NUMBERS and num > 10:  # Flag numbers > 10
                # Check context - skip if it's part of a common pattern
                start = max(0, match.start() - 20)
                context = line[start : match.end() + 10]

                # Skip if it looks like a port, version, or ID
                if any(keyword in context.lower() for keyword in ['port', 'version', 'id', 'status', 'http']):
                    continue

                magic_numbers.append(num_str)
        except ValueError:
            pass

    return magic_numbers


def check_file(filepath: Path) -> list[tuple[int, str, list[str]]]:
    """Check a file for magic numbers.

    Returns:
        List of (line_number, line_content, magic_numbers) tuples
    """
    findings = []

    try:
        with open(filepath, encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                magic_nums = is_magic_number(line)
                if magic_nums:
                    findings.append((line_num, line.strip(), magic_nums))

    except Exception as e:
        print(f'Error reading {filepath}: {e}', file=sys.stderr)

    return findings


def main(filenames: list[str]) -> int:
    """Main entry point for pre-commit hook.

    Returns:
        0 if no violations, 1 if violations found
    """
    has_violations = False

    for filename in filenames:
        filepath = Path(filename)
        findings = check_file(filepath)

        if findings:
            has_violations = True
            print(f'\n⚠️  Potential magic numbers in {filepath}:')
            for line_num, line, magic_nums in findings:
                print(f'  Line {line_num}: {line}')
                print(f'    Numbers: {", ".join(magic_nums)}')
            print('\n  Fix: Extract to constants file')
            print('  Example: Create constants.py and use named constants')

    if has_violations:
        print('\n' + '=' * 60)
        print('WARN: Potential magic numbers detected')
        print('Consider extracting to constants for better maintainability')
        print('=' * 60)
        print('\nThis is a warning only - commit will proceed')
        # Return 0 to allow commit, just warn
        return 0

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
