import type { TopicSlug } from '@/config/topics';

// User roles
export type UserRole = 'explorer' | 'learner' | 'expert' | 'creator' | 'mentor' | 'patron' | 'admin' | 'agent';

// Thrive Circle tier names
export type TierName = 'seedling' | 'sprout' | 'blossom' | 'bloom' | 'evergreen' | 'curation';

// User model
export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  roleDisplay: string;
  avatarUrl?: string;
  bio?: string;
  tagline?: string;
  location?: string;
  pronouns?: string;
  websiteUrl?: string;
  calendarUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  playgroundIsPublic?: boolean;
  createdAt: string;
  lastLogin?: string;
  totalPoints?: number;
  level?: number;
  currentStreak?: number;
  // Thrive Circle fields
  tier?: TierName;
  tierDisplay?: string;
  totalPoints?: number;
  // Follow fields
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean | null; // null when viewing own profile
}

// Authentication state
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Login form state
export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  errors: {
    email?: string;
    password?: string;
    form?: string;
  };
  isSubmitting: boolean;
}

// Navigation state
export interface NavigationState {
  returnUrl?: string;
  previousPath?: string;
}

// Authentication status enum
export enum AuthStatus {
  Idle = 'idle',
  Loading = 'loading',
  Authenticated = 'authenticated',
  Unauthenticated = 'unauthenticated',
  Error = 'error',
}

// Storage keys
export const StorageKeys = {
  AUTH_STATE: 'auth_state',
  THEME: 'theme',
  REMEMBER_ME: 'remember_me',
} as const;

// Project types
export type ProjectType = 'github_repo' | 'figma_design' | 'image_collection' | 'prompt' | 'reddit_thread' | 'other';

// Project redirect
export interface ProjectRedirect {
  id: number;
  oldSlug: string;
  createdAt: string;
}

// Project model
export interface Project {
  id: number;
  username: string; // Owner's username for URL construction
  userAvatarUrl?: string; // Owner's avatar URL
  title: string;
  slug: string;
  description: string;
  type: ProjectType;
  isShowcased: boolean; // Featured on user profile showcase section
  isHighlighted: boolean; // Featured at top of profile (only one per user)
  isPrivate: boolean; // Hidden from explore feed and public views
  isArchived: boolean; // Soft delete - hidden from all views
  isPromoted?: boolean; // Admin promoted - appears at top of explore feeds
  promotedAt?: string; // When this project was promoted
  bannerUrl?: string; // Banner/cover image
  featuredImageUrl?: string;
  externalUrl?: string;
  tools: number[]; // Tool IDs
  toolsDetails?: Tool[]; // Full tool objects with details
  categories?: number[]; // Category taxonomy IDs (predefined)
  categoriesDetails?: Taxonomy[]; // Full category taxonomy objects
  hideCategories?: boolean; // If true, categories are hidden from public display
  topics?: string[]; // User-generated topics (free-form, moderated)
  tagsManuallyEdited?: boolean; // If true, tags were manually edited by admin and won't be auto-updated
  heartCount: number;
  isLikedByUser: boolean;
  content: ProjectContent;
  redirects?: ProjectRedirect[]; // Old slugs that redirect to this project
  createdAt: string;
  updatedAt: string;
}

