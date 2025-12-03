# 🔒 AI Usage Tracking - Security Audit

## Executive Summary

The AI usage tracking system collects **sensitive user data** including:
- User identities (emails, usernames, IDs)
- Usage patterns and behavior
- Cost per user (financial data)
- AI request metadata (potentially including prompts/responses)

**Overall Risk Level**: ⚠️ **MEDIUM** - Several security concerns need addressing

---

## 🚨 Critical Security Issues

### 1. **Django Admin Access Control** - HIGH RISK

**Issue**: No granular permissions for AI usage data
- **Location**: `core/ai_usage/admin.py` (all admin classes)
- **Risk**: Any staff/superuser can view ALL user cost data and usage patterns
- **Current State**: Relies on default Django `is_staff` and `is_superuser` permissions

**Attack Vector**:
```python
# ANY admin user can access:
/admin/ai_usage/aiusagelog/        # All AI requests by all users
/admin/ai_usage/useraicostsummary/ # All user costs
```

**Recommendation**: ✅ **ADD CUSTOM PERMISSIONS**
```python
# In models.py - add to UserAICostSummary
class Meta:
    permissions = [
        ("view_all_user_costs", "Can view all user AI costs"),
        ("view_cau_metrics", "Can view CAU analytics"),
        ("export_usage_data", "Can export usage data"),
    ]

# In admin.py
class UserAICostSummaryAdmin(admin.ModelAdmin):
    def has_view_permission(self, request, obj=None):
        return request.user.has_perm('ai_usage.view_all_user_costs')

    def has_module_permission(self, request):
        return request.user.has_perm('ai_usage.view_cau_metrics')
```

---

### 2. **PII (Personal Identifiable Information) Exposure** - HIGH RISK

**Issue**: User emails displayed in multiple locations
- **Locations**:
  - `admin.py:108` - User email in AIUsageLog admin
  - `admin.py:258` - User email in UserAICostSummary admin
  - `models.py:154` - Email in `__str__()` method
  - `models.py:207` - Email in `__str__()` method

**Risk**:
- Admin logs may expose user emails
- Error messages could leak PII
- String representations used in debugging expose emails

**Compliance**: ⚠️ May violate GDPR/CCPA if not properly secured

**Recommendation**: ✅ **ANONYMIZE IN DISPLAY**
```python
# In admin.py - replace email with anonymized ID
@admin.display(description='User')
def user_display(self, obj):
    # Only show email to users with special permission
    if self.request.user.has_perm('ai_usage.view_pii'):
        return obj.user.email
    # Otherwise show anonymized ID
    return f"User #{obj.user.id} (***)"

# In models.py - add privacy-safe __str__
def __str__(self):
    return f'User {self.user.id} - {self.date} - ${self.total_cost:.2f}'
```

---

### 3. **Logging Contains User IDs** - MEDIUM RISK

**Issue**: Application logs contain user identifiable information
- **Location**: `tracker.py:162` and `tracker.py:327`

```python
logger.info(
    f'AI Usage: user={user.id}, feature={feature}, ...'  # ← Logs user ID
)
logger.warning(f'User {user.id} exceeded monthly AI budget...')  # ← Logs user ID
```

**Risk**:
- Log aggregation services (Sentry, CloudWatch) may expose user IDs
- Log files accessible to DevOps may leak user behavior

**Recommendation**: ✅ **HASH USER IDS IN LOGS**
```python
import hashlib

def anonymize_user_id(user_id):
    """Hash user ID for logging privacy."""
    return hashlib.sha256(f"{user_id}".encode()).hexdigest()[:12]

logger.info(
    f'AI Usage: user_hash={anonymize_user_id(user.id)}, feature={feature}, ...'
)
```

---

### 4. **No Audit Trail** - MEDIUM RISK

**Issue**: No tracking of who accesses sensitive cost data
- **Missing**: Audit log of admin users viewing AI usage data
- **Risk**: Can't detect unauthorized access or data breaches
- **Compliance**: Required for SOC 2, HIPAA, PCI DSS

