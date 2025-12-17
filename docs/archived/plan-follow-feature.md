# Follow Users Feature - Implementation Plan

## Overview
Implement a one-way follow system (Twitter-style) where users can follow other users to see their projects in the personalized "For You" feed.

## Requirements
- **Follow type**: One-way (no approval required)
- **Button placement**: Left side user details panel on profile page
- **Personalization**: Filter "For You" feed to show projects from followed users

---

## Phase 1: Backend - UserFollow Model & API

### 1.1 Create UserFollow Model
**File**: `/core/users/models.py` (add to existing file)

```python
class UserFollow(models.Model):
    """One-way follow relationship between users."""
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='following'
    )
    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='followers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['follower', 'following'],
                name='unique_follow'
            ),
            models.CheckConstraint(
                check=~models.Q(follower=models.F('following')),
                name='no_self_follow'
            ),
        ]
        indexes = [
            models.Index(fields=['following', '-created_at']),
            models.Index(fields=['follower', '-created_at']),
        ]
```

### 1.2 Create Migration
```bash
make makemigrations
make migrate
```

### 1.3 Add Follow Counts to User Model
Add cached counts to User model (denormalized for performance):
```python
# In User model
followers_count = models.PositiveIntegerField(default=0)
following_count = models.PositiveIntegerField(default=0)
```

### 1.4 Create Serializers
**File**: `/core/users/serializers.py` (add to existing)

```python
class UserFollowSerializer(serializers.ModelSerializer):
    follower_username = serializers.ReadOnlyField(source='follower.username')
    following_username = serializers.ReadOnlyField(source='following.username')

    class Meta:
        model = UserFollow
        fields = ['id', 'follower', 'follower_username', 'following', 'following_username', 'created_at']

# Update UserPublicSerializer to include:
# - followers_count
# - following_count
# - is_following (for current user context)
```

### 1.5 Create API Views
**File**: `/core/users/views.py` (add to existing)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/<username>/follow/` | POST | Follow a user |
| `/api/users/<username>/follow/` | DELETE | Unfollow a user |
| `/api/users/<username>/followers/` | GET | List user's followers |
| `/api/users/<username>/following/` | GET | List who user follows |
| `/api/me/following/` | GET | Current user's following list |

### 1.6 Add URL Routes
**File**: `/core/urls.py`

```python
path('users/<str:username>/follow/', views.toggle_follow, name='toggle-follow'),
path('users/<str:username>/followers/', views.list_followers, name='list-followers'),
path('users/<str:username>/following/', views.list_following, name='list-following'),
```

### 1.7 Signal for Count Updates & Notifications
**File**: `/core/users/signals.py`

- Update `followers_count` / `following_count` on follow/unfollow
- Send email notification using existing `SOCIAL_NEW_FOLLOWER` type
- Track quest action: `QuestTracker.track_action(user, 'user_followed')`

---

## Phase 2: Frontend - Profile Page UI

### 2.1 Update User Types
**File**: `/frontend/src/types/models.ts`

```typescript
interface User {
  // ... existing fields
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;  // Context-aware: is current user following this profile
}
```

### 2.2 Create Follow Service
**File**: `/frontend/src/services/followService.ts`

```typescript
export const followService = {
  followUser(username: string): Promise<void>,
  unfollowUser(username: string): Promise<void>,
  getFollowers(username: string): Promise<User[]>,
  getFollowing(username: string): Promise<User[]>,
};
```

### 2.3 Update Profile Page Left Sidebar
**File**: `/frontend/src/pages/ProfilePage.tsx`

Add to left side user details (after bio, before social links):

```tsx
{/* Follow Section */}
<div className="mb-6">
  {/* Follow/Unfollow Button (only show if not own profile) */}
  {!isOwnProfile && (
    <button
      onClick={handleToggleFollow}
      className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
        isFollowing
          ? 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300'
          : 'bg-teal-500 text-white hover:bg-teal-600'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )}

  {/* Follower/Following Stats */}
  <div className="flex gap-4 mt-3 text-sm">
    <button className="hover:underline">
      <span className="font-bold">{followersCount}</span>
      <span className="text-gray-500 ml-1">Followers</span>
    </button>
    <button className="hover:underline">
      <span className="font-bold">{followingCount}</span>
      <span className="text-gray-500 ml-1">Following</span>
    </button>
  </div>
