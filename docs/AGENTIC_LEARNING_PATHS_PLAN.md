# Agentic Learning Paths Implementation Plan

## Vision

Transform Ember into a **proactive, adaptive learning mentor** that:
- Celebrates skills as users learn them in real-time
- Nudges contextually ("I saw you looked at Midjourney...")
- Teaches conversationally within chat
- Tracks progress in a persistent learner profile
- Works seamlessly with `/learn` as a discovery hub

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER EXPERIENCE                          │
├─────────────────────────────────────────────────────────────────┤
│  EmberHomePage ←→ /learn Page ←→ Any Page (contextual nudges)   │
│       ↓                ↓                    ↓                   │
│  [IntelligentChatPanel with learning message types]             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND AGENTS                              │
├─────────────────────────────────────────────────────────────────┤
│  Orchestrator → Learning Intent Detection → Ember Learning Agent│
│                                                ↓                │
│                              [Adaptive Difficulty + Memory]     │
│                                                ↓                │
│                              [Micro-Lesson Generator (LLM)]     │
│                                                ↓                │
│                              [Project Content Ranker]           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  LearnerProfile │ UserConceptMastery │ LearningEvent │ Concept  │
│  ProjectLearningMetadata                                        │
│       ↓                   ↓                  ↓                  │
│  [Redis Cache]     [PostgreSQL]       [Celery Tasks]            │
└─────────────────────────────────────────────────────────────────┘
```

## Content Hierarchy (3-Tier Hybrid)

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: AI-GENERATED (Instant, infinite coverage)              │
│ • Ember generates lessons on-the-fly for any topic             │
│ • Personalized to user's skill level and learning style        │
│ • Fallback when no curated/project content exists              │
├─────────────────────────────────────────────────────────────────┤
│ TIER 2: HIGHLY-RATED USER PROJECTS (Learn from real examples)  │
│ • Top-rated projects from the showcase become learning content │
│ • "Learn how @sarahcodes built this RAG chatbot"              │
│ • Quality threshold: 4+ stars AND 10+ views to feature         │
│ • Projects with detailed descriptions/architecture preferred   │
│ • Creator earns XP when their project is used for learning     │
├─────────────────────────────────────────────────────────────────┤
│ TIER 3: CURATED (Admin-authored, highest quality)              │
│ • Official AllThrive lessons for core topics                   │
│ • Your hand-picked external content                            │
│ • Always prioritized over AI/projects for covered topics       │
└─────────────────────────────────────────────────────────────────┘
```

### How Projects Become Learning Content

When Ember teaches a concept, it can reference highly-rated user projects:

```
User: "Teach me about RAG pipelines"

Ember: "Great choice! RAG (Retrieval-Augmented Generation) is how
you give AI access to your own documents. Let me explain the basics,
then show you a real example from our community.

[Concept explanation...]

Here's a great example from @sarahcodes - their 'DocuChat' project
implements RAG beautifully:

┌─────────────────────────────────────────────────────────────┐
│ 📁 DocuChat by @sarahcodes           ⭐ 4.9 (47 ratings)    │
│ "Chat with your documents using RAG"                        │
│                                                             │
│ Key concepts demonstrated:                                  │
│ • Vector embeddings with OpenAI                            │
│ • Pinecone for similarity search                           │
│ • Context window management                                 │
│                                                             │
│ [View Project]  [Learn from Architecture]                   │
└─────────────────────────────────────────────────────────────┘

Want me to walk through how they structured their pipeline?"
```

---

## Phase 1: Data Foundation (Backend)

### New Django App: `core/learning/`

#### Models

