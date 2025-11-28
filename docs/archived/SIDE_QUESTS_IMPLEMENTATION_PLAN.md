# Side Quests Landing Page - Implementation Plan

## Overview
Build a personalized, AI-powered landing page for interactive learning quests with smart recommendations, semantic search, and social integration.

## Design Philosophy

### Personalization Strategy
The Side Quests page will use an intelligent recommendation system similar to modern social media feeds, showing users:
- **Difficulty-matched content** based on their skill level and history
- **Social integration** with Thrive Circle (what friends are doing)
- **Popularity signals** (trending quests this week)
- **Learning path progression** (guided skill development)
- **Tag-based preferences** (topics and skills users care about)

### Access Model
**Hybrid unlock system:**
- Most quests available immediately (low barrier to entry)
- Advanced/competitive quests require completing prerequisite quests
- Clear visual indicators for locked content with unlock requirements
- Celebration animations when unlocking new content

### Search Strategy
**Semantic AI search** powered by Weaviate:
- Natural language queries ("how to write better prompts")
- Finds relevant quests based on meaning, not just keywords
- Consistent with Explore page experience
- Tag and metadata enrichment for better results

## Phase 1: Backend Foundation (Priority 1)

### 1.1 Database Models

Create `core/side_quests/models.py` with the following models:

#### SideQuest Model
```python
class SideQuest(models.Model):
    """Main model for interactive learning quests"""

    TYPE_CHOICES = [
        ('educational', 'Educational'),
        ('project', 'Project-Based'),
        ('creative', 'Creative/Experimental'),
        ('competitive', 'Competitive/Social'),
        ('meta', 'Meta/Learning'),
    ]

    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    # Core fields
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField()
    learning_outcomes = models.JSONField(default=list)  # List of outcomes

    # Classification
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    category = models.CharField(max_length=100)  # More specific categorization
    tags = models.ManyToManyField('SideQuestTag', related_name='quests')

    # Mechanics
    estimated_time = models.IntegerField(help_text="Estimated time in minutes")
    xp_reward = models.IntegerField(default=100)
    prerequisites = models.ManyToManyField('self', blank=True, symmetrical=False)
    is_locked = models.BooleanField(default=False)

    # Media
    thumbnail_url = models.URLField(blank=True)
    cover_image_url = models.URLField(blank=True)

    # Engagement metrics
    popularity_score = models.FloatField(default=0.0)
    completion_count = models.IntegerField(default=0)
    average_rating = models.FloatField(default=0.0)

    # Search
    weaviate_indexed = models.BooleanField(default=False)
    weaviate_id = models.CharField(max_length=255, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-popularity_score', 'title']
        indexes = [
            models.Index(fields=['type', 'difficulty']),
            models.Index(fields=['-popularity_score']),
        ]
```

#### SideQuestProgress Model
```python
class SideQuestProgress(models.Model):
    """Track user progress on quests"""

    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quest_progress')
    quest = models.ForeignKey(SideQuest, on_delete=models.CASCADE, related_name='user_progress')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    progress_data = models.JSONField(default=dict)  # Quest-specific progress data
    progress_percentage = models.IntegerField(default=0)

    started_at = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'quest']
        indexes = [
            models.Index(fields=['user', 'status']),
        ]
```

#### SideQuestCompletion Model
```python
class SideQuestCompletion(models.Model):
    """Record quest completions and achievements"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quest_completions')
    quest = models.ForeignKey(SideQuest, on_delete=models.CASCADE, related_name='completions')

    completed_at = models.DateTimeField(auto_now_add=True)
    time_taken = models.IntegerField(help_text="Time taken in minutes")
    score = models.IntegerField(null=True, blank=True)

    achievements_earned = models.JSONField(default=list)
    xp_earned = models.IntegerField()

    # Quality metrics
    efficiency_score = models.FloatField(null=True, blank=True)
    user_rating = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])

    class Meta:
        unique_together = ['user', 'quest']
        indexes = [
            models.Index(fields=['-completed_at']),
        ]
```

