# 🚀 Quick Deployment Checklist

**Project**: AllThrive AI - Project Implementation Fixes
**Date**: 2025-11-22

---

## ✅ PRE-DEPLOYMENT

### 1. Database Migration
```bash
# Apply new indexes
python manage.py migrate projects 0002_optimize_project_indexes

# Verify indexes exist
python manage.py dbshell
# In PostgreSQL:
\d+ projects_project
# Look for: proj_user_showcase_created_idx, proj_published_archived_date_idx, proj_user_highlighted_idx
```

### 2. Frontend Build
```bash
cd frontend
npm install  # In case new dependencies
npm run build
npm run test  # Verify tests pass
```

### 3. Backend Tests
```bash
python manage.py test core.projects
# All tests should pass
```

### 4. Settings Check
```python
# In settings.py, verify throttle scopes exist:
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'project_like': '60/hour',
        # ... other rates
    }
}
```

---

## 🧪 STAGING DEPLOYMENT

### Deploy Steps
1. ✅ Deploy backend code
2. ✅ Run migrations (see above)
3. ✅ Deploy frontend build
4. ✅ Clear Redis cache: `python manage.py shell -c "from django.core.cache import cache; cache.clear()"`
5. ✅ Restart services

### Smoke Tests (5 minutes)
- [ ] Create new project → Check slug generation
- [ ] Create 5 projects with same name → Verify slug suffixes
- [ ] Load project list → Should be paginated (20 per page)
- [ ] Click project tool icon → Should not crash
- [ ] Rapid type in editor → Should autosave every 2s
- [ ] Spam like button 70 times → Should throttle after 60
- [ ] Paste malformed JSON in project content → Should catch gracefully

---

## 📊 MONITORING (First 24 Hours)

### Key Metrics to Watch

#### Performance
```sql
-- Check query performance
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%projects_project%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Expected:
- Mean query time: <50ms
- Max query time: <200ms
- Queries per project list: ≤5

#### Error Rates
- **Target**: <0.1% error rate
- **Alert if**: >1% errors
- Monitor Sentry for:
  - Undefined variable errors (should be 0)
  - Save race condition warnings (should be logged but not fail)
  - Rate limit hits (expected, not errors)

#### API Response Times
```bash
# Monitor key endpoints
/api/v1/me/projects/ → <300ms
/api/v1/me/projects/{id}/ → <100ms
/api/v1/me/projects/{id}/toggle-like/ → <50ms
```

---

## 🔍 VALIDATION TESTS

### Test 1: N+1 Query Fix
```python
# Before fix: 103 queries for 100 projects
# After fix: 3 queries for 100 projects

from django.test.utils import override_settings
from django.db import connection
from django.test import TestCase

def test_project_list_queries():
    # Create 100 projects
    # ...

    with self.assertNumQueries(3):
        response = self.client.get('/api/v1/me/projects/')
```

### Test 2: Pagination
```bash
curl http://localhost:8000/api/v1/me/projects/
# Should return: {"count": X, "next": "...", "previous": null, "results": [20 items]}
```

### Test 3: Rate Limiting
```bash
# Spam likes (should throttle after 60)
for i in {1..70}; do
  curl -X POST http://localhost:8000/api/v1/me/projects/1/toggle-like/
done
# Last 10 should return 429 Too Many Requests
```

### Test 4: Autosave Race Condition
```javascript
// In browser console on editor page:
let saves = 0;
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0].includes('projects')) {
    saves++;
    console.log('Save #', saves);
  }
  return originalFetch.apply(this, args);
};

// Type rapidly for 10 seconds
// Should see ~5 saves, not 50+
```

---

## 🚨 ROLLBACK PLAN

If issues occur:

### Quick Rollback
```bash
# 1. Revert code deploy
git revert HEAD
git push origin main

# 2. Rollback migration (if needed)
python manage.py migrate projects 0001_initial

# 3. Clear cache
python manage.py shell -c "from django.core.cache import cache; cache.clear()"

# 4. Restart services
```

### Partial Rollback
If only one fix is problematic, you can:
1. Remove specific index: `DROP INDEX proj_user_showcase_created_idx;`
2. Disable throttling: Comment out `throttle_classes=[ProjectLikeThrottle]`
3. Revert autosave changes: Use old autosave logic

---

## 📋 POST-DEPLOYMENT CHECKLIST

### Day 1
- [ ] Verify 0 crashes from undefined variables
- [ ] Check autosave works smoothly
- [ ] Confirm pagination displays correctly
- [ ] Monitor rate limit triggers (should be rare)
- [ ] Review error logs for new issues

### Week 1
- [ ] Analyze query performance in production
- [ ] Check average response times
- [ ] Review user feedback on editor experience
- [ ] Verify no data loss from autosave
- [ ] Monitor database size growth (indexes add ~5%)

### Month 1
- [ ] Performance review meeting
- [ ] Plan next optimization phase
- [ ] Update documentation with learnings

---

## 📞 CONTACT

**On-Call**: [Your name/team]
**Escalation**: [Manager/Lead]
**Monitoring**: [Dashboard URL]
**Logs**: [Log aggregation URL]

---

## 🎯 SUCCESS CRITERIA

**Deploy is successful if:**
- ✅ No increase in error rate
- ✅ 50%+ improvement in page load times
- ✅ Database queries reduced by 90%+
- ✅ User feedback is neutral or positive
- ✅ No data loss incidents

**Deploy needs rollback if:**
- ❌ Error rate >5%
- ❌ Critical feature broken
- ❌ Data loss reported
- ❌ Performance worse than before

---

**Last Updated**: 2025-11-22
**Version**: 1.0
**Status**: Ready for Staging Deploy
