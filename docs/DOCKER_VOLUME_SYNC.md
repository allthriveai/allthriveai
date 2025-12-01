# Docker Volume Sync Troubleshooting

## Overview

This document addresses Docker volume mount synchronization issues on macOS. While Docker Desktop typically handles bind mounts automatically, there are known issues that can cause files to not sync properly between your host machine and Docker containers.

## Common Causes

### 1. **Docker Desktop File Sharing Configuration**
- Docker Desktop must have explicit permission to access your project directory
- Check: Docker Desktop > Settings > Resources > File Sharing

### 2. **macOS File System Events (fsnotify) Limitations**
- macOS has limits on the number of file watchers
- Large projects can exceed these limits
- This affects hot-reload in development

### 3. **Docker Desktop Performance Settings**
- Insufficient resources allocated to Docker
- File sharing implementation (gRPC FUSE vs VirtioFS)

### 4. **Volume Mount Conflicts**
- Named volumes vs bind mounts
- Anonymous volumes overriding bind mounts (e.g., `node_modules`)

## Current Project Configuration

### Backend (web, celery)
```yaml
volumes:
  - .:/app  # Bind mount entire project
```

### Frontend
```yaml
volumes:
  - ./frontend:/app      # Bind mount frontend directory
  - /app/node_modules    # Anonymous volume (not synced)
```

**Important**: The frontend's `node_modules` directory is an anonymous volume, so changes to it won't sync. This is intentional to prevent conflicts between host and container dependencies.

## Diagnostic Steps

### Quick Test

Run the diagnostic script:
```bash
bash scripts/diagnose_docker_sync.sh
```

### Manual Verification

1. **Test backend sync:**
   ```bash
   echo "test" > test-sync.txt
   docker-compose exec web cat /app/test-sync.txt
   rm test-sync.txt
   ```

2. **Test frontend sync:**
   ```bash
   echo "test" > frontend/test-sync.txt
   docker-compose exec frontend cat /app/test-sync.txt
   rm frontend/test-sync.txt
   ```

3. **Check volume mounts:**
   ```bash
   docker inspect allthriveai_web_1 | grep -A 20 "Mounts"
   docker inspect allthriveai-frontend-1 | grep -A 20 "Mounts"
   ```

## Solutions

### 1. Ensure File Sharing is Enabled

1. Open Docker Desktop
2. Go to Settings > Resources > File Sharing
3. Ensure `/Users` is in the list
4. Add `/Users/allierays/Sites/allthriveai` explicitly if needed
5. Click "Apply & Restart"

### 2. Increase File System Limits (macOS)

```bash
# Check current limits
sysctl kern.maxfiles
sysctl kern.maxfilesperproc

# Increase limits (requires restart)
sudo sysctl -w kern.maxfiles=65536
sudo sysctl -w kern.maxfilesperproc=32768
```

To make permanent, add to `/etc/sysctl.conf`:
```
kern.maxfiles=65536
kern.maxfilesperproc=32768
```

### 3. Enable VirtioFS (Recommended for macOS)

VirtioFS is faster than the legacy gRPC FUSE implementation:

1. Docker Desktop > Settings > Experimental Features
2. Enable "Use the new Virtualization framework"
3. Enable "VirtioFS accelerated directory sharing"
4. Apply & Restart

**Note**: Requires Docker Desktop 4.6+ and macOS 12.5+

### 4. Restart Docker Desktop

Sometimes a simple restart fixes sync issues:
```bash
# Stop containers
docker-compose down

# Restart Docker Desktop from the menu bar
# Then start containers
docker-compose up -d
```

### 5. Use Docker Sync as Last Resort

If native sync continues to fail, use `docker-sync`:

```bash
# Install docker-sync
gem install docker-sync

# Create docker-sync.yml (see below)
docker-sync start
docker-compose up -d
```

## Manual Copy Workaround

If automatic syncing fails, manually copy files:

### Copy single file to backend:
```bash
docker cp <local-file> allthriveai_web_1:/app/<path>
docker-compose restart web
```