#### SideQuestTag Model
```python
class SideQuestTag(models.Model):
    """Tags for categorizing and filtering quests"""

    TAG_CATEGORY_CHOICES = [
        ('skill', 'Skill'),
        ('topic', 'Topic'),
        ('tool', 'Tool'),
        ('outcome', 'Learning Outcome'),
    ]

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    category = models.CharField(max_length=20, choices=TAG_CATEGORY_CHOICES)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
```

#### LearningPath Model
```python
class LearningPath(models.Model):
    """Curated sequences of quests for skill development"""

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField()

    difficulty_level = models.CharField(max_length=20, choices=SideQuest.DIFFICULTY_CHOICES)
    quests = models.ManyToManyField(SideQuest, through='LearningPathQuest')

    estimated_total_time = models.IntegerField(help_text="Total time in minutes")
    total_xp = models.IntegerField()

    thumbnail_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

class LearningPathQuest(models.Model):
    """Through model for ordering quests in learning paths"""

    learning_path = models.ForeignKey(LearningPath, on_delete=models.CASCADE)
    quest = models.ForeignKey(SideQuest, on_delete=models.CASCADE)
    order = models.IntegerField()

    class Meta:
        ordering = ['order']
        unique_together = ['learning_path', 'quest']
```

### 1.2 API Endpoints

Create ViewSets in `core/side_quests/views.py`:

#### Quest ViewSet
```python
class SideQuestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve side quests with filtering

    Filters:
    - difficulty: beginner, intermediate, advanced
    - type: educational, project, creative, competitive, meta
    - tags: comma-separated tag slugs
    - status: available, in_progress, completed, locked
    - time_max: maximum estimated time in minutes
    """
    queryset = SideQuest.objects.filter(is_active=True)
    serializer_class = SideQuestSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def recommended(self, request):
        """Get personalized quest recommendations"""
        quests = get_recommended_quests(request.user)
        serializer = self.get_serializer(quests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start a quest"""
        quest = self.get_object()
        # Check prerequisites
        # Create or update progress record
        # Return quest details with progress
        pass

    @action(detail=False, methods=['post'])
    def semantic_search(self, request):
        """Semantic search using Weaviate"""
        query = request.data.get('query')
        results = search_quests_semantic(query)
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)
```

#### Endpoints Structure
```
GET    /api/v1/side-quests/                      # List all quests with filters
GET    /api/v1/side-quests/recommended/          # Personalized recommendations
GET    /api/v1/side-quests/{slug}/               # Quest details
POST   /api/v1/side-quests/{slug}/start/         # Start a quest
POST   /api/v1/side-quests/semantic-search/      # Semantic search
GET    /api/v1/learning-paths/                   # List learning paths
GET    /api/v1/learning-paths/{slug}/            # Path details
GET    /api/v1/me/quest-progress/                # User's progress on all quests
PATCH  /api/v1/me/quest-progress/{quest_id}/     # Update progress
POST   /api/v1/me/quest-progress/{quest_id}/complete/  # Complete quest
```

### 1.3 Recommendation Algorithm

Create `core/side_quests/recommendations.py`:

