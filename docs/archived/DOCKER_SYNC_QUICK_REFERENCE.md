# Docker Sync Quick Reference

## Quick Commands

### Run Diagnostics
```bash
make diagnose-sync
```

### Manual Sync (if auto-sync fails)

```bash
# Sync backend only
make sync-backend

# Sync frontend only  
make sync-frontend

# Sync everything
make sync-all
```

### Sync Specific Files/Directories

```bash
# Single file
bash scripts/sync_to_docker.sh file core/models.py
bash scripts/sync_to_docker.sh file frontend/src/App.tsx

# Directory
bash scripts/sync_to_docker.sh dir services/ai_provider
bash scripts/sync_to_docker.sh dir frontend/src/components
```

## Common Issues & Quick Fixes

### Files not syncing automatically

**Try in order:**
1. `make restart` - Restart containers
2. `make diagnose-sync` - Check if sync is actually working
3. `make sync-all` - Manual sync as workaround
4. Restart Docker Desktop from menu bar
5. See full troubleshooting guide: `docs/DOCKER_VOLUME_SYNC.md`

### Frontend hot-reload not working

**Add to `frontend/vite.config.ts`:**
```typescript
export default defineConfig({
  server: {
    watch: {
      usePolling: true,  // Use polling instead of fsnotify
    },
  },
});
```

### Slow file sync (5-10 second delays)

**Enable VirtioFS:**
1. Docker Desktop → Settings → Experimental Features
2. Enable "Use the new Virtualization framework"
3. Enable "VirtioFS accelerated directory sharing"
4. Apply & Restart

## Manual Copy Commands

```bash
# Copy file to backend
docker cp <file> allthriveai_web_1:/app/<path>
docker-compose restart web

# Copy file to frontend
docker cp <file> allthriveai-frontend-1:/app/<path>

# Copy directory to backend
docker cp ./core allthriveai_web_1:/app/
docker-compose restart web
```

## Checking What's in Containers

```bash
# List files in backend container
docker-compose exec web ls -la /app

# List files in frontend container
docker-compose exec frontend ls -la /app

# View specific file in backend
docker-compose exec web cat /app/core/models.py

# View specific file in frontend
docker-compose exec frontend cat /app/src/App.tsx
```

## Volume Mount Info

```bash
# Check backend mounts
docker inspect allthriveai_web_1 | grep -A 20 "Mounts"

# Check frontend mounts
docker inspect allthriveai-frontend-1 | grep -A 20 "Mounts"

# List all volumes
docker volume ls | grep allthriveai
```

## When to Use Manual Sync

- ✅ Auto-sync is slow (>5 seconds)
- ✅ Changes not appearing in container at all
- ✅ Need immediate sync for testing
- ✅ Docker Desktop having issues
- ❌ Don't use for normal development (let auto-sync work)

## Docker Desktop Settings

**Recommended Resources:**
- CPUs: 4+
- Memory: 4-8 GB
- Swap: 1-2 GB

**File Sharing:**
- Ensure `/Users` is listed
- Consider adding project path explicitly

## Help

- Full guide: `docs/DOCKER_VOLUME_SYNC.md`
- Run diagnostics: `make diagnose-sync`
- Check Docker logs: Docker Desktop → Troubleshoot → View logs