```python
# core/learning/models.py

class LearnerProfile(models.Model):
    """Central learning profile that adapts over time."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='learner_profile')

    # Learning preferences (inferred over time)
    preferred_learning_style = models.CharField(max_length=20, default='mixed')  # visual, hands_on, conceptual, mixed
    current_difficulty_level = models.CharField(max_length=20, default='beginner')
    preferred_session_length = models.IntegerField(default=5)  # minutes

    # Notification preferences
    allow_proactive_suggestions = models.BooleanField(default=True)
    proactive_cooldown_minutes = models.IntegerField(default=10)

    # Streaks & engagement
    learning_streak_days = models.IntegerField(default=0)
    last_learning_activity = models.DateTimeField(null=True)
    last_proactive_nudge = models.DateTimeField(null=True)

    # Stats
    total_lessons_completed = models.IntegerField(default=0)
    total_concepts_mastered = models.IntegerField(default=0)
    total_learning_minutes = models.IntegerField(default=0)


class Concept(models.Model):
    """A learnable concept in the knowledge graph."""
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    topic = models.CharField(max_length=50)  # Maps to learning path topic
    tool = models.ForeignKey('tools.Tool', null=True, blank=True, on_delete=models.SET_NULL)

    base_difficulty = models.CharField(max_length=20, default='beginner')
    estimated_minutes = models.IntegerField(default=5)

    # For prerequisite relationships
    prerequisites = models.ManyToManyField('self', symmetrical=False, blank=True)


class UserConceptMastery(models.Model):
    """Tracks user mastery of each concept."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='concept_masteries')
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE)

    MASTERY_LEVELS = [('unknown', 'Unknown'), ('aware', 'Aware'), ('learning', 'Learning'),
                      ('practicing', 'Practicing'), ('proficient', 'Proficient'), ('mastered', 'Mastered')]
    mastery_level = models.CharField(max_length=20, choices=MASTERY_LEVELS, default='unknown')
    mastery_score = models.FloatField(default=0.0)  # 0.0-1.0

    # Spaced repetition
    last_practiced = models.DateTimeField(null=True)
    next_review_at = models.DateTimeField(null=True)
    consecutive_correct = models.IntegerField(default=0)

    class Meta:
        unique_together = ['user', 'concept']


class MicroLesson(models.Model):
    """Template for lessons Ember can deliver (hybrid: pre-authored + AI-enhanced)."""
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE)

    LESSON_TYPES = [('explanation', 'Explanation'), ('example', 'Example'),
                    ('practice', 'Practice'), ('tip', 'Quick Tip')]
    lesson_type = models.CharField(max_length=20, choices=LESSON_TYPES)

    # Content (can be template with placeholders for AI personalization)
    content_template = models.TextField()
    follow_up_prompts = models.JSONField(default=list)

    difficulty = models.CharField(max_length=20, default='beginner')
    estimated_minutes = models.IntegerField(default=3)
    is_ai_generated = models.BooleanField(default=False)  # Track hybrid content


class ProjectLearningMetadata(models.Model):
    """
    Learning-specific metadata for highly-rated user projects.
    Links projects to concepts they demonstrate for learning purposes.
    """
    project = models.OneToOneField('projects.Project', on_delete=models.CASCADE, related_name='learning_metadata')

    # Concepts this project demonstrates
    concepts = models.ManyToManyField(Concept, related_name='example_projects')

    # Learning quality signals (auto-calculated from project stats)
    is_learning_eligible = models.BooleanField(default=False)  # 4+ stars, 10+ views, good description
    learning_quality_score = models.FloatField(default=0.0)

    # What makes this project educational
    key_techniques = ArrayField(models.CharField(max_length=100), default=list)  # ["RAG", "Vector Search", "Streaming"]
    complexity_level = models.CharField(max_length=20, default='intermediate')

    # Usage tracking
    times_used_for_learning = models.IntegerField(default=0)
    last_used_for_learning = models.DateTimeField(null=True)

    class Meta:
        ordering = ['-learning_quality_score']

    def calculate_eligibility(self):
        """Check if project qualifies as learning content."""
        project = self.project
        has_good_rating = project.avg_rating >= 4.0 and project.rating_count >= 5
        has_views = project.view_count >= 10
        has_description = len(project.description or '') >= 100
        has_architecture = bool(project.architecture_diagram)

        self.is_learning_eligible = has_good_rating and has_views and has_description
        # Bonus for architecture diagrams
        self.learning_quality_score = (
            (project.avg_rating / 5.0) * 0.4 +
            min(project.view_count / 100, 1.0) * 0.2 +
            (1.0 if has_architecture else 0.0) * 0.2 +
            (1.0 if has_description else 0.0) * 0.2
        )


class LearningEvent(models.Model):
    """Unified event stream for learning activities."""
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    EVENT_TYPES = [('quiz_attempt', 'Quiz'), ('micro_lesson', 'Micro Lesson'),
                   ('tool_explore', 'Tool Explored'), ('concept_mastered', 'Concept Mastered'),
                   ('skill_level_up', 'Skill Level Up')]
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)

    concept = models.ForeignKey(Concept, null=True, on_delete=models.SET_NULL)
    was_successful = models.BooleanField(null=True)
    payload = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
```

