/**
 * Marketplace Types - Creator Products and Commerce
 */

// =============================================================================
// Product Types
// =============================================================================

export type ProductType = 'course' | 'prompt_pack' | 'template' | 'ebook';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type ProductSourceType = 'manual' | 'youtube' | 'import';
export type ProductAssetType = 'download' | 'preview' | 'bonus';

// =============================================================================
// Course Content Types (for AI-generated courses)
// =============================================================================

export interface CourseTimestamps {
  start: string;
  end: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  content: string;
  keyTakeaways: string[];
  timestamps?: CourseTimestamps;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  lessons: CourseLesson[];
}

export interface CourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface CourseQuiz {
  title: string;
  questions: CourseQuizQuestion[];
}

export interface CourseStructure {
  modules: CourseModule[];
  quiz?: CourseQuiz;
  summary: string;
  learningObjectives: string[];
  prerequisites: string[];
  estimatedDuration: string;
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface CourseSource {
  type: 'youtube';
  videoId: string;
  channelId: string;
  channelName: string;
  duration: string;
  publishedAt: string;
}

export interface CourseContent {
  type: 'course';
  source: CourseSource;
  course: CourseStructure;
  blocks: ProductBlock[];
}

// =============================================================================
// Product Block Types (for content display and editing)
// =============================================================================

export type ProductBlock =
  | { id: string; type: 'cover'; data: CoverBlockData }
  | { id: string; type: 'text'; data: TextBlockData }
  | { id: string; type: 'heading'; data: HeadingBlockData }
  | { id: string; type: 'checklist'; data: ChecklistBlockData }
  | { id: string; type: 'lesson'; data: LessonBlockData }
  | { id: string; type: 'quiz'; data: QuizBlockData };

export interface CoverBlockData {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  videoEmbed?: string;
}

export interface TextBlockData {
  title?: string;
  content: string;
}

export interface HeadingBlockData {
  text: string;
  level: 1 | 2 | 3;
}

export interface ChecklistBlockData {
  title: string;
  items: string[];
  style?: 'objectives' | 'default';
}

export interface LessonBlockData {
  title: string;
  content: string;
  keyTakeaways?: string[];
  timestamps?: CourseTimestamps;
}

export interface QuizBlockData {
  title: string;
  questions: CourseQuizQuestion[];
}

// =============================================================================
// Product Asset Types
// =============================================================================

export interface ProductAsset {
  id: number;
  title: string;
  description?: string;
  assetType: ProductAssetType;
  fileSize?: number;
  contentType?: string;
  order: number;
  isPreview: boolean;
  createdAt: string;
}

// =============================================================================
// Product Model
// =============================================================================

export interface ProductListItem {
  id: number;
  title: string;
  description: string;
  featuredImageUrl?: string;
  slug: string;
  productType: ProductType;
  productTypeDisplay: string;
  price: string; // Decimal as string
  currency: string;
  status: ProductStatus;
  totalSales: number;
  isFeatured: boolean;
  creatorUsername: string;
  createdAt: string;
  publishedAt?: string;
}

export interface ProductDetail extends ProductListItem {
  bannerUrl?: string;
  content: CourseContent | Record<string, unknown>;
  difficultyLevel?: string;
  totalRevenue: string;
  sourceType: ProductSourceType;
  sourceUrl?: string;
  assets: ProductAsset[];
  updatedAt: string;
  hasAccess?: boolean; // Whether current user has purchased/owns this product
}

// =============================================================================
// Product Payloads (Create/Update)
// =============================================================================

export interface ProductCreatePayload {
  title: string;
  description?: string;
  productType: ProductType;
  price?: string;
  content?: Record<string, unknown>;
}

export interface ProductUpdatePayload {
  title?: string;
  description?: string;
  productType?: ProductType;
  price?: string;
  content?: Record<string, unknown>;
}

// =============================================================================
// YouTube Import Types
// =============================================================================

export interface YouTubeImportRequest {
  youtubeUrl: string;
  productType?: ProductType;
  price?: string;
}

export interface YouTubeImportResponse {
  success: boolean;
  productId: number;
  projectId: number;
  title: string;
  message: string;
}

// =============================================================================
// Order Types
// =============================================================================

export type OrderStatus = 'pending' | 'completed' | 'refunded' | 'failed';

export interface Order {
  id: number;
  productTitle: string;
  buyerUsername: string;
  amountPaid: string;
  platformFee: string;
  stripeFee: string;
  creatorPayout: string;
  currency: string;
  status: OrderStatus;
  accessGrantedAt?: string;
  createdAt: string;
}

// =============================================================================
// Product Access Types
// =============================================================================

export interface ProductAccess {
  id: number;
  productTitle: string;
  productType: ProductType;
  creatorUsername: string;
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

// =============================================================================
// Creator Account Types
// =============================================================================

export type OnboardingStatus = 'not_started' | 'pending' | 'complete' | 'restricted';

export interface CreatorAccount {
  id: number;
  username: string;
  stripeConnectAccountId?: string;
  onboardingStatus: OnboardingStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  totalEarnings: string;
  pendingBalance: string;
  defaultCurrency: string;
  isActive: boolean;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface CreatorDashboardStats {
  totalProducts: number;
  publishedProducts: number;
  totalSales: number;
  totalRevenue: string;
  totalEarnings: string;
  pendingBalance: string;
  isOnboarded: boolean;
}

// =============================================================================
// Browse/List Response Types
// =============================================================================

export interface MarketplaceBrowseResponse {
  results: ProductListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarketplaceBrowseParams {
  type?: ProductType;
  featured?: boolean;
  creator?: string;
  limit?: number;
  offset?: number;
}