```python
def get_recommended_quests(user, limit=30):
    """
    Generate personalized quest recommendations

    Factors:
    1. User skill level (from quiz/quest history)
    2. Thrive Circle activity (what connections are doing)
    3. Learning path next steps
    4. Tag preferences (from user interests)
    5. Time-based filtering (user's typical session length)
    6. Popularity boost (trending quests)
    7. Novelty (quests user hasn't seen)
    """

    # Get user's skill level
    user_level = calculate_user_skill_level(user)

    # Get Thrive Circle activity
    circle_quests = get_thrive_circle_quests(user)

    # Get learning path recommendations
    path_quests = get_learning_path_next_quests(user)

    # Get tag-based recommendations
    tag_preferences = get_user_tag_preferences(user)
    tag_quests = SideQuest.objects.filter(tags__in=tag_preferences)

    # Get trending quests
    trending = get_trending_quests()

    # Combine with weighted scoring
    scored_quests = []

    for quest in SideQuest.objects.filter(is_active=True):
        score = 0.0

        # Difficulty match
        if quest.difficulty == user_level:
            score += 30

        # Circle activity
        if quest in circle_quests:
            score += 25

        # Learning path
        if quest in path_quests:
            score += 35

        # Tag match
        tag_overlap = quest.tags.filter(id__in=tag_preferences).count()
        score += tag_overlap * 10

        # Popularity
        score += quest.popularity_score * 5

        # Novelty (hasn't started)
        if not user.quest_progress.filter(quest=quest).exists():
            score += 15

        scored_quests.append((quest, score))

    # Sort by score and return top N
    scored_quests.sort(key=lambda x: x[1], reverse=True)
    return [q[0] for q in scored_quests[:limit]]


def get_thrive_circle_quests(user):
    """Get quests that user's Thrive Circle is doing"""
    # Get user's connections from Thrive Circle
    connections = user.thrive_circle_connections.all()

    # Get quests those users are working on
    recent_progress = SideQuestProgress.objects.filter(
        user__in=connections,
        status='in_progress',
        last_updated__gte=timezone.now() - timedelta(days=7)
    ).values_list('quest', flat=True)

    return SideQuest.objects.filter(id__in=recent_progress)


def get_trending_quests(days=7, limit=10):
    """Get quests with high recent activity"""
    cutoff = timezone.now() - timedelta(days=days)

    trending = SideQuest.objects.annotate(
        recent_starts=Count(
            'user_progress',
            filter=Q(user_progress__started_at__gte=cutoff)
        )
    ).order_by('-recent_starts')[:limit]

    return trending
```

### 1.4 Serializers

Create `core/side_quests/serializers.py`:

```python
class SideQuestSerializer(serializers.ModelSerializer):
    """Detailed quest information with user context"""

    tags = SideQuestTagSerializer(many=True, read_only=True)
    user_progress = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    unlock_requirements = serializers.SerializerMethodField()

    class Meta:
        model = SideQuest
        fields = [
            'id', 'slug', 'title', 'description', 'learning_outcomes',
            'type', 'difficulty', 'category', 'tags',
            'estimated_time', 'xp_reward',
            'thumbnail_url', 'cover_image_url',
            'popularity_score', 'completion_count', 'average_rating',
            'user_progress', 'is_locked', 'unlock_requirements'
        ]

    def get_user_progress(self, obj):
        user = self.context['request'].user
        try:
            progress = SideQuestProgress.objects.get(user=user, quest=obj)
            return {
                'status': progress.status,
                'progress_percentage': progress.progress_percentage,
                'started_at': progress.started_at,
            }
        except SideQuestProgress.DoesNotExist:
            return None

    def get_is_locked(self, obj):
        user = self.context['request'].user
        return not check_quest_unlocked(user, obj)

    def get_unlock_requirements(self, obj):
        if obj.prerequisites.exists():
            return [
                {'title': prereq.title, 'slug': prereq.slug}
                for prereq in obj.prerequisites.all()
            ]
        return []
```

## Phase 2: Frontend Core (Priority 1)

### 2.1 TypeScript Types

Create `frontend/src/types/sideQuest.ts`:

