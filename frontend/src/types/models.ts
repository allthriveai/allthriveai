import type { TopicSlug } from '@/config/topics';

// User roles
export type UserRole = 'explorer' | 'learner' | 'expert' | 'creator' | 'mentor' | 'patron' | 'admin' | 'agent' | 'vendor';

// Thrive Circle tier names
export type TierName = 'seedling' | 'sprout' | 'blossom' | 'bloom' | 'evergreen' | 'curation' | 'team';

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
  avatarFocalX?: number;  // 0-1, default 0.5 (center)
  avatarFocalY?: number;  // 0-1, default 0.5 (center)
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
  isProfilePublic?: boolean;
  allowLlmTraining?: boolean;
  gamificationIsPublic?: boolean;
  allowSimilarityMatching?: boolean;
  createdAt: string;
  lastLogin?: string;
  level?: number;
  currentStreak?: number;
  // Thrive Circle fields
  tier?: TierName;
  tierDisplay?: string;
  totalPoints?: number;
  subscriptionTier?: string;
  // Follow fields
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean | null; // null when viewing own profile
  // Additional user stats
  currentStatus?: string;
  totalAchievementsUnlocked?: number;
  lifetimeProjectsCreated?: number;
  projectsCount?: number;
  // Guest user flag
  isGuest?: boolean;
  // Admin role (includes superusers)
  isAdminRole?: boolean;
  // Avatar tracking
  aiAvatarsCreated?: number;
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

// Authentication status
export const AuthStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Authenticated: 'authenticated',
  Unauthenticated: 'unauthenticated',
  Error: 'error',
} as const;

export type AuthStatus = typeof AuthStatus[keyof typeof AuthStatus];

// Storage keys
export const StorageKeys = {
  AUTH_STATE: 'auth_state',
  THEME: 'theme',
  REMEMBER_ME: 'remember_me',
} as const;

// Project types
export type ProjectType = 'github_repo' | 'figma_design' | 'image_collection' | 'prompt' | 'reddit_thread' | 'video' | 'battle' | 'rss_article' | 'clipped' | 'game' | 'other';

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
  isLearningEligible?: boolean; // Whether this project appears in learning content
  bannerUrl?: string; // Banner/cover image
  featuredImageUrl?: string;
  externalUrl?: string;
  tools: number[]; // Tool IDs
  toolsDetails?: ToolSummary[]; // Minimal tool info for display
  categories?: number[]; // Category taxonomy IDs (predefined)
  categoriesDetails?: Taxonomy[]; // Full category taxonomy objects
  hideCategories?: boolean; // If true, categories are hidden from public display
  topics?: string[]; // User-generated topics (free-form, moderated)
  topicsDetails?: Taxonomy[]; // Full topic taxonomy objects
  tags?: string[]; // Tags for the project
  tagsManuallyEdited?: boolean; // If true, tags were manually edited by admin and won't be auto-updated
  // Content metadata taxonomy fields (AI-generated or manual)
  contentTypeTaxonomy?: number; // Content type taxonomy ID
  contentTypeDetails?: Taxonomy; // Full content type taxonomy object
  timeInvestment?: number; // Time investment taxonomy ID
  timeInvestmentDetails?: Taxonomy; // Full time investment taxonomy object
  difficultyTaxonomy?: number; // Difficulty taxonomy ID
  difficultyDetails?: Taxonomy; // Full difficulty taxonomy object
  pricingTaxonomy?: number; // Pricing taxonomy ID
  pricingDetails?: Taxonomy; // Full pricing taxonomy object
  viewCount?: number; // Number of views
  likesCount?: number; // Number of likes
  heartCount: number;
  isLikedByUser: boolean;
  content: ProjectContent;
  redirects?: ProjectRedirect[]; // Old slugs that redirect to this project
  publishedDate?: string; // Original publication date (for AI-imported/RSS content, editable)
  createdAt: string;
  updatedAt: string;
}

