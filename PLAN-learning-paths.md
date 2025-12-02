# Learning Paths Feature - Implementation Plan

## Overview

Add a **Learning Paths** tab to the user profile that displays auto-generated, personalized learning journeys based on the user's activity and interests. This aggregates their quiz completions, side quest progress, and recommends next steps.

## Key Requirements (from user)

1. **Auto-Generated Paths** - Not admin-curated; system creates personalized paths based on user behavior
2. **Content**: Quizzes now, AI courses eventually
3. **SideQuest Integration**: Side quests can be pulled into learning paths on the profile
4. **Goal**: Progress Showcase - show completed learning and current progress

---

## Architecture Design

### Concept: Topic-Based Learning Paths

Instead of rigid pre-defined paths, we generate **dynamic learning paths per topic** based on:
- User's interests (from `UserTag` with high confidence)
- Tools they use (from their projects)
- Quiz completions in each topic
- Side quest completions in each topic
- Skill level progression (beginner → intermediate → advanced → master)

### Topics (existing in SideQuest model)
```
- chatbots-conversation
- websites-apps
- images-video
- design-ui
- video-creative-media
- podcasts-education
- games-interactive
- workflows-automation
- productivity
- developer-coding
- prompts-templates
- thought-experiments
- wellness-growth
- ai-agents-multitool
- ai-models-research
- data-analytics
```

---

## Phase 1: Backend - Learning Path Service

### 1.1 New Model: `UserLearningPath`

Track user's progress through each topic they're interested in:

```python
# /core/learning_paths/models.py

class UserLearningPath(models.Model):
    """Auto-generated learning path per user per topic."""

    SKILL_LEVEL_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
        ('master', 'Master'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='learning_paths')
    topic = models.CharField(max_length=50, choices=SideQuest.TOPIC_CHOICES)

    # Calculated skill level based on activity
    current_skill_level = models.CharField(max_length=20, choices=SKILL_LEVEL_CHOICES, default='beginner')

    # Progress metrics
    quizzes_completed = models.IntegerField(default=0)
    quizzes_total = models.IntegerField(default=0)  # Available quizzes in this topic
    side_quests_completed = models.IntegerField(default=0)
    side_quests_total = models.IntegerField(default=0)

    # Points earned in this topic
    topic_points = models.IntegerField(default=0)

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'topic']
        ordering = ['-last_activity_at']
```

### 1.2 New Service: `LearningPathService`

```python
# /services/learning_path_service.py

class LearningPathService:
    """Generate and track personalized learning paths."""

    def get_user_paths(self, user) -> list[UserLearningPath]:
        """Get all learning paths for a user, creating new ones for high-interest topics."""
        pass

    def get_path_progress(self, user, topic: str) -> dict:
        """Get detailed progress for a specific topic path."""
        # Returns:
        # - current_skill_level
        # - progress_percentage
        # - completed_quizzes (list)
        # - available_quizzes (list)
        # - completed_side_quests (list)
        # - active_side_quests (list)
        # - recommended_next (quiz or side quest)
        pass

    def calculate_skill_level(self, user, topic: str) -> str:
        """Calculate skill level based on activity."""
        # beginner: 0-200 topic points
        # intermediate: 200-500 topic points
        # advanced: 500-1000 topic points
        # master: 1000+ topic points
        pass

    def get_recommended_topics(self, user, limit=5) -> list[str]:
        """Recommend new topics based on UserTags and similar users."""
        pass

    def update_path_progress(self, user, topic: str):
        """Recalculate progress after quiz/side quest completion."""
        # Called via signal when QuizAttempt or UserSideQuest is completed
        pass
```

### 1.3 API Endpoints

```python
# /core/learning_paths/views.py

GET /api/v1/me/learning-paths/
# Returns user's active learning paths with progress summary

GET /api/v1/me/learning-paths/{topic}/
# Returns detailed path for a specific topic

GET /api/v1/me/learning-paths/recommendations/
# Returns recommended new topics to explore

GET /api/v1/users/{username}/learning-paths/
# Returns public learning paths for any user (for profile display)
```

### 1.4 Signals Integration

```python
# Update learning path when quiz is completed
@receiver(post_save, sender=QuizAttempt)
def update_learning_path_on_quiz(sender, instance, created, **kwargs):
    if created and instance.completed_at:
        # Get quiz topic from quiz.categories
        for category in instance.quiz.categories.all():
            topic = map_category_to_topic(category)
            if topic:
                LearningPathService().update_path_progress(instance.user, topic)

# Update learning path when side quest is completed
@receiver(post_save, sender=UserSideQuest)
def update_learning_path_on_sidequest(sender, instance, **kwargs):
    if instance.is_completed and instance.side_quest.topic:
        LearningPathService().update_path_progress(instance.user, instance.side_quest.topic)
```

---

## Phase 2: Frontend - Profile Learning Path Tab

### 2.1 Profile Page Changes

Add new tab to `ProfilePage.tsx`:

```typescript
// Tabs become:
// - Showcase (existing)
// - Playground (existing)
// - Learning (NEW) - visible to everyone
// - Activity (existing) - owner only
```

### 2.2 New Components

```
/frontend/src/components/learning/
├── LearningPathsTab.tsx          # Main tab content
├── LearningPathCard.tsx          # Card for each topic path
├── PathProgressBar.tsx           # Visual progress indicator
├── SkillLevelBadge.tsx           # Beginner/Intermediate/etc badge
├── RecommendedPath.tsx           # "Start learning" card for new topics
└── PathDetailModal.tsx           # Expanded view with lessons
```