#### Services

```python
# core/learning/services.py

class LearnerMemory:
    """Two-tier memory: Redis hot cache + PostgreSQL persistence."""
    CACHE_PREFIX = 'learner:'
    CACHE_TTL = 3600

    @classmethod
    async def get_profile(cls, user_id: int) -> dict: ...

    @classmethod
    async def update_after_learning_event(cls, user_id: int, event: LearningEvent): ...

    @classmethod
    async def check_proactive_cooldown(cls, user_id: int) -> bool: ...


class AdaptiveDifficultyService:
    """Real-time difficulty adjustment."""

    @classmethod
    def calculate_next_difficulty(cls, current: str, consecutive_correct: int,
                                   consecutive_incorrect: int) -> str: ...

    @classmethod
    async def get_recommended_difficulty(cls, user_id: int, topic: str = None) -> str: ...


class MicroLessonService:
    """Generates lessons - 3-tier hybrid approach."""

    @classmethod
    async def get_best_lesson(cls, concept: Concept, user_profile: dict) -> dict:
        """
        Get best available lesson using 3-tier hierarchy:
        1. Curated (official) content - always preferred
        2. Highly-rated user projects demonstrating the concept
        3. AI-generated on-the-fly
        """
        # Tier 1: Check for curated content
        curated = await MicroLesson.objects.filter(
            concept=concept, is_ai_generated=False
        ).afirst()
        if curated:
            return {'source': 'curated', 'lesson': cls._personalize_lesson(curated, user_profile)}

        # Tier 2: Check for highly-rated projects demonstrating this concept
        project_metadata = await ProjectLearningMetadata.objects.filter(
            concepts=concept,
            is_learning_eligible=True
        ).select_related('project', 'project__user').order_by('-learning_quality_score').afirst()

        if project_metadata:
            return {
                'source': 'project',
                'project': project_metadata.project,
                'author': project_metadata.project.user,
                'key_techniques': project_metadata.key_techniques,
                'complexity': project_metadata.complexity_level
            }

        # Tier 3: Generate with AI
        generated = await cls._generate_with_llm(concept, user_profile)
        return {'source': 'ai_generated', 'lesson': generated}


class ProjectLearningService:
    """Manages projects as learning content."""

    @classmethod
    async def sync_learning_eligibility(cls):
        """Celery task: Recalculate learning eligibility for all projects."""
        # Get all projects with good ratings
        projects = await Project.objects.filter(
            avg_rating__gte=4.0,
            rating_count__gte=5,
            is_public=True
        ).aall()

        for project in projects:
            metadata, _ = await ProjectLearningMetadata.objects.aget_or_create(project=project)
            metadata.calculate_eligibility()
            await metadata.asave()

    @classmethod
    async def get_projects_for_concept(cls, concept: Concept, limit: int = 5) -> list:
        """Get top projects demonstrating a concept."""
        return await ProjectLearningMetadata.objects.filter(
            concepts=concept,
            is_learning_eligible=True
        ).select_related('project').order_by('-learning_quality_score')[:limit].aall()

    @classmethod
    async def record_learning_usage(cls, project_id: int, user_id: int):
        """Record when a project is used for learning (awards XP to creator)."""
        metadata = await ProjectLearningMetadata.objects.filter(project_id=project_id).afirst()
        if metadata:
            metadata.times_used_for_learning += 1
            metadata.last_used_for_learning = timezone.now()
            await metadata.asave()

            # Award XP to project creator
            project = await Project.objects.aget(id=project_id)
            if project.user_id != user_id:  # Don't award for viewing own project
                await cls._award_creator_xp(project.user_id, 'project_used_for_learning', 5)

    @classmethod
    async def tag_project_concepts(cls, project_id: int, concept_ids: list[int]):
        """Admin/AI tool: Tag a project with concepts it demonstrates."""
        metadata, _ = await ProjectLearningMetadata.objects.aget_or_create(project_id=project_id)
        await metadata.concepts.aset(concept_ids)
        metadata.calculate_eligibility()
        await metadata.asave()
```

#### API Endpoints