// Video content structure (for video projects)
export interface VideoContent {
  videoId?: string;
  channelName?: string;
  channelId?: string;
  isShort?: boolean;
  isVertical?: boolean;  // True if video has portrait/vertical orientation
  duration?: string;
  url?: string;  // Direct video URL (S3/MinIO upload)
}

// Reddit content structure (for reddit thread projects)
export interface RedditContent {
  subreddit: string;
  author: string;
  permalink: string;
  score: number;
  numComments?: number;
  createdUtc?: string;
  thumbnailUrl?: string;
  selftext?: string;
  selftextHtml?: string;
  upvoteRatio?: number;
  linkFlairText?: string;
  linkFlairBackgroundColor?: string;
  isVideo?: boolean;
  videoUrl?: string;
  redditPostId: string;
}

// Figma content structure (for Figma design projects)
export interface FigmaContent {
  analysisStatus?: 'pending' | 'complete' | 'failed';
  analysis?: any; // Figma analysis data
  analyzedAt?: string;
}

// Project content structure (portfolio-style blocks)
export interface ProjectContent {
  coverImage?: {
    url: string;
    alt?: string;
  };
  tags?: string[];
  blocks?: ProjectBlock[];
  sections?: any[]; // Legacy sections field
  video?: VideoContent | string; // Video content or legacy video field
  componentLayout?: string; // Legacy component layout field
  redditPermalink?: string;
  templateVersion?: number;
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
  reddit?: RedditContent;
  // GitHub project data
  github?: {
    stars?: number;
    forks?: number;
    watchers?: number;
    issues?: number;
    analyzedAt?: string;
    analysisStatus?: 'pending' | 'complete' | 'failed';
    analysis?: any; // GitHub analysis data
  };
  // Figma project data
  figma?: FigmaContent;
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
  // TL;DR section styling
  tldrBgColor?: string;
  // Game teaser fields (for game type projects)
  gameUrl?: string; // URL to the game (e.g., /play/context-snake)
  gameId?: string; // Game ID from games config
  difficulty?: string; // Game difficulty level
  learningOutcomes?: string[]; // What users will learn
  topicTags?: string[]; // Topic tags for the game
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
  | { type: 'badgeRow'; badges?: Array<{ url: string; caption?: string }> }
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
  publishedDate?: string; // Allow updating the published date (for AI-imported projects)
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

// Topic type alias (for backwards compatibility and convenience)
export type Topic = Taxonomy;

// User tag types
export type TagSource = 'manual' | 'auto_project' | 'auto_conversation' | 'auto_activity';

export interface UserTag {
  id: number;
  name: string;
  taxonomy?: Taxonomy | null;
  taxonomyCategory?: string;
  source: TagSource;
  sourceDisplay: string;
  confidenceScore: number;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
}

// User personalization overview
export interface UserPersonalization {
  manualTags: UserTag[];
  autoGeneratedTags: UserTag[];
  availableTaxonomies: Taxonomy[];
  availableTopics: Taxonomy[];
  selectedTopics: Taxonomy[];
  totalInteractions: number;
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

// Minimal tool info used in project toolsDetails
export interface ToolSummary {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
}

export interface ToolFeature {
  title: string;
  description: string;
}

export interface ToolUseCase {
  title: string;
  description: string;
  example?: string;
}

export interface ToolWhatsNew {
  date: string;
  title: string;
  description: string;
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
  whatsNew: ToolWhatsNew[];

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

export type CircleChallengeType = 'create_projects' | 'give_feedback' | 'complete_quests' | 'earn_points' | 'maintain_streaks' | 'projects_created' | 'comments_given' | 'streak_days' | 'quizzes_completed';

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
  // Dynamic match reason explaining why user is in this circle
  matchReason?: string;
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

// Activity item in the circle activity feed
export type CircleActivityType = 'project' | 'streak' | 'kudos' | 'comment' | 'quiz' | 'joined' | 'level_up';

export interface CircleActivityItem {
  id: string;
  type: CircleActivityType;
  username: string;
  message: string;
  timestamp: string;
  targetUsername?: string;
  points?: number;
}

export interface CircleActivityFeed {
  activities: CircleActivityItem[];
  kudos: Kudos[];
  circleName: string;
  hasCircle: boolean;
}

// WebSocket activity types (used by useCircleWebSocket hook)
export type CircleWebSocketActivityType =
  | 'kudos_given'
  | 'project_created'
  | 'streak_achieved'
  | 'challenge_progress'
  | 'level_up'
  | 'member_joined';

export interface CircleActivityEvent {
  id: string;
  type: CircleWebSocketActivityType;
  username: string;
  targetUsername?: string;
  kudosType?: KudosType;
  message?: string;
  timestamp: string;
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
  xpAwarded?: number; // XP awarded for quest completion
  startedAt: string;
  updatedAt: string;
}

// Learning Path Types
export type LearningPathSkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Learner Profile Types
export type LearningStyle = 'visual' | 'reading' | 'interactive' | 'video';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type SessionLength = 'short' | 'medium' | 'long';
export type MasteryLevel = 'unknown' | 'aware' | 'learning' | 'practicing' | 'proficient' | 'expert';

export interface LearnerProfile {
  preferredLearningStyle: LearningStyle;
  currentDifficultyLevel: DifficultyLevel;
  preferredSessionLength: SessionLength;
  allowProactiveSuggestions: boolean;
  proactiveCooldownMinutes: number;
  learningStreakDays: number;
  longestStreakDays: number;
  totalLessonsCompleted: number;
  totalConceptsCompleted: number;
  totalLearningMinutes: number;
  totalQuizzesCompleted: number;
  lastLearningActivity: string | null;
}

export interface Concept {
  id: number;
  name: string;
  slug: string;
  description: string;
  topic: string;
  toolName: string | null;
  toolSlug: string | null;
  baseDifficulty: DifficultyLevel;
  estimatedMinutes: number;
  keywords: string[];
}

export interface UserConceptMastery {
  id: number;
  concept: Concept;
  masteryLevel: MasteryLevel;
  masteryScore: number;
  timesPracticed: number;
  timesCorrect: number;
  timesIncorrect: number;
  accuracyPercentage: number;
  consecutiveCorrect: number;
  lastPracticed: string | null;
  nextReviewAt: string | null;
}

export interface LearningStats {
  totalEvents: number;
  totalXp: number;
  eventsByType: Record<string, number>;
  periodDays: number;
}

export interface DueReview {
  concept: string;
  conceptSlug: string;
  topic: string;
  masteryLevel: MasteryLevel;
  daysOverdue: number;
  lastPracticed: string | null;
}

export interface KnowledgeGap {
  concept: string;
  conceptSlug: string;
  topic: string;
  masteryLevel: MasteryLevel;
  masteryScore: number;
  timesPracticed: number;
  accuracyPercentage: number;
  suggestion: string;
}

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

// Structured Learning Path Types
export type LearningGoal = 'build_projects' | 'understand_concepts' | 'career' | 'exploring';
export type ConceptStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface ConceptNode {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: ConceptStatus;
  masteryScore: number;
  hasQuiz: boolean;
  estimatedMinutes: number;
}

export interface TopicSection {
  slug: string;
  name: string;
  description: string;
  progress: number;
  conceptCount: number;
  completedCount: number;
  concepts: ConceptNode[];
}

export interface CurrentFocus {
  concept: ConceptNode | null;
  topicSlug: string;
  topicName: string;
}

export interface StructuredPath {
  hasCompletedPathSetup: boolean;
  learningGoal: LearningGoal | null;
  currentFocus: CurrentFocus;
  overallProgress: number;
  totalConcepts: number;
  completedConcepts: number;
  topics: TopicSection[];
}

export interface LearningSetupRequest {
  learningGoal: LearningGoal;
}

// Re-export section types from sections.ts for convenience
export type { ProjectSection, SectionType } from './sections';
