# SEO & Privacy Testing Quick Start

**TL;DR**: Run `python manage.py test core.tests.test_seo_privacy` to validate SEO and privacy features.

## Prerequisites

1. ✅ Privacy migration applied (`python manage.py migrate`)
2. ✅ Redis running (for caching tests)
3. ✅ PostgreSQL running (for database tests)
4. ✅ `SITE_URL` environment variable set

## Quick Commands

### Run All SEO/Privacy Tests

```bash
python manage.py test core.tests.test_seo_privacy --verbosity=2
```

**Expected output**: All tests pass (50+ assertions)  
**Duration**: 10-15 seconds

### Run Specific Test Category

```bash
# Sitemap privacy tests
python manage.py test core.tests.test_seo_privacy.SitemapPrivacyTests

# API privacy tests
python manage.py test core.tests.test_seo_privacy.APIPrivacyTests

# robots.txt tests
python manage.py test core.tests.test_seo_privacy.RobotsTxtTests

# Performance tests
python manage.py test core.tests.test_seo_privacy.SEOPerformanceTests
```

### Validate SEO Endpoints (Manual)

```bash
# Start server
python manage.py runserver

# In another terminal, test endpoints
curl http://localhost:8000/sitemap.xml
curl http://localhost:8000/robots.txt
curl http://localhost:8000/.well-known/ai-plugin.json
```

## What Gets Tested

| Category | Tests | What it Protects |
|----------|-------|------------------|
| **Sitemap Privacy** | 3 | Private users excluded from search engines |
| **API Privacy** | 2 | Gamification data respects privacy flags |
| **robots.txt** | 3 | LLM crawlers blocked (GPTBot, ClaudeBot, etc.) |
| **LLM Manifest** | 4 | Clear "PUBLIC data only" boundaries |
| **Meta Tags** | 3 | SEO tags present for search/social |
| **User Model** | 3 | Privacy fields work correctly |
| **Performance** | 2 | Caching works, queries optimized |
| **Regressions** | 2 | Email/private data never leaks |

## CI/CD Integration

Tests run automatically in GitHub Actions on every push:

```yaml
# .github/workflows/ci.yml
job: seo-privacy
  - Run SEO & Privacy tests
  - Validate robots.txt
  - Validate sitemap
  - Validate AI plugin manifest
```

**View results**: [GitHub Actions](https://github.com/your-org/allthriveai/actions)

## Common Issues

### ❌ "No module named 'core.tests.test_seo_privacy'"

**Fix**: Run from project root where `manage.py` is located

### ❌ "Redis connection failed"

**Fix**: Start Redis - `docker-compose up redis` or `redis-server`

### ❌ "Private user appears in sitemap"

**Fix**: Run privacy migration - `python manage.py migrate users`

### ❌ "Test takes too long"

**Fix**: Use `--failfast` to stop on first failure - `python manage.py test core.tests.test_seo_privacy --failfast`

## Pass Criteria

All tests must pass:
- ✅ Sitemap excludes private users
- ✅ API hides gamification data for private users
- ✅ robots.txt blocks GPTBot, ClaudeBot, etc.
- ✅ ai-plugin.json emphasizes "PUBLIC" data only
- ✅ Sitemap uses caching (0 queries on 2nd request)
- ✅ Email addresses never in public responses

## Next Steps

1. ✅ Run tests locally - **YOU ARE HERE**
2. Commit changes - Tests run in CI automatically
3. Monitor GitHub Actions - Ensure all jobs pass
4. Deploy to staging - Tests run again
5. Deploy to production - With confidence!

## Full Documentation

- [docs/SEO_TESTING.md](SEO_TESTING.md) - Complete testing guide
- [docs/SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md) - SEO setup
- [docs/PRIVACY_FIXES_SUMMARY.md](PRIVACY_FIXES_SUMMARY.md) - Privacy features
- [docs/PRIVACY_MIGRATION_INSTRUCTIONS.md](PRIVACY_MIGRATION_INSTRUCTIONS.md) - Migration guide

## Summary

These tests ensure user privacy is protected while maintaining excellent SEO. They catch regressions early and run automatically in CI/CD. All tests should pass before deploying to production.

**Questions?** Check [docs/SEO_TESTING.md](SEO_TESTING.md) for troubleshooting.