**Recommendation**: ✅ **ADD AUDIT LOGGING**
```python
# Create new model
class AIUsageAuditLog(models.Model):
    admin_user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=50)  # 'view_cau', 'export_data'
    target_user = models.ForeignKey(User, null=True, related_name='ai_audits')
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField()

# Log admin actions
def changelist_view(self, request, extra_context=None):
    AIUsageAuditLog.objects.create(
        admin_user=request.user,
        action='view_cau_metrics',
        ip_address=request.META.get('REMOTE_ADDR')
    )
    return super().changelist_view(request, extra_context)
```

---

### 5. **Metadata Fields May Contain Sensitive Data** - MEDIUM RISK

**Issue**: `request_metadata` and `response_metadata` JSONFields
- **Location**: `models.py:130-135`
- **Risk**: May inadvertently store:
  - User prompts (sensitive questions)
  - AI responses (potentially sensitive)
  - API keys or tokens in request headers
  - Personal data in prompts

**Current State**: No validation or sanitization

**Recommendation**: ✅ **SANITIZE METADATA**
```python
# In tracker.py
ALLOWED_METADATA_KEYS = ['temperature', 'model_version', 'finish_reason', 'latency']

def sanitize_metadata(metadata):
    """Only allow safe metadata keys."""
    return {k: v for k, v in metadata.items() if k in ALLOWED_METADATA_KEYS}

# Usage
tracker.set_metadata(
    response_meta=sanitize_metadata(response.metadata)
)
```

---

### 6. **No Data Retention Policy** - LOW RISK

**Issue**: AI usage logs stored indefinitely
- **Current**: No automatic cleanup of old data
- **Risk**:
  - Database bloat
  - Increased breach surface area
  - GDPR violation (data minimization principle)

**Recommendation**: ✅ **IMPLEMENT RETENTION POLICY**
```python
# management/commands/cleanup_ai_logs.py
class Command(BaseCommand):
    def handle(self, *args, **options):
        # Delete logs older than 90 days
        cutoff = timezone.now() - timedelta(days=90)
        deleted = AIUsageLog.objects.filter(created_at__lt=cutoff).delete()

        # Keep summaries for 2 years
        summary_cutoff = timezone.now() - timedelta(days=730)
        UserAICostSummary.objects.filter(date__lt=summary_cutoff).delete()
```

Run as cron job:
```bash
0 2 * * * python manage.py cleanup_ai_logs
```

---

### 7. **Database Encryption at Rest** - MEDIUM RISK

**Issue**: No mention of database encryption
- **Risk**: If database is compromised, all user data is readable
- **Compliance**: Required for PCI DSS, HIPAA

**Current State**: Unknown - depends on infrastructure

**Recommendation**: ✅ **VERIFY ENCRYPTION IS ENABLED**

**For PostgreSQL**:
```sql
-- Enable encryption at rest
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/path/to/cert';
```

**For AWS RDS**:
- Enable encryption when creating database
- Use KMS for key management

**Django Field-Level Encryption** (alternative):
```bash
pip install django-fernet-fields
```

```python
from fernet_fields import EncryptedTextField

class AIUsageLog(models.Model):
    error_message = EncryptedTextField(blank=True)  # Encrypt sensitive fields
```

---

### 8. **No Rate Limiting on CAU Calculations** - LOW RISK

**Issue**: Expensive CAU calculations not rate-limited
- **Location**: `models.py:229` - `get_cau()` method
- **Risk**:
  - DoS via repeated expensive queries
  - Resource exhaustion

**Attack Vector**:
```python
# Malicious script
while True:
    AIUsageTracker.get_cau(days=365)  # Expensive query
```

**Recommendation**: ✅ **ADD CACHING + RATE LIMITING**
```python
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

@classmethod
def get_cau(cls, days=30, start_date=None, end_date=None):
    # Cache CAU for 5 minutes
    cache_key = f'cau_{days}_{start_date}_{end_date}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    result = # ... calculation ...
    cache.set(cache_key, result, 300)  # 5 min cache
    return result
```

---

## ✅ Good Security Practices (Already Implemented)

1. ✅ **Foreign Key Protection** - `on_delete=models.PROTECT` for pricing (models.py:117)
2. ✅ **Input Validation** - `MinValueValidator` on costs and tokens
3. ✅ **Read-only Fields** - Critical fields are readonly in admin
4. ✅ **No Public APIs** - All tracking is internal, no exposed endpoints
5. ✅ **Authentication Required** - Integration examples use `@permission_classes([IsAuthenticated])`

