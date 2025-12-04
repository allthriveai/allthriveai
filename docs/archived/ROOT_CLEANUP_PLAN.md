# Root Directory Cleanup Plan

## Files to Move to docs/

### Implementation Summary Files (3 files)
These are historical documentation of past implementations:

1. **CRITICAL_FIXES_IMPLEMENTED.md** → `docs/archived/CRITICAL_FIXES_IMPLEMENTED.md`
   - YouTube scalability fixes from Nov 28
   
2. **USER_FRIENDLY_ERRORS_IMPLEMENTED.md** → `docs/archived/USER_FRIENDLY_ERRORS_IMPLEMENTED.md`
   - Error message improvements from Nov 28
   
3. **YOUTUBE_SCALABILITY_REVIEW.md** → `docs/archived/YOUTUBE_SCALABILITY_REVIEW.md`
   - Code review from Nov 28

### Image Files (2 files)
Screenshot/design assets:

4. **dark.jpeg** → `docs/assets/dark.jpeg` (or delete if unused)
5. **light.jpeg** → `docs/assets/light.jpeg` (or delete if unused)

## Scripts to Move/Consolidate

### Setup Scripts (to docs/ or delete)
6. **scripts/setup_oauth.py** → Should be a Django management command instead
7. **scripts/setup_prompt_battle.sh** → Outdated (uses old Docker Compose syntax)
8. **scripts/SETUP_SOCIAL_OAUTH.sh** → Duplicate/outdated OAuth setup

### Test Scripts (to move or delete)
9. **scripts/test_phase1_api.sh** → `docs/testing/` or delete if tests exist in test suite
10. **scripts/test_project_chat.py** → `docs/testing/` or delete if obsolete

### Potentially Obsolete Scripts
11. **scripts/review_points_system.py** → Check if still needed, move to docs/ or delete
12. **scripts/verify_robots_txt.sh** → Could be a make command instead

## Files to Keep in Root

### Essential Configuration
- ✅ `.env.example`
- ✅ `.gitignore`
- ✅ `.pre-commit-config.yaml`
- ✅ `.dockerignore`
- ✅ `docker-compose.yml`
- ✅ `Dockerfile`
- ✅ `Makefile`
- ✅ `pyproject.toml`
- ✅ `requirements.txt`

### Essential Files
- ✅ `README.md`
- ✅ `manage.py`
- ✅ `pre-push` (git hook)

## Scripts to Keep in scripts/

### Active Scripts
- ✅ `scripts/startup.sh` - Used by Docker
- ✅ `scripts/pre-push` - Git hook
- ✅ `scripts/run_tests.sh` - Test runner
- ✅ `scripts/setup_langsmith.sh` - Active setup
- ✅ `scripts/diagnose_docker_sync.sh` - Created today
- ✅ `scripts/sync_to_docker.sh` - Created today
- ✅ `scripts/pre-commit-hooks/` - Active hooks

## Proposed Structure After Cleanup

```
/Users/allierays/Sites/allthriveai/
├── README.md                          ✅ Keep
├── manage.py                          ✅ Keep
├── Dockerfile                         ✅ Keep
├── docker-compose.yml                 ✅ Keep
├── Makefile                           ✅ Keep
├── requirements.txt                   ✅ Keep
├── pyproject.toml                     ✅ Keep
├── pre-push                           ✅ Keep
├── .env.example                       ✅ Keep
├── .gitignore                         ✅ Keep
├── .dockerignore                      ✅ Keep
├── .pre-commit-config.yaml            ✅ Keep
│
├── docs/
│   ├── assets/                        📁 New - for images
│   │   ├── dark.jpeg                  ⬆️ Moved
│   │   └── light.jpeg                 ⬆️ Moved
│   │
│   ├── archived/                      📁 Existing
│   │   ├── CRITICAL_FIXES_IMPLEMENTED.md        ⬆️ Moved
│   │   ├── USER_FRIENDLY_ERRORS_IMPLEMENTED.md  ⬆️ Moved
│   │   └── YOUTUBE_SCALABILITY_REVIEW.md        ⬆️ Moved
│   │
│   └── testing/                       📁 New - for test docs
│       └── (test scripts if needed)
│
└── scripts/
    ├── startup.sh                     ✅ Keep
    ├── run_tests.sh                   ✅ Keep
    ├── setup_langsmith.sh             ✅ Keep
    ├── diagnose_docker_sync.sh        ✅ Keep
    ├── sync_to_docker.sh              ✅ Keep
    ├── pre-push                       ✅ Keep
    └── pre-commit-hooks/              ✅ Keep
```

## Execution Plan

### Step 1: Create directories
```bash
mkdir -p docs/assets
mkdir -p docs/testing
```

### Step 2: Move markdown files
```bash
mv CRITICAL_FIXES_IMPLEMENTED.md docs/archived/
mv USER_FRIENDLY_ERRORS_IMPLEMENTED.md docs/archived/
mv YOUTUBE_SCALABILITY_REVIEW.md docs/archived/
```

### Step 3: Move or remove images
```bash
# Option A: Move to docs/assets
mv dark.jpeg docs/assets/
mv light.jpeg docs/assets/

# Option B: Delete if not referenced anywhere
rm dark.jpeg light.jpeg
```

### Step 4: Clean up obsolete scripts
```bash
# Archive or delete obsolete setup scripts
mv scripts/setup_oauth.py docs/archived/ # or delete
rm scripts/setup_prompt_battle.sh  # Outdated Docker syntax
rm scripts/SETUP_SOCIAL_OAUTH.sh   # Obsolete

# Move test scripts to docs or delete
mv scripts/test_phase1_api.sh docs/testing/  # or delete
mv scripts/test_project_chat.py docs/testing/  # or delete

# Review and decide
# scripts/review_points_system.py - check if still needed
# scripts/verify_robots_txt.sh - could be a make command
```

### Step 5: Remove weird artifacts
```bash
# These look like accidental files
rm =4.0.0
rm =4.2.0
```

## Benefits

1. **Cleaner root** - Only essential config and README
2. **Better organization** - Historical docs in docs/archived/
3. **Easier navigation** - New developers see only what matters
4. **Reduced clutter** - No obsolete scripts in scripts/
5. **Professional appearance** - Clean project structure

## Safety Notes

- ⚠️ Create git commit before cleanup
- ⚠️ Check if images are referenced in docs before deleting
- ⚠️ Verify scripts are truly obsolete before removing
- ⚠️ Test after cleanup to ensure nothing breaks
