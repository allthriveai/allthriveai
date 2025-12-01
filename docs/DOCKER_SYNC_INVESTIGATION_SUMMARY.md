# Docker Volume Sync Investigation Summary

**Date:** November 30, 2025  
**Issue:** Docker volume mounts not syncing automatically on macOS

## Investigation Results

### ✅ Current Status: Volume Sync is Working

The diagnostic tests show that Docker volume mounts **are currently functioning correctly**:

- ✅ Backend volume sync: **Working** (`/Users/allierays/Sites/allthriveai → /app`)
- ✅ Frontend volume sync: **Working** (`./frontend → /app`)
- ✅ File creation sync: **Working**
- ✅ File modification sync: **Working**

**Conclusion:** The automatic syncing appears to be operational at this time.

## Possible Causes of Intermittent Issues

Even though sync is working now, macOS Docker Desktop can have intermittent sync issues due to:

1. **File System Event Limits** - macOS limits file watchers (kern.maxfiles: 491,520)
2. **Docker Desktop Resource Constraints** - Insufficient CPU/memory allocation
3. **File Sharing Backend** - Using older gRPC FUSE instead of VirtioFS
4. **Large File Sets** - Too many files can overwhelm the sync mechanism
5. **Docker Desktop Bugs** - Known issues with certain macOS versions

## Tools Created for You

### 1. Diagnostic Script
**Location:** `scripts/diagnose_docker_sync.sh`

Run anytime to check sync status:
```bash
make diagnose-sync
# or
bash scripts/diagnose_docker_sync.sh
```

This will:
- Test backend and frontend sync
- Show volume mount configuration
- Check system limits
- Provide recommendations

### 2. Manual Sync Script
**Location:** `scripts/sync_to_docker.sh`

Use when automatic sync fails:
```bash
# Sync everything
make sync-all

# Sync backend only
make sync-backend

# Sync frontend only
make sync-frontend

# Sync specific file
bash scripts/sync_to_docker.sh file core/models.py

# Sync specific directory
bash scripts/sync_to_docker.sh dir services/ai_provider
```

### 3. Documentation

- **Full Guide:** `docs/DOCKER_VOLUME_SYNC.md` - Complete troubleshooting guide
- **Quick Reference:** `docs/DOCKER_SYNC_QUICK_REFERENCE.md` - Common commands
- **This Summary:** `docs/DOCKER_SYNC_INVESTIGATION_SUMMARY.md` - Investigation results

### 4. Makefile Commands

Added to your Makefile:
```bash
make diagnose-sync   # Run diagnostics
make sync-backend    # Manual backend sync
make sync-frontend   # Manual frontend sync
make sync-all        # Manual sync everything
```

### 5. .dockerignore File

Created to improve sync performance by excluding unnecessary files:
- Cache files (`__pycache__`, `.pytest_cache`, etc.)
- Virtual environments
- Build artifacts
- IDE and OS files

## Recommended Next Steps

### If Sync is Currently Working:
1. **Monitor** - Keep an eye on sync performance during development
2. **Use diagnostics** - Run `make diagnose-sync` periodically
3. **Keep manual sync ready** - Use it if auto-sync starts failing

### If Sync Starts Failing:

**Quick Fixes (in order):**
1. `make restart` - Restart containers
2. `make diagnose-sync` - Verify the issue
3. `make sync-all` - Manual sync as immediate workaround
4. Restart Docker Desktop from menu bar
5. Apply permanent fixes below

**Permanent Fixes:**

1. **Enable VirtioFS (Highly Recommended)**
   - Docker Desktop → Settings → Experimental Features
   - Enable "Use the new Virtualization framework"
   - Enable "VirtioFS accelerated directory sharing"
   - Requires Docker Desktop 4.6+ and macOS 12.5+

2. **Increase Docker Resources**
   - Docker Desktop → Settings → Resources
   - CPU: 4+ cores
   - Memory: 4-8 GB
   - Swap: 1-2 GB

3. **Verify File Sharing**
   - Docker Desktop → Settings → Resources → File Sharing
   - Ensure `/Users` is in the list
   - Add `/Users/allierays/Sites/allthriveai` explicitly if needed

4. **Frontend Hot-Reload Fix** (if needed)
   Add to `frontend/vite.config.ts`:
   ```typescript
   export default defineConfig({
     server: {
       watch: {
         usePolling: true,
       },
     },
   });
   ```

## Environment Details

- **OS:** macOS (Apple Silicon - aarch64)
- **Docker Version:** 20.10.12
- **Docker Desktop:** Active
- **CPUs:** 8
- **Memory:** 7.764 GiB
- **File System Limits:**
  - kern.maxfiles: 491,520
  - kern.maxfilesperproc: 245,760

## Volume Configuration

### Backend (`web`, `celery`)
```yaml
volumes:
  - .:/app  # Full project directory
```

**Mount Type:** Bind mount  
**Sync:** Bidirectional (host ↔ container)

### Frontend
```yaml
volumes:
  - ./frontend:/app           # Frontend directory
  - /app/node_modules         # Anonymous volume (isolated)
```

**Note:** `node_modules` is intentionally isolated to prevent conflicts.

## Known Limitations

1. **Frontend node_modules** - Not synced (by design)
2. **Sync Delay** - May take 1-2 seconds on macOS
3. **Large File Operations** - Can be slow with gRPC FUSE
4. **File Events** - Limited by macOS kernel parameters

## Testing Procedure

If you suspect sync issues:

1. **Create test file on host:**
   ```bash
   echo "test-$(date +%s)" > test-sync.txt
   ```

2. **Check in container:**
   ```bash
   docker-compose exec web cat /app/test-sync.txt
   ```

3. **Clean up:**
   ```bash
   rm test-sync.txt
   ```

If the file appears in the container, sync is working.

## When to Use Manual Sync

**Use manual sync if:**
- Changes take more than 5 seconds to appear
- Changes don't appear at all
- You need immediate sync for testing/debugging
- Docker Desktop is having issues

**Don't use manual sync if:**
- Auto-sync is working fine (even if slow)
- You can wait 2-3 seconds for changes
- You're doing normal development

## Support Resources

- [Docker Desktop macOS Docs](https://docs.docker.com/desktop/settings/mac/)
- [VirtioFS Documentation](https://docs.docker.com/desktop/mac/#virtualization-framework)
- [macOS File System Events](https://developer.apple.com/documentation/coreservices/file_system_events)

## Files Modified/Created

1. ✅ `scripts/diagnose_docker_sync.sh` - Diagnostic script
2. ✅ `scripts/sync_to_docker.sh` - Manual sync helper
3. ✅ `docs/DOCKER_VOLUME_SYNC.md` - Full troubleshooting guide
4. ✅ `docs/DOCKER_SYNC_QUICK_REFERENCE.md` - Quick reference
5. ✅ `docs/DOCKER_SYNC_INVESTIGATION_SUMMARY.md` - This summary
6. ✅ `.dockerignore` - Performance optimization
7. ✅ `Makefile` - Added sync commands

All scripts are executable and ready to use.
