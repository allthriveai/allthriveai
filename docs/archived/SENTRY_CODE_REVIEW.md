# Sentry Implementation Code Review

**Date:** 2025-12-03
**Reviewer:** Claude Code
**Status:** ⚠️ **NEEDS FIXES BEFORE PRODUCTION**

---

## Executive Summary

The Sentry error tracking implementation has **7 issues** that need to be addressed:
- **2 Critical** (will cause runtime errors)
- **3 Major** (missing important features)
- **2 Minor** (improvements for better DX)

---

## 🔴 CRITICAL ISSUES

### 1. Circular Dependency in `sentry.ts` (Lines 207-214)

**Severity:** 🔴 Critical
**Impact:** Runtime error on module initialization
**File:** `frontend/src/utils/sentry.ts:207-214`

**Problem:**
```typescript
// ❌ PROBLEM: These imports at module level cause circular dependencies
import React from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';
```

The React Router hooks are imported at the module level but used inside `initSentry()`. This creates a circular dependency when Sentry is initialized in `main.tsx` before the router is set up.

**Fix:**
```typescript
// ✅ SOLUTION 1: Dynamic import inside initSentry
export function initSentry() {
  // ... existing code ...

  // Load React Router integration asynchronously
  if (typeof window !== 'undefined') {
    import('react-router-dom').then(({ useLocation, useNavigationType, ... }) => {
      // Add integration after initial setup
    });
  }
}

// ✅ SOLUTION 2: Separate function for router integration
export function createSentryRouterIntegration() {
  return Sentry.reactRouterV6BrowserTracingIntegration({
    useEffect: React.useEffect,
    useLocation,
    useNavigationType,
    createRoutesFromChildren,
    matchRoutes,
  });
}
```

**Action Required:** Remove the imports from module level or move to dynamic imports.

---

### 2. Inconsistent Production Checks

**Severity:** 🔴 Critical
**Impact:** Sentry initializes even when DSN is missing; redundant checks

**Problem:**
```typescript
// Line 20-23: Warns but doesn't return
if (!dsn) {
  console.warn('Sentry DSN not configured. Error tracking is disabled.');
  return; // ✅ This is good
}

// Line 83-85: beforeSend also checks production (redundant)
beforeSend(event, hint) {
  if (!import.meta.env.PROD) {
    return null; // ❌ Already checked in captureException
  }
}
```

**Fix:**
```typescript
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProduction = import.meta.env.PROD;

  // Skip entirely if no DSN or not production
  if (!dsn || !isProduction) {
    if (!isProduction) {
      console.info('[Sentry] Skipping initialization in development mode.');
    }
    return;
  }

  // ... rest of initialization
}
```

**Action Required:** Consolidate production checks to `initSentry()` only.

---

## ⚠️ MAJOR ISSUES

### 3. Missing Error Boundary Component

**Severity:** ⚠️ Major
**Impact:** Component errors won't be caught by Sentry

**Problem:**
No React Error Boundary to catch component render errors.

**Fix:**
```typescript
// In App.tsx or main.tsx
import { Sentry } from './utils/sentry';

<Sentry.ErrorBoundary
  fallback={<ErrorFallback />}
  showDialog={false}
>
  <App />
</Sentry.ErrorBoundary>
```

**Action Required:** Wrap root app component in `Sentry.ErrorBoundary`.

---

### 4. No Auto User Context from AuthContext

**Severity:** ⚠️ Major
**Impact:** Errors won't be associated with specific users

**Problem:**
`setUser()` function exists but isn't connected to authentication flow.

**Fix:**
```typescript
// In AuthContext.tsx
import { setUser as setSentryUser } from '@/utils/sentry';

useEffect(() => {
  if (user) {
    setSentryUser({
      id: user.id.toString(),
      email: user.email,
      username: user.username,
    });
  } else {
    setSentryUser(null);
  }
}, [user]);
```

**Action Required:** Integrate `setUser()` with AuthContext.

---

### 5. Console.warn() in Production Code

**Severity:** ⚠️ Major
**Impact:** Warning messages visible in production console

**Problem:**
```typescript
// Line 21
console.warn('Sentry DSN not configured. Error tracking is disabled.');
```

**Fix:**
```typescript
if (!dsn) {
  if (!import.meta.env.PROD) {
    console.info('[Sentry] DSN not configured.');
  }
  return;
}
```

**Action Required:** Use `console.info` and wrap in dev check.

---

## 📝 MINOR ISSUES

