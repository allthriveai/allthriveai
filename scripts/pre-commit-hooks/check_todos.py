#!/usr/bin/env python3
"""Pre-commit hook to check for TODO/FIXME comments before pushing."""
import re
import sys
from pathlib import Path

TODO_PATTERNS = [
    r"#\s*TODO\b",
    r"#\s*FIXME\b",
    r"#\s*XXX\b",
    r"#\s*HACK\b",
]


def check_file(filepath: Path) -> list[tuple[int, str, str]]:
    """Check a file for TODO/FIXME comments.

    Returns:
        List of (line_number, keyword, line_content) tuples
    """
    findings = []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                for pattern in TODO_PATTERNS:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        keyword = match.group(0).strip("# ").upper()
                        findings.append((line_num, keyword, line.strip()))
                        break

    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)

    return findings


def main(filenames: list[str]) -> int:
    """Main entry point for pre-commit hook.

    Returns:
        0 if no TODOs, 1 if TODOs found
    """
    has_todos = False

    for filename in filenames:
        filepath = Path(filename)
        findings = check_file(filepath)

        if findings:
            has_todos = True
            print(f"\n⚠️  TODO/FIXME comments found in {filepath}:")
            for line_num, keyword, line in findings:
                print(f"  Line {line_num} [{keyword}]: {line}")

    if has_todos:
        print("\n" + "=" * 60)
        print("WARN: TODO/FIXME comments detected before push")
        print("Complete or remove these before production deployment")
        print("=" * 60)
        print("\nTo bypass this check (not recommended):")
        print("  git push --no-verify")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
