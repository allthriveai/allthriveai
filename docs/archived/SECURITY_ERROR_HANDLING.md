# Security & Error Handling Guide

## Overview

This document outlines the security practices and error handling patterns implemented across the AllThrive AI codebase, with a focus on user isolation, PII protection, and comprehensive logging.

## Secure Logging System

### SecureLogger Class (`core/logging_utils.py`)

A custom logging utility that automatically sanitizes sensitive information and maintains user isolation.

**Features:**
- Automatic PII redaction (emails, usernames, IPs)
- Sensitive field detection (passwords, tokens, keys)
- User context isolation (user_id tracking)
- Different log levels for different scenarios
- Stack traces only in DEBUG mode

**Usage Examples:**

```python
from core.logging_utils import SecureLogger

# Log a user action
SecureLogger.log_action(
    action="Profile update",
    user_id=user.id,
    username=user.username,
    details={'fields': ['bio', 'avatar_url']},
    level='info'
)

# Log an error
SecureLogger.log_action(
    action="Database query failed",
    user_id=user.id,
    error=exception,
    level='error'
)

# Log file upload
SecureLogger.log_file_upload(
    user_id=user.id,
    filename="profile.jpg",
    file_size=245678,
    content_type="image/jpeg",
    success=True
)

# Log authentication event
SecureLogger.log_auth_event(
    event_type="login",
    user_id=user.id,
    username=user.username,
    ip_address=get_client_ip(request),
    success=True
)
```

### What Gets Redacted

**Sensitive Fields (Always Redacted):**
- password
- token (access_token, refresh_token, csrf_token)
- secret / api_key
- session_id
- credit_card / ssn

**PII Protection:**
- Emails: `jo***@example.com` (shows first 2 chars)
- Usernames: `joh***` (shows first 3 chars)
- IP Addresses: `192.168.1.***` (shows first 10 chars)
- Filenames: Only extension logged (`jpg`, not `secret-document.jpg`)

## Error Handling Patterns

### 1. API Views

