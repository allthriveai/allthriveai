# Image Upload Documentation

## Overview

Users can upload profile photos and other images using a drag-and-drop interface. Images are securely stored in MinIO (S3-compatible object storage) and served via public URLs.

## Architecture

### Backend

**Storage Service** (`services/storage_service.py`)
- MinIO client wrapper for file operations
- Automatic bucket creation with public read policy
- UUID-based filename generation to prevent collisions
- User-scoped folder organization

**Upload Endpoint** (`core/upload_views.py`)
- Route: `POST /api/v1/upload/image/`
- Authentication: Required
- File validation: type, size
- Returns: URL to uploaded image

### Frontend

**ImageUpload Component** (`frontend/src/components/forms/ImageUpload.tsx`)
- Reusable drag-and-drop upload interface
- Live preview with fallback
- Client-side validation before upload
- Loading states and error handling
- Remove uploaded image functionality

## Features

### Drag-and-Drop
- Drag files over the upload area
- Visual feedback during drag operation
- Scale animation on drag enter
- Color change to indicate drop zone

### Click to Upload
- Click anywhere on the upload area
- Opens native file picker
- Single file selection

### Validation

**Client-Side:**
- File type: JPEG, PNG, GIF, WebP
- File size: Maximum 10MB
- Immediate feedback with error messages

**Server-Side:**
- Content type verification
- Size limit enforcement (10MB)
- Secure filename generation

### Visual Feedback

**States:**
- **Empty**: Dashed circle with photo icon
- **Dragging**: Scaled, highlighted border
- **Uploading**: Spinner overlay
- **Preview**: Circular image with remove button
- **Error**: Red error message below upload area

## Usage

### Basic Implementation

```tsx
import { ImageUpload } from '@/components/forms/ImageUpload';

function MyComponent() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <ImageUpload
      currentImage={imageUrl}
      onImageUploaded={(url) => setImageUrl(url)}
      onImageRemoved={() => setImageUrl('')}
    />
  );
}
```

### With Custom Settings

```tsx
<ImageUpload
  currentImage={currentImageUrl}
  onImageUploaded={handleUpload}
  onImageRemoved={handleRemove}
  maxSizeMB={5}  // Custom size limit
  acceptedFormats={['image/jpeg', 'image/png']}  // Limit formats
  className="my-custom-class"
/>
```

## MinIO Configuration

### Environment Variables

```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=allthrive-media
```

### Docker Compose

MinIO is configured in `docker-compose.yml`:
- Console: http://localhost:9001
- API: http://localhost:9000
- Bucket: `allthrive-media` (auto-created)

### Storage Structure

```
allthrive-media/
├── avatars/
│   ├── user_1/
│   │   ├── {uuid}.jpg
│   │   └── {uuid}.png
│   └── user_2/
│       └── {uuid}.jpg
└── images/
    ├── user_1/
    └── user_2/
```

## API Reference

### Upload Image

**Endpoint:** `POST /api/v1/upload/image/`

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request Body:**
```
file: <binary>
folder: avatars  // Optional, default: images
```

**Response (201 Created):**
```json
{
  "url": "http://localhost:9000/allthrive-media/avatars/user_1/abc-123.jpg",
  "filename": "profile.jpg",
  "size": 245678,
  "content_type": "image/jpeg"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "No file provided"
}
```
```json
{
  "error": "Invalid file type. Allowed: image/jpeg, image/png, image/gif, image/webp"
}
```
```json
{
  "error": "File too large. Maximum size: 10MB"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to upload file: <error details>"
}
```

## Security

### File Validation
- Strict content-type checking
- Size limits enforced
- No executable file types allowed

### Access Control
- Upload requires authentication
- Files organized by user ID
- Public read access only

### Filename Safety
- UUID-based names prevent collisions
- Original filenames preserved in metadata only
- No user-controlled paths

## Performance

### Optimization
- Direct upload to MinIO (no temporary storage)
- Chunked reading for large files
- Efficient BytesIO streaming

### Caching
- MinIO serves with appropriate cache headers
- CDN-ready URLs
- No application-level caching needed

## Future Enhancements

### Planned Features
- [ ] Image cropping/resizing
- [ ] Multiple file upload
- [ ] Progress bar for large files
- [ ] Drag-and-drop anywhere on page
- [ ] Paste from clipboard
- [ ] CDN integration
- [ ] Image optimization (WebP conversion)
- [ ] Thumbnail generation

### Considerations
- Add virus scanning for production
- Implement rate limiting
- Add image dimension validation
- Support for animated GIFs
- EXIF data stripping for privacy

## Troubleshooting

### Common Issues

**"Failed to upload image"**
- Check MinIO is running: `docker ps | grep minio`
- Verify MinIO credentials in `.env`
- Check bucket exists and has proper policy

**"File too large"**
- Check client and server size limits match
- Ensure nginx/proxy timeout is sufficient

**"Invalid file type"**
- Verify file MIME type is correct
- Check browser compatibility
- Try different file format

### Debug Commands

```bash
# Check MinIO logs
docker logs allthriveai-minio-1

# List buckets
docker exec allthriveai-minio-1 mc ls local/

# Check bucket policy
docker exec allthriveai-minio-1 mc policy list local/allthrive-media

# Upload test file
curl -X POST http://localhost:8000/api/v1/upload/image/ \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.jpg" \
  -F "folder=test"
```

## Testing

### Manual Testing

1. Navigate to `/account/settings`
2. Click or drag an image to the upload area
3. Verify preview appears
4. Check console for upload response
5. Confirm image displays correctly
6. Test remove button
7. Try dragging invalid file type
8. Try uploading oversized file

### Automated Testing

```typescript
// Component test example
describe('ImageUpload', () => {
  it('validates file type', () => {
    // Test invalid file type rejection
  });
  
  it('validates file size', () => {
    // Test size limit enforcement
  });
  
  it('uploads successfully', async () => {
    // Test successful upload flow
  });
});
```

## Related Files

- `services/storage_service.py` - MinIO client wrapper
- `core/upload_views.py` - Upload API endpoint
- `frontend/src/components/forms/ImageUpload.tsx` - React component
- `frontend/src/pages/AccountSettingsPage.tsx` - Usage example
- `docker-compose.yml` - MinIO configuration
- `requirements.txt` - MinIO Python client
