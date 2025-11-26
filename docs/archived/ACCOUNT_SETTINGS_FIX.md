# Account Settings Data Persistence Fix

## Problem

When users entered their information (first name, last name, etc.) in the account settings page at `http://localhost:3000/account/settings`, the data would save to the database but would not display in the input fields when the page was reloaded.

## Root Cause

**API Response Format Mismatch:**
- Backend (Django REST Framework) returns data with **snake_case** keys: `first_name`, `last_name`, `avatar_url`, etc.
- Frontend (TypeScript/React) expected data with **camelCase** keys: `firstName`, `lastName`, `avatarUrl`, etc.

When the frontend tried to populate the form with `user.firstName`, it was `undefined` because the API response had `first_name` instead.

### Example

Backend response:
```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "avatar_url": "http://example.com/avatar.png"
}
```

Frontend expected:
```typescript
{
  id: 1,
  firstName: "John",
  lastName: "Doe",
  avatarUrl: "http://example.com/avatar.png"
}
```

## Solution

Implemented automatic case transformation in the API client to bridge the gap between backend and frontend naming conventions.

### Files Changed

1. **`frontend/src/utils/caseTransform.ts`** (NEW)
   - Created utility functions for case transformation
   - `snakeToCamel()` - converts snake_case strings to camelCase
   - `camelToSnake()` - converts camelCase strings to snake_case
   - `keysToCamel()` - recursively transforms all object keys to camelCase
   - `keysToSnake()` - recursively transforms all object keys to snake_case

2. **`frontend/src/services/api.ts`** (MODIFIED)
   - Added request interceptor to transform outgoing data from camelCase to snake_case
   - Added response interceptor to transform incoming data from snake_case to camelCase
   - All API calls now automatically handle case transformation

3. **`frontend/src/pages/AccountSettingsPage.tsx`** (MODIFIED)
   - Simplified payload creation (no manual snake_case conversion needed)
   - Now uses camelCase consistently throughout the component

4. **`frontend/src/utils/caseTransform.test.ts`** (NEW)
   - Added comprehensive tests for case transformation utilities

## How It Works

### Request Flow (Frontend → Backend)

1. Component creates payload with camelCase keys:
   ```typescript
   const payload = {
     firstName: 'John',
     lastName: 'Doe',
     avatarUrl: 'http://example.com/avatar.png'
   };
   ```

2. API request interceptor automatically transforms to snake_case:
   ```javascript
   {
     first_name: 'John',
     last_name: 'Doe',
     avatar_url: 'http://example.com/avatar.png'
   }
   ```

3. Backend receives and saves data

### Response Flow (Backend → Frontend)

1. Backend returns data with snake_case keys:
   ```json
   {
     "first_name": "John",
     "last_name": "Doe",
     "avatar_url": "http://example.com/avatar.png"
   }
   ```

2. API response interceptor automatically transforms to camelCase:
   ```javascript
   {
     firstName: 'John',
     lastName: 'Doe',
     avatarUrl: 'http://example.com/avatar.png'
   }
   ```

3. Component receives properly formatted data and displays it

## Benefits

1. **Consistency**: Frontend code uses JavaScript naming conventions (camelCase) throughout
2. **Maintainability**: No manual case conversion needed in components
3. **DRY**: Transformation logic is centralized in the API client
4. **Type Safety**: TypeScript interfaces match the transformed data structure
5. **Scalability**: All API endpoints benefit from automatic transformation

## Testing

To verify the fix:

1. Navigate to `http://localhost:3000/account/settings`
2. Fill in your profile information (first name, last name, etc.)
3. Click "Save Changes"
4. Wait for success message
5. Refresh the page
6. **Expected**: All your entered information should be visible in the form fields

## Additional Notes

- The transformation is recursive and handles nested objects and arrays
- Null and undefined values are preserved
- The transformation only affects JSON data (not multipart/form-data for file uploads)
- All existing API calls benefit from this change automatically

## Related Files

- `core/auth/serializers.py` - Backend serializer (unchanged, still uses snake_case)
- `core/users/models.py` - User model definition (unchanged)
- `frontend/src/types/models.ts` - TypeScript User interface (camelCase)
- `frontend/src/context/AuthContext.tsx` - Auth context that stores user data
