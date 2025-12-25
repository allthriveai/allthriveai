# Incident: WebSocket Connections Failing with 301 Redirects

**Date**: 2025-12-12  
**Duration**: Unknown start - Fixed at 07:43 UTC  
**Severity**: High (all WebSocket features broken)  
**Status**: Resolved ✅

## Summary

All WebSocket connections were failing with "WebSocket is closed before the connection is established" errors. The root cause was Django's `SECURE_PROXY_SSL_HEADER` configuration using a header that ALB/CloudFront doesn't send, causing 301 SSL redirects that break WebSocket upgrade handshakes.

## Impact

- **User-facing features affected:**
  - Real-time chat streaming
  - Battle notifications  
  - Matchmaking queue updates
  - Live battle updates

- **Severity**: High
  - All WebSocket-dependent features completely non-functional
  - Users saw connection errors in browser console
  - No fallback mechanism available

## Timeline

### Discovery Phase
- **07:10 UTC** - Initial investigation started for ruff/eslint errors
- **07:39 UTC** - User reported actual WebSocket failure with browser console logs
- **07:39 UTC** - Verified tokens being generated successfully in server logs
- **07:40 UTC** - No WebSocket connection attempts reaching Django application layer

### Diagnosis Phase
- **07:41 UTC** - Direct curl test to ALB revealed HTTP/2 301 redirect
- **07:41 UTC** - Identified redirect location pointing to same URL (redirect loop)
- **07:42 UTC** - Found `SECURE_PROXY_SSL_HEADER = ('HTTP_CLOUDFRONT_FORWARDED_PROTO', 'https')` in settings
- **07:42 UTC** - Confirmed CloudFront doesn't send `CloudFront-Forwarded-Proto` header
- **07:42 UTC** - Django SecurityMiddleware treating all WebSocket requests as non-HTTPS
- **07:42 UTC** - SecurityMiddleware issuing 301 redirects to "force" HTTPS

### Resolution Phase
- **07:42 UTC** - Changed to `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`
- **07:43 UTC** - Added pre-commit hook to prevent recurrence
- **07:43 UTC** - Created WebSocket health check endpoint
- **07:43 UTC** - Added integration tests for CI/CD
- **07:43 UTC** - Committed and pushed fix (eb56ef1a)
- **07:43 UTC** - Deployment started

## Root Cause Analysis

### What Happened

Django's `SecurityMiddleware` enforces HTTPS by checking the `SECURE_PROXY_SSL_HEADER` setting. The configuration was:

```python
SECURE_PROXY_SSL_HEADER = ('HTTP_CLOUDFRONT_FORWARDED_PROTO', 'https')
```

**Problem:** CloudFront/ALB doesn't send a `CloudFront-Forwarded-Proto` header.

**Result:** Django couldn't detect that requests were coming through HTTPS, so it issued 301 redirects to "force" HTTPS. This breaks WebSocket upgrade handshakes which cannot follow redirects.

### Why It Happened

1. **Incorrect assumption** about which headers CloudFront/ALB sends
2. **No automated testing** for WebSocket connections through full infrastructure stack
3. **No validation** of critical infrastructure settings in pre-commit hooks
4. **Working connections in logs** created false confidence (those were from before the misconfiguration)

### Why It Wasn't Caught Earlier

1. The setting was likely changed at some point without testing
2. No integration tests verify WebSocket connections in deployed environments
3. Pre-commit hooks didn't validate infrastructure-critical settings
4. Some old logs showed successful connections, masking the issue

## Fix Applied

### Immediate Fix (config/settings.py)

```python
# Before (BROKEN):
SECURE_PROXY_SSL_HEADER = ('HTTP_CLOUDFRONT_FORWARDED_PROTO', 'https')

# After (FIXED):
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

**Commit**: eb56ef1a

### Why This Works

AWS ALB sets the `X-Forwarded-Proto` header for **all** requests, including:
- Regular HTTP/HTTPS requests
- WebSocket upgrade requests
- Both through CloudFront and direct to ALB

Django converts this to `HTTP_X_FORWARDED_PROTO` in the WSGI/ASGI environment.

## Prevention Measures

To prevent this from happening again, we implemented multiple safeguards:

### 1. Pre-Commit Hook ✅

**File**: `scripts/pre-commit-hooks/check_websocket_settings.py`

Validates that `SECURE_PROXY_SSL_HEADER` uses `HTTP_X_FORWARDED_PROTO`:
- Runs on every commit that touches settings files
- Provides clear error message if misconfigured
- Blocks commit until fixed

### 2. WebSocket Health Check Endpoint ✅

**Files**: 
- `core/monitoring/consumers.py`
- Route: `/ws/health/`

Provides a simple endpoint to verify WebSocket infrastructure:
- No authentication required (infrastructure monitoring)
- Returns `{"status":"ok","message":"WebSocket healthy"}`
- Can be used by ALB health checks, monitoring, and automated tests

### 3. Integration Tests ✅

**File**: `tests/integration/test_websocket_health.py`

Three test scenarios:
1. Basic health check connection
2. Explicit test that 301 redirects don't occur
3. Production infrastructure test (full CloudFront → ALB → ECS path)

Run in CI/CD with:
```bash
pytest tests/integration/test_websocket_health.py -v
```

### 4. Updated Documentation ✅

**File**: `docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md`

Added critical configuration requirement section:
- Clearly states required header setting
- Explains why it matters
- References this incident
- Linked to prevention measures

## Lessons Learned

### What Went Well
- Infrastructure was actually healthy (CloudFront, ALB, targets)
- Quick diagnosis with AWS CLI tools
- Comprehensive fix with multiple prevention layers
- Clear documentation added

### What Could Be Improved
1. **Testing**: Need integration tests that run against deployed environments
2. **Validation**: Critical infrastructure settings should be validated automatically
3. **Monitoring**: WebSocket health should be actively monitored
4. **Documentation**: Critical configuration requirements should be highlighted prominently

### Action Items
- [x] Fix immediate issue (eb56ef1a)
- [x] Add pre-commit hook
- [x] Add health check endpoint  
- [x] Add integration tests
- [x] Update documentation
- [ ] Add WebSocket health check to CloudWatch monitoring
- [ ] Add Slack alert for WebSocket failures
- [ ] Consider adding smoke tests to deployment pipeline

## Related Documentation

- [WebSocket Implementation Guide](../evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md)
- [WebSocket Troubleshooting](../evergreen-architecture/WEBSOCKET_TROUBLESHOOTING.md)
- [Debugging Results](../../ws-debug-results.md)

## Verification

After deployment, verify with:

```javascript
// Browser console on allthrive.ai
const ws = new WebSocket('wss://api.allthrive.ai/ws/health/');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onmessage = (e) => console.log('📩 Message:', e.data);
ws.onclose = (e) => console.log('🔌 Closed:', e.code, e.reason);
```

Expected output:
```
✅ Connected!
📩 Message: {"status":"ok","message":"WebSocket healthy"}
🔌 Closed: 1000
```

## References

- AWS ECS Logs: `/ecs/production-allthrive-web`
- CloudFront Distribution: EKZ5JJZGFJQ33
- ALB: production-allthrive-alb
- Target Group: production-allthrive-ws-tg
