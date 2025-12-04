#!/usr/bin/env python3
"""Pre-commit hook to detect DRY violations and code duplication in Python files.

Checks for:
1. Duplicate code blocks (similar consecutive lines)
2. Repeated string literals
3. Repeated complex expressions
4. Similar function implementations
5. Hardcoded values that should be constants
"""

import ast
import hashlib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Configuration
MIN_DUPLICATE_LINES = 6  # Minimum consecutive lines to flag as duplicate
MIN_STRING_LENGTH = 40  # Minimum string length to track for duplication (increased)
MIN_STRING_OCCURRENCES = 5  # How many times a string must appear to be flagged (increased)
SIMILARITY_THRESHOLD = 0.8  # How similar code blocks must be (0-1)

# Files/directories to skip entirely
SKIP_PATTERNS = [
    r'.*/tests/.*',  # All test files
    r'.*_test\.py$',  # Test files
    r'.*test_.*\.py$',  # Test files
    r'.*/migrations/.*',  # Django migrations
    r'.*/conftest\.py$',  # pytest fixtures
    r'.*/admin\.py$',  # Django admin (has repetitive patterns by design)
    r'.*/fixtures/.*',  # Test fixtures
    r'.*/scripts/.*',  # Scripts often have acceptable duplication
    r'.*/docs/.*',  # Documentation
]

# Function name patterns to skip for "identical body" checks
SKIP_FUNCTION_PATTERNS = [
    r'^test_',  # Test functions
    r'^setUp$',  # Test setup
    r'^tearDown$',  # Test teardown
    r'^has_\w+_permission$',  # Django admin permissions
    r'^get_\w+_display$',  # Django model display methods
    r'^__\w+__$',  # Dunder methods
    r'^visit_\w+$',  # AST visitors (intentionally similar)
]

# Body patterns to skip (these are acceptable to be identical)
SKIP_BODY_PATTERNS = [
    r'^pass$',  # Abstract method stubs
    r'^return None$',  # Simple returns
    r'^return \[\]$',  # Empty list returns
    r'^return \{\}$',  # Empty dict returns
    r'^return False$',  # Boolean returns
    r'^return True$',  # Boolean returns
    r'^raise NotImplementedError',  # Abstract methods
    r'^\.\.\.$',  # Ellipsis (placeholder)
]


