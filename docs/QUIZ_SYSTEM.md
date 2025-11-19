# Quiz System Implementation Plan

## Overview

This document outlines the implementation plan for an interactive quiz system in AllThrive AI. The system features swipeable card-based quizzes (Tinder-style) to make learning about AI frameworks, concepts, and best practices engaging and fun.

## Goals

- Create interactive, engaging learning experiences
- Make complex AI concepts accessible through bite-sized quizzes
- Provide immediate feedback and explanations
- Track user progress and learning patterns
- Build a reusable quiz component system

## Architecture

### Directory Structure

```
frontend/src/components/quiz/
├── QuizCard.tsx              # Swipeable quiz question card
├── QuizStack.tsx             # Manages stack of quiz cards
├── QuizProgress.tsx          # Progress bar/indicator
├── QuizResults.tsx           # Score and review screen
├── QuizAnswer.tsx            # Answer feedback component
├── QuizHint.tsx              # Optional hint display
└── types.ts                  # Quiz TypeScript types

frontend/src/hooks/
├── useSwipeGesture.ts        # Reusable swipe logic
└── useQuiz.ts                # Quiz state management

frontend/src/pages/
├── QuizListPage.tsx          # Browse available quizzes (/quick-quizzes)
│                             # - Hero banner component
│                             # - Search bar
│                             # - Quiz card grid
│                             # - Filter chips
├── QuizPage.tsx              # Active quiz interface (/quick-quizzes/:id)
└── QuizResultPage.tsx        # Detailed results view (/quick-quizzes/:id/results)

frontend/src/services/
└── quiz.ts                   # Quiz API calls
```

### Backend Structure

```
core/
├── models/
│   ├── quiz_models.py        # Quiz, QuizQuestion, QuizAttempt models
├── views/
│   ├── quiz_views.py         # Quiz API views
├── serializers/
│   ├── quiz_serializers.py   # Quiz serializers
└── migrations/
```

## Data Models

### TypeScript Types

```typescript
interface Quiz {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  questionCount: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  type: 'true_false' | 'multiple_choice' | 'swipe';
  correctAnswer: string | string[];
  options?: string[]; // for multiple choice
  explanation: string;
  hint?: string;
  order: number;
  imageUrl?: string;
}

interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<string, {
    answer: string;
    correct: boolean;
    timeSpent: number;
  }>;
  score: number;
  totalQuestions: number;
  startedAt: string;
  completedAt: string;
}

interface QuizAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}
```

### Django Models

```python
# core/quiz_models.py

class Quiz(models.Model):
    """A collection of quiz questions on a specific topic"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    title = models.CharField(max_length=200)
    description = models.TextField()
    topic = models.CharField(max_length=100)
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('beginner', 'Beginner'),
            ('intermediate', 'Intermediate'),
            ('advanced', 'Advanced'),
        ]
    )
    estimated_time = models.IntegerField(help_text="Estimated time in minutes")
    thumbnail_url = models.URLField(blank=True, null=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

class QuizQuestion(models.Model):
    """Individual question within a quiz"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    question = models.TextField()
    type = models.CharField(
        max_length=20,
        choices=[
            ('true_false', 'True/False'),
            ('multiple_choice', 'Multiple Choice'),
            ('swipe', 'Swipe'),
        ]
    )
    correct_answer = models.JSONField()  # String or list of strings
    options = models.JSONField(blank=True, null=True)  # For multiple choice
    explanation = models.TextField()
    hint = models.TextField(blank=True, null=True)
    order = models.IntegerField()
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

class QuizAttempt(models.Model):
    """User's attempt at a quiz"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    answers = models.JSONField()  # Store all answers with metadata
    score = models.IntegerField()
    total_questions = models.IntegerField()
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-started_at']
```

## API Endpoints

### RESTful API Design

