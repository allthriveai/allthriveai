/**
 * AllThrive Web Clipper Types
 */

export interface ClippedContent {
  /** Page title */
  title: string;
  /** Page URL */
  url: string;
  /** Main content as markdown */
  content: string;
  /** Plain text excerpt */
  excerpt?: string;
  /** Detected platform (chatgpt, claude, midjourney, etc) */
  platform?: string;
  /** Project type suggestion */
  projectType?: ProjectType;
  /** Extracted images */
  images: ExtractedImage[];
  /** Extracted metadata */
  metadata: PageMetadata;
  /** Raw HTML (for re-processing) */
  rawHtml?: string;
  /** Timestamp */
  clippedAt: string;
}

export interface ExtractedImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  isGenerated?: boolean; // AI-generated image
}

export interface PageMetadata {
  /** OpenGraph title */
  ogTitle?: string;
  /** OpenGraph description */
  ogDescription?: string;
  /** OpenGraph image */
  ogImage?: string;
  /** Author */
  author?: string;
  /** Published date */
  publishedAt?: string;
  /** Site name */
  siteName?: string;
  /** Favicon URL */
  favicon?: string;
  /** Schema.org data */
  schemaOrg?: Record<string, unknown>;
}

export type ProjectType =
  | 'ai_conversation'
  | 'ai_image'
  | 'ai_code'
  | 'article'
  | 'tutorial'
  | 'resource'
  | 'other';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface ClipperSettings {
  /** AllThrive API base URL */
  apiBaseUrl: string;
  /** Auto-detect content type */
  autoDetect: boolean;
  /** Default project visibility */
  defaultVisibility: 'public' | 'private' | 'unlisted';
  /** Include images by default */
  includeImages: boolean;
  /** Include page metadata */
  includeMetadata: boolean;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  content: string;
  sourceUrl: string;
  projectType: ProjectType;
  images?: string[];
  visibility?: 'public' | 'private' | 'unlisted';
  tags?: string[];
}

export interface CreateProjectResponse {
  success: boolean;
  project?: {
    id: number;
    slug: string;
    url: string;
    title: string;
  };
  error?: string;
}

// Message types for extension communication
export type MessageType =
  | 'CLIP_PAGE'
  | 'GET_PAGE_CONTENT'
  | 'PAGE_CONTENT_RESULT'
  | 'CHECK_AUTH'
  | 'AUTH_STATUS'
  | 'CREATE_PROJECT'
  | 'PROJECT_CREATED'
  | 'GET_SELECTION'
  | 'SELECTION_RESULT'
  | 'HIGHLIGHT_MODE'
  | 'SETTINGS_UPDATED';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ClipPageMessage extends ExtensionMessage {
  type: 'CLIP_PAGE';
  payload: {
    mode: 'full' | 'selection' | 'article';
  };
}

export interface PageContentMessage extends ExtensionMessage {
  type: 'PAGE_CONTENT_RESULT';
  payload: ClippedContent;
}

// Platform-specific extractors
export interface PlatformExtractor {
  name: string;
  matchUrl: (url: string) => boolean;
  extract: (document: Document) => Partial<ClippedContent>;
  getProjectType: () => ProjectType;
}
