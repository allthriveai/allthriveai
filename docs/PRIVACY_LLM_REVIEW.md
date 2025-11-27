# Privacy Review: LLM & Search Engine Exposure

## Executive Summary

**Review Date:** 2025-11-27  
**Focus:** Preventing private user information exposure to LLMs and search engines  
**Status:** ⚠️ **ACTION REQUIRED** - Privacy vulnerabilities found

### Severity Levels
- 🔴 **CRITICAL** - Private data exposed to LLMs/crawlers
- 🟠 **HIGH** - Potentially sensitive data accessible  
- 🟡 **MEDIUM** - Privacy best practices not followed
- 🟢 **LOW** - Minor privacy concerns

---

## Critical Privacy Issues Found

### 1. 🔴 **User Email Addresses in Sitemaps** - CRITICAL

**Problem:**
```python
# core/sitemaps.py line 131-137
profiles = list(
    User.objects.filter(
        is_active=True,
    ).only(
        'username', 'date_joined', 'updated_at'  # ✅ Good - no email
    )
)
```

**Status:** ✅ **SAFE** - Emails are NOT exposed in sitemaps (only username, dates)

**Verdict:** No action needed

---

### 2. 🟠 **All User Profiles in Sitemap** - HIGH PRIVACY CONCERN

**Problem:**
```python
# core/sitemaps.py - UserProfileSitemap
# Currently includes ALL active users in sitemap
profiles = User.objects.filter(is_active=True)
```

**Issue:**
- Every user profile is indexed by search engines
- No opt-out mechanism for privacy-conscious users
- Users may not want their profile publicly discoverable
- Includes users who may have signed up but never created content

**Recommendation:**
Add privacy flag to User model:

```python
# In core/users/models.py
class User(AbstractUser):
    # Add this field
    is_profile_public = models.BooleanField(
        default=True,
        help_text='Allow profile to appear in search engines and sitemaps'
    )
```

Then update sitemap:
```python
# core/sitemaps.py
profiles = User.objects.filter(
    is_active=True,
    is_profile_public=True,  # Only include users who opted in
)
```

---

### 3. 🟠 **User API Endpoint Exposes Gamification Data** - HIGH

**Location:** `core/users/views.py` - `explore_users()`

**Currently Exposes:**
```python
{
    'id': user.id,
    'username': user.username,
    'full_name': user.get_full_name(),
    'avatar_url': user.avatar_url,
    'bio': user.bio,
    'tagline': user.tagline,
    'project_count': user.project_count,
    'total_points': user.total_points,  # ⚠️ Gamification data
    'level': user.level,                 # ⚠️ Gamification data
    'tier': user.tier,                   # ⚠️ Gamification data
}
```

**Issue:**
- Gamification data (points, level, tier) is publicly accessible
- Users may not want their progress/rank exposed
- Could enable scraping for competitive analysis

**Recommendation:**
Add privacy control:

```python
# In User model
gamification_is_public = models.BooleanField(
    default=True,
    help_text='Show points, level, and tier on public profile'
)

# In serializer
if not user.gamification_is_public:
    data.pop('total_points', None)
    data.pop('level', None)
    data.pop('tier', None)
```

---

### 4. 🟢 **UserSerializer Properly Hides Email** - SECURE

**Location:** `core/auth/serializers.py`

```python
def get_fields(self):
    if not (request.user.is_authenticated and 
            (self.instance == request.user or request.user.is_staff)):
        # Remove email from public profiles
        fields.pop('email', None)      # ✅ Good
        fields.pop('last_login', None) # ✅ Good
```

**Status:** ✅ **SECURE** - Emails only visible to profile owner

**Verdict:** No action needed

---

### 5. 🟡 **Social Connection Tokens Not Exposed** - MEDIUM

**Location:** `core/auth/serializers.py`

```python
def get_social_connections(self, obj):
    # Only for own profile or staff
    if not (request.user.is_authenticated and 
            (obj == request.user or request.user.is_staff)):
        return None
    
    # ✅ Returns only public info, no tokens
    return [{
        'provider': conn.provider,
        'providerUsername': conn.provider_username,
        'profileUrl': conn.profile_url,
        # ✅ No access_token, refresh_token exposed
    }]
```

**Status:** ✅ **SECURE** - Tokens not exposed, only shown to profile owner

**Verdict:** No action needed

---

### 6. 🟡 **LLM Plugin Manifest Describes User Data Access** - MEDIUM

**Location:** `frontend/public/.well-known/ai-plugin.json`

```json
{
  "capabilities": [
    "Browse AI project portfolios",
    "Search AI tools and frameworks",
    "Discover learning resources",
    "Find AI practitioners and experts",  // ⚠️ Implies user search
    "Access AI project documentation",
    "Explore community challenges"
  ]
}
```

**Issue:**
- LLMs are told they can "find AI practitioners and experts"
- Without proper API auth, LLMs could scrape user data
- Need to ensure API requires authentication for user data

**Recommendation:**
Update `ai-plugin.json`:

```json
{
  "capabilities": [
    "Browse PUBLIC AI project portfolios",
    "Search AI tools directory",
    "Discover PUBLIC learning resources",
    "View PUBLIC community profiles",  // More explicit
    "Access PUBLIC project documentation"
  ],
  "api": {
    "is_user_authenticated": false  // ✅ Already set
  },
  "privacy_policy_url": "https://allthrive.ai/privacy"
}
```

---

## What's Currently in PUBLIC_INFO.md

**Location:** `PUBLIC_INFO.md` (exposed to LLMs)

**Currently Includes:**
- ✅ Platform description (safe)
- ✅ Features and capabilities (safe)
- ✅ Technology stack (safe)
- ✅ Use cases (safe)
- ✅ Keywords (safe)
- ✅ API endpoints - **GENERIC** (safe)

**Does NOT Include:**
- ✅ User emails
- ✅ User personal data
- ✅ Private project information
- ✅ Authentication tokens
- ✅ Internal system details

**Verdict:** ✅ **SAFE** - No private user data exposed

---

## What's in robots.txt

**Location:** `frontend/public/robots.txt`

```
# Disallow admin and private areas
Disallow: /admin/
Disallow: /dashboard
Disallow: /settings
Disallow: /account
Disallow: /api/v1/auth/

# Allow public user profiles
Allow: /@*  # ⚠️ All user profiles allowed
```

**Issue:**
- `Allow: /@*` makes ALL user profiles crawlable
- No way for users to opt-out

**Recommendation:**
Keep as-is BUT add user-level control via `is_profile_public` flag

---

## Privacy-Sensitive Data Inventory

### ✅ **PROTECTED** (Not Exposed to LLMs/Crawlers)

1. **User Emails** - Only visible to profile owner
2. **Passwords** - Hashed, never exposed
3. **OAuth Tokens** - Only visible to profile owner
4. **Last Login Time** - Hidden from public
5. **IP Addresses** - Never exposed in API
6. **API Keys** - Never stored in User model
7. **Private Projects** - Filtered out of sitemaps
8. **Draft Projects** - Not in sitemaps

### ⚠️ **CURRENTLY EXPOSED** (Needs Privacy Controls)

1. **All User Profiles** - In sitemap, no opt-out
2. **Gamification Data** - Points, level, tier publicly visible
3. **User Activity Stats** - Project counts, completion stats
4. **Bio and Social Links** - Always public if set

### ✅ **INTENTIONALLY PUBLIC** (By Design)

1. **Usernames** - Required for profile URLs
2. **Public Projects** - Explicitly marked as showcase
3. **Avatar URLs** - Profile pictures
4. **Taglines** - Professional headlines
5. **Social Media Links** - User-provided public links

---

## Recommended Privacy Enhancements

### Priority 1: Critical (Implement Now)

#### 1. Add Profile Privacy Flag

**Migration:**
```python
# Create migration
python manage.py makemigrations

# In migration file:
operations = [
    migrations.AddField(
        model_name='user',
        name='is_profile_public',
        field=models.BooleanField(
            default=True,
            help_text='Allow profile to appear in search engines'
        ),
    ),
]
```

**Update Sitemap:**
```python
# core/sitemaps.py
profiles = User.objects.filter(
    is_active=True,
    is_profile_public=True,
)
```

**Update Settings Page:**
```tsx
// Add to user settings
<Toggle
  label="Make my profile discoverable in search engines"
  checked={user.is_profile_public}
  onChange={handleToggle}
/>
```

#### 2. Add Gamification Privacy Flag

```python
# core/users/models.py
gamification_is_public = models.BooleanField(
    default=True,
    help_text='Show points, level, and achievements on public profile'
)
```

### Priority 2: High (Implement Soon)

#### 3. Add robots meta tag support per profile

```python
# In profile view
def username_profile_view(request, username):
    user = get_object_or_404(User, username=username)
    
    # If user opts out, add noindex meta tag
    context = {
        'user': user,
        'noindex': not user.is_profile_public
    }
```

#### 4. Add Privacy Policy and Terms

Create:
- `frontend/src/pages/PrivacyPage.tsx`
- `frontend/src/pages/TermsPage.tsx`

Update `ai-plugin.json`:
```json
{
  "privacy_policy_url": "https://allthrive.ai/privacy",
  "terms_of_service_url": "https://allthrive.ai/terms"
}
```

#### 5. Add Data Export Feature

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_my_data(request):
    """Export all user data (GDPR compliance)."""
    user = request.user
    
    data = {
        'profile': UserSerializer(user).data,
        'projects': ProjectSerializer(user.projects.all(), many=True).data,
        'achievements': # ... export all user data
    }
    
    return Response(data)