```
# Learner Profile
GET  /api/v1/me/learner-profile/              # Get learner profile
PUT  /api/v1/me/learner-profile/              # Update preferences
GET  /api/v1/me/concept-mastery/              # Get all mastery levels
GET  /api/v1/me/knowledge-gaps/               # Get identified gaps
POST /api/v1/me/learning-events/              # Record learning event
GET  /api/v1/me/learning-suggestions/         # Get proactive suggestions

# Lessons (3-tier)
POST /api/v1/lessons/{concept_slug}/start/    # Start best available lesson
GET  /api/v1/lessons/{concept_slug}/          # Get lesson by concept

# Projects as Learning Content
GET  /api/v1/learning/projects/               # List top learning-eligible projects
GET  /api/v1/learning/projects/{slug}/        # Get project with learning metadata
GET  /api/v1/concepts/{slug}/projects/        # Get projects demonstrating a concept
POST /api/v1/learning/projects/{slug}/used/   # Record project was used for learning (awards creator XP)

# Creator Dashboard (projects used for learning)
GET  /api/v1/me/learning-impact/              # Stats: how many times your projects helped others learn

# Admin (project-concept tagging)
POST /api/v1/admin/projects/{slug}/tag-concepts/  # Tag project with concepts it demonstrates
POST /api/v1/admin/projects/sync-eligibility/     # Recalculate learning eligibility for all projects
```

---

## Phase 2: AI Agent Enhancement

### Enhanced Learning Agent

```python
# services/agents/ember_learning/agent.py

EMBER_LEARNING_PROMPT = """You are Ember, a warm and wise AI learning mentor.

## Your Personality
- Warm and encouraging - celebrate every success
- Patient - never make users feel bad about not knowing
- Adaptive - adjust explanations to their level
- Proactive - notice opportunities to help learn

## Proactive Behaviors
1. **Real-time celebration**: "You just learned about {concept}! That's awesome!"
2. **Contextual nudges**: "I noticed you were looking at Midjourney - want to learn about AI image generation?"
3. **Gap filling**: "You did great on that quiz, but I noticed {concept} was tricky. Want me to explain it?"

## Teaching Approach
- Use the Socratic method - guide discovery through questions
- Break complex concepts into digestible pieces
- Use analogies and real-world examples
- Always offer a "next step" without being pushy
"""

class EmberLearningState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_id: int
    learner_profile: dict | None
    current_topic: str | None
    session_intent: str | None  # 'learning' | 'exploring' | 'chatting'
    difficulty_level: str
    should_suggest_learning: bool
```

### New Learning Tools

```python
# services/agents/ember_learning/tools.py

@tool
def generate_micro_lesson(topic: str, skill_level: str, format: str = 'conversational') -> dict:
    """Generate a personalized micro-lesson on any topic."""

@tool
def start_conversational_quiz(topic: str, question_count: int = 3) -> dict:
    """Start an interactive quiz with Ember guiding through questions."""

@tool
def check_answer_and_explain(session_id: str, answer: str) -> dict:
    """Evaluate answer, provide explanation, adjust difficulty."""

@tool
def celebrate_learning_milestone(user_id: int, milestone_type: str, details: dict) -> dict:
    """Generate celebration message for skill learned, streak, level up."""

@tool
def get_contextual_learning_nudge(user_id: int, current_page: str, recent_actions: list) -> dict:
    """Generate context-aware learning suggestion."""
```

### Proactive Trigger System

```python
# services/agents/ember_learning/triggers.py

class ProactiveTriggers:
    """When Ember should proactively engage about learning."""

    TRIGGER_TYPES = {
        'skill_learned': {'cooldown': 0, 'priority': 10},      # Immediate celebration
        'quiz_completed': {'cooldown': 0, 'priority': 9},      # Immediate next step
        'tool_viewed': {'cooldown': 600, 'priority': 5},       # 10 min cooldown
        'gap_detected': {'cooldown': 1800, 'priority': 7},     # 30 min cooldown
        'reengagement': {'cooldown': 86400, 'priority': 3},    # Daily max
    }

    @classmethod
    async def evaluate(cls, user_id: int, trigger_type: str, context: dict) -> dict | None:
        """Check if trigger should fire (respecting cooldowns)."""
```

---

## Phase 3: Frontend Chat Integration

### Extended Message Types

