# Data Model: React TypeScript Frontend Skeleton

**Date**: 2025-11-10
**Feature**: 001-react-typescript-frontend
**Purpose**: Define frontend state models and TypeScript interfaces

## Overview

This document defines the TypeScript interfaces and types for frontend state management. These models represent client-side state, not database schemas.

## Core Data Models

### User Model

Represents an authenticated user in the application.

```typescript
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;  // Computed from firstName + lastName
  createdAt: string; // ISO 8601 date string
}
```

**Validation Rules**:
- `id`: Positive integer, required
- `email`: Valid email format, required
- `firstName`: Non-empty string, 1-50 characters
- `lastName`: Non-empty string, 1-50 characters
- `fullName`: Read-only, computed property
- `createdAt`: ISO 8601 format

**State Transitions**:
- User object created on successful login
- User object cleared on logout
- User object refreshed periodically (token validation)

---

### AuthState Model

Represents the authentication state of the application.

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
```

**Fields**:
- `user`: Current authenticated user or null if not logged in
- `isAuthenticated`: Boolean flag for authentication status
- `isLoading`: True during login/logout/token refresh operations
- `error`: Error message from failed auth operations, null on success

**State Transitions**:
```
Initial → Loading (checking stored auth)
Loading → Authenticated (valid token found)
Loading → Unauthenticated (no token/invalid token)
Authenticated → Loading (logout initiated)
Loading → Unauthenticated (logout complete)
Unauthenticated → Loading (login initiated)
Loading → Authenticated (login success)
Loading → Error (login/logout failed)
```

---

### LoginCredentials Model

Represents user login form data.

```typescript
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}
```

**Validation Rules**:
- `email`: Required, valid email format
- `password`: Required, minimum 8 characters
- `rememberMe`: Optional boolean, default false

**Usage**: Login form submission to `/api/auth/login`

---

### API Response Models

#### Standard Success Response

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

#### Standard Error Response

```typescript
interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>; // Field-specific errors
  statusCode: number;
}
```

**Example Error Response**:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "email": ["Invalid email format"],
    "password": ["Password too short"]
  },
  "statusCode": 400
}
```

---

### Route Configuration Model

Represents routing metadata for access control.

```typescript
interface RouteConfig {
  path: string;
  element: React.ComponentType;
  requiresAuth: boolean;
  redirectIfAuthenticated?: boolean;
  title: string;
}
```

**Fields**:
- `path`: URL path pattern
- `element`: React component to render
- `requiresAuth`: True if route requires authentication
- `redirectIfAuthenticated`: True for login page (redirect to dashboard if already logged in)
- `title`: Page title for document.title

**Example Routes**:
```typescript
const routes: RouteConfig[] = [
  { path: '/', element: HomePage, requiresAuth: false, title: 'Home' },
  { path: '/about', element: AboutPage, requiresAuth: false, title: 'About' },
  { path: '/login', element: LoginPage, requiresAuth: false, redirectIfAuthenticated: true, title: 'Login' },
  { path: '/dashboard', element: DashboardPage, requiresAuth: true, title: 'Dashboard' },
];
```

---

### Navigation State Model

Represents navigation and redirect state.

```typescript
interface NavigationState {
  returnUrl?: string;  // URL to return to after login
  previousPath?: string;  // Previous route for back navigation
}
```

**Usage**:
- Stored in React Router location state
- `returnUrl` set when unauthenticated user tries to access protected route
- After successful login, redirect to `returnUrl` or default to `/dashboard`

---

## Form State Models

### LoginFormState

```typescript
interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  errors: {
    email?: string;
    password?: string;
    form?: string; // General form error
  };
  isSubmitting: boolean;
}
```

**Validation**:
- Email: Real-time validation on blur
- Password: Validated on submit
- Form-level errors from API response

---

## API Query State (TanStack Query)

### Query Keys

```typescript
const queryKeys = {
  auth: ['auth'] as const,
  user: ['auth', 'user'] as const,
} as const;
```

### Query/Mutation State

TanStack Query provides standard state:

```typescript
interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}
```

---

## Type Guards

Utility functions for runtime type checking.

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === false
  );
}
```

---

## Enums

### Authentication Status

```typescript
enum AuthStatus {
  Idle = 'idle',
  Loading = 'loading',
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated',
  Error = 'error',
}
```

### HTTP Methods

```typescript
enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}
```

---

## Storage Models

### Local Storage Keys

```typescript
const StorageKeys = {
  AUTH_STATE: 'auth_state',
  THEME: 'theme',
  REMEMBER_ME: 'remember_me',
} as const;
```

**Security Notes**:
- Do NOT store auth tokens in localStorage (using httpOnly cookies instead)
- Only store non-sensitive preferences

---

## Relationships

```
AuthState
  ├── user: User | null
  └── error: string | null

RouteConfig
  └── element: ComponentType

NavigationState
  └── returnUrl: string (references RouteConfig.path)

LoginFormState
  └── errors: Record (maps to ApiError.details)
```

---

## Data Flow

### Authentication Flow

```
1. User submits LoginCredentials
   ↓
2. API returns ApiResponse<User> or ApiError
   ↓
3. AuthState updated:
   - success: { user: User, isAuthenticated: true, error: null }
   - failure: { user: null, isAuthenticated: false, error: string }
   ↓
4. TanStack Query caches result
   ↓
5. Router redirects based on auth state
```

### Route Protection Flow

```
1. User navigates to route
   ↓
2. Router checks RouteConfig.requiresAuth
   ↓
3. If requiresAuth && !isAuthenticated:
   - Store current path in NavigationState.returnUrl
   - Redirect to /login
   ↓
4. After login:
   - Read NavigationState.returnUrl
   - Redirect to returnUrl or /dashboard
```

---

## Type Safety Guidelines

1. **No `any` types**: Use `unknown` and type guards instead
2. **Strict null checks**: All nullable fields explicitly marked
3. **Readonly where appropriate**: Prevent accidental mutations
4. **Discriminated unions**: For polymorphic types (ApiResponse vs ApiError)
5. **Const assertions**: For literal types (query keys, storage keys)

---

## Validation

All validation done with:
- **Client-side**: Immediate UI feedback (zod or custom validators)
- **Server-side**: Source of truth (Django REST Framework serializers)

**Never trust client validation alone** - always validate on backend.

---

## Next Steps

- Implement TypeScript interfaces in `src/types/`
- Create validation schemas (if using zod)
- Implement type guards for runtime checks
- Document any deviations from this model
