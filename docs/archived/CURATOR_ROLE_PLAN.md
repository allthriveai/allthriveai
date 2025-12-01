# Curator Role & Project Claiming - Planning Document

**Date:** 2025-11-28
**Status:** Planning Phase - Not Implemented
**Related:** See `CONTENT_AUTOMATION_PLAN.md` for content automation features

---

## Overview

Enable internal staff to curate projects from across the web and allow users to claim ownership of these curated projects.

**Key Concepts:**
- **CURATOR Role:** Internal staff who find and create projects for public consumption
- **Curated Projects:** Projects created by curators appearing on public "Curated" page
- **Project Claiming:** Users can claim curated projects, transferring ownership to them

**Goals:**
- Internal team can populate site with quality projects
- Users discover interesting projects curated by staff
- Users can claim projects to add to their own profiles
- Reduce friction for users building portfolios

---

## Curator Role

### User Role Definition

**File:** `/core/users/models.py`

Add to UserRole enum:
```python
class UserRole(models.TextChoices):
    # ... existing roles ...
    CURATOR = 'curator', 'Curator'
```

### Curator Permissions

**Curators (Internal Staff):**
- Can create projects intended for OTHER users to claim
- Projects marked as `is_curated=True`
- Projects appear on public "Curated" page
- Projects have no initial owner (or owned by system curator account)
- Can use content automation for unlimited sources
- Can manually create projects from found content

**Regular Users:**
- Can view curated projects on public page
- Can claim unclaimed projects (transfers ownership)
- Can use content automation for their own sources
- Cannot mark their own projects as curated

### Curator Workflow

1. **Curator finds interesting content:**
   - YouTube video from creator without AllThrive account
   - Blog post from external site
   - GitHub repo from developer not on platform
   - Any project-worthy content

2. **Curator creates project:**
   - Uses admin interface or curator tools
   - Fills in project details (title, description, tools, etc.)
   - Marks `is_curated = True`
   - `user = None` or `user = curator_system_account`
   - `is_showcase = True` (visible on curated page)

3. **Project appears on Curated page:**
   - Public `/curated/projects` page
   - Shows all unclaimed curated projects
   - "Claim This Project" button visible

4. **User claims project:**
   - Clicks "Claim" button
   - Confirms in modal
   - Ownership transfers to user
   - Project moves to user's profile
   - No longer appears on curated page

---

## Project Claiming Feature

### Data Model Changes

**File:** `/core/projects/models.py`

Add fields to Project model:
```python
class Project(models.Model):
    # ... existing fields ...

    # Curator fields
    is_curated = models.BooleanField(
        default=False,
        help_text='Created by curator for claiming'
    )
    claimed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When project was claimed by user'
    )
    original_curator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='curated_projects',
        help_text='Staff curator who created this project'
    )
```

### Claiming Workflow

**1. User Views Curated Page:**
```
GET /curated/projects
```

**Response:**
- List of unclaimed curated projects
- Each project shows "Claim This Project" button
- Projects with engaging thumbnails, descriptions
- Filter by category, tools, topics

**2. User Clicks "Claim":**
```
POST /api/curated/projects/{id}/claim/
```

**Backend Logic:**
```python
def claim_project(request, project_id):
    project = get_object_or_404(Project, id=project_id, is_curated=True)

    # Validate: already claimed?
    if project.claimed_at is not None:
        return Response({'error': 'Project already claimed'}, status=400)

    # Transfer ownership
    project.user = request.user
    project.claimed_at = timezone.now()
    project.is_curated = False  # No longer curated
    project.save()

    return Response({
        'success': True,
        'message': f'You claimed "{project.title}"!',
        'project_url': project.get_absolute_url()
    })
```

**3. Project Transferred:**
- `project.user = requesting_user`
- `project.claimed_at = now()`
- `project.is_curated = False`
- Project appears on user's profile
- Project removed from curated page

### UI Components

**Curated Projects Page** (`/curated/projects`):
```tsx
const CuratedProjectsPage = () => {
  const { data: projects } = useQuery('/api/curated/projects/');

  return (
    <div>
      <h1>Curated Projects</h1>
      <p>Projects hand-picked by our team. Claim one to add to your profile!</p>

      <ProjectGrid>
        {projects.map(project => (
          <ProjectCard key={project.id}>
            <img src={project.featuredImageUrl} />
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <ClaimButton projectId={project.id} />
          </ProjectCard>
        ))}
      </ProjectGrid>
    </div>
  );
};
```