```typescript
export type QuestType = 'educational' | 'project' | 'creative' | 'competitive' | 'meta';
export type QuestDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type QuestStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';

export interface SideQuestTag {
  id: number;
  name: string;
  slug: string;
  category: 'skill' | 'topic' | 'tool' | 'outcome';
}

export interface SideQuest {
  id: number;
  slug: string;
  title: string;
  description: string;
  learning_outcomes: string[];

  type: QuestType;
  difficulty: QuestDifficulty;
  category: string;
  tags: SideQuestTag[];

  estimated_time: number;
  xp_reward: number;

  thumbnail_url?: string;
  cover_image_url?: string;

  popularity_score: number;
  completion_count: number;
  average_rating: number;

  user_progress?: {
    status: QuestStatus;
    progress_percentage: number;
    started_at: string;
  };

  is_locked: boolean;
  unlock_requirements: Array<{
    title: string;
    slug: string;
  }>;
}

export interface LearningPath {
  id: number;
  slug: string;
  name: string;
  description: string;
  difficulty_level: QuestDifficulty;
  quests: SideQuest[];
  estimated_total_time: number;
  total_xp: number;
  thumbnail_url?: string;
}

export interface QuestFilters {
  difficulty?: QuestDifficulty[];
  type?: QuestType[];
  tags?: string[];
  status?: QuestStatus[];
  time_max?: number;
  search?: string;
}
```

### 2.2 API Service

Create `frontend/src/services/sideQuests.ts`:

```typescript
import { api } from './api';
import type { SideQuest, LearningPath, QuestFilters } from '@/types/sideQuest';

interface QuestListResponse {
  results: SideQuest[];
  count: number;
  next: string | null;
  previous: string | null;
}

export async function getRecommendedQuests(): Promise<SideQuest[]> {
  const response = await api.get<SideQuest[]>('/side-quests/recommended/');
  return response.data;
}

export async function getSideQuests(filters?: QuestFilters): Promise<QuestListResponse> {
  const params = new URLSearchParams();

  if (filters?.difficulty?.length) {
    params.append('difficulty', filters.difficulty.join(','));
  }
  if (filters?.type?.length) {
    params.append('type', filters.type.join(','));
  }
  if (filters?.tags?.length) {
    params.append('tags', filters.tags.join(','));
  }
  if (filters?.status?.length) {
    params.append('status', filters.status.join(','));
  }
  if (filters?.time_max) {
    params.append('time_max', filters.time_max.toString());
  }

  const response = await api.get<QuestListResponse>('/side-quests/', { params });
  return response.data;
}

export async function getSideQuest(slug: string): Promise<SideQuest> {
  const response = await api.get<SideQuest>(`/side-quests/${slug}/`);
  return response.data;
}

export async function startQuest(slug: string): Promise<SideQuest> {
  const response = await api.post<SideQuest>(`/side-quests/${slug}/start/`);
  return response.data;
}

export async function semanticSearchQuests(query: string): Promise<SideQuest[]> {
  const response = await api.post<SideQuest[]>('/side-quests/semantic-search/', { query });
  return response.data;
}

export async function getLearningPaths(): Promise<LearningPath[]> {
  const response = await api.get<LearningPath[]>('/learning-paths/');
  return response.data;
}
```

### 2.3 SideQuestCard Component

Create `frontend/src/components/side-quests/SideQuestCard.tsx`:

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LockClosedIcon,
  ClockIcon,
  StarIcon,
  FireIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import type { SideQuest } from '@/types/sideQuest';

interface SideQuestCardProps {
  quest: SideQuest;
  variant?: 'default' | 'compact';
  showProgress?: boolean;
}

