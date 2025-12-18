# OAuth Site Configuration

## Problem

The Django Sites framework is used by django-allauth to construct OAuth callback URLs. The previous startup.sh script hardcoded the Site domain to `localhost:8000`, which would cause OAuth callback mismatches in production environments (AWS, etc.).

## Solution

The `scripts/startup.sh` script now dynamically sets the Site domain based on the `BACKEND_URL` environment variable.

### How It Works

```python
# Parse BACKEND_URL to extract domain
backend_url = os.environ.get('BACKEND_URL', 'http://localhost:8000')
parsed = urlparse(backend_url)
domain = parsed.netloc  # e.g., 'api.allthrive.ai' or 'localhost:8000'

# Set site domain
site, created = Site.objects.get_or_create(id=1)
site.domain = domain
site.save()
```

### Environment-Specific Configuration

**Development (.env):**
```bash
BACKEND_URL=http://localhost:8000
DEBUG=True
# Site domain will be: localhost:8000
# OAuth callbacks: http://localhost:8000/accounts/{provider}/login/callback/
```

**Production (.env.production):**
```bash
BACKEND_URL=https://api.allthrive.ai
DEBUG=False
# Site domain will be: api.allthrive.ai
# OAuth callbacks: https://api.allthrive.ai/accounts/{provider}/login/callback/
```

## OAuth Provider Configuration

When configuring OAuth apps with providers, use these callback URLs:

### Development
- **Google**: `http://localhost:8000/accounts/google/login/callback/`
- **GitHub**: `http://localhost:8000/accounts/github/login/callback/`
- **LinkedIn**: `http://localhost:8000/accounts/oidc/linkedin/login/callback/`

### Production
- **Google**: `https://api.allthrive.ai/accounts/google/login/callback/`
- **GitHub**: `https://api.allthrive.ai/accounts/github/login/callback/`
- **LinkedIn**: `https://api.allthrive.ai/accounts/oidc/linkedin/login/callback/`

## Testing the Fix

### Local Development
```bash
# Start the stack
make up

# Check the site configuration
make django-shell
>>> from django.contrib.sites.models import Site
>>> site = Site.objects.get(id=1)
>>> print(f"Domain: {site.domain}, Name: {site.name}")
# Expected: Domain: localhost:8000, Name: AllThrive AI Local
```

### Production Deployment
```bash
# Set production environment variables
export BACKEND_URL=https://api.allthrive.ai
export DEBUG=False

# On startup, site will be configured as:
# Domain: api.allthrive.ai
# Name: AllThrive AI Production
```

## Related Files
- `scripts/startup.sh` - Dynamic site configuration
- `.env.example` - Development environment variables
- `.env.production.example` - Production environment variables
- `config/settings.py` - Django settings with BACKEND_URL

## Why This Matters

The Django Sites framework's domain is used by django-allauth to construct:
1. **OAuth callback URLs** - Must match what's registered with OAuth providers
2. **Redirect URLs** - After successful authentication
3. **Email verification links** - If email verification is enabled

If the Site domain is incorrect:
- ✗ OAuth callbacks fail with redirect_uri_mismatch errors
- ✗ Users cannot log in via social authentication
- ✗ Email verification links point to wrong domain

With the fix:
- ✓ Site domain automatically matches deployment environment
- ✓ OAuth callbacks work in development and production
- ✓ No manual database changes needed after deployment
