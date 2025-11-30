# Load Testing for AllThrive AI

Comprehensive load testing setup to validate scalability from 100 → 100,000 concurrent users.

## Quick Start

### 1. Install Locust

```bash
# In your virtual environment
source .venv/bin/activate
pip install locust
```

### 2. Run Interactive Load Test

```bash
cd load_testing
locust -f locustfile.py --host=http://localhost:8000
```

Then open http://localhost:8089 and configure:
- **Number of users**: 100 (start small)
- **Spawn rate**: 10 users/second
- **Host**: http://localhost:8000

### 3. Run Automated Test Suite

```bash
cd load_testing
./scenarios.sh http://localhost:8000
```

This runs the full testing ladder:
- Phase 0: 100 users (baseline)
- Phase 1: 1,000 users (backend security target)
- Phase 2-3: 10,000 users (WebSocket target)
- Phase 4: 100,000 users (production target)

## User Profiles

### AllThriveUser (General Browsing)
**Weight: 60% of traffic**

Simulates typical user behavior:
- Browse projects (50%)
- View project details (30%)
- Explore tools (20%)
- Chat interactions (15%)
- Search (10%)

**Wait time**: 1-5 seconds between actions

### ChatHeavyUser (Intensive Chat)
**Weight: 30% of traffic**

Stress tests the chat agent:
- Rapid-fire chat messages (80%)
- Quick project browsing (20%)

**Wait time**: 0.5-2 seconds (high frequency)

### ProjectCreatorUser (Heavy Backend Load)
**Weight: 10% of traffic**

Tests project creation flows:
- GitHub imports (50%)
- YouTube imports (30%)
- View created projects (20%)

**Wait time**: 3-10 seconds (realistic creation time)

## Testing Ladder

### Phase 0: Baseline (100 users)
**Goal**: Establish baseline metrics

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=100 \
    --spawn-rate=10 \
    --run-time=2m \
    --headless \
    --html=reports/baseline.html
```

**Success Criteria**:
- Error rate < 1%
- Response time p95 < 1s
- No crashes

### Phase 1: Backend Security (1,000 users)
**Goal**: Validate auth, rate limiting, circuit breaker

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=1000 \
    --spawn-rate=50 \
    --run-time=5m \
    --headless \
    --html=reports/phase1.html
```

**Success Criteria**:
- Error rate < 1%
- Response time p95 < 2s
- Rate limiting works (429 responses)
- Circuit breaker activates during failures

### Phase 2-3: WebSocket Backend (10,000 users)
**Goal**: Validate WebSocket + Celery scalability

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=10000 \
    --spawn-rate=200 \
    --run-time=10m \
    --headless \
    --html=reports/phase23.html
```

**Success Criteria**:
- Error rate < 1%
- Response time p95 < 3s
- WebSocket connections stable
- Celery queue depth < 50 tasks
- Redis cache hit rate > 60%

### Phase 4: Production Scale (100,000 users)
**Goal**: Validate production readiness

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=100000 \
    --spawn-rate=1000 \
    --run-time=15m \
    --headless \
    --html=reports/phase4.html
```

**Success Criteria**:
- Error rate < 1%
- Response time p95 < 5s
- PostgreSQL query time < 100ms p95
- Redis memory < 80%
- No connection pool exhaustion

## Key Metrics to Monitor

### During Load Tests

**In Locust UI** (http://localhost:8089):
- Total RPS (requests per second)
- Response times (p50, p95, p99)
- Failure rate
- Current user count

**In Grafana** (http://localhost:3001):
- WebSocket connections count
- PostgreSQL query performance
- Redis cache hit rate
- Celery queue depth
- Memory/CPU usage

**In Prometheus** (http://localhost:9090):
- http_requests_total
- http_request_duration_seconds
- websocket_connections
- celery_tasks_total

## Custom Scenarios

### Test Only Chat (High Agent Load)

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=5000 \
    --spawn-rate=100 \
    --run-time=10m \
    --user-classes=ChatHeavyUser \
    --headless
```

### Test Only Project Creation (High Database Load)

```bash
locust -f locustfile.py \
    --host=http://localhost:8000 \
    --users=1000 \
    --spawn-rate=50 \
    --run-time=10m \
    --user-classes=ProjectCreatorUser \
    --headless
```

### Distributed Load Testing (Multiple Machines)

**Master node:**
```bash
locust -f locustfile.py --master --host=http://localhost:8000
```

**Worker nodes (run on multiple machines):**
```bash
locust -f locustfile.py --worker --master-host=<master-ip>
```

## Analyzing Results

### HTML Reports

After each test, check `reports/*.html`:
- Response time charts
- Failure rate over time
- RPS over time
- Response time distribution

### CSV Reports

Export CSV for detailed analysis:
```bash
locust -f locustfile.py \
    --csv=reports/test \
    --headless
```

Generates:
- `reports/test_stats.csv` - Request statistics
- `reports/test_failures.csv` - Failure details
- `reports/test_exceptions.csv` - Exception traces

### Prometheus Metrics

Query in Prometheus (http://localhost:9090):

```promql
# Request rate
rate(http_requests_total[1m])

# Response time p95
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Error rate
rate(http_requests_total{status=~"5.."}[1m]) / rate(http_requests_total[1m])
```

## Troubleshooting

### Too many open files error

```bash
# macOS/Linux
ulimit -n 10000

# Permanent fix (add to ~/.bashrc or ~/.zshrc)
ulimit -n 65536
```

### Connection refused errors

- Check Django is running: `docker-compose ps web`
- Verify host URL is correct
- Check firewall settings

### High memory usage

- Reduce spawn rate (start slower)
- Run distributed tests across multiple machines
- Use `FastHttpUser` instead of `HttpUser` for better performance

### Inconsistent results

- Run longer tests (10+ minutes)
- Ensure no other processes are using resources
- Check network stability

## Best Practices

1. **Start Small**: Always start with 100 users and work up
2. **Monitor Everything**: Keep Grafana open during tests
3. **Save Reports**: Save HTML reports for each phase
4. **Document Issues**: Note any errors or bottlenecks
5. **Iterate**: Fix issues, re-test, repeat

## Integration with CI/CD

### GitHub Actions (Future)

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Load Test
        run: |
          pip install locust
          cd load_testing
          locust -f locustfile.py \
            --host=${{ secrets.STAGING_URL }} \
            --users=1000 \
            --spawn-rate=50 \
            --run-time=5m \
            --headless \
            --html=report.html
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: load-test-report
          path: load_testing/report.html
```

## Resources

- [Locust Documentation](https://docs.locust.io/)
- [Distributed Load Testing](https://docs.locust.io/en/stable/running-distributed.html)
- [Custom Metrics](https://docs.locust.io/en/stable/extending-locust.html)