**Pattern: Layered Try-Catch with Specific Errors**

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def my_view(request):
    user_id = request.user.id
    username = request.user.username

    # Validation layer
    if 'required_field' not in request.data:
        SecureLogger.log_action(
            "Validation failed: Missing required field",
            user_id=user_id,
            level='warning'
        )
        return Response(
            {'error': 'Required field missing'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Business logic layer
        try:
            result = perform_operation(request.data)
        except SpecificException as e:
            SecureLogger.log_action(
                "Operation failed",
                user_id=user_id,
                error=e,
                level='error'
            )
            return Response(
                {'error': 'Operation failed. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Success logging
        SecureLogger.log_action(
            "Operation successful",
            user_id=user_id,
            details={'result_id': result.id},
            level='info'
        )

        return Response(result_data, status=status.HTTP_200_OK)

    except Exception as e:
        # Catch-all for unexpected errors
        SecureLogger.log_action(
            "Unexpected error",
            user_id=user_id,
            error=e,
            level='critical'
        )
        return Response(
            {'error': 'An unexpected error occurred'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

### 2. File Upload Security

**Implemented in `core/uploads/views.py`:**

```python
# Multi-layer validation
1. File presence check
2. File size validation (10MB for images)
3. Content type validation (whitelist only)
4. Actual file content validation (PIL Image.open)
5. Dimension validation (max 5000x5000)
6. Resolution validation (max 25 megapixels)
7. Image optimization (resize, compress)
8. Rate limiting (10 uploads/minute)
```

**Security Features:**
- ✅ Validates actual file content, not just headers
- ✅ Prevents decompression bombs
- ✅ Automatically optimizes images
- ✅ Rate limiting per user
- ✅ User-scoped storage folders
- ✅ UUID-based filenames (no user-controlled paths)

### 3. Profile Updates

**Pattern: Field-level validation with audit logging**

```python
# In serializers
class UserUpdateSerializer(serializers.ModelSerializer):
    def validate_username(self, value):
        # Normalize
        value = value.lower().strip()

        # Check uniqueness (excluding current user)
        if self.instance and self.instance.username == value:
            return value

        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username taken')

        # Validate format
        if not re.match(r'^[a-z0-9_-]+$', value):
            raise serializers.ValidationError('Invalid format')

        return value

    def update(self, instance, validated_data):
        # Track changed fields
        changed_fields = [
            field for field in validated_data.keys()
            if getattr(instance, field) != validated_data[field]
        ]

        try:
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            # Log successful update
            SecureLogger.log_profile_update(
                user_id=instance.id,
                username=instance.username,
                fields_updated=changed_fields,
                success=True
            )

            return instance

        except Exception as e:
            SecureLogger.log_profile_update(
                user_id=instance.id,
                username=instance.username,
                fields_updated=changed_fields,
                success=False,
                error=e
            )
            raise
```

## User Isolation

### Database Level

**Query Filtering:**
```python
# Always scope queries to requesting user
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_data(request):
    # GOOD: User isolated
    data = MyModel.objects.filter(user=request.user)

    # BAD: No user isolation
    data = MyModel.objects.all()  # ❌ Security risk
```

**Object Permissions:**
```python
from core.permissions import IsOwnerOrReadOnly

class MyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        # Always filter by user
        return MyModel.objects.filter(user=self.request.user)
```

### Storage Level

**MinIO User Folders:**
```
allthrive-media/
├── avatars/
│   ├── user_1/        # User isolation
│   │   └── {uuid}.jpg
│   └── user_2/
│       └── {uuid}.jpg
```

**Storage Service:**
```python
def upload_file(self, ..., user_id: int, ...):
    # Automatic user folder scoping
    object_name = f"{folder}/user_{user_id}/{unique_id}.{ext}"
```

### Logging Level

**User Context in All Logs:**
```
[user_id=123, username=joh***] Profile update | details: {'fields': ['bio']}
[user_id=456, username=jan***] File upload | details: {'extension': 'jpg', 'size_bytes': 245678}
```

## Frontend Error Handling

### API Service Layer

**Pattern: Consistent error extraction**

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

// Global error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Extract user-friendly error message
    const message = error.response?.data?.error
      || error.response?.data?.detail
      || 'An unexpected error occurred';

    // Don't log sensitive data
    console.error('API Error:', {
      endpoint: error.config?.url,
      status: error.response?.status,
      // Don't log request data
    });

    return Promise.reject(error);
  }
);
```

### Component Level

**Pattern: Try-catch with user feedback**

```typescript
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await api.post('/endpoint', data);
    // Success handling
    onSuccess(response.data);
  } catch (err: any) {
    const errorMsg = err.response?.data?.error
      || 'Failed to complete action';
    setError(errorMsg);
    // Don't log user data
    console.error('Action failed:', errorMsg);
  } finally {
    setIsLoading(false);
  }
};

// Display error to user
{error && (
  <div className="error-message">
    {error}
  </div>
)}
```

## Security Checklist

### For New API Endpoints

- [ ] Authentication required (`@permission_classes([IsAuthenticated])`)
- [ ] User isolation in queries (`.filter(user=request.user)`)
- [ ] Input validation (serializers or manual checks)
- [ ] Rate limiting if needed (`@ratelimit`)
- [ ] Secure logging (use `SecureLogger`)
- [ ] Proper error messages (no sensitive data leakage)
- [ ] Try-catch for exceptions
- [ ] User-friendly error responses

### For File Uploads

- [ ] File size validation
- [ ] Content type whitelist
- [ ] Actual content validation (not just headers)
- [ ] Rate limiting
- [ ] User-scoped storage paths
- [ ] UUID-based filenames
- [ ] Secure logging (filename extension only)

### For Data Updates

- [ ] Field-level validation
- [ ] Uniqueness checks (excluding current record)
- [ ] XSS prevention (bleach/sanitize)
- [ ] SQL injection prevention (ORM usage)
- [ ] Audit logging (fields changed, not values)
- [ ] Transaction rollback on error

## Common Vulnerabilities Prevented

### 1. Information Disclosure
**Prevention:**
- Sanitize all log output
- Generic error messages to users
- Detailed errors only in DEBUG mode
- No stack traces in production

### 2. User Enumeration
**Prevention:**
- Consistent response times (see `username_profile_view`)
- Generic error messages ("Invalid credentials" not "User not found")
- Rate limiting on auth endpoints

### 3. Path Traversal
**Prevention:**
- UUID-based filenames
- No user-controlled paths
- Whitelist allowed file types

### 4. XSS Attacks
**Prevention:**
- bleach.clean() on user HTML content
- Allowed tags whitelist
- Frontend escaping

### 5. SQL Injection
**Prevention:**
- Django ORM (parameterized queries)
- No raw SQL with user input

### 6. CSRF
**Prevention:**
- Django CSRF middleware
- Token validation on state-changing operations

### 7. Mass Assignment
**Prevention:**
- Explicit serializer fields
- `read_only_fields` for sensitive fields
- Role validation in serializers

## Monitoring & Alerts

### Log Aggregation

**Recommended Setup:**
1. Collect logs from Docker containers
2. Send to centralized logging (ELK, Datadog, etc.)
3. Set up alerts for:
   - High error rates
   - Failed auth attempts
   - Storage failures
   - Unusual user activity

### Metrics to Track

**Security Metrics:**
- Failed login attempts per user/IP
- File upload failures
- Rate limit hits
- Permission denied errors

**Performance Metrics:**
- API response times
- File upload times
- Database query times
- Error rates by endpoint

## Testing Security

### Unit Tests

```python
def test_user_isolation():
    """Test that users can only access their own data"""
    user1 = User.objects.create(username='user1')
    user2 = User.objects.create(username='user2')

    data1 = MyModel.objects.create(user=user1)

    # User2 should not see User1's data
    client.force_authenticate(user=user2)
    response = client.get(f'/api/v1/data/{data1.id}/')
    assert response.status_code == 404  # or 403
```

### Integration Tests

```python
def test_file_upload_security():
    """Test file upload validates content"""
    # Test with malicious file
    malicious_file = create_malicious_file()
    response = client.post('/api/v1/upload/image/', {'file': malicious_file})
    assert response.status_code == 400
    assert 'Invalid' in response.data['error']
```

## Related Files

- `core/logging_utils.py` - Secure logging implementation
- `core/permissions.py` - Custom permission classes
- `core/uploads/views.py` - File upload with security
- `services/storage_service.py` - MinIO storage with user isolation
- `frontend/src/services/api.ts` - Frontend API client with error handling
