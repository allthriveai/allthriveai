// User roles
export type UserRole = 'explorer' | 'expert' | 'mentor' | 'patron' | 'admin';

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

// Project model
export interface Project {
  id: number;
  username: string; // Owner's username for URL construction
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
  thumbnailUrl?: string;
  featuredImageUrl?: string;
  externalUrl?: string;
  tools: number[]; // Tool IDs
  toolsDetails?: Tool[]; // Full tool objects with details
  heartCount: number;
  isLikedByUser: boolean;
  content: ProjectContent;
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
}

export type ProjectBlock =
  | { type: 'text'; style: 'body' | 'heading' | 'quote'; content: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'imageGrid'; images: Array<{ url: string; caption?: string }>; caption?: string };

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
  thumbnailUrl?: string;
  featuredImageUrl?: string;
  externalUrl?: string;
  tools?: number[];
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
export type TaxonomyCategory = 'interest' | 'skill' | 'goal' | 'topic' | 'industry' | 'tool';

export interface Taxonomy {
  id: number;
  name: string;
  category: TaxonomyCategory;
  categoryDisplay: string;
  description: string;
  isActive: boolean;
  website_url?: string;
  logo_url?: string;
  usage_tips?: string[];
  best_for?: string[];
}

// User tag types
export type TagSource = 'manual' | 'auto_project' | 'auto_conversation' | 'auto_activity';

export interface UserTag {
  id: number;
  name: string;
  taxonomy: number | null;
  taxonomyName?: string;
  taxonomyCategory?: TaxonomyCategory;
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