```
GET    /api/v1/quizzes/
       List all published quizzes
       Response: { results: Quiz[], count: number }

GET    /api/v1/quizzes/:id/
       Get quiz details
       Response: Quiz

GET    /api/v1/quizzes/:id/questions/
       Get all questions for a quiz
       Response: { questions: QuizQuestion[] }

POST   /api/v1/quizzes/:id/start/
       Start a new quiz attempt
       Response: { attemptId: string, questions: QuizQuestion[] }

POST   /api/v1/quizzes/attempts/:attemptId/answer/
       Submit an answer for a question
       Body: { questionId: string, answer: string, timeSpent: number }
       Response: { correct: boolean, explanation: string }

POST   /api/v1/quizzes/attempts/:attemptId/complete/
       Complete a quiz attempt
       Response: { score: number, totalQuestions: number, results: QuizAttempt }

GET    /api/v1/users/me/quiz-history/
       Get user's quiz attempt history
       Response: { attempts: QuizAttempt[] }

GET    /api/v1/users/me/quiz-stats/
       Get user's quiz statistics
       Response: { totalAttempts: number, averageScore: number, topicBreakdown: {} }
```

## Interaction Design

### Swipe Gestures

- **Swipe Right**: True / Agree / Option A / Correct
- **Swipe Left**: False / Disagree / Option B / Incorrect
- **Swipe Up** (optional): Save question for review / Request hint
- **Tap Card**: Flip to show explanation (after answering)
- **Tap Hint Button**: Show hint without answering

### Visual Feedback

- **Correct Answer**: 
  - Green glow/border animation
  - Checkmark icon
  - Card flies off to the right
  - Confetti effect (on last question)

- **Incorrect Answer**:
  - Red glow/border animation
  - X icon
  - Card flies off to the left
  - Shake animation before flying off

- **Progress**:
  - Progress bar at top showing X/Y questions
  - Small preview of next card behind current card
  - Question counter

### Mobile Considerations

- Touch-optimized swipe threshold (100px minimum)
- Haptic feedback on swipe (Web Vibration API)
- Large touch targets for buttons
- Bottom-sheet style results panel
- Prevent accidental swipes (velocity threshold)

## Technology Stack

### Frontend Libraries

**Primary Choice: react-spring + @use-gesture/react**

```bash
npm install react-spring @use-gesture/react
```

**Pros:**
- Physics-based animations (natural feel)
- Full gesture control (swipe, drag, pinch)
- TypeScript support
- Lightweight (~40kb combined)
- Works with React 19
- Active maintenance

**Alternative: framer-motion**
```bash
npm install framer-motion
```
- Simpler API
- Great for prototyping
- Heavier bundle (~90kb)

### State Management

- **TanStack Query**: Data fetching, caching quiz data
- **Local State (useState)**: Quiz progress, current question
- **Context (optional)**: Share quiz state across components
- **Backend Storage**: User quiz history, scores

## QuizListPage Component Details

### Route
`/quick-quizzes`

### Layout Structure

```tsx
<QuizListPage>
  <HeroBanner 
    image="/assets/quiz-hero.jpg"
    title="Quick Quizzes"
    subtitle="Test your knowledge on AI frameworks, concepts, and best practices"
  />
  
  <SearchBar 
    placeholder="Search quizzes by title, topic, or keyword..."
    onChange={handleSearch}
  />
  
  <FilterChips>
    <TopicFilter /> {/* AI Frameworks, Prompt Engineering, etc. */}
    <DifficultyFilter /> {/* Beginner, Intermediate, Advanced */}
    <StatusFilter /> {/* Not Started, In Progress, Completed */}
  </FilterChips>
  
  <QuizCardGrid>
    {quizzes.map(quiz => (
      <QuizCard
        key={quiz.id}
        thumbnail={quiz.thumbnailUrl}
        title={quiz.title}
        description={quiz.description}
        difficulty={quiz.difficulty}
        estimatedTime={quiz.estimatedTime}
        questionCount={quiz.questionCount}
        topics={quiz.topics}
        onClick={() => navigate(`/quick-quizzes/${quiz.id}`)}
      />
    ))}
  </QuizCardGrid>
  
  {/* Empty state when no results */}
  {quizzes.length === 0 && (
    <EmptyState message="No quizzes found. Try adjusting your filters." />
  )}
</QuizListPage>
```

