# Security Fixes for Public Profile Endpoints

## Overview

This document describes the security improvements implemented for the public profile viewing feature (`/username` routes) to prevent common security vulnerabilities.

## Implemented Fixes

### 1. Rate Limiting ✅

**Problem:** Public endpoints without rate limiting can be abused for enumeration attacks or DoS.

**Solution:** Implemented tiered rate limiting with different limits for authenticated vs. anonymous users.

**Implementation:**
- Created `core/throttles.py` with throttle classes:
  - `PublicProfileThrottle`: 60 requests/hour for anonymous users
  - `PublicProjectsThrottle`: 100 requests/hour for anonymous users
  - `AuthenticatedProfileThrottle`: 300 requests/hour for authenticated users
  - `AuthenticatedProjectsThrottle`: 500 requests/hour for authenticated users

**Affected Endpoints:**
- `GET /api/v1/users/<username>/` - User profile
- `GET /api/v1/users/<username>/projects/` - User projects

**Configuration:** `config/settings.py` - `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`

---

### 2. User Enumeration Prevention ✅

**Problem:** Endpoints that return 404 for non-existent users allow attackers to enumerate valid usernames through timing attacks or response differences.

**Solution:** Implemented consistent response timing and proper error handling.

**Implementation:**
- Added minimum response time (50ms) to prevent timing attacks
- Consistent response structure for both valid and invalid usernames
- Proper logging of suspicious activity (repeated requests for non-existent users)
- 404 responses not cached to prevent cache poisoning

**Code Location:**
- `core/auth_views.py` - `username_profile_view()`
- `core/views.py` - `public_user_projects()`

---

### 3. N+1 Query Optimization ✅

**Problem:** Serializing projects without prefetching user data causes N+1 database queries.

**Solution:** Added `select_related('user')` to prefetch user data in a single query.

**Implementation:**
```python
Project.objects.select_related('user').filter(...)
```

**Performance Impact:**
- Before: 1 + N queries (1 for projects, N for each user)
- After: 2 queries (1 for projects with user data, 1 for authentication)

**Code Location:** `core/views.py` - `public_user_projects()`

---

### 4. Response Caching ✅

**Problem:** Every request hits the database, creating unnecessary load for frequently accessed public data.

**Solution:** Implemented Redis-based caching with appropriate TTLs and cache invalidation.

**Implementation:**

**Cache Configuration:**
```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://redis:6379/2',
    }
}

CACHE_TTL = {
    'PUBLIC_PROFILE': 300,   # 5 minutes
    'PUBLIC_PROJECTS': 180,  # 3 minutes
    'USER_PROJECTS': 60,     # 1 minute (for own projects)
}
```

**Cache Keys:**
- Profile: `profile:{username}`
- Public projects: `projects:{username}:public`
- Own projects: `projects:{username}:own`

**Cache Invalidation:**
- Automatic invalidation on project create/update/delete (via Django signals)
- Automatic invalidation on user profile update (via Django signals)
- Implemented in `core/signals.py`

**Cache Strategy:**
- Successful responses are cached
- 404 responses are NOT cached (prevents enumeration cache poisoning)
- Different TTLs for public vs. owned data

---

### 5. Security Logging ✅

**Problem:** No visibility into potential attacks or suspicious activity.

**Solution:** Added structured logging for security-relevant events.

**Logged Events:**
- Repeated requests for non-existent users (potential enumeration)
- IP addresses for suspicious requests
- Throttle violations (automatically logged by DRF)

**Code Location:** `core/views.py` - `public_user_projects()`

**Log Format:**
```
WARNING: Public project access attempt for non-existent user: {username} from IP: {ip_address}
```

---

## Security Best Practices Applied

### Defense in Depth
Multiple layers of security:
1. Rate limiting (prevents brute force)
2. Timing attack prevention (prevents enumeration)
3. Caching (reduces attack surface by reducing DB hits)
4. Logging (enables detection and response)

### Least Privilege
- Anonymous users get minimal data (showcase only)
- Authenticated users get more data (all projects if own profile)
- Different rate limits based on trust level

### Fail Securely
- Errors don't leak sensitive information
- Failed requests maintain consistent timing
- Invalid cache data fails to empty state, not error

---

## Testing Recommendations

### Manual Testing

1. **Rate Limiting:**
   ```bash
   # Should get throttled after 60 requests
   for i in {1..65}; do
     curl http://localhost:8000/api/v1/users/testuser/
   done
   ```

2. **Timing Attack Prevention:**
   ```bash
   # Times should be similar for valid and invalid users
   time curl http://localhost:8000/api/v1/users/validuser/
   time curl http://localhost:8000/api/v1/users/invaliduser/
   ```

3. **Caching:**
   ```bash
   # First request hits DB, second hits cache
   curl -w "@curl-format.txt" http://localhost:8000/api/v1/users/testuser/projects/
   curl -w "@curl-format.txt" http://localhost:8000/api/v1/users/testuser/projects/
   ```

### Automated Testing

Add to test suite:
- Rate limit enforcement
- Cache invalidation on model updates
- Query count assertions (N+1 prevention)
- Response timing consistency

---

## Monitoring & Alerts

### Recommended Monitoring

1. **Rate Limit Violations:**
   - Track IPs hitting rate limits
   - Alert on sustained violations (potential attack)

2. **Cache Hit Ratio:**
   - Monitor cache effectiveness
   - Low hit ratio may indicate cache poisoning or misconfiguration

3. **Enumeration Attempts:**
   - Track requests for non-existent users
   - Alert on patterns (sequential usernames, same IP)

4. **Response Times:**
   - Monitor p95/p99 response times
   - Degradation may indicate attack or performance issue

---

## Configuration Options

### Environment Variables

```bash
# Cache configuration
CACHE_URL=redis://redis:6379/2

# Rate limit overrides (optional)
THROTTLE_ANON_RATE=60/hour
THROTTLE_USER_RATE=300/hour
```

### Tuning Rate Limits

Adjust in `config/settings.py`:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'public_profile': '60/hour',      # Increase for higher traffic
        'public_projects': '100/hour',
        'authenticated_profile': '300/hour',
        'authenticated_projects': '500/hour',
    },
}
```

### Tuning Cache TTLs

Adjust in `config/settings.py`:
```python
CACHE_TTL = {
    'PUBLIC_PROFILE': 300,   # Longer = less DB load, staler data
    'PUBLIC_PROJECTS': 180,
    'USER_PROJECTS': 60,     # Shorter for frequently changing data
}
```

---

## Future Enhancements

### Potential Improvements

1. **IP-based Reputation System**
   - Track IPs with suspicious behavior
   - Apply stricter limits to known bad actors

2. **CAPTCHA for Suspected Bots**
   - Challenge suspicious traffic patterns
   - Balance security with UX

3. **Distributed Rate Limiting**
   - Use Redis for rate limit state (multi-server)
   - Currently uses local memory

4. **GraphQL Complexity Limits**
   - If adding GraphQL, limit query complexity
   - Prevent expensive queries

5. **Content Delivery Network (CDN)**
   - Cache public profiles at edge
   - Reduce origin load further

---

## References

- [OWASP User Enumeration](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/03-Identity_Management_Testing/04-Testing_for_Account_Enumeration_and_Guessable_User_Account)
- [Django REST Framework Throttling](https://www.django-rest-framework.org/api-guide/throttling/)
- [Django Caching Framework](https://docs.djangoproject.com/en/stable/topics/cache/)
- [Timing Attack Prevention](https://codahale.com/a-lesson-in-timing-attacks/)
