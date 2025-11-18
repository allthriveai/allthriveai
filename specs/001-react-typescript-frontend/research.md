# Research: React TypeScript Frontend Skeleton

**Date**: 2025-11-10
**Feature**: 001-react-typescript-frontend
**Purpose**: Resolve technical decisions and validate Django integration approach

## Technical Decisions

### 1. Build Tool Selection

**Decision**: Vite

**Rationale**:
- Lightning-fast HMR (Hot Module Replacement) with native ES modules
- Out-of-the-box TypeScript support with no configuration
- Optimized production builds with Rollup
- Smaller bundle sizes compared to Create React App
- Active development and modern architecture
- Excellent Django backend integration (simple proxy configuration)

**Alternatives Considered**:
- **Create React App**: Mature but slower build times, heavier configuration, maintenance mode since 2023
- **Next.js**: Overkill for SPA, designed for SSR/SSG which conflicts with Django rendering

**Implementation Notes**:
- Use Vite proxy to Django backend during development
- Configure CORS on Django for production
- Build output goes to `frontend/dist/` for Django static serving if needed

### 2. State Management

**Decision**: React Context API + TanStack Query

**Rationale**:
- Context API sufficient for authentication state (simple, no library needed)
- TanStack Query handles server state, caching, and synchronization
- Avoids over-engineering with Redux for this scale
- Type-safe with TypeScript
- Follows modern React patterns (hooks-based)

**Alternatives Considered**:
- **Redux Toolkit**: Too complex for authentication-only state management, adds boilerplate
- **Zustand**: Good option but Context API is simpler for this use case

**Implementation Notes**:
- AuthContext for user authentication state
- TanStack Query for API data fetching and caching
- Custom hooks (useAuth, useApi) to encapsulate logic

### 3. API Client

**Decision**: Axios + TanStack Query

**Rationale**:
- Axios provides interceptors for auth token injection
- Better error handling than native Fetch
- Automatic request/response transformation
- CSRF token handling for Django integration
- TanStack Query wraps Axios for caching and state management

**Alternatives Considered**:
- **Native Fetch**: Requires more boilerplate for error handling and interceptors
- **TanStack Query alone**: Works but Axios interceptors simplify auth token management

**Implementation Notes**:
- Axios instance with base URL configuration
- Request interceptor to add auth tokens
- Response interceptor to handle 401 (token expiration)
- CSRF token from Django cookies

### 4. Styling Solution

**Decision**: Tailwind CSS

**Rationale**:
- Utility-first approach speeds up development
- Excellent TypeScript/React integration
- Built-in responsive design utilities
- Smaller production bundle (PurgeCSS removes unused styles)
- Follows modern web development trends
- Good documentation and community

**Alternatives Considered**:
- **CSS Modules**: More boilerplate, harder to maintain consistency
- **styled-components**: Runtime overhead, CSS-in-JS not ideal for performance

**Implementation Notes**:
- Tailwind configured with Vite PostCSS plugin
- Custom theme for brand colors
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

### 5. Authentication Strategy

**Decision**: JWT in httpOnly Cookies

**Rationale**:
- Most secure option against XSS attacks (JavaScript cannot access httpOnly cookies)
- Django can set CSRF protection
- Automatic cookie sending with requests
- Refresh token rotation supported
- Follows Django security best practices

**Alternatives Considered**:
- **JWT in localStorage**: Vulnerable to XSS attacks, not recommended for production
- **Session storage**: Better than localStorage but still accessible to JavaScript

**Implementation Notes**:
- Django sets httpOnly cookie with JWT on login
- Frontend doesn't store token directly
- Axios automatically includes cookies in requests
- CSRF token in separate cookie (Django standard)
- Token refresh endpoint for long-lived sessions

## Django Integration Pattern

### Development Setup

```
Frontend (Vite): http://localhost:5173
Backend (Django): http://localhost:8000
```

