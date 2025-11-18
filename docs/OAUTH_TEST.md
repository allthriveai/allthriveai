# OAuth Flow Test Checklist

## Expected Behavior

### Login Flow
1. User visits `http://localhost:3000/login`
2. User clicks "Continue with Google"
3. **If already signed into Google**: Popup opens and auto-authenticates, then closes
4. **If not signed into Google**: Popup shows Google account picker, user selects account, popup closes
5. Main window redirects to `http://localhost:3000/{username}`
6. User is logged in

### Logout Flow
1. User clicks "Log Out" from sidebar
2. Cookies are cleared
3. User is logged out
4. User redirects to login page

## Current Status

### Working
- ✅ Logout endpoint responds with 200
- ✅ OAuth redirects to Google correctly
- ✅ LOGIN_REDIRECT_URL set to `/api/v1/auth/callback/`

### To Test
- ⏳ Does popup close automatically?
- ⏳ Does main window redirect to profile?
- ⏳ Are cookies being set with correct domain?
- ⏳ After logout, are cookies actually cleared?

## Debug Steps

1. Open browser DevTools
2. Go to Application → Cookies → http://localhost:3000
3. Look for: `access_token`, `refresh_token`, `csrftoken`
4. Check their Domain value (should be `localhost`)

### Check Popup Closing
1. Open browser console
2. Click "Continue with Google"
3. In popup, open console (before it closes)
4. Look for: "OAuth callback - closing popup" message
5. Look for: "Redirecting opener to profile" message

### Check Logout
1. Before logout: Note cookies in DevTools
2. Click "Log Out"
3. After logout: Verify all auth cookies are gone
4. Check Network tab for logout request (should be 200)