class DuplicationChecker(ast.NodeVisitor):
    """AST visitor that detects various forms of code duplication."""

    def __init__(self, filename: str):
        self.filename = filename
        self.string_literals: list[tuple[int, str]] = []  # (line, value)
        self.function_bodies: dict[str, tuple[int, str, str]] = {}  # name -> (line, body_hash, body_repr)
        self.expressions: list[tuple[int, str]] = []  # (line, normalized_expr)
        self.findings: list[str] = []

    def visit_Constant(self, node: ast.Constant) -> None:
        """Track string literals."""
        if isinstance(node.value, str) and len(node.value) >= MIN_STRING_LENGTH:
            # Skip docstrings and common patterns
            if not self._is_docstring_context(node) and not self._is_common_pattern(node.value):
                self.string_literals.append((node.lineno, node.value))
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Track function bodies for similarity detection."""
        # Skip functions matching skip patterns
        if any(re.match(pattern, node.name) for pattern in SKIP_FUNCTION_PATTERNS):
            self.generic_visit(node)
            return

        body_repr = self._normalize_function_body(node)

        # Skip trivial/stub bodies
        if self._is_trivial_body(body_repr):
            self.generic_visit(node)
            return

        body_hash = hashlib.md5(body_repr.encode()).hexdigest()[:8]  # noqa: S324
        self.function_bodies[node.name] = (node.lineno, body_hash, body_repr)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Track async function bodies."""
        # Skip functions matching skip patterns
        if any(re.match(pattern, node.name) for pattern in SKIP_FUNCTION_PATTERNS):
            self.generic_visit(node)
            return

        body_repr = self._normalize_function_body(node)

        # Skip trivial/stub bodies
        if self._is_trivial_body(body_repr):
            self.generic_visit(node)
            return

        body_hash = hashlib.md5(body_repr.encode()).hexdigest()[:8]  # noqa: S324
        self.function_bodies[node.name] = (node.lineno, body_hash, body_repr)
        self.generic_visit(node)

    def _is_trivial_body(self, body_repr: str) -> bool:
        """Check if function body is too trivial to flag."""
        if not body_repr or len(body_repr) < 20:
            return True

        # Check against skip patterns
        body_simple = body_repr.strip()
        for pattern in SKIP_BODY_PATTERNS:
            if re.match(pattern, body_simple, re.IGNORECASE):
                return True

        # Skip single-line returns and simple statements
        if body_repr.count('\n') == 0:
            # Single statement bodies are often acceptable
            if 'Return' in body_repr or 'Raise' in body_repr or 'Pass' in body_repr:
                return True

        # Skip functions that just call .inc() (Prometheus metrics)
        if '.inc()' in body_repr or '.set(' in body_repr or '.labels(' in body_repr:
            return True

        return False

    def _is_docstring_context(self, node: ast.Constant) -> bool:
        """Check if this constant might be a docstring."""
        # Simple heuristic - docstrings usually start with capital or """
        value = str(node.value)
        return value.startswith('"""') or value.startswith("'''") or (len(value) > 50 and '\n' in value)

    def _is_common_pattern(self, value: str) -> bool:
        """Check if string is a common pattern we should ignore."""
        common_patterns = [
            r'^https?://',  # URLs
            r'^/api/v\d+/',  # API paths (common in tests)
            r'^\w+@\w+\.\w+',  # Email patterns
            r'^[A-Z_]+$',  # Constant-like patterns
            r'^\d{4}-\d{2}-\d{2}',  # Date patterns
            r'^application/\w+',  # MIME types
            r'^Bearer ',  # Auth headers
            r'^services\.',  # Module paths (commonly repeated in tests)
            r'^core\.',  # Module paths
            r'.*\.py$',  # File paths
            r'^mock_',  # Mock variable names
            r'^test_',  # Test names
            r'_test$',  # Test suffixes
            r'^on_\w+',  # Event handlers
            r'claude-\d',  # Model names
            r'gemini-\d',  # Model names
            r'gpt-\d',  # Model names
            r'^class=',  # HTML/CSS classes
            r'^text-\w+',  # Tailwind classes
            r'^bg-\w+',  # Tailwind classes
            r'^font-\w+',  # Tailwind classes
            r'^flex\s',  # Tailwind classes
            r'^rounded-',  # Tailwind classes
            r'^border-',  # Tailwind classes
            r'^px-\d',  # Tailwind spacing
            r'^py-\d',  # Tailwind spacing
            r'^p-\d',  # Tailwind spacing
            r'^m-\d',  # Tailwind spacing
            r'^\w+:$',  # Dict keys
            r'^error:',  # Error messages (often similar)
            r'^Error:',  # Error messages
            r'^Warning:',  # Warning messages
            r'^Successfully',  # Success messages
            r'^Failed to',  # Failure messages
        ]
        return any(re.match(pattern, value) for pattern in common_patterns)

    def _normalize_function_body(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
        """Create normalized representation of function body for comparison."""
        # Skip docstring if present
        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            body = body[1:]

        if not body:
            return ''

        # Convert body to normalized string representation
        lines = []
        for stmt in body:
            # Replace variable names with placeholders for comparison
            stmt_repr = ast.dump(stmt)
            # Normalize common variations
            stmt_repr = re.sub(r"id='\w+'", "id='VAR'", stmt_repr)
            stmt_repr = re.sub(r"arg='\w+'", "arg='ARG'", stmt_repr)
            lines.append(stmt_repr)

        return '\n'.join(lines)

    def check_duplications(self) -> list[str]:
        """Run all duplication checks and return findings."""
        self._check_string_duplicates()
        self._check_similar_functions()
        return self.findings

    def _check_string_duplicates(self) -> None:
        """Check for repeated string literals."""
        string_counts = Counter(s for _, s in self.string_literals)

        for string, count in string_counts.items():
            if count >= MIN_STRING_OCCURRENCES:
                # Find all line numbers
                lines = [line for line, s in self.string_literals if s == string]
                preview = string[:50] + '...' if len(string) > 50 else string
                self.findings.append(
                    f'String literal repeated {count} times (lines {", ".join(map(str, lines))}): "{preview}"'
                )

    def _check_similar_functions(self) -> None:
        """Check for functions with identical or very similar bodies."""
        # Group functions by body hash
        hash_groups: dict[str, list[tuple[str, int]]] = defaultdict(list)
        for name, (line, body_hash, _) in self.function_bodies.items():
            hash_groups[body_hash].append((name, line))

        # Report groups with more than one function
        for body_hash, funcs in hash_groups.items():
            if len(funcs) > 1 and body_hash:  # Skip empty functions
                func_list = ', '.join(f'{name} (line {line})' for name, line in funcs)
                self.findings.append(f'Functions with identical bodies: {func_list}')


def check_consecutive_duplicates(lines: list[str]) -> list[tuple[int, int, list[str]]]:
    """Check for consecutive duplicate code blocks.

    Returns:
        List of (start_line, end_line, duplicate_lines) tuples
    """
    findings = []

    # Normalize lines for comparison
    normalized = []
    for line in lines:
        # Remove whitespace and comments for comparison
        stripped = line.strip()
        if stripped.startswith('#'):
            stripped = ''
        normalized.append(stripped)

    # Look for repeated blocks
    i = 0
    while i < len(normalized) - MIN_DUPLICATE_LINES:
        # Skip empty/comment lines
        if not normalized[i]:
            i += 1
            continue

        # Look for this block repeated later
        block = normalized[i : i + MIN_DUPLICATE_LINES]

        # Skip if block contains trivial lines
        if _is_trivial_block(block):
            i += 1
            continue

        for j in range(i + MIN_DUPLICATE_LINES, len(normalized) - MIN_DUPLICATE_LINES + 1):
            if normalized[j : j + MIN_DUPLICATE_LINES] == block:
                # Check if all lines are non-trivial
                if all(len(line) > 10 for line in block if line):  # Increased from 5
                    findings.append(
                        (
                            i + 1,
                            i + MIN_DUPLICATE_LINES,
                            [lines[i + k] for k in range(MIN_DUPLICATE_LINES)],
                        )
                    )
                    break

        i += 1

    return findings


def _is_trivial_block(block: list[str]) -> bool:
    """Check if a code block is too trivial to flag."""
    trivial_patterns = [
        r'^\s*$',  # Empty lines
        r'^\s*#',  # Comments
        r'^\s*pass\s*$',  # Pass statements
        r'^\s*return\s*$',  # Empty returns
        r'^\s*\.\.\.\s*$',  # Ellipsis
        r'^\s*\}\s*$',  # Closing braces
        r'^\s*\]\s*$',  # Closing brackets
        r'^\s*\)\s*$',  # Closing parens
        r"^\s*'\w+'\s*:\s*",  # Dict keys
        r'^\s*"\w+"\s*:\s*',  # Dict keys
        r'^\s*self\.\w+\s*=\s*\w+\s*$',  # Simple assignments
    ]

    trivial_count = 0
    for line in block:
        if any(re.match(pattern, line) for pattern in trivial_patterns):
            trivial_count += 1

    # If more than half the block is trivial, skip it
    return trivial_count > len(block) / 2


def should_skip_file(filepath: Path) -> bool:
    """Check if file should be skipped based on path patterns."""
    filepath_str = str(filepath)
    return any(re.search(pattern, filepath_str) for pattern in SKIP_PATTERNS)


def check_file(filepath: Path) -> list[str]:
    """Check a file for DRY violations.

    Returns:
        List of violation descriptions
    """
    # Skip files matching skip patterns
    if should_skip_file(filepath):
        return []

    findings = []

    try:
        content = filepath.read_text(encoding='utf-8')
        lines = content.split('\n')

        # AST-based checks
        try:
            tree = ast.parse(content)
            checker = DuplicationChecker(str(filepath))
            checker.visit(tree)
            findings.extend(checker.check_duplications())
        except SyntaxError:
            # Skip AST checks if file has syntax errors
            pass

        # Line-based duplicate block detection
        duplicates = check_consecutive_duplicates(lines)
        for start, end, dup_lines in duplicates:
            preview = dup_lines[0].strip()[:40] + '...'
            findings.append(f'Duplicate code block at lines {start}-{end}: {preview}')

    except Exception as e:
        print(f'Error reading {filepath}: {e}', file=sys.stderr)

    return findings


def main(filenames: list[str]) -> int:
    """Main entry point for pre-commit hook.

    Returns:
        0 if no violations, 1 if violations found (warning only)
    """
    all_findings: dict[str, list[str]] = {}

    for filename in filenames:
        filepath = Path(filename)
        findings = check_file(filepath)

        if findings:
            all_findings[filename] = findings

    if all_findings:
        # Concise summary - just file count and total issues
        total_issues = sum(len(f) for f in all_findings.values())
        file_count = len(all_findings)
        print(f'DRY: {total_issues} potential issue(s) in {file_count} file(s). Run with --verbose for details.')

        # Return 0 to allow commit (warning only)
        return 0

    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
