#!/bin/bash
# Docker Volume Sync Diagnostic Script
# This script helps diagnose Docker volume mount sync issues on macOS

set -e

echo "=== Docker Volume Sync Diagnostics ==="
echo ""

echo "1. Docker Desktop Version:"
docker --version
echo ""

echo "2. Docker Desktop Info:"
docker info | grep -E "(Operating System|OSType|Architecture|CPUs|Total Memory)"
echo ""

echo "3. Running Containers:"
docker-compose ps
echo ""

echo "4. Volume Mounts (Backend):"
docker inspect allthriveai_web_1 | grep -A 10 "Mounts"
echo ""

echo "5. Volume Mounts (Frontend):"
docker inspect allthriveai-frontend-1 | grep -A 10 "Mounts"
echo ""

echo "6. Testing Backend Sync..."
TEST_FILE="test-backend-sync-$(date +%s).txt"
echo "Created at $(date)" > "$TEST_FILE"
echo "Host file created: $TEST_FILE"
sleep 2
docker-compose exec -T web cat "/app/$TEST_FILE" && echo "✓ Backend sync working" || echo "✗ Backend sync FAILED"
rm -f "$TEST_FILE"
echo ""

echo "7. Testing Frontend Sync..."
TEST_FILE="frontend/test-frontend-sync-$(date +%s).txt"
echo "Created at $(date)" > "$TEST_FILE"
echo "Host file created: $TEST_FILE"
sleep 2
docker-compose exec -T frontend cat "/app/$(basename $TEST_FILE)" && echo "✓ Frontend sync working" || echo "✗ Frontend sync FAILED"
rm -f "$TEST_FILE"
echo ""

echo "8. Checking for common macOS Docker issues:"
echo ""
echo "File Events Performance (fsnotify):"
sysctl -n kern.maxfiles
sysctl -n kern.maxfilesperproc
echo ""

echo "9. Recommendations:"
echo "If syncing is slow or not working:"
echo "  - Check Docker Desktop > Preferences > Resources > File Sharing"
echo "  - Ensure /Users is in the file sharing list"
echo "  - Try increasing Docker Desktop resources (CPU/Memory)"
echo "  - Consider using Docker Desktop's VirtioFS (Settings > Experimental Features)"
echo "  - Check for macOS-specific performance issues with gRPC FUSE"
echo ""

echo "=== Diagnostics Complete ==="