**Claim Button Component:**
```tsx
const ClaimButton = ({ projectId }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const claimMutation = useMutation(() =>
    api.post(`/api/curated/projects/${projectId}/claim/`)
  );

  return (
    <>
      <Button onClick={() => setShowConfirm(true)}>
        Claim This Project
      </Button>

      {showConfirm && (
        <ConfirmModal
          title="Claim Project?"
          message="This will add the project to your profile."
          onConfirm={() => {
            claimMutation.mutate();
            setShowConfirm(false);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};
```

---

## API Endpoints

### Curated Projects API

**List Curated Projects:**
```
GET /api/curated/projects/

Response:
[
  {
    "id": 123,
    "title": "Awesome AI Project",
    "description": "An amazing project...",
    "featuredImageUrl": "...",
    "externalUrl": "https://github.com/...",
    "tools": [...],
    "categories": [...],
    "isCurated": true,
    "claimedAt": null,
    "originalCurator": {
      "username": "curator_staff",
      "fullName": "Staff Curator"
    }
  },
  ...
]
```

**Claim Project:**
```
POST /api/curated/projects/{id}/claim/

Response (Success):
{
  "success": true,
  "message": "You claimed 'Awesome AI Project'!",
  "projectUrl": "/projects/username/awesome-ai-project"
}

Response (Already Claimed):
{
  "error": "Project already claimed",
  "claimedBy": "other_user"
}

Response (Rate Limited):
{
  "error": "You've claimed too many projects today. Try again tomorrow.",
  "limitReached": true
}
```

### Admin/Curator API

**Create Curated Project:**
```
POST /api/admin/curated-projects/

Payload:
{
  "title": "Awesome Project",
  "description": "...",
  "externalUrl": "https://...",
  "tools": ["Python", "TensorFlow"],
  "categories": ["AI", "Machine Learning"],
  "featuredImageUrl": "...",
  "isCurated": true,
  "isShowcase": true
}

Requires: CURATOR role
```

---

## Curator Tools & Admin Interface

### Django Admin Enhancements

**File:** `/core/projects/admin.py`

```python
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'is_curated', 'claimed_at', 'created_at']
    list_filter = ['is_curated', 'claimed_at', 'type']
    search_fields = ['title', 'description']

    fieldsets = (
        ('Basic Info', {
            'fields': ('title', 'description', 'user', 'type')
        }),
        ('Curator Options', {
            'fields': ('is_curated', 'original_curator', 'claimed_at'),
            'classes': ('collapse',)
        }),
        # ... other fieldsets
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.role == UserRole.CURATOR:
            # Curators see all curated + their own projects
            return qs.filter(
                Q(is_curated=True) | Q(user=request.user)
            )
        return qs
```

### Curator Dashboard (Future)

**Route:** `/curator/dashboard`

**Features:**
- **Create Curated Project:** Form to add new curated project
- **Manage Curated Projects:** List all curated projects, edit/delete
- **Claim Analytics:** See which projects are claimed most
- **User Suggestions:** Users suggest content for curation
- **Import from URL:** Auto-populate project from URL (GitHub, YouTube, etc.)

---

## Rate Limiting & Abuse Prevention

### Claiming Limits

**Prevent Abuse:**
- Users limited to 5 claims per day
- Users limited to 20 claims per month
- Throttle enforced at API level

**Implementation:**
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='user', rate='5/d', method='POST')
def claim_project(request, project_id):
    # ... claim logic
    pass
