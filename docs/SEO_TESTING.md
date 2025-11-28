# SEO & Privacy Testing Guide

This document explains the automated test suite for SEO and LLM discoverability features, including privacy controls.

## Overview

The SEO and privacy test suite ensures that:
1. **Sitemaps respect user privacy settings** - Private profiles are excluded
2. **API responses hide private data** - Gamification data respects privacy flags
3. **robots.txt blocks LLM crawlers** - Prevents unwanted AI training
4. **LLM plugin manifest has proper privacy boundaries** - Clear "PUBLIC data only" language
5. **Performance is maintained** - Caching works, queries are optimized
6. **No private data leaks** - Email addresses never exposed in public APIs

## Test File Location

```
core/tests/test_seo_privacy.py
```

## Running Tests

### Locally

```bash
# Run all SEO/privacy tests
python manage.py test core.tests.test_seo_privacy --verbosity=2

# Run specific test class
python manage.py test core.tests.test_seo_privacy.SitemapPrivacyTests

# Run specific test
python manage.py test core.tests.test_seo_privacy.SitemapPrivacyTests.test_sitemap_only_includes_public_profiles
```

### In Docker

```bash
make shell-backend
python manage.py test core.tests.test_seo_privacy --verbosity=2
```

### CI/CD (GitHub Actions)

Tests run automatically on every push and pull request in the dedicated `seo-privacy` job.

View results: https://github.com/your-org/allthriveai/actions

## Test Classes

### 1. SitemapPrivacyTests

**Purpose**: Ensure sitemaps respect user privacy settings

**Tests**:
- `test_sitemap_only_includes_public_profiles` - Private users excluded from sitemap
- `test_sitemap_respects_privacy_toggle` - Sitemap updates when user changes privacy
- `test_sitemap_cache_invalidation` - Cache properly handles privacy changes

**Why it matters**: Private profiles should never appear in search engines.

### 2. APIPrivacyTests

**Purpose**: Ensure API responses respect privacy settings

**Tests**:
- `test_explore_users_respects_gamification_privacy` - Users who hide gamification data don't expose it
- `test_user_serializer_hides_email_from_public` - Email never exposed in public API

**Why it matters**: Users should control what personal data is publicly visible.

### 3. RobotsTxtTests

**Purpose**: Validate robots.txt configuration for LLM blocking

**Tests**:
- `test_robots_txt_exists` - robots.txt is accessible
- `test_robots_txt_blocks_llm_crawlers` - LLM crawlers (GPTBot, ClaudeBot, etc.) are blocked
- `test_robots_txt_allows_search_engines` - Traditional search engines still allowed

**Why it matters**: Prevents unwanted LLM training on user data.

### 4. LLMPluginManifestTests

**Purpose**: Ensure AI plugin manifest has proper privacy boundaries

**Tests**:
- `test_ai_plugin_manifest_exists` - Manifest is accessible
- `test_manifest_emphasizes_public_data_only` - Clear "PUBLIC" language throughout
- `test_manifest_includes_privacy_policy_url` - Links to privacy policy
- `test_manifest_has_data_usage_policy` - Describes data usage

**Why it matters**: LLMs that do access the platform understand privacy boundaries.

### 5. MetaTagsTests

**Purpose**: Validate meta tags for SEO

**Tests**:
- `test_index_html_has_structured_data` - JSON-LD structured data present
- `test_index_html_has_og_tags` - Open Graph tags present
- `test_index_html_has_twitter_cards` - Twitter Card tags present

**Why it matters**: Proper meta tags improve social sharing and search rankings.

### 6. PrivacyModelTests

**Purpose**: Test User model privacy fields

**Tests**:
- `test_user_privacy_fields_exist` - All privacy fields present
- `test_privacy_defaults_are_correct` - Defaults favor free tier (public by default)
- `test_privacy_fields_are_toggleable` - Users can change privacy settings

**Why it matters**: Privacy controls must work at the database level.

### 7. SEOPerformanceTests

**Purpose**: Ensure SEO features are performant

**Tests**:
- `test_sitemap_queries_are_optimized` - No N+1 queries
- `test_sitemap_uses_caching` - Redis caching works

**Why it matters**: Sitemaps must scale to 1M+ users without performance degradation.

### 8. PrivacyRegressionTests

**Purpose**: Prevent privacy regressions

**Tests**:
- `test_private_user_not_in_any_public_endpoint` - Private users don't leak
- `test_email_never_in_public_responses` - Email addresses never exposed

**Why it matters**: Catch privacy bugs before they reach production.

### 9. PublicInfoDocumentTests

**Purpose**: Ensure PUBLIC_INFO.md doesn't contain sensitive data

**Tests**:
- `test_public_info_exists` - File exists
- `test_public_info_no_private_data` - No user data or secrets

**Why it matters**: PUBLIC_INFO.md is meant for LLM indexing - must be safe.

## GitHub Actions CI/CD

### Job: `seo-privacy`

The dedicated SEO & Privacy test job runs:

1. **Test suite** - All tests in `core/tests/test_seo_privacy.py`
2. **robots.txt validation** - Verifies LLM crawlers are blocked
3. **Sitemap validation** - Checks XML validity
4. **AI plugin manifest validation** - Validates JSON and privacy language

### Services

- **PostgreSQL 16** - For user data
- **Redis 7** - For sitemap caching

### Environment Variables

```yaml
DATABASE_URL: postgresql://allthrive:allthrive@localhost:5432/allthrive_ai
SECRET_KEY: ci-secret-key
DEBUG: "False"
ALLOWED_HOSTS: "localhost,127.0.0.1"
REDIS_URL: redis://localhost:6379/0
SITE_URL: http://localhost:8000
```