```typescript
// frontend/src/types/chat.ts

export interface LearningChatMetadata extends IntelligentChatMetadata {
  type?:
    | 'lesson_intro'        // Start of micro-lesson
    | 'lesson_concept'      // Teaching content block
    | 'lesson_checkpoint'   // Quick comprehension check
    | 'lesson_complete'     // Summary + XP earned
    | 'quiz_embed'          // Interactive quiz question
    | 'quiz_result'         // Answer feedback
    | 'progress_celebration' // Skill learned, level up, streak
    | 'learning_nudge';     // Proactive suggestion

  // Lesson fields
  lessonId?: string;
  conceptNumber?: number;
  totalConcepts?: number;

  // Quiz fields
  quizQuestion?: { id: string; question: string; type: 'true_false' | 'multiple_choice'; options?: string[] };

  // Celebration fields
  xpEarned?: number;
  newSkillLevel?: string;
  streakDays?: number;
}
```

### New Components

```
frontend/src/components/chat/learning/
├── LessonIntroMessage.tsx      # "Let's learn about X!" with objectives
├── LessonConceptCard.tsx       # Teaching content with markdown
├── LessonCheckpointCard.tsx    # Quick quiz question mid-lesson
├── LessonCompleteCard.tsx      # Summary, XP, next steps
├── EmbeddedQuizCard.tsx        # Interactive quiz in chat
├── QuizResultCard.tsx          # Correct/incorrect with explanation
├── ProgressCelebration.tsx     # "You learned a skill!" celebration
├── LearningNudgeCard.tsx       # "I noticed you looked at..." suggestion
└── SkillProgressRing.tsx       # Visual skill level indicator
```

### useLearningChat Hook

```typescript
// frontend/src/hooks/useLearningChat.ts

export function useLearningChat(options?: UseLearningChatOptions) {
  const [learningState, setLearningState] = useState<'idle' | 'lesson' | 'quiz' | 'celebration'>('idle');
  const [currentLesson, setCurrentLesson] = useState<LessonProgress | null>(null);

  const startLesson = useCallback(async (topic: string) => { ... });
  const advanceConcept = useCallback(() => { ... });
  const submitQuizAnswer = useCallback((answer: string) => { ... });

  return {
    learningState,
    currentLesson,
    startLesson,
    advanceConcept,
    submitQuizAnswer,
    isLearningActive: learningState !== 'idle',
  };
}
```

---

## Phase 4: Project-Based Learning UI

### Learn from Projects in Chat

When Ember teaches a concept, it can reference highly-rated user projects:

```
┌─────────────────────────────────────────────────────────────────┐
│ Ember: "Here's a great example of RAG in action!"              │
│                                                                 │
│ [ProjectLearningCard]                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📁 DocuChat                        ⭐ 4.9 (47)              │ │
│ │ by @sarahcodes                                              │ │
│ │                                                             │ │
│ │ "Chat with your documents using RAG"                        │ │
│ │                                                             │ │
│ │ Demonstrates: RAG • Vector Search • Streaming               │ │
│ │                                                             │ │
│ │ [View Project]  [Walk me through it]                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ "Want me to explain how they structured their retrieval?"      │
└─────────────────────────────────────────────────────────────────┘
```

### New Components

```
frontend/src/components/learning/projects/
├── ProjectLearningCard.tsx     # Project card optimized for learning context
├── ProjectTechniquesTag.tsx    # Shows techniques: "RAG", "Vector Search"
├── LearningSourceBadge.tsx     # Shows "Project" / "Official" / "AI" badge
├── CreatorAttribution.tsx      # "by @username" with avatar and link
└── LearningImpactStats.tsx     # For creators: "Your projects helped 47 people learn"
```

### /learn Page Integration

```
┌── Learn from the Community ──────────────────────────────────────┐
│ Top-rated projects that demonstrate key AI concepts             │
│                                                                 │
│ [ProjectLearningCard]  [ProjectLearningCard]  [ProjectLearningCard]
│  DocuChat by @sarah     AIComposer by @mike    PromptLib by @alex
│  RAG • Embeddings       Music Gen • Diffusion  Templates • API
│  ⭐ 4.9 (47)            ⭐ 4.8 (32)            ⭐ 4.7 (28)
│                                                                 │
│                                              [Browse all →]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: /learn Page Redesign

Transform the placeholder page into a learning discovery hub:

```
┌─────────────────────────────────────────────────────────────────┐
│ Learn with Ember                                                │
│ "Your personalized AI learning companion"                       │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Compact Ember Chat]                                        │ │
│ │ 🐉 "What would you like to learn today?"                    │ │
│ │ [Ask Ember to teach you something...]              [Send]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌── Continue Learning ────────────────────────────────────────┐ │
│ │ 📚 "Prompt Engineering" - 2/4 concepts    [Resume]          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌── Your Learning Paths ──────────────────────────────────────┐ │
│ │ [PromptEng: 65%] [ChatGPT: 25%] [AI Ethics: 0%] [+ Start]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌── Recommended For You ──────────────────────────────────────┐ │
│ │ Based on your Midjourney exploration...                     │ │
│ │ [Multi-modal AI] [Image Prompts] [Diffusion Models]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌── Quick Quizzes ────────────────────────────────────────────┐ │
│ │ [AI Ethics Quiz] [ChatGPT Quiz] [Prompt Quiz]   [See all →] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🔥 5-day streak │ ⭐ 1,250 XP │ 📚 12 lessons │ 🏆 8 quizzes    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order (Chat-First MVP)

