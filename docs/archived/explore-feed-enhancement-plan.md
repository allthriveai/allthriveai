# Explore Feed Filtering & Personalization Enhancement

## Overview

Improve the explore feed with:
1. **Content type filtering** in existing dropdown (Phase 1 - MVP) ✅ COMPLETED
2. **Tinder-style swipe gestures** for like/show-less (Phase 2)
3. **Negative signal learning** to teach personalization (Phase 3)

## User Decisions
- **Swipe Mode**: Toggle between grid and card stack (dual mode)
- **MVP Priority**: Type filters first (frontend-only quick win)
- **Penalty Level**: Soft (-20%) for "show less" signals

---

## Phase 1: Content Type Filtering (MVP) ✅ COMPLETED

### What Was Implemented

1. **Added 'quiz' to CONTENT_TYPES** in `FilterDropdown.tsx`
   - All content types: All, GitHub Projects, Prompt Battles, Videos, Articles, Designs, Prompts, Image Collections, Reddit Threads, Clipped Content, Quizzes

2. **Quiz Taxonomy Filtering** in `ExplorePage.tsx`
   - Quizzes now filter by selected categories (using `quiz.categories`)
   - Quizzes now filter by selected tools (using `quiz.tools`)
   - Quizzes hidden when non-quiz content type is selected
   - Projects hidden when 'quiz' content type is selected

3. **Tab Reordering** in `FilterDropdown.tsx`
   - Tabs now ordered: Categories | Tools | Types
   - Default tab is Categories

4. **Glass Pill Styling** for filter button when active
   - Uses `glass-subtle` class with backdrop blur
   - Icon: `text-primary-600 dark:text-cyan-400`
   - Badge: `bg-gray-800 text-white` (light) / `bg-white text-gray-900` (dark)

### Files Modified
- `frontend/src/components/explore/FilterDropdown.tsx`
- `frontend/src/components/explore/SearchBarWithFilters.tsx`
- `frontend/src/pages/ExplorePage.tsx`

---

## Phase 2: Swipe Gestures (Not Started)

### Goal
Add Tinder-style card swiping as an optional mode alongside the grid.

### UX Design

**Dual Mode Toggle**
- Floating action button (bottom-right, above mobile nav)
- Grid icon (default) / Card stack icon (swipe mode)
- Smooth transition animation between modes

**Swipe Mode**
- Card stack: 3 cards visible (top active, 2 behind scaled)
- Swipe right = Like (green heart overlay)
- Swipe left = Show less (red X overlay)
- Undo button (bottom-left) for last 10 actions

**Visual Feedback**
- Card rotates up to 20° during drag
- Color overlay fades in based on swipe distance
- Threshold: 60px or velocity 0.15
- Spring physics for smooth animations

### Implementation

**1. New Components**

```
frontend/src/components/explore/
├── SwipeableCardStack.tsx    # Container managing card stack
├── SwipeableCard.tsx         # Individual card with gestures
├── SwipeIndicators.tsx       # Like/dislike overlay icons
├── ModeToggleFAB.tsx         # Floating toggle button
└── SwipeUndoButton.tsx       # Undo last swipe
```

**2. Reuse Existing Hook**

`useSwipeGesture.ts` already exists with @use-gesture/react - extend for card-specific behavior.

**3. State Management**

```typescript
// In ExplorePage.tsx
const [isSwipeMode, setIsSwipeMode] = useState(false);
const [swipeHistory, setSwipeHistory] = useState<SwipeAction[]>([]);
```

**4. Mobile Considerations**
- Touch-optimized (44px minimum targets)
- Haptic feedback on iOS
- Disable page scroll in swipe mode
- Respect `prefers-reduced-motion`

### Files to Modify
- `frontend/src/pages/ExplorePage.tsx` - Add mode toggle, conditional rendering
- `frontend/src/hooks/useSwipeGesture.ts` - Extend for cards
- `frontend/src/index.css` - Swipe animations