```

### Priority 3: Medium (Good to Have)

#### 6. Add Privacy Dashboard

Show users what's public:
```
✅ Your profile is visible to search engines
✅ Your gamification stats are public  
✅ You have 5 public projects
❌ Your email is private
❌ Your activity history is private
```

#### 7. Add "Who Can See This" Indicators

On profile settings, show:
```
Avatar URL: 🌍 Everyone
Bio: 🌍 Everyone  
Email: 🔒 Only you
Points: 🌍 Everyone (change in settings)
```

---

## Compliance Considerations

### GDPR Requirements

✅ **Currently Compliant:**
- User email not exposed publicly
- OAuth tokens not exposed
- Password properly hashed

⚠️ **Needs Implementation:**
- [ ] Right to be forgotten (delete account)
- [ ] Data export (GDPR Article 20)
- [ ] Privacy policy
- [ ] Cookie consent banner
- [ ] Opt-out of indexing

### CCPA Requirements

⚠️ **Needs Implementation:**
- [ ] "Do Not Sell My Personal Information" link
- [ ] Privacy policy disclosure
- [ ] User data access request handling

---

## LLM-Specific Privacy Controls

### What LLMs Can Currently Access

**Via PUBLIC_INFO.md:**
- ✅ Platform description (safe)
- ✅ Features (safe)
- ✅ Technology stack (safe)

**Via Sitemap:**
- ⚠️ All public user profile URLs
- ✅ Public project URLs (appropriate)
- ✅ Tool directory URLs (safe)

**Via robots.txt:**
- ✅ Properly blocks /admin/, /settings, /account
- ⚠️ Allows all user profiles (/@*)

### Recommendations for LLM Privacy

#### 1. Update robots.txt

Add LLM-specific rules:
```
# Specific LLM crawlers
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: Claude-Web
User-agent: anthropic-ai
Disallow: /@*  # Block user profiles from LLM training

# Still allow search engines
User-agent: Googlebot
User-agent: Bingbot
Allow: /@*
```

#### 2. Add X-Robots-Tag Headers

```python
# In username_profile_view
def username_profile_view(request, username):
    user = get_object_or_404(User, username=username)
    
    response = Response(...)
    
    # Block LLM crawlers from training on profiles
    if not user.allow_llm_training:
        response['X-Robots-Tag'] = 'noai, noimageai'
    
    return response
```

#### 3. Update ai-plugin.json

Make capabilities more restrictive:
```json
{
  "capabilities": [
    "Search PUBLIC AI projects",
    "Browse PUBLIC tool directory",
    "Access PUBLIC learning resources"
  ],
  "data_retention": "We do not store user queries",
  "privacy_policy_url": "https://allthrive.ai/privacy",
  "user_data_usage": "Only public data as explicitly marked by users"
}
```

---

## Implementation Checklist

### Phase 1: Critical Privacy Fixes (Do Now)

- [ ] Add `is_profile_public` field to User model
- [ ] Update UserProfileSitemap to filter by `is_profile_public`
- [ ] Add `gamification_is_public` field
- [ ] Update API serializers to respect privacy flags
- [ ] Clear sitemap cache after changes
- [ ] Update robots.txt with LLM-specific rules

### Phase 2: GDPR/Privacy Compliance (This Week)

- [ ] Create Privacy Policy page
- [ ] Create Terms of Service page
- [ ] Add data export API endpoint
- [ ] Add account deletion feature
- [ ] Update `ai-plugin.json` with privacy URLs
- [ ] Add cookie consent banner

### Phase 3: User Privacy Dashboard (This Month)

- [ ] Build privacy settings UI
- [ ] Add "What's Public" dashboard
- [ ] Add "Who Can See This" indicators
- [ ] Implement data download feature
- [ ] Add privacy tour for new users

---

## Testing Privacy Controls

### Test User Profile Privacy

```bash
# 1. Create test user with private profile
curl -X POST http://localhost:8000/api/v1/users/ \
  -d '{"username": "private_user", "is_profile_public": false}'

# 2. Check sitemap doesn't include them
curl http://localhost:8000/sitemap.xml | grep "private_user"
# Should return nothing

# 3. Check profile is still accessible directly
curl http://localhost:3000/@private_user
# Should work (just not in search engines)
```

### Test LLM Blocking

```bash
# Test with GPTBot user agent
curl -A "GPTBot" http://localhost:3000/@testuser
# Should see X-Robots-Tag: noai header
```

---

## Summary & Recommendations

### Current Privacy Status: 6/10 ⚠️

**Good:**
- ✅ Emails properly hidden
- ✅ Tokens not exposed
- ✅ Private projects filtered
- ✅ Sensitive fields protected

**Needs Work:**
- ⚠️ No opt-out from search indexing
- ⚠️ Gamification data always public
- ⚠️ No LLM-specific privacy controls
- ⚠️ Missing GDPR compliance features

### Action Plan

1. **Week 1:** Add privacy flags + update sitemaps
2. **Week 2:** Create privacy/terms pages
3. **Week 3:** Build privacy dashboard
4. **Week 4:** GDPR compliance features

### Business Impact

**Risk if Not Fixed:**
- GDPR fines (up to 4% of revenue)
- User trust issues
- Competitive disadvantage
- LLM training on user data without consent

**Benefit of Fixing:**
- GDPR/CCPA compliant
- User trust and confidence
- Competitive advantage ("privacy-first platform")
- Control over LLM data usage

---

**Status:** ⚠️ ACTION REQUIRED  
**Priority:** HIGH  
**Estimated Effort:** 2-3 weeks  
**Risk Level:** MEDIUM (no critical exposure, but compliance gaps)
