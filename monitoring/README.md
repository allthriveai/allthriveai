# AllThrive AI Monitoring Setup

## Overview

This directory contains monitoring configuration for AllThrive AI's infrastructure, designed to scale to 100,000 concurrent users.

## Stack

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards

## Quick Start

### 1. Start Monitoring Stack

```bash
docker-compose up -d prometheus grafana
```

### 2. Access Dashboards

- **Prometheus**: http://localhost:9090
  - View metrics, run queries, check targets

- **Grafana**: http://localhost:3001
  - **Username**: `admin`
  - **Password**: `admin` (change in `.env` via `GRAFANA_ADMIN_PASSWORD`)

### 3. Verify Health

```bash
# Check container status
docker-compose ps prometheus grafana

# View Prometheus logs
docker-compose logs -f prometheus

# View Grafana logs
docker-compose logs -f grafana
```

## Configuration

### Prometheus (`prometheus.yml`)

Scrapes metrics from:
- Django application (`web:8000/metrics`) - *will add in Phase 1*
- PostgreSQL (`db:5432`)
- Redis (`redis:6379`)
- Celery workers
- Prometheus itself

**Scrape interval**: 15 seconds

### Grafana

**Auto-provisioned:**
- Prometheus datasource (configured automatically)
- Dashboards (from `grafana/provisioning/dashboards/`)

**Manual setup** (until Phase 0 is complete):
1. Go to http://localhost:3001
2. Login with admin/admin
3. Create dashboards manually or import from dashboard JSON files

## Key Metrics to Monitor

### Phase 0 Baseline (Current)
- Container health status
- Resource usage (CPU, memory)
- Basic availability

### Phase 1 (Security & Backend)
- **Request rate**: Requests/second to Django
- **Response time**: p50, p95, p99 latency
- **Error rate**: 4xx, 5xx responses
- **Rate limiting**: Rate limit hits/minute
- **PostgreSQL**: Query time, connection pool usage
- **Redis**: Cache hit rate, memory usage

### Phase 2-3 (WebSocket + Frontend)
- **WebSocket connections**: Total active connections
- **Message throughput**: Messages/second
- **Celery queue depth**: Pending tasks
- **Circuit breaker**: Activations/hour
- **LangGraph**: Response latency, token usage

### Phase 4 (Gradual Rollout)
- **Feature flag rollout**: % of users on new chat
- **Error rate comparison**: Old vs new chat
- **User segmentation**: Active users by chat version

## Load Testing Targets

- **Baseline**: 100 concurrent users (current dev environment)
- **Phase 1**: 1,000 concurrent users (<2s response time)
- **Phase 2-3**: 10,000 concurrent users (<3s response time)
- **Phase 4**: 100,000 concurrent users (<5s p95 response time)

## Alerting (Production Only)

*Will add in Phase 1:*
- Error rate > 5%
- Response time p95 > 5s
- Circuit breaker activations > 10/hour
- Redis memory > 80%
- PostgreSQL connections > 80% of max

## Troubleshooting

### Prometheus not collecting metrics

1. Check target status: http://localhost:9090/targets
2. Verify Django metrics endpoint exists: `curl http://localhost:8000/metrics`
3. Check Prometheus logs: `docker-compose logs prometheus`

### Grafana can't connect to Prometheus

1. Verify Prometheus is running: `docker-compose ps prometheus`
2. Check datasource config: http://localhost:3001/datasources
3. Test connection: Settings → Datasources → Prometheus → Test

### Containers won't start

1. Check for port conflicts:
   ```bash
   lsof -i :9090  # Prometheus
   lsof -i :3001  # Grafana
   ```
2. View logs:
   ```bash
   docker-compose logs prometheus grafana
   ```

## Next Steps

1. ✅ **Phase 0**: Infrastructure setup (DONE)
2. **Phase 1**: Add Django metrics endpoint with `django-prometheus`
3. **Phase 1**: Create custom Grafana dashboards
4. **Phase 1**: Set up load testing with Locust
5. **Phase 2**: Add WebSocket connection metrics
6. **Phase 3**: Monitor Celery queue depth
7. **Phase 4**: Feature flag monitoring dashboards

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Django Prometheus](https://github.com/korfuri/django-prometheus)