### Files to Create
- `frontend/src/components/explore/SwipeableCardStack.tsx`
- `frontend/src/components/explore/SwipeableCard.tsx`
- `frontend/src/components/explore/ModeToggleFAB.tsx`

### Effort: ~2-3 days

---

## Phase 3: Negative Signal Learning (Not Started)

### Goal
Track "show less" signals and use them to improve personalization.

### Backend Changes

**1. New Interaction Types**

Add to `core/taxonomy/models.py` UserInteraction.InteractionType:

```python
CONTENT_DISMISS = 'content_dismiss', 'Dismissed Content'        # -20% penalty
CONTENT_NOT_INTERESTED = 'content_not_interested', 'Not Interested'  # -50%
CONTENT_HIDE = 'content_hide', 'Hidden Content'                 # Filter entirely
```

**2. New User Preferences Model**

```python
class UserContentPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    hidden_content_types = models.JSONField(default=list)  # ['quizzes', 'events']
    muted_topics = models.JSONField(default=list)          # ['blockchain']
    muted_user_ids = models.JSONField(default=list)        # [123, 456]
```

**3. Scoring Adjustments**

In `services/personalization/engine.py` `_score_candidates()`:

```python
# Query dismissed projects once (batch)
dismissed_ids = set(UserInteraction.objects.filter(
    user=user, interaction_type='content_dismiss'
).values_list('metadata__project_id', flat=True))

# Apply soft penalty
if project_id in dismissed_ids:
    behavioral_score -= 0.2  # Soft penalty per user preference
```

**4. API Endpoints**

- `POST /api/explore/swipe/` - Track swipe action
- `POST /api/explore/swipe/undo/` - Revert last action
- `GET /api/me/content-preferences/` - Get user preferences
- `POST /api/me/content-preferences/clear/` - Privacy: clear all

**5. Rate Limiting**

- 100 negative signals per hour
- 30 preference updates per hour

### Files to Modify
- `core/taxonomy/models.py` - Add InteractionTypes, UserContentPreference
- `core/taxonomy/views.py` - Add preference endpoints
- `services/personalization/engine.py` - Add penalty scoring

### Migration
```bash
python manage.py makemigrations taxonomy
python manage.py migrate
```

### Effort: ~1 week

---

## Implementation Order

```
Week 1:
├── Phase 1: Content Type Filtering (4 hours) ✅ DONE
│   ├── Add CONTENT_TYPES constant
│   ├── Update FilterDropdown with type section
│   └── Client-side filtering in ExplorePage

Week 2-3:
├── Phase 2: Swipe Gestures (2-3 days)
│   ├── SwipeableCardStack component
│   ├── Mode toggle FAB
│   ├── Swipe animations and feedback
│   └── Undo functionality

Week 4:
├── Phase 3: Negative Signals (3-4 days)
│   ├── Backend models and migrations
│   ├── API endpoints
│   ├── PersonalizationEngine updates
│   └── Connect swipe actions to backend
```

---

## Critical Files Reference

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/pages/ExplorePage.tsx` | Mode state, conditional render, type filter |
| `frontend/src/components/explore/SearchBarWithFilters.tsx` | Content type filter UI |
| `frontend/src/components/explore/FilterDropdown.tsx` | Type filter section |
| `frontend/src/hooks/useSwipeGesture.ts` | Extend for card gestures |

### Backend
| File | Changes |
|------|---------|
| `core/taxonomy/models.py` | InteractionTypes, UserContentPreference |
| `core/taxonomy/views.py` | Preference CRUD endpoints |
| `services/personalization/engine.py` | Negative signal penalties |

---

## Success Metrics

- % users using type filters
- Avg swipes per session
- Like rate in swipe mode vs grid clicks
- Repeat swipe mode usage (weekly)
- "Show less" signal accuracy (do users engage less with penalized content?)

---

## Privacy Considerations

- Users can clear all negative history
- GDPR: Delete preferences on account deletion
- No negative signals stored in Weaviate (Postgres only)
- Transparent: Users can view their negative history