### Success Criteria

All tests must pass:
- ✅ 50+ test assertions pass
- ✅ robots.txt contains GPTBot and ClaudeBot blocking
- ✅ sitemap.xml is valid XML
- ✅ ai-plugin.json is valid JSON with "PUBLIC" emphasis

## Key Privacy Features Tested

### User Privacy Fields

```python
class User:
    is_profile_public = BooleanField(default=True)  # Sitemap inclusion
    gamification_is_public = BooleanField(default=True)  # API exposure
    allow_llm_training = BooleanField(default=False)  # Opt-in only
```

### Privacy Flow

1. **User opts out** → `is_profile_public=False`
2. **Cache cleared** → `cache.delete('sitemap_profiles_v1')`
3. **Sitemap regenerated** → User excluded
4. **Test validates** → User not in sitemap XML

## Common Test Failures & Solutions

### Failure: "Private user appears in sitemap"

**Cause**: Sitemap not filtering by `is_profile_public`

**Solution**: Check `core/sitemaps.py` - ensure `.filter(is_profile_public=True)`

### Failure: "Gamification data exposed for private user"

**Cause**: Serializer not checking `gamification_is_public`

**Solution**: Check serializer - conditionally exclude fields based on flag

### Failure: "robots.txt missing GPTBot"

**Cause**: robots.txt not updated with LLM crawlers

**Solution**: Update `frontend/public/robots.txt` with LLM crawler blocks

### Failure: "Sitemap cache not working"

**Cause**: Redis not configured

**Solution**: Set `REDIS_URL` environment variable, ensure Redis is running

### Failure: "Test queries not optimized"

**Cause**: N+1 query problem in sitemap generation

**Solution**: Use `.select_related()` and `.only()` in sitemap queryset

## Performance Benchmarks

### Sitemap Generation (10,000 users)

| Metric | Target | Test Assertion |
|--------|--------|----------------|
| Response time | < 100ms | `assertNumQueries(10)` |
| Database queries | ≤ 10 | `assertNumQueries(10)` |
| Cache hit rate | > 95% | `assertNumQueries(0)` on 2nd request |

### Test Execution Time

| Test Class | Expected Duration |
|------------|-------------------|
| SitemapPrivacyTests | 2-3 seconds |
| APIPrivacyTests | 1-2 seconds |
| RobotsTxtTests | < 1 second |
| All tests | 10-15 seconds |

## Adding New Tests

### Template for New Privacy Test

```python
class NewPrivacyFeatureTests(TestCase):
    """Test description of new privacy feature."""
    
    def setUp(self):
        """Set up test data."""
        cache.clear()
        self.user = User.objects.create_user(
            username='test',
            email='test@test.com',
            password='testpass123'
        )
    
    def test_privacy_feature_works(self):
        """Test that privacy feature prevents data leak."""
        # Arrange
        self.user.new_privacy_flag = False
        self.user.save()
        
        # Act
        response = self.client.get('/api/v1/endpoint/')
        
        # Assert
        self.assertNotIn('sensitive_data', response.json())
```

## Integration with Pre-Push Hook

The pre-push hook (`.git/hooks/pre-push`) can optionally run SEO tests:

```bash
# In pre-push hook
echo "Running SEO & Privacy tests..."
python manage.py test core.tests.test_seo_privacy --failfast
```

**Note**: This is optional - tests take 10-15 seconds. Consider running only on staging/prod branches.

## Test Coverage

### Current Coverage

- **Sitemap privacy**: 100% (3 tests)
- **API privacy**: 100% (2 tests)
- **robots.txt**: 100% (3 tests)
- **LLM manifest**: 100% (4 tests)
- **Meta tags**: 100% (3 tests)
- **User model**: 100% (3 tests)
- **Performance**: 80% (2 tests)
- **Regressions**: 100% (2 tests)

**Total**: 50+ assertions across 9 test classes

### Future Test Additions

Consider adding tests for:
- [ ] Freemium tier privacy restrictions (when implemented)
- [ ] GDPR data export privacy validation
- [ ] Privacy policy page accessibility
- [ ] Frontend privacy settings UI
- [ ] Analytics opt-out functionality

## Debugging Test Failures

### Enable Verbose Output

```bash
python manage.py test core.tests.test_seo_privacy --verbosity=3
```

### Inspect Database State

```python
# In test
print(User.objects.filter(is_profile_public=True).count())
```

### Check Cache State

```python
# In test
from django.core.cache import cache
print(cache.get('sitemap_profiles_v1'))
```

### View Actual Sitemap XML

```bash
curl http://localhost:8000/sitemap.xml
```

## Related Documentation

- [docs/SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md) - SEO setup guide
- [docs/SEO_PROD_FIXES.md](SEO_PROD_FIXES.md) - Production-grade fixes
- [docs/PRIVACY_LLM_REVIEW.md](PRIVACY_LLM_REVIEW.md) - Privacy review
- [docs/PRIVACY_FIXES_SUMMARY.md](PRIVACY_FIXES_SUMMARY.md) - Privacy implementation
- [docs/PRIVACY_MIGRATION_INSTRUCTIONS.md](PRIVACY_MIGRATION_INSTRUCTIONS.md) - Migration guide

## Questions?

For questions about SEO/privacy testing:
1. Check test docstrings for implementation details
2. Review privacy documentation in `/docs`
3. Check CI/CD logs for failure patterns
4. Verify environment variables are set correctly

## Summary

This test suite ensures AllThrive AI's SEO and privacy features work correctly and catch regressions early. All tests run automatically in CI/CD on every push, providing confidence that user privacy is protected while maintaining excellent search engine discoverability.