// Project content structure (portfolio-style blocks)
export interface ProjectContent {
  coverImage?: {
    url: string;
    alt?: string;
  };
  tags?: string[];
  blocks?: ProjectBlock[];
  // Hero display fields
  heroDisplayMode?: 'image' | 'video' | 'slideshow' | 'quote' | 'slideup';
  heroQuote?: string;
  heroVideoUrl?: string;
  heroSlideshowImages?: string[];
  // Gradient colors for quote cards (Tailwind color names)
  heroGradientFrom?: string;  // e.g., 'violet-600'
  heroGradientTo?: string;    // e.g., 'indigo-600'
  // Slide-up hero fields (two-element display)
  heroSlideUpElement1?: {
    type: 'image' | 'video' | 'text';
    content: string; // URL for image/video, text content for text
    caption?: string;
  };
  heroSlideUpElement2?: {
    type: 'image' | 'video' | 'text';
    content: string; // URL for image/video, text content for text
    caption?: string;
  };
  // Reddit thread data
  reddit?: {
    subreddit: string;
    author: string;
    permalink: string;
    score: number;
    num_comments: number;
    thumbnail_url: string;
    created_utc: string;
    reddit_post_id: string;
  };
  // GitHub project data
  github?: {
    analysis_status?: 'pending' | 'complete' | 'failed';
    analysis?: any; // GitHub analysis data
  };
  // Figma project data
  figma?: {
    analysis_status?: 'pending' | 'complete' | 'failed';
    analysis?: any; // Figma analysis data
  };
  // Battle result data (for saved prompt battles)
  battleResult?: {
    battleId: number;
    challengeText: string;
    challengeType?: {
      key: string;
      name: string;
    };
    won: boolean;
    isTie: boolean;
    mySubmission: {
      prompt: string;
      imageUrl?: string;
      score?: number | null;
      criteriaScores?: Record<string, number>;
      feedback?: string;
    };
    opponent: {
      username: string;
      isAi: boolean;
    };
    opponentSubmission?: {
      prompt: string;
      imageUrl?: string;
      score?: number | null;
      criteriaScores?: Record<string, number>;
      feedback?: string;
    };
  };
}

// Base block interface
interface BaseBlock {
  id?: string; // UUID for client-side tracking (not persisted)
}

// Column block structure
export interface ColumnBlock {
  id: string;
  blocks: ProjectBlock[];
}

export type ProjectBlock = BaseBlock & (
  | { type: 'text'; style: 'body' | 'heading' | 'quote'; content: string; markdown?: boolean }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'video'; url: string; embedUrl?: string; caption?: string }
  | { type: 'file'; url: string; filename: string; fileType: string; fileSize: number; label: string; icon: string }
  | { type: 'button'; text: string; url: string; icon: string; style: 'primary' | 'secondary' | 'outline'; size: 'small' | 'medium' | 'large' }
  | { type: 'divider'; style: 'line' | 'dotted' | 'dashed' | 'space' }
  | { type: 'columns'; columnCount: 1 | 2 | 3; containerWidth: 'full' | 'boxed'; columns: ColumnBlock[] }
  | { type: 'imageGrid'; images: Array<{ url: string; caption?: string }>; caption?: string }
  | { type: 'mermaid'; code: string; caption?: string }
  | { type: 'code_snippet'; code: string; language: string; filename?: string; highlightLines?: number[] }
  | { type: 'icon_card'; icon: string; text: string }
);