---

## 🔐 Security Checklist

### Immediate Actions (High Priority)
- [ ] Add custom Django admin permissions for AI usage data
- [ ] Anonymize user emails in admin displays (keep raw data, hide display)
- [ ] Hash user IDs in application logs
- [ ] Add audit trail for admin access to sensitive data
- [ ] Sanitize metadata before storing

### Short-term (This Sprint)
- [ ] Implement data retention policy (90-day cleanup)
- [ ] Add caching to expensive CAU queries
- [ ] Document who has access to AI usage data
- [ ] Create security policy for AI tracking data

### Long-term (Next Quarter)
- [ ] Enable database encryption at rest
- [ ] Implement field-level encryption for sensitive fields
- [ ] Add data export for GDPR/CCPA compliance
- [ ] Pen test the admin interface
- [ ] SOC 2 compliance audit

---

## 📋 Compliance Considerations

### GDPR (EU Privacy Regulation)
- ⚠️ **User Consent**: Need explicit consent to track usage
- ⚠️ **Right to Access**: Users should see their own AI usage
- ⚠️ **Right to Deletion**: Implement data deletion on request
- ⚠️ **Data Minimization**: Only store necessary data

### CCPA (California Privacy Law)
- ⚠️ **Disclosure**: Must disclose AI usage tracking in privacy policy
- ⚠️ **Opt-out**: Users can request no tracking

### SOC 2 (Security Audit)
- ⚠️ **Access Control**: Implement role-based access
- ⚠️ **Audit Logging**: Track all data access
- ⚠️ **Encryption**: Data at rest and in transit

---

## 🛡️ Recommended Security Enhancements

### 1. Add Permission Middleware
```python
# middleware/ai_usage_permissions.py
class AIUsagePermissionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin/ai_usage/'):
            if not request.user.has_perm('ai_usage.view_all_user_costs'):
                return HttpResponseForbidden("Access Denied")
        return self.get_response(request)
```

### 2. Add User-Facing AI Usage Dashboard
```python
# views.py - Let users see THEIR OWN data
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_ai_usage(request):
    """User can only see their own AI usage."""
    monthly_cost = AIUsageTracker.get_user_monthly_cost(request.user)
    logs = AIUsageLog.objects.filter(user=request.user)[:100]

    return Response({
        'monthly_cost': monthly_cost,
        'recent_usage': AIUsageLogSerializer(logs, many=True).data
    })
```

### 3. Implement Row-Level Security
```python
# Only show users their own data, admins see all
class AIUsageLogAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            # Non-superusers only see their own department
            return qs.filter(user__department=request.user.department)
        return qs
```

---

## 📊 Risk Assessment Matrix

| Issue | Likelihood | Impact | Risk Score | Priority |
|-------|-----------|--------|------------|----------|
| Admin data breach | Medium | High | **High** | P0 |
| PII exposure in logs | High | Medium | **High** | P0 |
| Metadata leak | Low | High | Medium | P1 |
| No audit trail | Medium | Medium | Medium | P1 |
| No encryption | Low | High | Medium | P1 |
| No rate limiting | Low | Low | Low | P2 |
| No retention policy | Medium | Low | Low | P2 |

---

## 🎯 Recommended Implementation Order

### Phase 1: Quick Wins (1-2 days)
1. Add custom admin permissions
2. Anonymize displays (keep raw data)
3. Hash user IDs in logs
4. Add caching to CAU queries

### Phase 2: Compliance (1 week)
5. Implement audit trail
6. Sanitize metadata
7. Add data retention policy
8. Document security measures

### Phase 3: Infrastructure (2 weeks)
9. Enable database encryption
10. Pen test admin interface
11. User-facing usage dashboard
12. GDPR compliance tools

---

## 🚀 Next Steps

1. **Review this audit with team** - Discuss priorities
2. **Get security approval** - From security team/CISO
3. **Implement P0 fixes** - Admin permissions + anonymization
4. **Test security measures** - Verify they work
5. **Document policies** - Who can access what data
6. **Regular audits** - Quarterly security reviews

---

**Audit Date**: 2025-12-02
**Auditor**: AI Security Review
**Status**: ⚠️ Needs attention - Several medium/high risk issues identified
