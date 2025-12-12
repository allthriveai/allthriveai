# WebSocket Failure Prevention System

**Created**: 2025-12-12  
**Commits**: eb56ef1a (fix), 5db139ce (prevention)

## Overview

After fixing a critical WebSocket outage caused by `SECURE_PROXY_SSL_HEADER` misconfiguration, we implemented a comprehensive defense-in-depth system to prevent similar failures.

## The 4-Layer Prevention System

### Layer 1: Pre-Commit Validation ⚡
**File**: `scripts/pre-commit-hooks/check_websocket_settings.py`

Automatically validates Django settings on every commit:
- Checks `SECURE_PROXY_SSL_HEADER` uses `HTTP_X_FORWARDED_PROTO`
- Blocks commits with incorrect configuration
- Provides clear error message explaining the issue
- Runs automatically before every commit

**Example error output:**
```
❌ SECURE_PROXY_SSL_HEADER uses incorrect header: 'HTTP_CLOUDFRONT_FORWARDED_PROTO'

WebSocket connections will fail with 301 redirects!

AWS ALB/CloudFront sets 'X-Forwarded-Proto' header (becomes HTTP_X_FORWARDED_PROTO in Django).
Other headers like 'CloudFront-Forwarded-Proto' are NOT set by AWS infrastructure.

✅ Correct usage:
   SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

### Layer 2: Health Check Endpoint 🏥
**Files**: `core/monitoring/consumers.py`, `core/agents/routing.py`  
**Endpoint**: `/ws/health/`

Simple WebSocket endpoint for infrastructure monitoring:
- No authentication required
- Returns `{"status":"ok","message":"WebSocket healthy"}`
- Closes immediately after responding
- Can be used by:
  - ALB health checks
  - Monitoring systems (CloudWatch, Datadog, etc.)
  - Automated tests
  - Manual verification

**Usage:**
```javascript
// Browser console
const ws = new WebSocket('wss://api.allthrive.ai/ws/health/');
ws.onmessage = (e) => console.log(e.data);
```

### Layer 3: Integration Tests 🧪
**File**: `tests/integration/test_websocket_health.py`

Three comprehensive test scenarios:

1. **Basic Health Check**
   - Connects to `/ws/health/`
   - Verifies response data
   - Tests full infrastructure path

2. **301 Redirect Detection** (Regression test)
   - Explicitly tests that redirects don't occur
   - Fails with clear error message if detected
   - Prevents the exact bug that caused the outage

3. **Production Infrastructure Test**
   - Only runs when `API_URL` is set to production
   - Tests CloudFront → ALB → ECS path
   - Verifies end-to-end connectivity

**Run tests:**
```bash
# Local/CI environment
pytest tests/integration/test_websocket_health.py -v

# Against production
API_URL=https://api.allthrive.ai pytest tests/integration/test_websocket_health.py -v
```

### Layer 4: Documentation 📚
**Files**:
- `docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md`
- `docs/incidents/2025-12-12-websocket-ssl-redirect.md`

Updated documentation with:
- Critical configuration warnings at the top
- Why the setting matters
- What happens if misconfigured
- Link to incident post-mortem
- References to prevention measures

## How Each Layer Prevents Failures

| Layer | Prevents | When | How |
|-------|----------|------|-----|
| Pre-commit hook | Configuration errors | Before code is committed | Validates settings automatically |
| Health endpoint | Runtime failures | After deployment | Allows active monitoring |
| Integration tests | Infrastructure issues | During CI/CD | Tests full stack before production |
| Documentation | Human error | Development time | Clear warnings and examples |

## Testing the System

### 1. Test Pre-Commit Hook

Try to commit a bad configuration:

```python
# In config/settings.py
SECURE_PROXY_SSL_HEADER = ('HTTP_CLOUDFRONT_FORWARDED_PROTO', 'https')  # Wrong!
```

```bash
git add config/settings.py
git commit -m "test"
# Should be blocked with clear error message
```

### 2. Test Health Endpoint

After deployment:

```bash
# Using wscat
npm install -g wscat
wscat -c wss://api.allthrive.ai/ws/health/

# Using browser console
const ws = new WebSocket('wss://api.allthrive.ai/ws/health/');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📩', e.data);
ws.onclose = (e) => console.log('🔌 Closed:', e.code);
```

Expected:
```
✅ Connected!
📩 {"status":"ok","message":"WebSocket healthy"}
🔌 Closed: 1000
```

### 3. Test Integration Tests

```bash
# Local development
pytest tests/integration/test_websocket_health.py -v

# Against staging
API_URL=https://staging-api.allthrive.ai pytest tests/integration/test_websocket_health.py -v

# Against production
API_URL=https://api.allthrive.ai pytest tests/integration/test_websocket_health.py -v
```

## Monitoring Recommendations

### CloudWatch Alarms

Create alarms for:
1. WebSocket connection failures (from logs)
2. Health endpoint failures
3. 301 redirects on /ws/* paths

### Slack Notifications

Configure alerts for:
- WebSocket health check failures
- Pre-commit hook violations in CI
- Integration test failures

### Deployment Pipeline

Consider adding:
- Smoke tests after deployment
- Automated health checks
- Rollback triggers on WebSocket failures

## Future Improvements

- [ ] Add WebSocket metrics to CloudWatch
- [ ] Create Slack alerts for WebSocket failures
- [ ] Add smoke tests to deployment pipeline
- [ ] Monitor WebSocket connection duration
- [ ] Track 301 redirect rate on /ws/* paths

## Related Documentation

- [WebSocket Implementation Guide](docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md)
- [Incident Post-Mortem](docs/incidents/2025-12-12-websocket-ssl-redirect.md)
- [WebSocket Troubleshooting](docs/evergreen-architecture/WEBSOCKET_TROUBLESHOOTING.md)
- [Debugging Results](ws-debug-results.md)

## Summary

This multi-layer approach ensures:
- ✅ Configuration errors caught before commit
- ✅ Runtime issues detected immediately
- ✅ Full infrastructure tested in CI/CD
- ✅ Clear documentation prevents mistakes
- ✅ Easy verification after deployment

**Result**: WebSocket failures prevented at multiple checkpoints, with clear feedback at each stage.
