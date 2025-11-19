# Role-Based Permission System

## Overview

AllThrive AI uses a hierarchical role system to manage user permissions and access levels. There are 5 distinct roles, each with specific capabilities and limitations.

## Role Hierarchy

```
1. Explorer  (Entry Level)
2. Expert    (Experienced)
3. Mentor    (Trusted - Requires Admin Approval)
4. Patron    (Premium Supporter)
5. Admin     (Platform Administrator - Requires Admin Approval)
```

## Roles & Permissions

### 1. Explorer 🔍
**Default role for all new users**

**Description**: New members exploring the platform and learning to use its features.

**Permissions**:
- ✅ Create up to 10 projects
- ✅ Access AI chat (10 requests/day)
- ✅ Access mentorship program
- ❌ Cannot create showcase projects
- ❌ No premium features

**Badge Color**: Slate (Gray)

**Auto-Upgrade Path**: Can upgrade to Expert or Patron instantly

---

### 2. Expert 💡
**For experienced contributors**

**Description**: Experienced members who actively contribute quality content to the platform.

**Permissions**:
- ✅ Create up to 25 projects
- ✅ Create up to 5 showcase projects
- ✅ Access AI chat (50 requests/day)
- ✅ Access mentorship program
- ❌ No premium features
- ❌ Cannot mentor others

**Badge Color**: Blue

**Auto-Upgrade Path**: Can upgrade to Patron instantly
**Upgrade Requirements**: None (self-service from Explorer)

---

### 3. Mentor 🎓
**Trusted community leaders - REQUIRES ADMIN APPROVAL**

**Description**: Trusted community members who guide and support other users through mentorship.

**Permissions**:
- ✅ Create up to 50 projects
- ✅ Create up to 15 showcase projects
- ✅ Access AI chat (100 requests/day)
- ✅ Access mentorship program
- ✅ **Can mentor other users**
- ✅ Access premium features
- ❌ Cannot moderate content
- ❌ Cannot manage users

**Badge Color**: Purple

**Upgrade Requirements**:
- ❗ **Admin approval required**
- Must submit application with reasoning
- Reviewed by platform administrators

---

### 4. Patron 👑
**Premium platform supporters**

**Description**: Premium members who financially support the platform and receive enhanced benefits.

**Permissions**:
- ✅ Create unlimited projects (999)
- ✅ Create unlimited showcase projects (999)
- ✅ Access AI chat (500 requests/day)
- ✅ Access mentorship program
- ✅ Access premium features
- ✅ Priority support
- ❌ Cannot mentor (unless also Mentor)
- ❌ Cannot moderate content

**Badge Color**: Amber (Gold)

**Auto-Upgrade Path**: Can upgrade from any lower role instantly
**Upgrade Requirements**: Payment/subscription (future integration)

---

### 5. Admin 🛡️
**Platform administrators - REQUIRES ADMIN APPROVAL**

**Description**: Platform administrators with full access to manage and moderate the platform.

**Permissions**:
- ✅ Create unlimited projects (999)
- ✅ Create unlimited showcase projects (999)
- ✅ Access AI chat (unlimited)
- ✅ **Can mentor users**
- ✅ Access all premium features
- ✅ **Can moderate content**
- ✅ **Can manage users**
- ✅ **Approve role upgrade requests**

**Badge Color**: Red

**Upgrade Requirements**:
- ❗ **Admin approval required**
- Reserved for platform staff and trusted administrators
- Manual assignment only

---

## Role Upgrade System

### Auto-Approval Rules

**Instant Upgrades** (No approval needed):
- Explorer → Expert ✅
- Explorer → Patron ✅
- Expert → Patron ✅

**Requires Admin Approval** ❗:
- Any role → Mentor
- Any role → Admin

### Upgrade Request Process

1. **User submits request**
   - Selects desired role
   - Provides reasoning/justification
   - Request enters "Pending" status

2. **Auto-approval check**
   - If eligible for auto-upgrade → Approved instantly
   - If requires approval → Sent to admin queue

3. **Admin review** (for Mentor/Admin requests)
   - Admin reviews request and reasoning
   - Can approve or reject with notes
   - User is notified of decision

4. **Role assignment**
   - Upon approval, user role is updated
   - User gains new permissions immediately
   - Request marked as "Approved"

### Request Statuses

- **Pending**: Waiting for admin review
- **Approved**: Request approved, role upgraded
- **Rejected**: Request denied by admin
- **Cancelled**: User cancelled their request

## Technical Implementation

### Database Models

**RoleUpgradeRequest**
```python
- user: ForeignKey (requester)
- current_role: CharField
- requested_role: CharField
- reason: TextField
- status: CharField (pending/approved/rejected/cancelled)
- reviewed_by: ForeignKey (admin)
- review_notes: TextField
- reviewed_at: DateTimeField
```