**Vite Proxy Configuration** (vite.config.ts):
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:8000',
  }
}
```

### Production Setup

**Option A**: Django serves frontend (traditional)
- Build frontend →`frontend/dist/`
- Configure Django static files to serve from dist/
- Single deployment unit

**Option B**: Separate deployment (modern)
- Frontend deployed to CDN/static host
- Backend as API-only service
- CORS configured on Django
- Recommended for scalability

### Django CORS Configuration

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Development
    "https://yourdomain.com",  # Production
]

CORS_ALLOW_CREDENTIALS = True  # For cookies
```

### Django Authentication Endpoints

Expected Django REST Framework endpoints:
- POST `/api/auth/login/` - Returns httpOnly cookie with JWT
- POST `/api/auth/logout/` - Clears authentication cookie
- GET `/api/auth/me/` - Returns current user info
- POST `/api/auth/refresh/` - Refreshes token

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

- Component rendering and behavior
- Custom hooks (useAuth, useApi)
- Utility functions (validators, storage)
- Target: >80% code coverage

### Integration Tests (Vitest + React Testing Library)

- Complete user flows (login → dashboard → logout)
- Route protection and redirection
- API mock interactions
- Error handling scenarios

### End-to-End Tests (Playwright)

- Critical paths:
  - Homepage → About page (public access)
  - Unauthenticated user redirected from protected routes
  - Login flow → Dashboard access
  - Token expiration → Re-login
- Run against real Django backend in test mode

## Security Considerations

### Authentication Security

- httpOnly cookies prevent XSS token theft
- CSRF tokens on state-changing requests
- Secure cookie flag in production (HTTPS only)
- SameSite=Lax cookie attribute

### Content Security Policy

- No inline scripts
- Restrict script sources to known CDNs
- Report CSP violations to monitoring

### Input Validation

- Client-side validation for UX (immediate feedback)
- Never trust client validation alone
- Backend validation is source of truth

## Performance Optimization

### Build Optimization

- Code splitting by route (React.lazy + Suspense)
- Tree shaking unused code
- Minification and compression
- Asset optimization (images, fonts)

### Runtime Optimization

- React.memo for expensive components
- useMemo/useCallback for expensive computations
- Virtualization for long lists (if needed later)
- Lazy load images

### Caching Strategy

- TanStack Query caches API responses
- Stale-while-revalidate pattern
- Cache invalidation on mutations
- Conservative cache times (5 minutes default)

## Accessibility (a11y)

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus management for route changes
- Screen reader testing

## Browser Support

**Supported**:
- Chrome 90+ (2021)
- Firefox 88+ (2021)
- Safari 14+ (2020)
- Edge 90+ (2021)

**Not Supported**:
- IE 11 (discontinued)
- Legacy mobile browsers (<2 years old)

## Development Workflow

### Local Development

1. Start Django backend: `python manage.py runserver`
2. Start frontend: `npm run dev` (Vite)
3. Access at http://localhost:5173
4. API calls proxied to Django

### Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=AllThrive AI
```

### Code Quality Tools

- ESLint: JavaScript/TypeScript linting
- Prettier: Code formatting
- TypeScript: Type checking
- Husky: Pre-commit hooks

## Monitoring & Observability

### Error Tracking

- React Error Boundary for component errors
- Global error handler for uncaught errors
- API error logging (status, endpoint, user)

### Performance Monitoring

- Core Web Vitals tracking
- Route transition times
- API call durations

### User Analytics

- Page view tracking
- User flow analysis
- Error rate monitoring

## Migration Path

This skeleton provides foundation for:
- Additional pages and features
- AI chat interface integration
- User profile management
- Admin dashboard
- Mobile app (React Native code sharing)

## Conclusion

All technical decisions resolved. Stack selected:
- **Build**: Vite
- **State**: Context API + TanStack Query
- **API**: Axios
- **Styling**: Tailwind CSS
- **Auth**: httpOnly cookies with JWT

Ready to proceed to Phase 1 (Design & Contracts).