### Sprint 1: Backend Foundation (3-4 days)
1. Create `core/learning/` Django app with models (LearnerProfile, Concept, UserConceptMastery, ProjectLearningMetadata)
2. Create migrations and seed initial concepts from tools/topics
3. Implement `LearnerMemory` service with Redis caching
4. Add API endpoints for profile and events
5. Extend existing quiz completion to emit learning events

### Sprint 2: Agent Enhancement (3-4 days)
1. Enhance learning agent with new tools (generate_micro_lesson, conversational_quiz)
2. Implement `MicroLessonService` with 3-tier hierarchy (curated → projects → AI)
3. Add `ProactiveTriggers` system for real-time celebrations and contextual nudges
4. Integrate learner profile into agent context
5. Update supervisor routing for learning intent

### Sprint 3: Chat UI (4-5 days)
1. Add new message types to `LearningChatMetadata`
2. Create `useLearningChat` hook
3. Build core components: `LessonConceptCard`, `EmbeddedQuizCard`, `ProgressCelebration`
4. Extend `IntelligentChatPanel` to render learning messages
5. Wire up WebSocket events for learning flow

### Sprint 4: Project-Based Learning (3-4 days)
1. Implement `ProjectLearningService` for syncing project eligibility
2. Build `ProjectLearningCard` component for chat
3. Add "Learn from Projects" section to `/learn` page
4. Create `LearningImpactStats` for creators (your projects helped X people learn)
5. Add admin UI for tagging projects with concepts

### Sprint 5: /learn Page & Polish (3-4 days)
1. Redesign `/learn` page with embedded Ember chat
2. Add "Continue Learning" banner
3. Integrate learning paths display with progress visualization
4. Add contextual nudge UI components
5. Skill progress visualization and streak tracking

---

## Critical Files to Modify

### Backend
| File | Changes |
|------|---------|
| `core/learning/models.py` | New - All learning models |
| `core/learning/services.py` | New - LearnerMemory, AdaptiveDifficulty, MicroLessonService |
| `core/learning/views.py` | New - API endpoints |
| `services/agents/learning/agent.py` | Enhance with new tools and proactive behaviors |
| `services/agents/learning/tools.py` | Add micro-lesson, quiz, celebration tools |
| `services/agents/orchestrator/supervisor.py` | Enhanced learning intent detection |
| `core/quizzes/models.py` | Add signal to emit learning events on completion |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/types/chat.ts` | Extend with learning message types |
| `frontend/src/hooks/useLearningChat.ts` | New - Learning state management |
| `frontend/src/hooks/useIntelligentChat.ts` | Handle new WebSocket events |
| `frontend/src/components/chat/IntelligentChatPanel.tsx` | Render learning message types |
| `frontend/src/components/chat/learning/*.tsx` | New - All learning components |
| `frontend/src/pages/LearnPage.tsx` | Redesign with Ember integration |

---

## Success Metrics

1. **Learning Engagement**: Track lessons started vs completed
2. **Proactive Acceptance Rate**: % of nudges users engage with (target: >30%)
3. **Skill Progression**: Users advancing skill levels per week
4. **Streak Retention**: % of users maintaining learning streaks
5. **Qualitative**: User feedback on Ember as mentor

---

## Open Questions for Future

- [ ] Should concepts auto-import from Tools database?
- [ ] How to handle content moderation for AI-generated lessons?
- [ ] Browser extension for tracking tool usage outside platform?
- [ ] Leaderboards for learning progress?