### Responsive Behavior
- **Desktop (≥1024px)**: 3-column grid
- **Tablet (768px-1023px)**: 2-column grid
- **Mobile (<768px)**: 1-column grid
- Banner scales proportionally
- Search bar full width on mobile

### Search Functionality
- Debounced search (300ms delay)
- Searches across: title, description, topics
- Real-time filtering of quiz cards
- Maintains filter state in URL query params

### Filter Chips
- Multiple selections allowed per category
- Visual active state for selected filters
- Clear all filters button
- Filters combine with AND logic within category, OR across categories

## Implementation Phases

### Phase 1: Foundation (Day 1)

**Tasks:**
- [ ] Install dependencies: `react-spring`, `@use-gesture/react`
- [ ] Create TypeScript types in `components/quiz/types.ts`
- [ ] Build `useSwipeGesture` custom hook
- [ ] Create base `SwipeableCard` component with animations
- [ ] Test basic swipe interactions

**Deliverables:**
- Working swipe gesture system
- Reusable card component
- Type definitions

### Phase 2: Quiz Components (Day 1-2)

**Tasks:**
- [ ] Build `QuizCard` component with question display
- [ ] Create `QuizStack` to manage card deck state
- [ ] Add `QuizProgress` component (progress bar, counter)
- [ ] Build `QuizAnswer` feedback component
- [ ] Create `QuizResults` screen with score/review
- [ ] Add `QuizHint` component

**Deliverables:**
- Complete quiz component library
- Interactive quiz interface
- Results/review screen

### Phase 3: Backend Integration (Day 2)

**Tasks:**
- [ ] Create Django models: Quiz, QuizQuestion, QuizAttempt
- [ ] Write migrations
- [ ] Build serializers
- [ ] Create API views and endpoints
- [ ] Add permissions and validation
- [ ] Create admin interface for quiz management

**Deliverables:**
- Working API endpoints
- Database models
- Admin panel for creating quizzes

### Phase 4: Frontend API Integration (Day 2-3)

**Tasks:**
- [ ] Create `services/quiz.ts` with API functions
- [ ] Build `useQuiz` hook with TanStack Query
- [ ] Integrate API calls in components
- [ ] Add loading and error states
- [ ] Handle authentication/permissions
- [ ] Add optimistic updates

**Deliverables:**
- Full API integration
- Error handling
- Loading states

### Phase 5: Pages & Routing (Day 2-3)

**Tasks:**
- [ ] Create `QuizListPage` - browse available quizzes at `/quick-quizzes`
  - [ ] Hero banner image component
  - [ ] Search bar with debounced filtering
  - [ ] Responsive quiz card grid (3/2/1 columns)
  - [ ] Filter chips (topic, difficulty, completion status)
  - [ ] Empty state when no quizzes match search/filters
- [ ] Build `QuizPage` - active quiz interface at `/quick-quizzes/:id`
- [ ] Create `QuizResultPage` - detailed results with review at `/quick-quizzes/:id/results`
- [ ] Add routing in `routes/index.tsx`
- [ ] Update sidebar navigation to link to `/quick-quizzes`
- [ ] Implement breadcrumbs

**Deliverables:**
- Complete page implementations
- Routing setup (`/quick-quizzes`, `/quick-quizzes/:id`, `/quick-quizzes/:id/results`)
- Navigation integration

### Phase 6: Content Creation (Day 3)

**Tasks:**
- [ ] Write "Top AI Agent Frameworks" quiz (10-12 questions)
- [ ] Write "Prompt Engineering Basics" quiz (8-10 questions)
- [ ] Write "AI Model Comparison" quiz (10-12 questions)
- [ ] Generate/find thumbnail images
- [ ] Add explanations and hints
- [ ] Test content flow

