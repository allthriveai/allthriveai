# Avatar Upload Fix

## Problem

Users were unable to upload avatar photos and save their profile. The error message "Failed to update profile. Please try again." appeared when trying to save after uploading an image.

## Root Cause

When a user uploaded an avatar image:
1. The image was uploaded to MinIO storage via `/api/v1/upload/image/`
2. MinIO returned a URL like `http://localhost:9000/allthrive-media/public/avatars/user_1/uuid.jpg`
3. This URL was set in the user's `avatar_url` field
4. When saving the profile, the User model's `clean()` validation method checked if the URL was from an allowed domain
5. The validation only allowed URLs from: GitHub, Google, Gravatar, but **NOT MinIO**
6. The validation failed, causing the profile update to fail

## Solution

Updated the User model's `clean()` validation method in `core/users/models.py` to dynamically include MinIO endpoints from settings:

- `MINIO_ENDPOINT` - Internal Docker network endpoint
- `MINIO_ENDPOINT_PUBLIC` - Public browser-accessible endpoint

Now avatar URLs from MinIO storage are accepted along with the other allowed domains.

## Testing

### Automated Tests

New tests were added in `core/users/tests/test_avatar_validation.py`:

```bash
# Run avatar validation tests
docker-compose exec web python manage.py test core.users.tests.test_avatar_validation
```

### Manual Testing

1. **Start the application:**
   ```bash
   docker-compose up
   ```

2. **Navigate to Account Settings:**
   - Go to `http://localhost:3000/settings/account`
   - Login if needed

3. **Upload an avatar:**
   - Click or drag an image to the profile photo upload area
   - Wait for upload to complete
   - You should see the image preview

4. **Save the profile:**
   - Click "Save Changes"
   - You should see "✓ Changes saved successfully"
   - The avatar should persist and display correctly

## Technical Details

### Files Modified

- `core/users/models.py` - Updated `User.clean()` method to include MinIO domains

### Files Added

- `core/users/tests/__init__.py` - Test package initialization
- `core/users/tests/test_avatar_validation.py` - Comprehensive avatar URL validation tests

### Configuration

The fix uses these environment variables (from `.env`):

```env
MINIO_ENDPOINT=minio:9000              # Internal endpoint (Docker network)
MINIO_ENDPOINT_PUBLIC=localhost:9000   # Public endpoint (browser access)
```

### Allowed Avatar URL Domains

After the fix, avatar URLs are accepted from:

1. **GitHub:** `github.com`, `githubusercontent.com`, `avatars.githubusercontent.com`
2. **Google:** `googleusercontent.com`
3. **Gravatar:** `gravatar.com`
4. **MinIO:** Dynamic from `MINIO_ENDPOINT` and `MINIO_ENDPOINT_PUBLIC` settings

### Security Considerations

- Bot users can use any avatar URL (validation is bypassed for bot accounts)
- All non-bot users must use URLs from allowed domains
- The validation prevents users from using potentially malicious external image URLs
- MinIO endpoints are read from settings, supporting different configurations for development and production

## Production Deployment

When deploying to production:

1. Update `MINIO_ENDPOINT_PUBLIC` to your production MinIO domain (e.g., `cdn.allthrive.ai`)
2. The validation will automatically accept URLs from the production MinIO endpoint
3. No code changes required - configuration is dynamic

## Related Files

- **User Model:** `core/users/models.py`
- **Upload Views:** `core/uploads/views.py`
- **Storage Service:** `services/storage_service.py`
- **Frontend Upload Component:** `frontend/src/components/forms/ImageUpload.tsx`
- **Account Settings Page:** `frontend/src/pages/AccountSettingsPage.tsx`