### Copy single file to frontend:
```bash
docker cp <local-file> allthriveai-frontend-1:/app/<path>
# Frontend hot-reload should pick it up
```

### Copy entire directory:
```bash
# Backend
docker cp ./core allthriveai_web_1:/app/
docker-compose restart web

# Frontend
docker cp ./frontend/src allthriveai-frontend-1:/app/
```

### Helper Script

Create `scripts/sync_to_docker.sh`:
```bash
#!/bin/bash
# Manually sync files to Docker containers

BACKEND_CONTAINER="allthriveai_web_1"
FRONTEND_CONTAINER="allthriveai-frontend-1"

case "$1" in
  backend)
    echo "Syncing backend files..."
    docker cp ./core "$BACKEND_CONTAINER:/app/"
    docker cp ./services "$BACKEND_CONTAINER:/app/"
    docker-compose restart web
    echo "✓ Backend synced and restarted"
    ;;
  frontend)
    echo "Syncing frontend files..."
    docker cp ./frontend/src "$FRONTEND_CONTAINER:/app/"
    echo "✓ Frontend synced (hot-reload active)"
    ;;
  all)
    $0 backend
    $0 frontend
    ;;
  *)
    echo "Usage: $0 {backend|frontend|all}"
    exit 1
    ;;
esac
```

## Prevention Tips

1. **Keep project path short** - Long paths can cause issues
2. **Avoid symlinks** - Docker may not follow them correctly
3. **Use .dockerignore** - Exclude unnecessary files
4. **Regular restarts** - Restart Docker Desktop periodically
5. **Monitor resources** - Ensure Docker has enough CPU/memory

## Performance Optimization

### .dockerignore
Ensure these are in your `.dockerignore`:
```
__pycache__
*.pyc
.git
.venv
node_modules
.pytest_cache
.ruff_cache
htmlcov
.coverage
```

### Docker Desktop Resources
Recommended settings:
- CPUs: 4+
- Memory: 4-8 GB
- Swap: 1-2 GB
- Disk size: 64 GB+

## Known Issues

### Issue: Changes not reflected immediately
**Symptom**: Code changes take 5-10 seconds to appear in container

**Solutions**:
- Enable VirtioFS
- Increase Docker Desktop resources
- Use polling instead of fsnotify (see below)

### Issue: Frontend hot-reload not working
**Symptom**: Changes to React components don't trigger reload

**Solutions**:
1. Add to `frontend/vite.config.ts`:
   ```typescript
   export default defineConfig({
     server: {
       watch: {
         usePolling: true, // Use polling on macOS
       },
     },
   });
   ```

2. Set environment variable:
   ```yaml
   # In docker-compose.yml
   frontend:
     environment:
       - CHOKIDAR_USEPOLLING=true
   ```

### Issue: File permissions mismatch
**Symptom**: Container can't write to mounted volumes

**Solution**:
Ensure user IDs match in Dockerfile:
```dockerfile
RUN useradd -m -u 1000 app
USER app
```

## Testing After Changes

After applying any fix:

1. Stop containers: `make down`
2. Rebuild if needed: `make build`
3. Start containers: `make up`
4. Test sync: `bash scripts/diagnose_docker_sync.sh`
5. Verify your application changes appear

## Additional Resources

- [Docker Desktop macOS File Sharing](https://docs.docker.com/desktop/settings/mac/#file-sharing)
- [VirtioFS Documentation](https://docs.docker.com/desktop/mac/#virtualization-framework)
- [Docker Sync](https://docker-sync.readthedocs.io/)
- [macOS File System Events](https://developer.apple.com/documentation/coreservices/file_system_events)

## Need Help?

If you continue experiencing sync issues:

1. Run diagnostics: `bash scripts/diagnose_docker_sync.sh`
2. Check Docker Desktop logs: Docker Desktop > Troubleshoot > View logs
3. Try the manual copy workaround as a temporary solution
4. Consider filing an issue with Docker Desktop if it's a persistent bug