**Deliverables:**
- 3 complete quizzes with content
- Thumbnails and images
- Quality explanations

### Phase 7: Polish & Testing (Day 3-4)

**Tasks:**
- [ ] Polish animations and transitions
- [ ] Add sound effects (optional)
- [ ] Test on mobile devices
- [ ] Add keyboard navigation (accessibility)
- [ ] Optimize performance
- [ ] Add analytics tracking
- [ ] Write unit tests for components
- [ ] E2E tests for quiz flow

**Deliverables:**
- Polished user experience
- Mobile-optimized
- Test coverage
- Performance optimization

## Quiz Content Strategy

### Initial Quiz Topics

#### 1. "Top AI Agent Frameworks"
**Target Audience:** Beginners to Intermediate  
**Estimated Time:** 5-7 minutes  
**Question Count:** 10-12

**Sample Questions:**
- "LangGraph is best suited for building multi-agent systems with complex workflows" (True/False)
- "Which framework has built-in human-in-the-loop capabilities?" (Multiple Choice)
- "CrewAI specializes in role-based agent collaboration" (True/False)

**Learning Outcomes:**
- Understand key differences between frameworks
- Know which framework to choose for specific use cases
- Learn about agent orchestration patterns

#### 2. "Prompt Engineering Basics"
**Target Audience:** Beginners  
**Estimated Time:** 4-6 minutes  
**Question Count:** 8-10

**Sample Questions:**
- "Clear, specific prompts generally produce better results than vague ones" (True/False)
- "Which technique helps break down complex tasks?" (Chain-of-thought / Few-shot / Zero-shot)
- "Adding examples to your prompt is called few-shot learning" (True/False)

**Learning Outcomes:**
- Master basic prompt engineering techniques
- Understand prompt structure
- Learn common pitfalls to avoid

#### 3. "AI Model Comparison"
**Target Audience:** Intermediate  
**Estimated Time:** 5-7 minutes  
**Question Count:** 10-12

**Sample Questions:**
- "GPT-4 has a larger context window than Claude 3.5 Sonnet" (True/False)
- "Which model is known for superior code generation?" (Multiple Choice)
- "Claude models excel at following complex instructions and being 'helpful, harmless, and honest'" (True/False)

**Learning Outcomes:**
- Compare major AI models
- Understand strengths/weaknesses
- Choose the right model for tasks

### Future Quiz Topics

- **"RAG Systems Explained"** - Understanding retrieval augmented generation
- **"Vector Databases 101"** - When and how to use vector stores
- **"AI Safety Basics"** - Responsible AI development
- **"LangChain Deep Dive"** - Advanced LangChain concepts
- **"Building AI Pipelines"** - System architecture patterns
- **"Fine-tuning vs RAG"** - Choosing the right approach

## User Experience Flow

### 1. Discovery (/quick-quizzes Landing Page)
- User navigates to "Learn" → "Quick Quizzes" from sidebar or directly to `/quick-quizzes`
- **Banner Image**: Hero banner at top of page (motivational/learning theme)
- **Search Bar**: Prominent search at top to filter quizzes by title, topic, or keywords
- **Quiz Grid**: Card-based layout displaying all available quizzes
- Each quiz card shows:
  - Thumbnail image
  - Title
  - Brief description
  - Difficulty badge (Beginner/Intermediate/Advanced)
  - Estimated time (e.g., "5-7 min")
  - Question count (e.g., "10 questions")
  - Topic tag(s)
- Can filter by:
  - Topic (AI Frameworks, Prompt Engineering, etc.)
  - Difficulty level
  - Completion status (if logged in)
- Responsive grid: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)

### 2. Quiz Start
- User clicks a quiz card
- Modal or new page shows quiz details
- "Start Quiz" button begins the experience
- Brief animation showing cards stack

