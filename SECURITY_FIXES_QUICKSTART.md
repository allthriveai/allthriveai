# Security Fixes Quick Start Guide

**⚡ Start here to apply all critical security fixes**

---

## 📋 Prerequisites

- Docker and Docker Compose installed
- Access to `.env` file
- Database backup (recommended)

---

## 🚀 Quick Implementation (5 Steps)

### Step 1: Generate SECRET_KEY

Run this in your Django container:

```bash
docker-compose exec web python manage.py shell -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the output and add to your `.env` file:

```bash
SECRET_KEY=<paste-generated-key-here>
```

**⚠️ CRITICAL:** App will NOT start without this!

---

### Step 2: Update Environment Variables

Add these to your `.env` file:

```bash
# Email Configuration (for user verification)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key-here
DEFAULT_FROM_EMAIL=noreply@allthrive.ai
ADMIN_EMAIL=admin@allthrive.ai
```

**Note:** For development, email will print to console. For production, set up SendGrid.

---

### Step 3: Install Dependencies & Run Migrations

```bash
# Stop services
docker-compose down

# Rebuild with new dependencies
docker-compose build

# Start services
docker-compose up -d

# Run migrations
docker-compose exec web python manage.py makemigrations
docker-compose exec web python manage.py migrate

# Check deployment readiness
docker-compose exec web python manage.py check --deploy
```

---

### Step 4: Verify Logging

```bash
# Check logs directory created
ls -la logs/

# You should see:
# - django.log
# - security.log

# Tail logs to verify they're working
docker-compose logs -f web
```

---

### Step 5: Test Critical Features

```bash
# 1. Test rate limiting (should block on 6th attempt)
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/v1/auth/signup/ \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"test$i\",\"email\":\"test$i@test.com\",\"password\":\"testpass12345\"}"
  echo "\nAttempt $i"
done

# 2. Test CSP reporting
curl -X POST http://localhost:8000/api/v1/csp-report/ \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"blocked-uri":"http://evil.com"}}'

# Check security log
tail logs/security.log

# 3. Test database health
curl http://localhost:8000/api/v1/db/health/
```

---

## ✅ Success Indicators

You're good to go if:

- [x] App starts without "SECRET_KEY" error
- [x] Migrations run successfully
- [x] Log files appear in `/logs` directory
- [x] Rate limiting blocks 6th signup attempt
- [x] CSP violations logged to `security.log`
- [x] Database health check returns `{"status":"ok"}`
- [x] All tests pass: `docker-compose exec web python manage.py test`

---

## ⚠️ Breaking Changes

### 1. SECRET_KEY is now REQUIRED

**Before:** Had default value  
**After:** Must be set explicitly or app won't start

**Fix:** Add to `.env` (see Step 1)

---

### 2. Email Verification is MANDATORY

**Before:** Optional email verification  
**After:** Users must verify email to access app

**Impact:** 
- New signups receive verification email
- Frontend may need to handle verification flow
- For dev: emails print to console

---

### 3. Conversations use Soft Deletion

**Before:** Deleted conversations removed from DB  
**After:** Marked with `deleted_at` timestamp

**Benefits:**
- Audit trail preserved
- Can restore deleted conversations
- Compliance-friendly

**Code changes:**
```python
# Get all active conversations (default)
Conversation.objects.all()

# Get deleted conversations
Conversation.all_objects.filter(deleted_at__isnull=False)

# Soft delete
conversation.soft_delete()

# Restore
conversation.restore()
```

---

## 🐛 Common Issues

### Issue: "ImproperlyConfigured: The SECRET_KEY setting must not be empty"

**Solution:** Generate and add SECRET_KEY to `.env` (see Step 1)

---

### Issue: "ModuleNotFoundError: No module named 'django_ratelimit'"

**Solution:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

### Issue: Migrations fail with "relation already exists"

**Solution:**
```bash
# Check migration status
docker-compose exec web python manage.py showmigrations

# Fake existing migrations
docker-compose exec web python manage.py migrate --fake-initial
```

---

### Issue: Email not sending

**For Development:** Emails print to console (this is expected)

**For Production:**
1. Verify SendGrid API key is correct
2. Check `EMAIL_HOST_PASSWORD` in `.env`
3. Review logs: `docker-compose logs web | grep -i email`

---

## 📊 What Changed?

### Security Improvements

| Feature | Before | After |
|---------|--------|-------|
| **Logging** | None | Rotating files + security log |
| **Rate Limiting** | Partial | All auth endpoints |
| **Email Verification** | Optional | Mandatory |
| **Data Retention** | CASCADE delete | Soft deletion |
| **JSON Validation** | Basic | Comprehensive + sanitization |
| **DB Performance** | No pooling | Connection pooling |
| **CSP Monitoring** | None | Violation reporting |

### Files Modified

- `config/settings.py` - Logging, email, DB pooling
- `core/models.py` - Soft deletion, indexes
- `core/auth_views.py` - Rate limiting
- `core/serializers.py` - JSON validation
- `core/views.py` - CSP reporting
- `requirements.txt` - New dependencies
- `.gitignore` - Logs directory

---

## 📚 Documentation

Full details:
- `docs/SECURITY_REVIEW_2025.md` - Comprehensive security review
- `docs/SECURITY_FIXES_IMPLEMENTATION.md` - Detailed implementation notes

---

## 🎯 Next Actions

After implementing these fixes:

1. **Week 2-3:** Implement medium priority fixes
   - Transaction management
   - Comprehensive audit logging
   - Additional rate limits

2. **Week 4:** Set up monitoring
   - Sentry for error tracking
   - APM for performance
   - Log aggregation (ELK/Datadog)

3. **Ongoing:** Security maintenance
   - Quarterly security reviews
   - Dependency updates
   - Penetration testing

---

## 🆘 Need Help?

If you encounter issues:

1. Check `docker-compose logs web` for errors
2. Review `logs/django.log` and `logs/security.log`
3. Run `python manage.py check --deploy` for warnings
4. Consult detailed docs in `/docs` folder

---

**Implementation Time:** ~30 minutes  
**Difficulty:** Intermediate  
**Impact:** High security improvement

Good luck! 🚀
