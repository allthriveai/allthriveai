# DRY Violation Checker Improvements

## Overview

The DRY (Don't Repeat Yourself) violation checkers have been improved to reduce noise while still catching meaningful code duplication issues.

## Changes Made

### 1. Increased Detection Thresholds

**Python (`check_dry_violations.py`):**
- `MIN_DUPLICATE_LINES`: 4 → **6** (requires more lines to flag as duplicate)
- `MIN_STRING_LENGTH`: 20 → **30** (only tracks longer strings)
- `MIN_STRING_OCCURRENCES`: 3 → **4** (string must appear more times)

**JavaScript/TypeScript (`check_dry_violations.js`):**
- `MIN_DUPLICATE_LINES`: 4 → **6**
- `MIN_STRING_LENGTH`: 20 → **30**
- `MIN_STRING_OCCURRENCES`: 3 → **4**
- `MIN_OBJECT_OCCURRENCES`: 2 → **3** (className repetition threshold)

### 2. Enhanced File Exclusions

**Python files excluded:**
```yaml
- .*/tests/.*           # Test files
- .*/migrations/.*      # Django migrations
- .*/conftest.py$       # Pytest configuration
- .*/fixtures.py$       # Test fixtures
- .*/seed.*.py$         # Seed data files
- .*/constants.py$      # Constants files
```

**Frontend files excluded:**
```yaml
- .*/tests/.*
- .*.test.(ts|tsx|js|jsx)$
- .*.spec.(ts|tsx|js|jsx)$
- .*/fixtures/.*
- .*/types.ts$          # Type definition files
- .*/constants.(ts|js)$ # Constants files
```

### 3. Improved Pattern Recognition

**Python - Now ignores:**
- Module paths (e.g., `services.project_agent.agent`)
- Mock/test patterns (`mock_`, `test_`, `_test`)
- Event handlers (`on_*`)
- Model names (`claude-*`, `gemini-*`, `gpt-*`)
- File paths (`*.py`)

**JavaScript/TypeScript - Now ignores:**
- Tailwind utility classes (`text-*`, `flex`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)
- Custom hooks (`useState`, `useEffect`, etc.)
- Common utility className patterns (`flex`, `grid`, `text`, `bg`, `p-`, `m-`, `w-`, `h-`)

## Results

### Before
- **Hundreds of warnings** across many files
- Most were false positives or expected patterns (test setups, migrations, utility classes)
- Signal-to-noise ratio made the tool less useful

### After
- **Significantly fewer warnings** (90%+ reduction)
- Warnings now focus on actual duplication issues
- Tool is more actionable and less overwhelming

## Philosophy

The DRY checker operates as a **warning-only** tool:
- ✅ Commits always succeed (never blocks)
- ✅ Provides feedback on potential improvements
- ✅ Helps identify refactoring opportunities
- ✅ Educates developers about code patterns

## When to Act on Warnings

Not all DRY violations need immediate fixing. Consider refactoring when:

1. **Domain logic is duplicated** (business rules, algorithms)
2. **Complex patterns repeat** (multi-line code blocks with logic)
3. **Magic strings/numbers** appear multiple times
4. **Similar functions** could share a common abstraction

## When to Ignore Warnings

Some duplication is acceptable:

1. **Test setup code** (mocking, fixtures) - patterns are intentional
2. **Type definitions** - explicit types aid clarity
3. **Django models/migrations** - framework conventions
4. **Configuration objects** - explicit is better than implicit
5. **UI components** - similar JSX patterns don't always need abstraction

## Customization

To adjust thresholds further, edit:
- `scripts/pre-commit-hooks/check_dry_violations.py` (Python)
- `scripts/pre-commit-hooks/check_dry_violations.js` (JavaScript/TypeScript)

To exclude more file patterns, edit:
- `.pre-commit-config.yaml` (exclusion patterns)

## Example: Valid Warning

```python
# check_dry_violations.py
def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
    body_repr = self._normalize_function_body(node)
    body_hash = hashlib.md5(body_repr.encode()).hexdigest()[:8]
    self.function_bodies[node.name] = (node.lineno, body_hash, body_repr)
    self.generic_visit(node)

def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
    body_repr = self._normalize_function_body(node)
    body_hash = hashlib.md5(body_repr.encode()).hexdigest()[:8]
    self.function_bodies[node.name] = (node.lineno, body_hash, body_repr)
    self.generic_visit(node)
```

**Suggested fix:** Create a shared helper method:
```python
def _process_function_def(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
    body_repr = self._normalize_function_body(node)
    body_hash = hashlib.md5(body_repr.encode()).hexdigest()[:8]
    self.function_bodies[node.name] = (node.lineno, body_hash, body_repr)
    self.generic_visit(node)

def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
    self._process_function_def(node)

def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
    self._process_function_def(node)
```

## Future Improvements

Potential enhancements to consider:

1. **Configurable thresholds** via config file
2. **Severity levels** (info, warning, error)
3. **Auto-fix suggestions** for common patterns
4. **Integration with code review tools**
5. **Historical tracking** of duplication trends