### 3. Taking Quiz
- One question card visible at a time
- Clear instruction at top ("Swipe right for True, left for False")
- Progress indicator at top (3/10)
- Hint button available (optional)
- User swipes to answer
- Immediate feedback (green/red, explanation appears briefly)
- Next card automatically appears

### 4. Completion
- After last question, confetti animation
- Results screen shows:
  - Score (8/10 - 80%)
  - Time taken
  - Topic mastery level
  - Option to review incorrect answers
  - "Try Another Quiz" button
  - Share results (future)

### 5. Review
- See all questions
- Correct answers highlighted in green
- Incorrect answers in red with correct answer shown
- Full explanations visible
- "Retake Quiz" button

## Success Metrics

### Engagement Metrics
- Quiz completion rate (target: >75%)
- Average time per quiz
- Quiz retake rate
- Daily/weekly active quiz takers

### Learning Metrics
- Average score per quiz
- Score improvement on retakes
- Most common incorrect answers (identify knowledge gaps)
- Topic completion rate

### Technical Metrics
- Page load time (<2s)
- API response time (<200ms)
- Animation frame rate (60fps)
- Mobile vs desktop usage

### Content Metrics
- Most popular quiz topics
- Difficulty level distribution
- Drop-off points (which questions cause exits)
- Quiz creation rate (admin side)

## Accessibility

### Requirements
- **Keyboard Navigation**: Arrow keys to navigate, Space/Enter to answer
- **Screen Reader**: Proper ARIA labels, announce score/feedback
- **Color Blind**: Don't rely solely on color (use icons + color)
- **Reduced Motion**: Respect `prefers-reduced-motion` for animations
- **Focus Management**: Clear focus indicators, logical tab order

### Implementation
```typescript
// Respect user's motion preferences
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const springConfig = prefersReducedMotion
  ? { duration: 0 }
  : { tension: 200, friction: 25 };
```

## Performance Optimization

### Strategies
- **Virtual Scrolling**: Quiz list with many items
- **Image Optimization**: Lazy load thumbnails, use WebP
- **Code Splitting**: Load quiz components on-demand
- **Prefetching**: Preload next 2-3 questions
- **Memoization**: React.memo for card components
- **Debouncing**: Prevent rapid swipe spam

### Bundle Size Targets
- Quiz components bundle: <50kb gzipped
- react-spring + @use-gesture: ~40kb gzipped
- Total additional bundle: <100kb gzipped

## Future Enhancements

### Phase 2 Features
- [ ] **Daily Challenge**: New quiz every day, streak tracking
- [ ] **Leaderboards**: Top scores per quiz/topic
- [ ] **Achievements/Badges**: Unlock badges for completing quiz series
- [ ] **Social Sharing**: Share results on social media
- [ ] **Custom Quizzes**: Users can create their own quizzes
- [ ] **Collaborative Quizzes**: Quiz each other in real-time

### Phase 3 Features
- [ ] **Spaced Repetition**: Re-quiz on missed questions later
- [ ] **Adaptive Difficulty**: Adjust question difficulty based on performance
- [ ] **Quiz Collections**: Curated series of quizzes
- [ ] **Learning Paths**: Structured curriculum with quizzes
- [ ] **Multiplayer Mode**: Race against others
- [ ] **Voice Answers**: Speak answers (accessibility + engagement)

### Gamification Ideas
- **XP System**: Earn points for completing quizzes
- **Levels**: Unlock advanced quizzes by completing basics
- **Streaks**: Daily quiz streak counter
- **Challenges**: Weekly/monthly challenges with prizes
- **Profile Badges**: Display achievements on profile
- **Topic Mastery**: Track expertise in different AI topics

## Security Considerations

### Backend
- Rate limiting on quiz attempts (prevent cheating/spam)
- Validate all answers server-side
- Don't expose correct answers in API until after submission
- Authentication required for quiz attempts
- Prevent rapid-fire answer submissions