**RolePermission**
```python
- role: CharField (unique)
- display_name: CharField
- description: TextField
- badge_color: CharField
- hierarchy_level: IntegerField
- can_create_projects: BooleanField
- max_projects: IntegerField
- can_create_showcase: BooleanField
- max_showcase_projects: IntegerField
- can_access_ai_chat: BooleanField
- ai_requests_per_day: IntegerField
- can_mentor_users: BooleanField
- can_access_mentorship: BooleanField
- can_access_premium_features: BooleanField
- can_moderate_content: BooleanField
- can_manage_users: BooleanField
```

### Permission Checking

```python
# Check if user has required role level
user.has_role_permission(UserRole.MENTOR)  # Returns bool

# Check specific role
user.is_mentor  # Returns bool
user.is_admin_role  # Returns bool (includes superuser)

# Get role hierarchy level
user.role  # Returns UserRole enum value
```

## API Endpoints

### Submit Role Upgrade Request
```
POST /api/v1/roles/upgrade-request/
```

**Body**:
```json
{
  "requested_role": "expert",
  "reason": "I have been an active member for 6 months and have contributed..."
}
```

**Response**:
```json
{
  "id": 123,
  "status": "approved",  // or "pending" for Mentor/Admin
  "requested_role": "expert",
  "message": "Your role has been upgraded to Expert!"
}
```

### Get My Role Upgrade Requests
```
GET /api/v1/roles/my-requests/
```

### Admin: List Pending Requests
```
GET /api/v1/admin/role-requests/?status=pending
```

### Admin: Approve/Reject Request
```
POST /api/v1/admin/role-requests/{id}/review/
```

**Body**:
```json
{
  "action": "approve",  // or "reject"
  "review_notes": "User has demonstrated expertise..."
}
```

## Security Considerations

### Role Escalation Prevention

1. **Validation**: Users cannot directly modify their own role
2. **Approval Flow**: Sensitive roles require admin approval
3. **Audit Trail**: All role changes are logged
4. **Permission Checks**: API endpoints enforce role permissions

### Permission Enforcement

```python
# In views/serializers
from core.permissions import CanModifyRole

class UserProfileView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, CanModifyRole]
```

## Frontend Integration

### Display Role Badge

```tsx
const ROLE_COLORS = {
  explorer: 'slate',
  expert: 'blue',
  mentor: 'purple',
  patron: 'amber',
  admin: 'red',
};

<span className={`badge-${ROLE_COLORS[user.role]}`}>
  {user.roleDisplay}
</span>
```

### Show Upgrade Options

```tsx
{user.role === 'explorer' && (
  <UpgradeButton to="expert" autoApprove />
  <UpgradeButton to="patron" autoApprove />
  <UpgradeButton to="mentor" requiresApproval />
)}
```

## Admin Dashboard Features

### Role Request Management

- View all pending requests
- Filter by status, role, date
- Approve/reject with notes
- View user profile and history
- Bulk approve/reject actions

### User Role Management

- View all users by role
- Manually assign roles (superuser only)
- View role change history
- Export role statistics

## Future Enhancements

- [ ] Role-based content visibility
- [ ] Role-specific features and UI
- [ ] Gamification: Automatic role upgrades based on activity
- [ ] Role badges and achievements
- [ ] Mentor matching system
- [ ] Patron subscription integration
- [ ] Role analytics dashboard
- [ ] Email notifications for role changes

## Migration Commands

```bash
# Create migration
docker exec allthriveai-web-1 python manage.py makemigrations

# Run migration
docker exec allthriveai-web-1 python manage.py migrate

# Initialize role permissions
docker exec allthriveai-web-1 python manage.py init_role_permissions
```

## Testing

### Test Role Permissions

```python
def test_explorer_cannot_create_showcase():
    user = User.objects.create(role=UserRole.EXPLORER)
    project = Project(user=user, is_showcase=True)
    # Should fail validation

def test_mentor_can_mentor_users():
    mentor = User.objects.create(role=UserRole.MENTOR)
    assert mentor.is_mentor
    assert mentor.has_role_permission(UserRole.MENTOR)
```

### Test Upgrade Requests

```python
def test_expert_upgrade_auto_approved():
    user = User.objects.create(role=UserRole.EXPLORER)
    request = RoleUpgradeRequest.objects.create(
        user=user,
        current_role=UserRole.EXPLORER,
        requested_role=UserRole.EXPERT
    )
    assert request.can_auto_approve()

def test_mentor_upgrade_requires_approval():
    user = User.objects.create(role=UserRole.EXPERT)
    request = RoleUpgradeRequest.objects.create(
        user=user,
        current_role=UserRole.EXPERT,
        requested_role=UserRole.MENTOR
    )
    assert not request.can_auto_approve()
```

## Related Files

- `core/user_models.py` - User model with role field
- `core/role_models.py` - RoleUpgradeRequest and RolePermission models
- `core/permissions.py` - Custom permission classes
- `core/management/commands/init_role_permissions.py` - Initialize role data
- Frontend role components (to be created)