```

### Curator Permissions

**Who Can Be a Curator:**
- Internal staff only (manually assigned)
- Not open to public sign-up
- Requires admin approval

**Curator Actions Logged:**
- All curator-created projects logged
- Audit trail for project creation
- Track claim rates for curator content

---

## Use Cases

### Use Case 1: Staff Curates AI Projects

**Scenario:**
- Curator finds interesting AI repos on GitHub
- Creates curated projects with nice descriptions
- Users browse curated page, find relevant projects
- Users claim projects to showcase on their profiles

**Benefit:**
- Users get quality pre-filled projects
- Site populated with diverse content
- Discovery mechanism for users

### Use Case 2: Content Creator Claims Their Work

**Scenario:**
- Curator finds YouTuber's video, creates project
- YouTuber signs up for AllThrive
- YouTuber searches curated page, finds their video
- YouTuber claims project, becomes owner
- Project moves to their profile

**Benefit:**
- Onboarding made easy
- Creator gets instant portfolio item
- Credit goes to rightful owner

### Use Case 3: Learning Resource Curation

**Scenario:**
- Curator creates projects from blog posts/tutorials
- Students browse curated learning resources
- Students claim projects as "completed work"
- Projects become part of student portfolio

**Benefit:**
- Educational content aggregation
- Students build portfolios from learning
- Curator team adds value

---

## Privacy & Content Rights

### Content Rights

**Curator Responsibilities:**
- Only curate publicly available content
- Link to original source (external_url)
- Don't copy entire articles (summaries only)
- Respect Creative Commons licenses

**User Claiming:**
- Claiming doesn't imply ownership of underlying content
- User agrees to link to original source
- User can edit project after claiming

### Privacy Settings

**Curated Projects:**
- All curated projects public by default
- Appear in search engines (SEO)
- Can be claimed by any registered user

**After Claiming:**
- User inherits project privacy settings
- User can make private if desired
- User can delete claimed project

---

## Migration Strategy

### Phase 1: Curator Role Setup

**Week 1:**
1. Add CURATOR to UserRole enum
2. Assign curator role to internal staff
3. Update admin permissions

### Phase 2: Data Model Changes

**Week 1-2:**
1. Add `is_curated`, `claimed_at`, `original_curator` to Project model
2. Create migration
3. Update serializers to include new fields

### Phase 3: Claiming API

**Week 2:**
1. Create curated projects API endpoints
2. Implement claim logic with rate limiting
3. Add tests for claim flow

### Phase 4: UI Implementation

**Week 2-3:**
1. Create Curated Projects page
2. Add Claim button to project cards
3. Implement confirmation modal
4. Add success/error messaging

### Phase 5: Curator Tools

**Week 3:**
1. Enhance Django admin for curators
2. Add bulk import tools
3. Create curator dashboard (optional)

---

## Success Metrics

### Curator Metrics

- Number of curated projects created per month
- Claim rate (% of curated projects claimed)
- Time to claim (how long until projects claimed)
- User satisfaction with curated content

### User Metrics

- Number of projects claimed per user
- User retention after claiming
- Profile completion rate for claiming users

### Content Metrics

- Diversity of curated content (types, categories)
- Quality of curated projects (ratings, views)
- Source diversity (YouTube, GitHub, blogs, etc.)

---

## Risk Mitigation

### Risk 1: Claim Abuse

**Mitigation:**
- Rate limiting (5 claims/day, 20/month)
- Audit logs for excessive claiming
- Ability to revoke claims if abused

### Risk 2: Content Rights Issues

**Mitigation:**
- Clear attribution to original source
- Only curate public content
- DMCA takedown process
- Curator training on content rights

### Risk 3: Low Claim Rate

**Mitigation:**
- Curate high-quality, relevant projects
- A/B test curated page design
- Add discovery features (filters, search)
- Email notifications for new curated content

### Risk 4: Curator Scalability

**Mitigation:**
- Start with small curator team (2-3 people)
- Automate content discovery (RSS, APIs)
- User-submitted curation suggestions
- AI-assisted project creation

---

## Implementation Checklist

### Data Model
- [ ] Add CURATOR to UserRole enum
- [ ] Add `is_curated` field to Project model
- [ ] Add `claimed_at` field to Project model
- [ ] Add `original_curator` field to Project model
- [ ] Create database migration
- [ ] Update Project serializers

### Backend API
- [ ] Create `/api/curated/projects/` endpoint (list)
- [ ] Create `/api/curated/projects/{id}/claim/` endpoint
- [ ] Implement rate limiting on claim endpoint
- [ ] Add claim validation logic
- [ ] Add tests for claim flow
- [ ] Update admin permissions for curators

### Frontend UI
- [ ] Create Curated Projects page (`/curated/projects`)
- [ ] Create ProjectCard component with Claim button
- [ ] Create ConfirmModal for claiming
- [ ] Add success/error toast notifications
- [ ] Add filters/search to curated page
- [ ] Update navigation to include Curated link

### Admin/Curator Tools
- [ ] Update Django admin for Project model
- [ ] Add curator-specific views in admin
- [ ] Create bulk import tools (optional)
- [ ] Create curator dashboard (optional)

### Documentation
- [ ] Write curator onboarding guide
- [ ] Document claim flow for users
- [ ] Create content rights policy
- [ ] Write admin documentation

---

## Related Documents

- **`CONTENT_AUTOMATION_PLAN.md`** - Automated content sync from YouTube/RSS
- **`INTEGRATION_ARCHITECTURE.md`** - Existing integration patterns

---

**Status:** ✅ Planning Complete
**Timeline:** 3 weeks for implementation
**Dependencies:** None (can be implemented independently)
**Created:** 2025-11-28
