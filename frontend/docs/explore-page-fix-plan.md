# 🔍 Explore Page Not Showing Projects - Root Cause Analysis & Fix Plan

**Date:** November 22, 2025
**Status:** 🔴 CRITICAL BUG - Explore page showing "No projects found" despite 9 published projects existing
**Analyst:** Senior Developer Investigation

---

## 📊 Executive Summary

The explore page at `/explore` is showing "No projects found" even though:
- ✅ Database contains 9 published projects
- ✅ Backend API endpoint returns projects correctly
- ✅ Vite proxy is configured and working
- ❌ Frontend React app receives NO data

**Root Cause Identified:** 🎯 **DOUBLE API PREFIX BUG**

---

## 🔬 Investigation Findings

### 1. Backend Verification ✅
```bash
# Direct backend test
curl http://localhost:8000/api/v1/projects/explore/?tab=all
# Returns: 9 projects successfully
```

### 2. Proxy Verification ✅
```bash
# Through Vite proxy
curl http://localhost:3000/api/v1/projects/explore/?tab=all
# Returns: 9 projects successfully
# Logs show: "Sending Request to the Target: GET /api/v1/projects/explore/"
# Logs show: "Received Response from the Target: 200"
```

### 3. Frontend Configuration ❌ **PROBLEM FOUND**

**File:** `frontend/.env:2`
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

**File:** `frontend/src/services/api.ts:20`
```typescript
baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
```

**File:** `frontend/src/services/explore.ts:30`
```typescript
const response = await api.get<PaginatedResponse<any>>('/api/v1/projects/explore/', { params });
```

### 🚨 **THE BUG:**

When the frontend makes a request, axios constructs the URL as:
```
baseURL + path = http://localhost:8000/api/v1 + /api/v1/projects/explore/
                = http://localhost:8000/api/v1/api/v1/projects/explore/  ❌ WRONG!
```

This double `/api/v1` prefix causes:
1. Request goes to non-existent endpoint
2. Backend returns 404 or error
3. Frontend receives no data
4. User sees "No projects found"

---

## 🎯 Root Cause Analysis

### Why This Happened

1. **Environment Variable Misconfiguration**
   - `VITE_API_BASE_URL` was set to absolute URL with full path
   - Should use relative path for Vite proxy to work

2. **Vite Proxy vs Absolute URL Conflict**
   - Vite proxy is configured to forward `/api/*` to `http://web:8000`
   - But axios is configured to use absolute URL `http://localhost:8000/api/v1`
   - These two configurations conflict

3. **Service Paths Include Full Path**
   - All service files (explore.ts, etc.) use `/api/v1/...` paths
   - When combined with `baseURL=/api/v1`, creates duplication

---

## ✅ Solution Options

### **Option A: Use Vite Proxy (RECOMMENDED)** ⭐

**Pros:**
- ✅ Works in Docker and local development
- ✅ Simplest fix - just remove one line
- ✅ Proxy already configured and working
- ✅ No code changes needed

**Cons:**
- None

**Changes Required:**
1. Remove or empty `VITE_API_BASE_URL` in `.env`
2. Let axios use default `baseURL: '/api/v1'`
3. Vite proxy forwards all `/api/*` requests to backend

**Result:**
```
Request: /api/v1/projects/explore/
↓
Vite Proxy: http://web:8000/api/v1/projects/explore/
↓
Backend returns projects
↓
Frontend displays projects ✅
```

---

### **Option B: Fix Service Paths**

**Pros:**
- ✅ More explicit control over API structure

**Cons:**
- ❌ Requires changing 10+ service files
- ❌ More prone to errors
- ❌ Breaking change

**Changes Required:**
1. Set `VITE_API_BASE_URL=http://localhost:8000/api/v1` (keep as is)
2. Change ALL service calls from `/api/v1/...` to `/...`
   - `explore.ts`: `/api/v1/projects/explore/` → `/projects/explore/`
   - `projects.ts`: All paths
   - `auth.ts`: All paths
   - etc.

---

### **Option C: Adjust Base URL**

**Pros:**
- ✅ Middle ground solution

**Cons:**
- ❌ Still requires service file changes
- ❌ Less clear than Option A

**Changes Required:**
1. Set `VITE_API_BASE_URL=/api`
2. Change service paths from `/api/v1/...` to `/v1/...`

---

## 🚀 Implementation Plan (Option A - RECOMMENDED)

### Phase 1: Fix Environment Configuration
**File:** `frontend/.env`
```diff
- VITE_API_BASE_URL=http://localhost:8000/api/v1
+ VITE_API_BASE_URL=
```
OR simply delete the line entirely.

### Phase 2: Verify Default Behavior
**File:** `frontend/src/services/api.ts:20`
```typescript
// This will now use the fallback value
baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',  // Uses '/api/v1'
```

### Phase 3: Test Request Flow
```
Frontend request:
  api.get('/api/v1/projects/explore/')
  ↓
Axios constructs:
  baseURL ('/api/v1') + path ('/api/v1/projects/explore/')
  = '/api/v1/api/v1/projects/explore/'  ❌ Still wrong!
```

**WAIT - This is still wrong!**

Let me recalculate...

Actually, if `baseURL = '/api/v1'` and path = `/api/v1/projects/explore/`, axios will create:
`/api/v1` + `/api/v1/projects/explore/` = `/api/v1/api/v1/projects/explore/`

So we need **BOTH:**
1. Remove `VITE_API_BASE_URL` from `.env`
2. **AND** fix service paths to remove `/api/v1` prefix

OR use a different approach...

### **REVISED PLAN:**

