# Signup Feature Documentation

## Overview

Users can now create accounts using both OAuth (Google/GitHub) and traditional email/password signup.

## Signup Methods

### 1. OAuth Signup (Google/GitHub)
- Click "Sign up with Google" or "Sign up with GitHub"
- Authenticate with the provider
- User account is automatically created with Explorer role
- Redirected to dashboard

### 2. Email/Password Signup
- Fill out the signup form with:
  - First Name
  - Last Name
  - Email
  - Username (unique, minimum 3 characters)
  - Password (minimum 8 characters)
  - Account Type (role selection)
- Submit the form
- Redirected to login page with success message
- Log in with email and password

## Account Types Available at Signup

Users can choose their account type during signup:

- **Explorer** (Free) - Basic access, default role
- **Expert** - Enhanced features
- **Mentor** - Advanced capabilities
- **Patron** - Premium features

*Note: Admin role can only be assigned via Django admin*

## Frontend Components

### SignupPage Component
**Location**: `frontend/src/pages/SignupPage.tsx`

**Features**:
- OAuth buttons for Google and GitHub
- Email/password form with validation
- Role selection dropdown
- Real-time form validation
- Error handling
- Success redirect to login

**Form Validation**:
- Email format validation
- Username uniqueness and length (min 3 chars)
- Password strength (min 8 chars)
- Password confirmation match
- Required field validation

### LoginPage Updates
**Location**: `frontend/src/pages/LoginPage.tsx`

**New Features**:
- Success message display (after signup)
- "Sign up" link for new users

## Backend API

### Signup Endpoint

**URL**: `POST /api/auth/signup/`

**Request Body**:
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "explorer"
}
```

**Success Response** (201 Created):
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "role": "explorer",
    "role_display": "Explorer",
    "avatar_url": null,
    "bio": "",
    "date_joined": "2025-11-13T11:30:00Z",
    "last_login": null
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "email": ["A user with this email already exists."],
  "username": ["A user with this username already exists."],
  "password": ["This password is too short."]
}
```

## Validation Rules

### Email
- Required
- Must be valid email format
- Must be unique
- Used for authentication

### Username
- Required
- Minimum 3 characters
- Must be unique
- Displayed in user profile

### Password
- Required
- Minimum 8 characters
- Django's password validators applied:
  - Not similar to user attributes
  - Not commonly used password
  - Not entirely numeric

### Name Fields
- First name: Required
- Last name: Required
- Used for full name display

### Role
- Optional (defaults to "explorer")
- Can be: explorer, expert, mentor, patron
- Cannot be set to "admin" via signup (admin only)

## User Flow

### New User Signup Flow

```
1. User visits /signup
   ↓
2. Fills out form or clicks OAuth button
   ↓
3a. OAuth Path:
    - Redirects to provider
    - Authenticates
    - Returns to app
    - User created with explorer role
    - Redirects to dashboard
    
3b. Email/Password Path:
    - Validates form
    - Submits to /api/auth/signup/
    - User created
    - Redirects to /login with success message
    ↓
4. User logs in
   ↓
5. Redirects to dashboard
```

## Routes

### Frontend Routes
- `/signup` - Signup page (public, redirects if authenticated)
- `/login` - Login page (public, redirects if authenticated)

### Backend Routes
- `POST /api/auth/signup/` - Create new user account

## Security Features

1. **Password Hashing**: All passwords are hashed using Django's PBKDF2 algorithm
2. **CSRF Protection**: Forms include CSRF tokens
3. **Email Validation**: Prevents duplicate emails
4. **Username Validation**: Prevents duplicate usernames
5. **Password Strength**: Enforces minimum password requirements
6. **Role Restrictions**: Admin role cannot be self-assigned

## Error Messages

### Common Errors

**Email already exists**:
```
A user with this email already exists.
```

**Username already exists**:
```
A user with this username already exists.
```

**Password too short**:
```
Password must be at least 8 characters.
```

**Passwords don't match**:
```
Passwords do not match.
```

**Invalid email format**:
```
Invalid email format.
```

**Username too short**:
```
Username must be at least 3 characters.
```

## Testing

### Manual Testing Checklist

- [ ] Signup with valid credentials
- [ ] Signup with existing email (should fail)
- [ ] Signup with existing username (should fail)
- [ ] Signup with password < 8 chars (should fail)
- [ ] Signup with non-matching passwords (should fail)
- [ ] Signup with invalid email format (should fail)
- [ ] Signup with OAuth (Google)
- [ ] Signup with OAuth (GitHub)
- [ ] Test each role selection
- [ ] Verify redirect to login after signup
- [ ] Verify success message on login page
- [ ] Verify account is created in Django admin

### API Testing

```bash
# Test signup endpoint
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "securepass123",
    "first_name": "Test",
    "last_name": "User",
    "role": "explorer"
  }'
```

## Integration with Existing Features

### AuthContext
The signup process integrates with the existing `AuthContext`:
- After signup, users are redirected to login
- Login flow remains unchanged
- OAuth signup creates user automatically and logs them in

### Role System
- New users can select their initial role (except admin)
- Roles can be upgraded later via Django admin
- Role hierarchy is maintained

### User Model
- All custom User model fields are supported
- Avatar URL and bio can be added later via profile update

## Future Enhancements

1. **Email Verification**: Add email confirmation step
2. **Password Reset**: Allow users to reset forgotten passwords
3. **Social Profile Import**: Import avatar and bio from OAuth providers
4. **Username Availability Check**: Real-time username availability checking
5. **Password Strength Indicator**: Visual feedback for password strength
6. **Terms of Service**: Require acceptance of terms during signup
7. **Captcha**: Add bot protection for signup form
8. **Two-Factor Setup**: Option to enable 2FA during signup

## Troubleshooting

### Issue: Username validation error on OAuth signup
**Solution**: OAuth users get auto-generated username from email. This is handled automatically by django-allauth.

### Issue: User created but cannot login
**Solution**: Check that password was properly hashed. Use `user.set_password()` method.

### Issue: Role not being set
**Solution**: Verify role field is included in serializer and is a valid choice.

### Issue: Redirect not working after signup
**Solution**: Check frontend routing and ensure `/login` route exists.

## Configuration

### Backend Settings

In `config/settings.py`:
```python
# Allow username for traditional signup
ACCOUNT_USERNAME_REQUIRED = True

# Email is still used for authentication
ACCOUNT_AUTHENTICATION_METHOD = 'email'
```

### Frontend Environment

In `frontend/.env`:
```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

## Support

For issues related to signup:
1. Check browser console for frontend errors
2. Check Django server logs for backend errors
3. Verify database migrations are up to date
4. Ensure all required environment variables are set

## Summary

The signup feature provides multiple ways for users to create accounts:
- **OAuth** for quick, passwordless signup
- **Email/Password** for traditional signup with role selection
- **Role-based** onboarding with four user tiers
- **Secure** with proper validation and password hashing
- **User-friendly** with clear error messages and success feedback

All signups integrate seamlessly with the existing authentication system and role-based permission structure.