</div>
```

### 2.4 Create Followers/Following Modal
**File**: `/frontend/src/components/profile/FollowListModal.tsx`

- Modal to show list of followers or following
- Each item shows avatar, username, follow button
- Infinite scroll for large lists

---

## Phase 3: Personalization - "For You" Feed

### 3.1 Update Explore Projects Endpoint
**File**: `/core/projects/views.py`

Modify the explore endpoint to boost/filter by followed users:

```python
@api_view(['GET'])
def explore_projects(request):
    tab = request.query_params.get('tab', 'for-you')

    if tab == 'for-you' and request.user.is_authenticated:
        # Get IDs of users the current user follows
        following_ids = request.user.following.values_list('following_id', flat=True)

        # Boost projects from followed users
        projects = Project.objects.filter(is_published=True).annotate(
            from_following=Case(
                When(author_id__in=following_ids, then=1),
                default=0,
                output_field=IntegerField()
            )
        ).order_by('-from_following', '-trending_score', '-created_at')
    else:
        # Default sorting
        projects = Project.objects.filter(is_published=True).order_by('-trending_score')

    return paginated_response(projects)
```

### 3.2 Add "Following" Tab to Explore Page (Optional Enhancement)
**File**: `/frontend/src/pages/ExplorePage.tsx`

Add a dedicated "Following" tab that shows ONLY projects from followed users.

---

## Phase 4: Testing & Polish

### 4.1 Backend Tests
- Test follow/unfollow endpoints
- Test self-follow prevention
- Test duplicate follow prevention
- Test count accuracy
- Test feed personalization

### 4.2 Frontend Tests
- Test follow button states
- Test optimistic UI updates
- Test follower/following modal

### 4.3 Edge Cases
- User with 0 followers/following
- Following a private profile
- Unfollowing updates counts correctly
- Feed works with 0 followed users

---

## File Changes Summary

### Backend (New/Modified)
| File | Action | Description |
|------|--------|-------------|
| `/core/users/models.py` | Modify | Add UserFollow model + count fields |
| `/core/users/serializers.py` | Modify | Add follow serializers + update UserPublicSerializer |
| `/core/users/views.py` | Modify | Add follow/unfollow endpoints |
| `/core/users/signals.py` | Create | Handle count updates + notifications |
| `/core/urls.py` | Modify | Add follow routes |
| `/core/projects/views.py` | Modify | Update explore for personalization |

### Frontend (New/Modified)
| File | Action | Description |
|------|--------|-------------|
| `/frontend/src/types/models.ts` | Modify | Add follow fields to User type |
| `/frontend/src/services/followService.ts` | Create | API service for follow actions |
| `/frontend/src/pages/ProfilePage.tsx` | Modify | Add follow button + counts to sidebar |
| `/frontend/src/components/profile/FollowListModal.tsx` | Create | Modal for follower/following lists |
| `/frontend/src/pages/ExplorePage.tsx` | Modify | (Optional) Add Following tab |

---

## Implementation Order

1. **Backend model + migration** (UserFollow + count fields)
2. **Backend API endpoints** (follow/unfollow/list)
3. **Backend signals** (count updates, notifications)
4. **Frontend types + service**
5. **Profile page follow button + counts**
6. **Follow list modal**
7. **Feed personalization**
8. **Testing**

---

## Estimated Scope
- Backend: ~300 lines of code
- Frontend: ~400 lines of code
- Migration: 1 file
- Total new files: 3-4
- Modified files: 6-8