export function SideQuestCard({ quest, variant = 'default', showProgress = true }: SideQuestCardProps) {
  const [imageError, setImageError] = useState(false);

  const isCompact = variant === 'compact';

  // Difficulty color schemes
  const difficultyColors = {
    beginner: {
      gradient: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      badge: 'bg-green-500/20 text-green-300',
    },
    intermediate: {
      gradient: 'from-yellow-500/20 to-orange-500/20',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      badge: 'bg-yellow-500/20 text-yellow-300',
    },
    advanced: {
      gradient: 'from-red-500/20 to-pink-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      badge: 'bg-red-500/20 text-red-300',
    },
  };

  const colors = difficultyColors[quest.difficulty];

  // Type icons mapping
  const typeIcons = {
    educational: '📚',
    project: '🛠️',
    creative: '🎨',
    competitive: '⚔️',
    meta: '🧠',
  };

  const Component = quest.is_locked ? 'div' : Link;
  const linkProps = quest.is_locked ? {} : { to: `/play/side-quests/${quest.slug}` };

  return (
    <Component
      {...linkProps}
      className={`
        block group relative overflow-hidden rounded-2xl
        ${isCompact ? 'h-64' : 'min-h-80'}
        ${quest.is_locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-[1.02]'}
        transition-all duration-300
      `}
    >
      {/* Glassmorphism background */}
      <div className={`
        absolute inset-0 bg-gradient-to-br ${colors.gradient}
        backdrop-blur-xl border ${colors.border}
        transition-all duration-300
        group-hover:backdrop-blur-2xl
      `} />

      {/* Thumbnail */}
      {quest.thumbnail_url && !imageError ? (
        <div className={`relative ${isCompact ? 'h-32' : 'h-40'} overflow-hidden`}>
          <img
            src={quest.thumbnail_url}
            alt={quest.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        </div>
      ) : (
        <div className={`${isCompact ? 'h-32' : 'h-40'} bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
          <span className="text-6xl">{typeIcons[quest.type]}</span>
        </div>
      )}

      {/* Content */}
      <div className="relative p-4 space-y-3">
        {/* Header badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors.badge}`}>
            {quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)}
          </span>
          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/80">
            {quest.type.charAt(0).toUpperCase() + quest.type.slice(1)}
          </span>
          {quest.is_locked && (
            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-300 flex items-center gap-1">
              <LockClosedIcon className="w-3 h-3" />
              Locked
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-bold ${colors.text} ${isCompact ? 'text-lg' : 'text-xl'} line-clamp-2`}>
          {quest.title}
        </h3>

        {/* Description */}
        {!isCompact && (
          <p className="text-sm text-white/70 line-clamp-2">
            {quest.description}
          </p>
        )}

        {/* Progress bar */}
        {showProgress && quest.user_progress && quest.user_progress.status === 'in_progress' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/60">
              <span>Progress</span>
              <span>{quest.user_progress.progress_percentage}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                style={{ width: `${quest.user_progress.progress_percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-white/60">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>{quest.estimated_time} min</span>
          </div>
          <div className="flex items-center gap-1">
            <StarIcon className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{quest.xp_reward} XP</span>
          </div>
          {quest.completion_count > 0 && (
            <div className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              <span>{quest.completion_count}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {quest.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {quest.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-md bg-white/5 text-white/50 text-xs"
              >
                {tag.name}
              </span>
            ))}
            {quest.tags.length > 3 && (
              <span className="px-2 py-0.5 text-white/50 text-xs">
                +{quest.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Unlock requirements */}
        {quest.is_locked && quest.unlock_requirements.length > 0 && (
          <div className="text-xs text-white/60 space-y-1">
            <p className="font-medium">Complete first:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {quest.unlock_requirements.map((req) => (
                <li key={req.slug}>{req.title}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Trending indicator */}
        {quest.popularity_score > 80 && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 text-xs font-medium">
              <FireIcon className="w-3 h-3" />
              Trending
            </div>
          </div>
        )}
      </div>

      {/* Hover overlay */}
      {!quest.is_locked && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
          <div className={`px-6 py-2 rounded-lg bg-white/10 backdrop-blur-md text-white font-medium ${isCompact ? 'text-sm' : 'text-base'}`}>
            Start Quest →
          </div>
        </div>
      )}
    </Component>
  );
}
```

### 2.4 QuestFeedSection Component

Create `frontend/src/components/side-quests/QuestFeedSection.tsx`:

```typescript
interface QuestFeedSectionProps {
  title: string;
  description?: string;
  quests: SideQuest[];
  icon?: React.ReactNode;
  emptyMessage?: string;
}

export function QuestFeedSection({
  title,
  description,
  quests,
  icon,
  emptyMessage = 'No quests found in this section'
}: QuestFeedSectionProps) {
  if (quests.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        {icon && <div className="text-2xl">{icon}</div>}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Quest Grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
        {quests.map((quest) => (
          <div key={quest.id} className="break-inside-avoid mb-4">
            <SideQuestCard quest={quest} variant="compact" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.5 SideQuestsPage Component

Create `frontend/src/pages/SideQuestsPage.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SemanticSearchBar } from '@/components/explore/SemanticSearchBar';
import { SideQuestCard } from '@/components/side-quests/SideQuestCard';
import { QuestFeedSection } from '@/components/side-quests/QuestFeedSection';
import {
  getRecommendedQuests,
  getSideQuests,
  semanticSearchQuests,
} from '@/services/sideQuests';
import type { QuestFilters } from '@/types/sideQuest';

export function SideQuestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState<QuestFilters>({});

  // Fetch recommended quests (personalized feed)
  const { data: recommendedQuests, isLoading: isLoadingRecommended } = useQuery({
    queryKey: ['recommendedQuests'],
    queryFn: getRecommendedQuests,
    enabled: !searchQuery,
  });

  // Fetch all quests with filters
  const { data: allQuestsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['sideQuests', filters],
    queryFn: () => getSideQuests(filters),
    enabled: !searchQuery,
  });

  // Semantic search
  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['searchQuests', searchQuery],
    queryFn: () => semanticSearchQuests(searchQuery),
    enabled: !!searchQuery,
  });

  // Organize quests into feed sections
  const forYouQuests = recommendedQuests?.slice(0, 6) || [];
  const trendingQuests = allQuestsData?.results
    .filter(q => q.popularity_score > 70)
    .slice(0, 6) || [];
  const inProgressQuests = allQuestsData?.results
    .filter(q => q.user_progress?.status === 'in_progress') || [];

  const isLoading = isLoadingRecommended || isLoadingAll || isLoadingSearch;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    setSearchParams(params, { replace: true });
  };

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Side Quests
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Interactive challenges to level up your AI skills
              </p>
            </div>

            {/* Search Bar */}
            <SemanticSearchBar
              onSearch={handleSearch}
              placeholder="Search quests with AI..."
              initialValue={searchQuery}
            />

            {/* Content */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quests...</p>
                </div>
              </div>
            ) : searchQuery && searchResults ? (
              // Search Results
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Search Results
                </h2>
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
                  {searchResults.map((quest) => (
                    <div key={quest.id} className="break-inside-avoid mb-4">
                      <SideQuestCard quest={quest} variant="compact" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Personalized Feed Sections
              <div className="space-y-12">
                {/* Continue Learning */}
                {inProgressQuests.length > 0 && (
                  <QuestFeedSection
                    title="Continue Learning"
                    description="Pick up where you left off"
                    quests={inProgressQuests}
                    icon="🎯"
                  />
                )}

                {/* For You */}
                <QuestFeedSection
                  title="For You"
                  description="Personalized recommendations based on your skills and interests"
                  quests={forYouQuests}
                  icon="✨"
                />

                {/* Trending */}
                <QuestFeedSection
                  title="Trending This Week"
                  description="Popular quests in your community"
                  quests={trendingQuests}
                  icon="🔥"
                />

                {/* All Quests */}
                {allQuestsData && allQuestsData.results.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      All Quests
                    </h2>
                    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
                      {allQuestsData.results.map((quest) => (
                        <div key={quest.id} className="break-inside-avoid mb-4">
                          <SideQuestCard quest={quest} variant="compact" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
```

### 2.6 Routing

Update `frontend/src/routes/index.tsx`:

```typescript
import { SideQuestsPage } from '@/pages/SideQuestsPage';

// Add to routes:
<Route
  path="/play/side-quests"
  element={
    <ProtectedRoute>
      <SideQuestsPage />
    </ProtectedRoute>
  }
/>
```

Update `frontend/src/components/navigation/menuData.ts`:

```typescript
{
  label: 'Side Quests',
  path: '/play/side-quests',  // Changed from '#'
},
```

## Phase 3: Smart Features (Priority 2)

### 3.1 Filter Panel

Create `frontend/src/components/side-quests/QuestFilterPanel.tsx`:

- Multi-select filters for difficulty, type, tags, time, completion status
- Clear all functionality
- Collapsible design
- Sticky positioning on scroll

### 3.2 Weaviate Integration

Backend Weaviate indexing:
- Index quests on creation/update
- Include: title, description, learning outcomes, tags
- Support semantic similarity search
- Hybrid search (keyword + semantic)

### 3.3 Social Features

Thrive Circle integration:
- "Friends are doing" section
- Share quest completions
- Challenge friends to specific quests
- Leaderboards for competitive quests

### 3.4 Unlock System UI

- Visual lock icons on locked quests
- Prerequisite quest links
- Unlock celebration modal with confetti
- Progress tracking towards unlocks
- "Almost there" indicators

## Phase 4: Initial Content & Testing (Priority 2)

### 4.1 Placeholder Quests

Seed 8 placeholder quests:

1. **AI Prompt Engineering Challenge** (Educational, Beginner)
2. **Model Behavior Predictor** (Educational, Intermediate)
3. **Token Optimizer** (Educational, Intermediate)
4. **Code Pattern Hunter** (Project-Based, Intermediate) - LOCKED
5. **AI Conversation Tree Builder** (Creative, Beginner)
6. **Hallucination Detective** (Creative, Intermediate)
7. **Prompt Battle Arena** (Competitive, Advanced) - LOCKED
8. **RAG System Simulator** (Meta, Advanced) - LOCKED

### 4.2 Learning Paths

Create 3 starter paths:

1. **Prompt Engineering Mastery**
   - AI Prompt Engineering Challenge
   - Token Optimizer
   - Prompt Battle Arena (final)

2. **AI Code Collaboration**
   - Code Pattern Hunter
   - Test Case Generator Challenge
   - Refactor Race

3. **Critical AI Thinking**
   - Model Behavior Predictor
   - AI Ethics Scenarios
   - Hallucination Detective

## Implementation Checklist

### Backend
- [ ] Create `core/side_quests` app
- [ ] Define models (SideQuest, Progress, Completion, Tag, LearningPath)
- [ ] Create migrations and run
- [ ] Build serializers
- [ ] Implement ViewSets and endpoints
- [ ] Write recommendation algorithm
- [ ] Set up Weaviate indexing
- [ ] Create seed data for placeholder quests
- [ ] Add tests

### Frontend
- [ ] Create TypeScript types
- [ ] Build API service layer
- [ ] Create SideQuestCard component
- [ ] Create QuestFeedSection component
- [ ] Build SideQuestsPage
- [ ] Add routing
- [ ] Update navigation menu
- [ ] Create filter panel component
- [ ] Implement semantic search
- [ ] Add loading states and error handling
- [ ] Add tests

### Integration
- [ ] Connect to Thrive Circle for social features
- [ ] Integrate with existing XP/rewards system
- [ ] Set up analytics tracking
- [ ] Test personalization algorithm
- [ ] Performance optimization
- [ ] Security audit (access control, rate limiting)

## Success Metrics

- ✅ Page loads with personalized "For You" section
- ✅ Search returns semantically relevant results
- ✅ Locked quests clearly show unlock requirements
- ✅ Thrive Circle activity appears in feed
- ✅ Filters work smoothly with instant updates
- ✅ Infrastructure supports easy addition of new quests
- ✅ Mobile responsive design
- ✅ < 2s page load time

## Future Enhancements (Post-MVP)

- Quest builder for community-created quests
- Team quests and collaborative challenges
- Seasonal events and limited-time quests
- Advanced analytics dashboard
- Quest difficulty auto-adjustment based on user performance
- AI-generated quest variations
- Voice-based quests
- AR/VR quest experiences
