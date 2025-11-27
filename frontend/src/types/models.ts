import type { TopicSlug } from '@/config/topics';

// User roles
export type UserRole = 'explorer' | 'expert' | 'mentor' | 'patron' | 'admin';

// Thrive Circle tier names
export type TierName = 'seedling' | 'sprout' | 'blossom' | 'bloom' | 'evergreen';

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
export type ProjectType = 'github_repo' | 'image_collection' | 'prompt' | 'other';

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
  isShowcase: boolean;
  isHighlighted: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  isPublished: boolean;
  publishedAt?: string;
  bannerUrl?: string; // Banner/cover image (renamed from bannerUrl for clarity)
  featuredImageUrl?: string;
  externalUrl?: string;
  tools: number[]; // Tool IDs
  toolsDetails?: Tool[]; // Full tool objects with details
  categories?: number[]; // Category taxonomy IDs (predefined)
  categoriesDetails?: Taxonomy[]; // Full category taxonomy objects
  topics?: string[]; // User-generated topics (free-form, moderated)
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
);

// Project creation/update payload
export interface ProjectPayload {
  title?: string;
  slug?: string;
  description?: string;
  type?: ProjectType;
  isShowcase?: boolean;
  isHighlighted?: boolean;
  isPrivate?: boolean;
  isArchived?: boolean;
  isPublished?: boolean;
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
  taxonomyType: TaxonomyType;
  taxonomyTypeDisplay: string;
  description: string;
  color?: string; // For topics
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
  createdAt: string;
  updatedAt: string;
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

export interface SideQuest {
  id: string;
  title: string;
  description: string;
  questType: SideQuestType;
  questTypeDisplay: string;
  difficulty: SideQuestDifficulty;
  difficultyDisplay: string;
  topic: TopicSlug | null;
  topicDisplay: string | null;
  skillLevel: SideQuestSkillLevel | null;
  skillLevelDisplay: string | null;
  requirements: Record<string, any>;
  pointsReward: number;
  isActive: boolean;
  isAvailable: boolean;
  startsAt: string | null;
  expiresAt: string | null;
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
  isCompleted: boolean;
  completedAt: string | null;
  pointsAwarded: number;
  startedAt: string;
  updatedAt: string;
}
