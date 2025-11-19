#!/usr/bin/env python3
"""Pre-commit hook to prevent imports from core.models (use domain imports)."""
import re
import sys
from pathlib import Path


def check_file(filepath: Path) -> list[tuple[int, str]]:
    """Check a file for core.models imports.

    Returns:
        List of (line_number, line_content) tuples for violations
    """
    violations = []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                # Check for core.models imports
                if re.search(r"from\s+core\.models\s+import", line):
                    violations.append((line_num, line.strip()))

    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)

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
            print(f"\n❌ core.models imports found in {filepath}:")
            for line_num, line in violations:
                print(f"  Line {line_num}: {line}")
            print("\n  Fix: Use domain-specific imports instead")
            print("  Examples:")
            print("    from core.users.models import User")
            print("    from core.projects.models import Project")
            print("    from core.agents.models import Conversation")

    if has_violations:
        print("\n" + "=" * 60)
        print("FAIL: core.models imports detected")
        print("Use domain imports for better organization")
        print("=" * 60)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
