#!/bin/bash
# Load Testing Scenarios for AllThrive AI
# Tests scalability from 100 users → 100k users

set -e

HOST="${1:-http://localhost:8000}"
echo "🎯 Target: $HOST"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function run_test() {
    local name=$1
    local users=$2
    local spawn_rate=$3
    local duration=$4

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🚀 Running: $name${NC}"
    echo -e "   Users: $users"
    echo -e "   Spawn rate: $spawn_rate/sec"
    echo -e "   Duration: $duration"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    locust -f locustfile.py \
        --host="$HOST" \
        --users=$users \
        --spawn-rate=$spawn_rate \
        --run-time=$duration \
        --headless \
        --html="reports/${name}_report.html" \
        --csv="reports/${name}"

    echo ""
    echo -e "${GREEN}✅ $name completed!${NC}"
    echo ""
    sleep 5
}

# Create reports directory
mkdir -p reports

echo "╔═══════════════════════════════════════════════════════╗"
echo "║     AllThrive AI Load Testing - Testing Ladder       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Phase 0: Baseline (current dev environment)
echo -e "${YELLOW}📊 PHASE 0: BASELINE${NC}"
run_test "phase0_baseline" 100 10 "2m"

# Phase 1: Security & Backend (target: <2s response time)
echo -e "${YELLOW}📊 PHASE 1: BACKEND SECURITY${NC}"
run_test "phase1_light" 500 25 "3m"
run_test "phase1_target" 1000 50 "5m"

# Phase 2-3: WebSocket + Frontend (target: <3s response time)
echo -e "${YELLOW}📊 PHASE 2-3: WEBSOCKET BACKEND${NC}"
run_test "phase23_light" 5000 100 "5m"
run_test "phase23_target" 10000 200 "10m"

# Phase 4: Full Rollout (target: <5s p95 response time)
echo -e "${YELLOW}📊 PHASE 4: PRODUCTION SCALE${NC}"
run_test "phase4_beta" 50000 500 "10m"
run_test "phase4_target" 100000 1000 "15m"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║              🎉 All tests complete! 🎉                ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "📁 Reports saved to: load_testing/reports/"
echo ""
echo "Next steps:"
echo "  1. Review HTML reports in load_testing/reports/"
echo "  2. Check Grafana dashboards: http://localhost:3001"
echo "  3. Identify bottlenecks and optimize"
echo ""
