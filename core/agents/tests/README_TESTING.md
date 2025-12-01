# Security Testing Guide

## ✅ Recommended Approach (Best for CI/CD)

### Use pytest for comprehensive testing

```bash
# Run all security tests with coverage
pytest core/agents/tests/test_security_comprehensive.py -v --cov=core.agents.security

# Run with coverage report
pytest core/agents/tests/test_security_comprehensive.py -v --cov=core.agents.security --cov-report=html

# Run specific test class
pytest core/agents/tests/test_security_comprehensive.py::TestPromptInjectionFilter -v

# Run in parallel (faster)
pytest core/agents/tests/test_security_comprehensive.py -v -n auto
```

**Why pytest?**
- ✅ Works perfectly in GitHub Actions CI/CD
- ✅ Better test discovery and reporting
- ✅ Coverage reports integration
- ✅ Faster execution
- ✅ More detailed failure output
- ✅ Industry standard for Python testing

## Alternative Testing Methods

### 1. Django Test Runner

```bash
# Run Django unittest-compatible tests
python manage.py test core.agents.tests.test_security --keepdb --verbosity=2
```

**Use this when:**
- You prefer Django's built-in test runner
- You're already using Django tests elsewhere
- You don't need coverage reports

### 2. Quick Standalone Script

```bash
# Inside Docker container
docker-compose exec web python test_security_quick.py

# Or locally
python test_security_quick.py
```

**Use this for:**
- Quick manual verification
- Demo purposes
- Development workflow

## Test Files

| File | Purpose | Run With |
|------|---------|----------|
| `test_security_comprehensive.py` | **Primary** - 26 comprehensive pytest tests | `pytest` |
| `test_security.py` | Django unittest smoke tests (5 tests) | `python manage.py test` |
| `/test_security_quick.py` | Standalone verification script | `python test_security_quick.py` |

## What's Tested

### ✅ Prompt Injection Detection (10 tests)
- `test_detects_ignore_instructions` - Blocks "ignore previous instructions"
- `test_detects_system_override` - Blocks system role manipulation
- `test_detects_special_tokens` - Blocks `<|system|>`, `[INST]`, etc.
- `test_detects_jailbreak_attempts` - Blocks DAN mode, jailbreak patterns
- `test_detects_excessive_special_chars` - Blocks flooding with special characters
- `test_detects_repetitive_content` - Blocks repetitive/flooding attacks
- `test_rejects_too_long_messages` - Blocks messages > 5000 chars
- `test_allows_normal_messages` - Allows legitimate messages
- `test_sanitizes_special_tokens` - Removes special tokens
- `test_sanitizes_role_markers` - Escapes role markers

### ✅ Output Validation (5 tests)
- `test_detects_api_keys` - Detects API keys in output
- `test_detects_passwords` - Detects passwords
- `test_detects_connection_strings` - Detects database URLs
- `test_detects_file_paths` - Detects internal file paths
- `test_allows_normal_output` - Allows normal responses

### ✅ Rate Limiting (3 tests)
- `test_allows_within_limit` - Allows requests under limit
- `test_blocks_over_limit` - Blocks after 50 messages/hour
- `test_different_users_independent` - Per-user limits

### ✅ Circuit Breaker (3 tests)
- `test_starts_in_closed_state` - Initial state is CLOSED
- `test_opens_after_failures` - Opens after threshold failures
- `test_allows_when_closed` - Allows requests when closed

### ✅ Integration Pipeline (5 tests)
- `test_rejects_empty` - Rejects empty messages
- `test_rejects_too_long` - Rejects oversized messages
- `test_rejects_injection` - Blocks injection attempts
- `test_checks_rate_limit` - Enforces rate limits
- `test_allows_normal` - Allows normal messages

## GitHub Actions CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Workflow file:** `.github/workflows/security-tests.yml`

**What it does:**
1. Sets up Python 3.11
2. Starts PostgreSQL and Redis services
3. Runs pytest with coverage
4. Runs Django tests
5. Uploads coverage to Codecov
6. Creates test summary

## Coverage Report

```bash
# Generate HTML coverage report
pytest core/agents/tests/test_security_comprehensive.py --cov=core.agents.security --cov-report=html

# Open in browser
open htmlcov/index.html
```

Target: **>90% coverage** for all security modules

## Expected Results

All 26 tests should pass:

```
============================== test session starts ==============================
collected 26 items

core/agents/tests/test_security_comprehensive.py::TestPromptInjectionFilter::test_detects_ignore_instructions PASSED [  3%]
...
============================== 26 passed in 0.33s ===============================
```

## Troubleshooting

### Redis Connection Error
```bash
# Make sure Redis is running
docker-compose up -d redis

# Or use local Redis
redis-server
```

### Database Error
```bash
# Create test database
createdb test_allthrive_ai

# Or let Django create it
pytest --create-db
```

### Import Errors
```bash
# Install test dependencies
pip install -r requirements.txt
pip install pytest pytest-django pytest-cov
```

## Best Practices for CI/CD

1. **Always use pytest** for new tests
2. **Include coverage** in CI pipeline
3. **Run tests in parallel** for speed
4. **Use fixtures** for common setup
5. **Mock external services** (APIs, etc.)
6. **Test isolation** - each test is independent
7. **Descriptive test names** - what it tests is clear
8. **Fast tests** - optimize for speed (<1s total)

## Adding New Tests

Create new test classes in `test_security_comprehensive.py`:

```python
@pytest.mark.django_db
class TestNewFeature:
    def setup_method(self):
        # Setup code
        cache.clear()

    def test_feature_works(self):
        # Test code
        assert result is True
```

Always:
- Use `@pytest.mark.django_db` for database access
- Clear cache in `setup_method()`
- Use descriptive test names
- Assert both positive and negative cases
- Test edge cases

## Running in Docker

```bash
# Run pytest inside container
docker-compose exec web pytest core/agents/tests/test_security_comprehensive.py -v

# Run Django tests
docker-compose exec web python manage.py test core.agents.tests.test_security --verbosity=2

# Run quick test
docker-compose exec web python test_security_quick.py
```

## Summary

**For local development:** Use pytest
```bash
pytest core/agents/tests/test_security_comprehensive.py -v
```

**For CI/CD:** GitHub Actions automatically runs all tests

**For quick checks:** Run the standalone script
```bash
python test_security_quick.py
```

All three methods test the same security features - choose based on your workflow!