// Project creation/update payload
export interface ProjectPayload {
  title?: string;
  slug?: string;
  description?: string;
  type?: ProjectType;
  isShowcased?: boolean;
  isHighlighted?: boolean;
  isPrivate?: boolean;
  isArchived?: boolean;
  bannerUrl?: string;
  featuredImageUrl?: string;
  externalUrl?: string;
  tools?: number[];
  categories?: number[]; // Category taxonomy IDs (predefined)
  topics?: string[]; // User-generated topics (free-form, moderated)
  content?: ProjectContent;
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Taxonomy types
export type TaxonomyType = 'tool' | 'topic';
export type TaxonomyCategory = 'interest' | 'skill' | 'goal' | 'topic' | 'industry' | 'tool';

export interface Taxonomy {
  id: number;
  name: string;
  slug: string;
  taxonomyType: TaxonomyType;
  taxonomyTypeDisplay: string;
  description: string;
  color?: string; // For topics and categories
  isActive: boolean;
  websiteUrl?: string;
  logoUrl?: string;
  usageTips?: string[];
  bestFor?: string[];
}

// User tag types
export type TagSource = 'manual' | 'auto_project' | 'auto_conversation' | 'auto_activity';

export interface UserTag {
  id: number;
  name: string;
  taxonomy?: Taxonomy | null;
  source: TagSource;
  sourceDisplay: string;
  confidenceScore: number;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
}

// User personalization overview
export interface UserPersonalization {
  manual_tags: UserTag[];
  auto_generated_tags: UserTag[];
  available_taxonomies: Taxonomy[];
  available_topics: Taxonomy[];
  selected_topics: Taxonomy[];
  total_interactions: number;
}

// Interaction types
export type InteractionType = 'project_view' | 'project_create' | 'conversation' | 'search' | 'content_view';

export interface UserInteraction {
  id: number;
  interactionType: InteractionType;
  interactionTypeDisplay: string;
  metadata: Record<string, any>;
  extractedKeywords: string[];
  createdAt: string;
}

// Tool types
export type ToolCategory = 'chat' | 'code' | 'image' | 'video' | 'audio' | 'writing' | 'research' | 'productivity' | 'data' | 'design' | 'other';
export type PricingModel = 'free' | 'freemium' | 'subscription' | 'pay_per_use' | 'enterprise' | 'open_source';

export interface ToolFeature {
  title: string;
  description: string;
}

export interface ToolUseCase {
  title: string;
  description: string;
  example?: string;
}

export interface Tool {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;

  // Categorization
  category: ToolCategory;
  categoryDisplay: string;
  company?: number; // Company ID
  companyName?: string; // Company name
  companySlug?: string; // Company slug
  tags: string[];

  // Media
  logoUrl?: string;
  bannerUrl?: string;
  screenshotUrls: string[];
  demoVideoUrl?: string;

  // Links
  websiteUrl: string;
  documentationUrl?: string;
  pricingUrl?: string;
  githubUrl?: string;
  twitterHandle?: string;
  discordUrl?: string;

  // Pricing
  pricingModel: PricingModel;
  pricingModelDisplay: string;
  startingPrice?: string;
  hasFreeTier: boolean;
  requiresApiKey: boolean;
  requiresWaitlist: boolean;

  // Content Sections
  overview?: string;
  keyFeatures: ToolFeature[];
  useCases: ToolUseCase[];
  usageTips: string[];
  bestPractices: string[];
  limitations: string[];
  alternatives: string[];

  // Technical
  modelInfo: Record<string, any>;
  integrations: string[];
  apiAvailable: boolean;
  languagesSupported: string[];

  // SEO
  metaDescription: string;
  keywords: string[];

  // Status & Metrics
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  viewCount: number;
  popularityScore: number;
  averageRating?: number;
  reviewCount: number;
  bookmarkCount: number;

  // Taxonomy Link
  taxonomy?: number;