### Frontend
- Disable network tab inspection benefits (obfuscate)
- Timer validation on backend (prevent time manipulation)
- Secure cookie storage for in-progress attempts
- No localStorage for sensitive data

## Testing Strategy

### Unit Tests
- Test swipe gesture detection
- Test score calculation
- Test answer validation
- Test component rendering

### Integration Tests
- Test quiz flow start-to-finish
- Test API integration
- Test error handling
- Test state management

### E2E Tests (Playwright)
```typescript
test('complete a quiz successfully', async ({ page }) => {
  await page.goto('/quizzes');
  await page.click('text=Top AI Agent Frameworks');
  await page.click('text=Start Quiz');
  
  // Answer questions
  for (let i = 0; i < 10; i++) {
    await page.locator('.quiz-card').swipe('right');
    await page.waitForTimeout(500);
  }
  
  // Check results
  await expect(page.locator('.quiz-results')).toBeVisible();
  await expect(page.locator('.score')).toContainText('/10');
});
```

### Manual Testing Checklist
- [ ] Swipe gestures work smoothly on mobile
- [ ] Animations are 60fps
- [ ] Progress saves if user navigates away
- [ ] Results display correctly
- [ ] Explanations are helpful and clear
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Works on desktop browsers

## Migration & Deployment

### Database Migrations
```bash
# Backend
python manage.py makemigrations
python manage.py migrate

# Add initial quiz data
python manage.py loaddata initial_quizzes.json
```

### Frontend Deployment
- Build frontend: `npm run build`
- No localStorage usage (per project rules)
- Test with production API
- Monitor bundle size
- Check performance metrics

### Rollout Strategy
1. **Internal Testing**: Team tests all features
2. **Beta Release**: Limited users, gather feedback
3. **Soft Launch**: Feature available, not heavily promoted
4. **Full Launch**: Announce to all users, marketing push
5. **Iteration**: Collect data, improve based on usage

## Documentation Needs

### User-Facing
- [ ] "How to Take Quizzes" guide
- [ ] FAQ about scoring and progress
- [ ] Tips for best quiz experience

### Developer-Facing
- [ ] Component API documentation
- [ ] Quiz creation guide for admins
- [ ] API endpoint documentation
- [ ] Contribution guide for new quiz content

## Dependencies

### Frontend
```json
{
  "dependencies": {
    "react-spring": "^9.7.3",
    "@use-gesture/react": "^10.3.0"
  }
}
```

### Backend
```python
# requirements.txt (already have these)
Django>=4.2
djangorestframework>=3.14
```

## Timeline Summary

**Total Estimated Time: 3-4 days**

- **Day 1**: Foundation + Quiz Components (Phase 1-2)
- **Day 2**: Backend Integration + API (Phase 3-4)
- **Day 2-3**: Pages & Routing (Phase 5)
- **Day 3**: Content Creation (Phase 6)
- **Day 3-4**: Polish & Testing (Phase 7)

## Questions to Resolve

- [ ] Should quiz attempts be anonymous or require login?
- [ ] Should we show leaderboards initially or in phase 2?
- [ ] What's the policy on retaking quizzes? Unlimited?
- [ ] Should we track time per question for analytics?
- [ ] Do we want sound effects or purely visual feedback?
- [ ] Should hints cost anything (points, limited use)?

## References

- **React Spring Docs**: https://react-spring.dev/
- **Use-Gesture Docs**: https://use-gesture.netlify.app/
- **TanStack Query**: https://tanstack.com/query/latest
- **Swipe Interaction Patterns**: https://www.nngroup.com/articles/swipe-gesture/

## Changelog

- **2025-11-19**: Initial planning document created
- **TBD**: Implementation started
- **TBD**: Phase 1 completed
- **TBD**: First quiz published

---

**Document Status**: Planning Phase  
**Last Updated**: 2025-11-19  
**Owner**: AllThrive AI Team  
**Next Review**: After Phase 1 completion