### 6. Hardcoded Sample Rates

**Severity:** 📝 Minor
**Impact:** Can't adjust monitoring without code changes

**Problem:**
```typescript
tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
replaysSessionSampleRate: 0.1,
replaysOnErrorSampleRate: 1.0,
```

**Fix:**
```typescript
// Add to .env
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_ERROR_SAMPLE_RATE=1.0

// In code
const tracesSampleRate = parseFloat(
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1'
);
```

**Action Required:** Make sample rates configurable via environment variables.

---

### 7. Missing Source Maps Configuration

**Severity:** 📝 Minor
**Impact:** Stack traces won't map to source code

**Problem:**
No mention of source map upload for production debugging.

**Fix:**
1. **Install Sentry Vite Plugin:**
   ```bash
   npm install @sentry/vite-plugin --save-dev
   ```

2. **Update vite.config.ts:**
   ```typescript
   import { sentryVitePlugin } from "@sentry/vite-plugin";

   export default defineConfig({
     build: {
       sourcemap: true,
     },
     plugins: [
       sentryVitePlugin({
         org: "your-org",
         project: "your-project",
         authToken: process.env.SENTRY_AUTH_TOKEN,
       }),
     ],
   });
   ```

**Action Required:** Add source map upload for production builds.

---

## ✅ WHAT'S GOOD

1. **Comprehensive sanitization** of sensitive data (URLs, headers, objects)
2. **Good error filtering** for browser extensions and network errors
3. **Proper session replay** configuration with privacy settings
4. **Well-documented** with clear comments
5. **Type-safe** helper functions with TypeScript
6. **Production-only** sending to avoid development noise

---

## 📋 IMMEDIATE ACTION ITEMS

### Priority 1 (Before Production Deploy)
- [ ] Fix circular dependency (remove React Router imports)
- [ ] Add Error Boundary component
- [ ] Connect `setUser()` to AuthContext
- [ ] Remove/guard `console.warn` in production

### Priority 2 (This Week)
- [ ] Make sample rates configurable
- [ ] Add source maps configuration
- [ ] Test error tracking in staging environment

### Priority 3 (Nice to Have)
- [ ] Add breadcrumb tracking for user actions
- [ ] Set up Sentry alerts for critical errors
- [ ] Configure release tracking with git SHA

---

## 🧪 TESTING CHECKLIST

Before deploying to production:

- [ ] Test that Sentry initializes without errors
- [ ] Trigger a test error and verify it appears in Sentry
- [ ] Verify sensitive data is redacted (check URLs, headers)
- [ ] Confirm errors don't send in development
- [ ] Verify user context is attached to errors
- [ ] Test Error Boundary fallback UI
- [ ] Confirm sample rates are working (check Sentry quota usage)
- [ ] Verify source maps work (readable stack traces)

---

## 📚 ADDITIONAL RECOMMENDATIONS

### 1. Add Performance Monitoring
```typescript
// Track custom transactions
const transaction = Sentry.startTransaction({
  name: "API Call",
  op: "http.client",
});

// ... make API call ...

transaction.finish();
```

### 2. Add Custom Integrations
```typescript
// Track web vitals
import { BrowserTracing } from "@sentry/react";

integrations: [
  new BrowserTracing({
    tracePropagationTargets: ["localhost", "allthrive.ai"],
  }),
],
```

### 3. Set Up Release Tracking
```typescript
// In vite.config.ts
VITE_APP_VERSION=`git-${process.env.GITHUB_SHA?.slice(0, 7) || 'dev'}`;
```

### 4. Configure Alerts
Set up Sentry alerts for:
- Error spikes (>100 errors in 1 hour)
- New error types
- Errors affecting >10% of users
- Critical errors (500 server errors)

---

## 🔗 REFERENCES

- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
- [Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sampling Guide](https://docs.sentry.io/platforms/javascript/configuration/sampling/)

---

## FIXED VERSION

A corrected implementation is available at:
`frontend/src/utils/sentry.fixed.ts`

**Key Improvements:**
✅ No circular dependencies
✅ Consistent production checks
✅ Configurable sample rates
✅ Better sanitization helpers
✅ Added breadcrumb tracking
✅ Offline transport for reliability

**To use the fixed version:**
```bash
mv frontend/src/utils/sentry.ts frontend/src/utils/sentry.old.ts
mv frontend/src/utils/sentry.fixed.ts frontend/src/utils/sentry.ts
```

---

**Review Status:** Complete
**Next Steps:** Address critical issues before production deployment