  // Topic suggestions
  suggestedTopics?: TopicSlug[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
}

export interface ToolReview {
  id: number;
  tool: number;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  useCase?: string;
  userUsername: string;
  userAvatarUrl?: string;
  userRole: string;
  isVerifiedUser: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

// Thrive Circle Types
export type PointActivityType =
  | 'quiz_complete'
  | 'project_create'
  | 'project_update'
  | 'comment'
  | 'reaction'
  | 'daily_login'
  | 'streak_bonus'
  | 'weekly_goal'
  | 'side_quest'
  | 'special_event'
  | 'referral';

export interface PointActivity {
  id: string;
  user: number;
  username: string;
  amount: number;
  activityType: PointActivityType;
  activityTypeDisplay: string;
  description: string;
  tierAtTime: TierName;
  createdAt: string;
}

export interface UserTier {
  id: string;
  user: number;
  username: string;
  tier: TierName;
  tierDisplay: string;
  totalPoints: number;
  level: number;
  // Progress fields
  pointsToNextLevel?: number;
  pointsToNextTier?: number;
  // Phase 2: Streak fields
  currentStreakDays: number;
  longestStreakDays: number;
  lastActivityDate: string | null;
  // Phase 2: Lifetime stats
  lifetimeQuizzesCompleted: number;
  lifetimeProjectsCreated: number;
  lifetimeSideQuestsCompleted: number;
  lifetimeCommentsPosted: number;
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  recentActivities?: PointActivity[];
}

export interface ThriveCircleStatus {
  tierStatus: UserTier;
  recentActivities: PointActivity[];
}

export interface AwardPointsRequest {
  amount: number;
  activityType: PointActivityType;
  description?: string;
}

export interface AwardPointsResponse {
  tierStatus: UserTier;
  pointActivity: PointActivity;
  tierUpgraded: boolean;
  oldTier: TierName | null;
  newTier: TierName | null;
}

// Phase 2: Weekly Goals
export type WeeklyGoalType = 'activities_3' | 'streak_7' | 'help_5' | 'topics_2';

export interface WeeklyGoal {
  id: string;
  user: number;
  username: string;
  goalType: WeeklyGoalType;
  goalTypeDisplay: string;
  weekStart: string;
  weekEnd: string;
  currentProgress: number;
  targetProgress: number;
  progressPercentage: number;
  isCompleted: boolean;
  completedAt: string | null;
  pointsReward: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Circle Types - Community Micro-Groups
// =============================================================================

export type KudosType = 'great_project' | 'helpful' | 'inspiring' | 'creative' | 'supportive' | 'welcome';

export type CircleChallengeType = 'create_projects' | 'give_feedback' | 'complete_quests' | 'earn_points' | 'maintain_streaks';

export interface CircleMember {
  id: string;
  username: string;
  avatarUrl: string | null;
  tier: TierName;
  level: number;
  totalPoints: number;
}

export interface CircleMembership {
  id: string;
  user: CircleMember;
  isActive: boolean;
  joinedAt: string;
  pointsEarnedInCircle: number;
  wasActive: boolean;
}

export interface CircleChallenge {
  id: string;
  challengeType: CircleChallengeType;
  challengeTypeDisplay: string;
  title: string;
  description: string;
  target: number;
  currentProgress: number;
  progressPercentage: number;
  isCompleted: boolean;
  completedAt: string | null;
  bonusPoints: number;
  rewardsDistributed: boolean;
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  tier: TierName;
  tierDisplay: string;
  weekStart: string;
  weekEnd: string;
  memberCount: number;
  activeMemberCount: number;
  isActive: boolean;
  createdAt: string;
  // Detailed fields (from CircleDetailSerializer)
  members?: CircleMembership[];
  activeChallenge?: CircleChallenge | null;
  myMembership?: CircleMembership | null;
  hasCircle?: boolean;
}

export interface Kudos {
  id: string;
  fromUser: CircleMember;
  toUser: CircleMember;
  circle: string;
  kudosType: KudosType;
  kudosTypeDisplay: string;
  message: string;
  project: string | null;
  projectTitle: string | null;
  createdAt: string;
}

export interface CreateKudosRequest {
  toUserId: string;
  kudosType: KudosType;
  message?: string;
  projectId?: string;
}

export interface CircleActivityFeed {
  kudos: Kudos[];
  circleName: string;
  hasCircle: boolean;
}

// Side Quests
export type SideQuestType =
  | 'quiz_mastery'
  | 'project_showcase'
  | 'community_helper'
  | 'learning_streak'
  | 'topic_explorer'
  | 'tool_master'
  | 'early_bird'
  | 'night_owl'
  | 'social_butterfly'
  | 'content_creator';

export type SideQuestDifficulty = 'easy' | 'medium' | 'hard' | 'epic';

export type SideQuestSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';

export type UserSideQuestStatus = 'not_started' | 'in_progress' | 'completed' | 'expired';

export type QuestCategoryType = 'community' | 'learning' | 'creative' | 'exploration' | 'daily' | 'special';

export interface QuestCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryType: QuestCategoryType;
  categoryTypeDisplay: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  completionBonusPoints: number;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  questCount: number;
  quests?: SideQuest[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestCategoryProgress {
  totalQuests: number;
  completedQuests: number;
  inProgressQuests: number;
  completionPercentage: number;
  isComplete: boolean;
  bonusClaimed: boolean;
}

// Quest step definition for multi-step guided quests
export interface QuestStep {
  id: string;
  title: string;
  description: string;
  destinationUrl: string | null;
  actionTrigger: string;
  icon: string;
}

// Step progress for tracking user's journey
export interface QuestStepProgress {
  step: QuestStep;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  completedAt: string | null;
}

export interface SideQuest {
  id: string;
  title: string;
  description: string;
  questType: SideQuestType;
  questTypeDisplay: string;
  difficulty: SideQuestDifficulty;
  difficultyDisplay: string;
  category?: string;
  categoryName?: string;
  categorySlug?: string;
  topic: TopicSlug | null;
  topicDisplay: string | null;
  skillLevel: SideQuestSkillLevel | null;
  skillLevelDisplay: string | null;
  requirements: Record<string, any>;
  pointsReward: number;
  order?: number;
  isDaily?: boolean;
  isRepeatable?: boolean;
  isActive: boolean;
  isAvailable: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  // Multi-step guided quest fields
  isGuided: boolean;
  steps: QuestStep[];
  narrativeIntro: string;
  narrativeComplete: string;
  estimatedMinutes: number | null;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSideQuest {
  id: string;
  user: number;
  username: string;
  sideQuest: SideQuest;
  sideQuestId?: string;
  status: UserSideQuestStatus;
  statusDisplay: string;
  currentProgress: number;
  targetProgress: number;
  progressPercentage: number;
  progressData: Record<string, any>;
  // Multi-step guided quest progress
  currentStepIndex: number;
  completedStepIds: string[];
  stepCompletedAt: Record<string, string>;
  currentStep: QuestStep | null;
  nextStepUrl: string | null;
  stepsProgress: QuestStepProgress[];
  isCompleted: boolean;
  completedAt: string | null;
  pointsAwarded: number;
  startedAt: string;
  updatedAt: string;
}

// Learning Path Types
export type LearningPathSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'master';

export interface UserLearningPath {
  id: number;
  topic: TopicSlug;
  topicDisplay: string;
  currentSkillLevel: LearningPathSkillLevel;
  skillLevelDisplay: string;
  quizzesCompleted: number;
  quizzesTotal: number;
  sideQuestsCompleted: number;
  sideQuestsTotal: number;
  topicPoints: number;
  progressPercentage: number;
  pointsToNextLevel: number;
  nextSkillLevel: LearningPathSkillLevel | null;
  startedAt: string;
  lastActivityAt: string;
}

export interface CompletedQuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  completedAt: string;
}

export interface AvailableQuiz {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  estimatedTime: number;
  questionCount: number;
}

export interface CompletedSideQuest {
  id: string;
  sideQuestId: string;
  title: string;
  difficulty: string;
  pointsAwarded: number;
  completedAt: string;
}

export interface ActiveSideQuest {
  id: string;
  sideQuestId: string;
  title: string;
  difficulty: string;
  progressPercentage: number;
  currentProgress: number;
  targetProgress: number;
}

export interface RecommendedNext {
  type: 'quiz' | 'sidequest';
  id: string;
  title: string;
  difficulty?: string;
  progress?: number;
  isNew?: boolean;
}

export interface LearningPathDetail {
  path: UserLearningPath;
  completedQuizzes: CompletedQuizAttempt[];
  availableQuizzes: AvailableQuiz[];
  completedSidequests: CompletedSideQuest[];
  activeSidequests: ActiveSideQuest[];
  recommendedNext: RecommendedNext | null;
}

export interface TopicRecommendation {
  topic: TopicSlug;
  topicDisplay: string;
  quizCount: number;
  sidequestCount: number;
  score: number;
}

export interface LearningPathTopic {
  slug: TopicSlug;
  name: string;
}