#### **Solution 1: Use Empty Base URL**
```diff
File: frontend/.env
- VITE_API_BASE_URL=http://localhost:8000/api/v1
+ # No VITE_API_BASE_URL - use default

File: frontend/src/services/api.ts
const api: AxiosInstance = axios.create({
- baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
+ baseURL: import.meta.env.VITE_API_BASE_URL || '',
  ...
});

File: frontend/src/services/explore.ts
// Keep as is - paths already include /api/v1
const response = await api.get<PaginatedResponse<any>>('/api/v1/projects/explore/', { params });
```

**Result:**
```
baseURL: '' (empty)
path: '/api/v1/projects/explore/'
Full URL: '/api/v1/projects/explore/' ✅
Vite proxy: Forwards to http://web:8000/api/v1/projects/explore/ ✅
```

---

## 📋 Step-by-Step Implementation

### Step 1: Update API Configuration
**File:** `frontend/src/services/api.ts:20`
```typescript
// Change from:
baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',

// To:
baseURL: import.meta.env.VITE_API_BASE_URL || '',
```

### Step 2: Clear Environment Variable
**File:** `frontend/.env:2`
```env
# Remove or comment out
# VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Step 3: Restart Frontend Container
```bash
docker-compose restart frontend
```

### Step 4: Verify Fix
```bash
# Test 1: Check API endpoint directly
curl http://localhost:3000/api/v1/projects/explore/?tab=all | jq '.count'
# Expected: 9

# Test 2: Open browser
# Navigate to http://localhost:3000/explore
# Expected: See 9 projects displayed
```

### Step 5: Test All Tabs
- ✅ For You tab
- ✅ Trending tab
- ✅ All tab
- ✅ Profiles tab
- ✅ Search functionality
- ✅ Filters

---

## 🧪 Testing Checklist

- [ ] Explore page shows all 9 published projects
- [ ] "For You" tab works (personalized feed)
- [ ] "Trending" tab works
- [ ] "All" tab works
- [ ] "Profiles" tab works
- [ ] Search bar filters projects
- [ ] Tool filters work
- [ ] Topic filters work
- [ ] Pagination works
- [ ] No console errors
- [ ] No proxy errors in logs
- [ ] All API requests return 200

---

## 🔒 Verification Commands

```bash
# 1. Check frontend logs for successful requests
docker-compose logs --tail=20 frontend | grep "Received Response"
# Expected: Multiple "200" status codes

# 2. Monitor proxy in real-time
docker-compose logs -f frontend &
# Then navigate to http://localhost:3000/explore
# Expected: See "Sending Request" and "Received Response: 200"

# 3. Check React Query DevTools
# Open http://localhost:3000/explore
# Open browser DevTools → React Query tab
# Check query: ['exploreProjects', {...}]
# Expected: status: 'success', data: { count: 9, results: [...] }

# 4. Check Network tab
# Open http://localhost:3000/explore
# Open browser DevTools → Network tab
# Filter: Fetch/XHR
# Find: /api/v1/projects/explore/
# Expected: Status 200, Response contains 9 projects
```

---

## 🐛 Potential Issues & Solutions

### Issue 1: Still seeing "No projects found"
**Cause:** Browser cache or React Query cache
**Solution:**
```bash
# Hard refresh browser
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# Or clear React Query cache
# Add to frontend temporarily:
queryClient.clear()
```

### Issue 2: CORS errors
**Cause:** Proxy not forwarding headers correctly
**Solution:** Already handled by `changeOrigin: true` in vite.config.ts

### Issue 3: 404 errors
**Cause:** Vite proxy not matching path
**Solution:** Verify proxy config matches `/api` prefix

---

## 📈 Success Metrics

**Before Fix:**
- ❌ 0 projects displayed
- ❌ API returns double-prefixed path error
- ❌ User experience: broken

**After Fix:**
- ✅ 9 projects displayed
- ✅ API returns 200 OK with data
- ✅ User experience: excellent

---

## 🎓 Lessons Learned

1. **Environment variables should use relative paths in proxied environments**
   - Don't use `http://localhost:8000/api/v1`
   - Use `/api/v1` or empty string

2. **baseURL + path concatenation can cause duplication**
   - If baseURL includes path, service paths should not
   - If baseURL is empty, service paths should include full path

3. **Vite proxy is the preferred development approach**
   - Avoids CORS issues
   - Works seamlessly in Docker
   - Simplifies configuration

4. **Always test the full request chain**
   - Database → Backend → Proxy → Frontend
   - Don't assume working backend = working frontend

---

## 🚦 Risk Assessment

**Risk Level:** 🟢 LOW
**Breaking Changes:** None
**Rollback Plan:** Revert `.env` and `api.ts` changes
**Testing Required:** 15 minutes
**Deployment Impact:** None (dev-only fix)

---

## 📝 Files to Modify

### Required Changes:
1. ✏️ `frontend/.env` - Remove `VITE_API_BASE_URL`
2. ✏️ `frontend/src/services/api.ts` - Change `baseURL` default from `'/api/v1'` to `''`

### No Changes Needed:
- ✅ `frontend/vite.config.ts` - Proxy already configured correctly
- ✅ `frontend/src/services/explore.ts` - Paths already correct
- ✅ `frontend/src/pages/ExplorePage.tsx` - Logic already correct
- ✅ Backend - Already working perfectly

---

## ✅ Final Recommendation

**Implement Option A (Empty Base URL):**

1. Change `baseURL` default to empty string in `api.ts`
2. Remove `VITE_API_BASE_URL` from `.env`
3. Restart frontend container
4. Verify all projects display correctly

**Estimated Time:** 5 minutes
**Confidence Level:** 99%
**Risk:** Minimal

---

**Ready to implement? Let's fix this bug and get those projects showing!** 🚀