### 2.3 LearningPathsTab Component

```tsx
// Shows:
// 1. Active learning paths (topics user is learning)
//    - Progress bar
//    - Skill level badge
//    - Quizzes completed / total
//    - Side quests completed / total
//    - "Continue Learning" button
//
// 2. Recommended paths (if user has interests but hasn't started)
//    - Based on UserTags
//    - "Start Path" button
//
// 3. Completed mastery (topics where skill_level = master)
//    - Achievement-style display
```

### 2.4 PathDetailModal

When clicking on a path card:

```tsx
// Shows expanded view:
// - Topic title + description
// - Current skill level with progress to next
// - Completed quizzes (with scores)
// - Completed side quests
// - Available quizzes (not yet taken)
// - Active side quests (in progress)
// - Recommended next step
```

---

## Phase 3: Personalization Integration

### 3.1 Leverage Existing Systems

**UserTags** (already tracking):
- Auto-tagged from projects user creates
- Auto-tagged from AI conversations
- Confidence scores for each tag

**Map UserTags to Topics**:
```python
TAG_TO_TOPIC_MAP = {
    'ChatGPT': 'chatbots-conversation',
    'Claude': 'chatbots-conversation',
    'Midjourney': 'images-video',
    'DALL-E': 'images-video',
    'Figma': 'design-ui',
    'React': 'websites-apps',
    'n8n': 'workflows-automation',
    # ... etc
}
```

### 3.2 Path Recommendations Algorithm

```python
def get_recommended_topics(user, limit=5):
    # 1. Get user's high-confidence tags
    user_tags = UserTag.objects.filter(user=user, confidence_score__gte=0.5)

    # 2. Map to topics
    potential_topics = set()
    for tag in user_tags:
        topic = TAG_TO_TOPIC_MAP.get(tag.name)
        if topic:
            potential_topics.add(topic)

    # 3. Exclude topics user already has paths for
    existing_topics = UserLearningPath.objects.filter(user=user).values_list('topic', flat=True)
    new_topics = potential_topics - set(existing_topics)

    # 4. Score by tag confidence and quiz availability
    scored = []
    for topic in new_topics:
        quiz_count = Quiz.objects.filter(categories__slug=topic).count()
        tag_confidence = max(tag.confidence_score for tag in user_tags
                           if TAG_TO_TOPIC_MAP.get(tag.name) == topic)
        score = quiz_count * 0.3 + tag_confidence * 0.7
        scored.append((topic, score))

    # 5. Return top N
    return [t[0] for t in sorted(scored, key=lambda x: -x[1])[:limit]]
```

---

## Data Flow Summary

```
User Activity
    │
    ├─→ Creates Project → Auto-tag → UserTag → Suggested Topics
    │
    ├─→ Completes Quiz → QuizAttempt → Signal → Update UserLearningPath
    │
    ├─→ Completes SideQuest → UserSideQuest → Signal → Update UserLearningPath
    │
    └─→ Views Profile → API → LearningPathService → Aggregated Progress
```

---

## Implementation Order

### Step 1: Backend Foundation
1. Create `core/learning_paths/` Django app
2. Add `UserLearningPath` model
3. Create `LearningPathService`
4. Add signals to update paths on quiz/sidequest completion
5. Add API endpoints

### Step 2: Frontend Tab
1. Add "Learning" tab to ProfilePage
2. Create `LearningPathsTab` component
3. Create `LearningPathCard` component
4. Create `PathProgressBar` and `SkillLevelBadge`
5. Wire up API calls with React Query

### Step 3: Recommendations
1. Implement topic recommendation algorithm
2. Create `RecommendedPath` component
3. Add "Start Learning" flow

### Step 4: Detail View
1. Create `PathDetailModal`
2. Show completed + available quizzes
3. Show completed + active side quests
4. Add "Continue Learning" actions

---

## Future Enhancements (Post-MVP)

1. **AI Courses**: Add course content type alongside quizzes
2. **Learning Streaks**: Track consecutive days of learning
3. **Topic Mastery Achievements**: Unlock achievements for mastering topics
4. **Learning Leaderboards**: Compare progress with similar users
5. **Personalized Quiz Recommendations**: AI-powered next quiz suggestions

---

## Files to Create/Modify

### New Files:
- `/core/learning_paths/__init__.py`
- `/core/learning_paths/models.py`
- `/core/learning_paths/views.py`
- `/core/learning_paths/serializers.py`
- `/core/learning_paths/urls.py`
- `/core/learning_paths/admin.py`
- `/services/learning_path_service.py`
- `/frontend/src/components/learning/LearningPathsTab.tsx`
- `/frontend/src/components/learning/LearningPathCard.tsx`
- `/frontend/src/components/learning/PathProgressBar.tsx`
- `/frontend/src/components/learning/SkillLevelBadge.tsx`
- `/frontend/src/services/learningPaths.ts`
- `/frontend/src/hooks/useLearningPaths.ts`

### Modified Files:
- `/config/settings.py` - Add 'core.learning_paths' to INSTALLED_APPS
- `/config/urls.py` - Include learning_paths URLs
- `/frontend/src/pages/ProfilePage.tsx` - Add Learning tab
- `/frontend/src/types/models.ts` - Add LearningPath types

---

## Questions Resolved

- **Path Creation**: Auto-generated based on user behavior
- **Content Types**: Quizzes (now), AI courses (future)
- **SideQuest Integration**: Pulled into paths, tracked separately
- **Profile Display**: Progress showcase with recommendations
