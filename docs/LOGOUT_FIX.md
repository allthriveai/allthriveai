# Logout Fix

## Issue
Logout was failing with **403 Forbidden** error when users tried to log out after OAuth login.

## Root Cause
The logout endpoint requires a CSRF token for POST requests, but the frontend wasn't ensuring the CSRF token was available before making the logout call. This was particularly problematic after OAuth login where the user might not have triggered any other POST requests that would have fetched the CSRF token.

## Error in Logs
```
Forbidden: /api/v1/auth/logout/
[18/Nov/2025 07:34:12] "POST /api/v1/auth/logout/ HTTP/1.1" 403 46
```

## Solution Applied

### 1. Backend Changes

**Updated `core/auth_views.py` - Improved logout endpoint:**

- Changed permission from `IsAuthenticated` to `AllowAny` (allow anyone to logout)
- Added explicit `samesite` parameter to cookie deletion
- Delete cookies with both domain and without domain as fallback
- More robust cookie cleanup

```python
@api_view(['POST'])
@permission_classes([AllowAny])  # Allow anyone to logout
@csrf_exempt
def logout_view(request):
    """Logout user and clear cookies."""
    response = Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    
    # Get cookie domain from settings
    cookie_domain = settings.COOKIE_DOMAIN
    cookie_samesite = settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE']
    
    # Delete cookies with domain (how they were set in oauth_callback)
    response.delete_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        domain=cookie_domain,
        path='/',
        samesite=cookie_samesite,
    )
    # ... (repeat for refresh_token and csrftoken)
    
    # Also delete without domain as fallback
    response.delete_cookie(
        key=settings.SIMPLE_JWT['AUTH_COOKIE'],
        path='/',
        samesite=cookie_samesite,
    )
    # ... (repeat for other cookies)
    
    return response
```

### 2. Frontend Changes

**Updated `frontend/src/services/auth.ts`:**

Added CSRF token check before logout to ensure the token is available:

```typescript
import { api, ensureCsrfToken } from './api';

export async function logout(): Promise<void> {
  // Ensure we have a CSRF token before logout
  await ensureCsrfToken();
  await api.post('/auth/logout/');
}
```

## How It Works

1. **User clicks logout** in the UI (e.g., LeftSidebar)
2. **Frontend calls `logout()`** from AuthContext
3. **`ensureCsrfToken()` is called** - fetches CSRF token if not present
4. **POST request to `/api/v1/auth/logout/`** with CSRF token in header
5. **Backend deletes cookies** with proper domain/path/samesite settings
6. **Frontend updates auth state** and redirects to login

## Testing

### Test Logout Flow

1. Login via OAuth (Google or GitHub)
2. Navigate to dashboard
3. Click logout button in sidebar
4. Should successfully log out without errors
5. Should redirect to login page
6. Cookies should be cleared (check DevTools → Application → Cookies)

### Verify in Browser Console

```javascript
// Before logout
document.cookie // Should show: access_token, refresh_token, csrftoken

// After logout
document.cookie // Cookies should be cleared
```

### Check Backend Logs

```bash
docker logs allthriveai_web_1 --tail 20 -f
# Should see 200 OK for logout, not 403 Forbidden
```

## Key Files Modified

1. `core/auth_views.py` - Improved logout endpoint
2. `frontend/src/services/auth.ts` - Added CSRF token check before logout

## Related Issues

- OAuth login was working ✅
- Cookie setting was working ✅
- Logout was failing due to missing CSRF token ❌ → ✅ Fixed

## Best Practices

✅ **DO**: Always ensure CSRF token is available before making POST requests
✅ **DO**: Match cookie deletion parameters with how cookies were set
✅ **DO**: Delete cookies with multiple attempts (with/without domain)

❌ **DON'T**: Require authentication for logout endpoint (use AllowAny)
❌ **DON'T**: Forget to handle CSRF tokens for state-changing operations

## Status
✅ **FIXED** - Logout now works correctly with proper CSRF token handling and cookie cleanup.
