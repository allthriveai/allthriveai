# Deployment Configuration Guide

This guide explains how to configure the application for different environments.

## Environment Variables

### Development (localhost)

```bash
# Cookie domain for localhost (both :3000 and :8000)
COOKIE_DOMAIN=localhost

# Frontend URL
FRONTEND_URL=http://localhost:3000

# CORS settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Production (Single Domain)

If your frontend and backend are on the same domain (e.g., `example.com` and `example.com/api`):

```bash
# No need for special cookie domain
COOKIE_DOMAIN=.example.com

# Frontend URL
FRONTEND_URL=https://example.com

# CORS settings (might not be needed if same origin)
CORS_ALLOWED_ORIGINS=https://example.com
CSRF_TRUSTED_ORIGINS=https://example.com
```

### Production (Subdomains)

If your frontend and backend are on different subdomains (e.g., `app.example.com` and `api.example.com`):

```bash
# Cookie domain with leading dot to share across subdomains
COOKIE_DOMAIN=.example.com

# Frontend URL
FRONTEND_URL=https://app.example.com

# CORS settings
CORS_ALLOWED_ORIGINS=https://app.example.com,https://api.example.com
CSRF_TRUSTED_ORIGINS=https://app.example.com,https://api.example.com

# Also ensure ALLOWED_HOSTS includes both
ALLOWED_HOSTS=api.example.com,app.example.com
```

## How Cookies Work

### Cookie Domain Explanation

- **`localhost`**: Cookies work across different ports (`:3000`, `:8000`) on localhost
- **`.example.com`**: Cookies work across all subdomains (`app.example.com`, `api.example.com`, `www.example.com`)
- **`example.com`**: Cookies only work on `example.com`, NOT on subdomains

### Cookie Settings

All cookies use these settings (configured in `config/settings.py`):

```python
SESSION_COOKIE_DOMAIN = COOKIE_DOMAIN
CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN
SIMPLE_JWT['AUTH_COOKIE_DOMAIN'] = COOKIE_DOMAIN
```

## OAuth Configuration

### Redirect URLs

OAuth providers need to know where to redirect users after authentication. Configure these in:

1. **Google Cloud Console** → Credentials → Authorized redirect URIs:
   - Development: `http://localhost:8000/accounts/google/login/callback/`
   - Production: `https://api.example.com/accounts/google/login/callback/`

2. **GitHub Developer Settings** → OAuth Apps → Authorization callback URL:
   - Development: `http://localhost:8000/accounts/github/login/callback/`
   - Production: `https://api.example.com/accounts/github/login/callback/`

### Frontend OAuth Flow

The frontend URL (`FRONTEND_URL`) is used to redirect users after successful OAuth:

```python
# In oauth_callback view
window.location.href = '{FRONTEND_URL}/{username}'
```

## Security Checklist for Production

- [ ] Set `DEBUG=False`
- [ ] Set strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS` with your domains
- [ ] Use HTTPS (set `SECURE_SSL_REDIRECT=True` automatically when `DEBUG=False`)
- [ ] Set proper `COOKIE_DOMAIN` for your domain structure
- [ ] Update OAuth redirect URIs in provider consoles
- [ ] Set `FRONTEND_URL` to your production frontend URL
- [ ] Configure CORS origins for your frontend domain
- [ ] Update CSRF trusted origins
- [ ] Set `COOKIE_SECURE=True` (automatic when `DEBUG=False`)

## Testing Configuration

To test if cookies are being set correctly:

1. Open browser DevTools → Application/Storage → Cookies
2. Look for:
   - `access_token` (HTTPOnly, Domain: your COOKIE_DOMAIN)
   - `refresh_token` (HTTPOnly, Domain: your COOKIE_DOMAIN)
   - `csrftoken` (readable by JS, Domain: your COOKIE_DOMAIN)

3. Verify the domain matches your `COOKIE_DOMAIN` setting
4. After logout, verify all cookies are cleared

## Common Issues

### Cookies Not Working Across Domains

**Problem**: Frontend at `localhost:3000` can't read cookies from backend at `localhost:8000`

**Solution**: Ensure `COOKIE_DOMAIN=localhost` (not empty, not a specific port)

### OAuth Redirect Loop

**Problem**: After OAuth, keeps redirecting back to login

**Solution**: Check that:
1. `FRONTEND_URL` is correctly set
2. OAuth callback URLs in provider console match your backend URL
3. Cookies are being set with correct domain

### CORS Errors

**Problem**: Browser blocks requests from frontend to backend

**Solution**:
1. Add frontend URL to `CORS_ALLOWED_ORIGINS`
2. Add frontend URL to `CSRF_TRUSTED_ORIGINS`
3. Ensure `CORS_ALLOW_CREDENTIALS=True` (already set)

## Docker Compose Environment

When using Docker Compose, add these to your `docker-compose.yml` or `.env`:

```yaml
services:
  web:
    environment:
      - COOKIE_DOMAIN=localhost
      - FRONTEND_URL=http://localhost:3000
      - CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Or in your `.env` file that docker-compose reads.
