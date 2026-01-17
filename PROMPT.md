# AllThrive Development Prompt

## Session Rules
- **ONE feature per session** - Do not attempt multiple features
- **Test like a human** - Actually verify the feature works before marking complete
- **Commit after each feature** - Clean, atomic commits

## Session Startup Routine
1. Run `pwd` to confirm working directory
2. Read `claude-progress.txt` for context on recent work
3. Read `features.json` to identify next failing feature (pick ONLY ONE)
4. Run `git status` to check for uncommitted work from previous session
5. If working on backend: Run `make up && make ps` to verify Docker services
6. If working on frontend: Ensure dev server is running at localhost:3000
7. Run a basic smoke test (curl or browser) to confirm environment works

## Current Focus
[Auto-updated by agent based on features.json]

## Project Context
- Tech stack: Django 5 + React 18 + TypeScript + PostgreSQL + Redis
- Design system: Neon Glass (glass-panel, glass-card, glass-subtle, btn-primary, btn-outline)
- Icons: Heroicons only - NO emojis anywhere
- API conventions: snake_case backend, camelCase frontend (auto-converted by axios)
- Styleguide reference: http://localhost:3000/styleguide

## Development Rules
1. Always use Docker for backend (`make shell-backend` for Django commands)
2. Never create Python virtual environments
3. Follow existing patterns - read similar code before writing new code
4. Commit with descriptive messages after each feature

## Verification Checklist (REQUIRED before marking any feature "passing")

**You MUST complete ALL applicable checks before updating features.json:**

### Code Quality
- [ ] `npx tsc --noEmit` - TypeScript compiles with no errors
- [ ] `make lint` or `ruff check` - No linting errors
- [ ] No console errors in browser devtools

### Backend Changes
- [ ] `make test-backend` - All tests pass
- [ ] `curl` the API endpoint and verify response shape
- [ ] Check Django logs for errors: `make logs-backend`

### Frontend Changes
- [ ] Dev server runs without crashing: `npm run dev`
- [ ] Navigate to the page/component in browser
- [ ] Verify the UI renders correctly (no blank screens, no missing data)
- [ ] Check Network tab for failed API calls
- [ ] Test happy path user flow end-to-end

### How to Verify a Feature
```bash
# 1. Get the test steps for the current feature
cat features.json | jq '.features[] | select(.passes == false) | .testSteps'

# 2. Execute EACH test step manually
# 3. Only if ALL steps pass, update the feature:
#    Change "passes": false -> "passes": true

# Example:
npx tsc --noEmit                    # Must pass
curl http://localhost:8000/api/...  # Verify API returns data
# Then manually visit http://localhost:3000/@allierays
# Follow each testStep in features.json
```

**DO NOT change `passes` to `true` until ALL testSteps are verified.**
**If ANY step fails, keep `passes: false` and document the issue in claude-progress.txt.**

## When You Fail
If a test fails or code doesn't work:
1. Document the failure in `claude-progress.txt`
2. Analyze why the prompt didn't prevent this
3. Add a "sign" to this PROMPT.md to prevent recurrence
4. Continue iteration

## Signs (Learned from Failures)
<!-- Add entries here as failures teach us better patterns -->
- [Frontend] Always use displayUser.firstName not displayUser.first_name (camelCase in frontend)
- [Frontend] Always check listing.listingTypeSlug not listing.listing_type.slug
- [Design] Never use emojis - use Heroicons instead
- [Design] Use styleguide classes: glass-panel, glass-card, btn-outline, btn-primary
