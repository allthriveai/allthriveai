// Content Engine TypeScript Types
// US-002: TypeScript types for Content Engine models

// Idea statuses matching backend ContentIdea.Status
export type IdeaStatus = 'saved' | 'planned' | 'in_progress' | 'archived';

// Idea sources matching backend ContentIdea.Source
export type IdeaSource = 'mcp' | 'web' | 'mobile' | 'brainstorm';

// Platform options matching backend ScheduledPost.Platform
export type Platform = 'linkedin' | 'youtube' | 'twitter';

// Clip statuses matching backend ContentClip.Status
export type ClipStatus =
  | 'draft'
  | 'ready_for_review'
  | 'needs_changes'
  | 'approved'
  | 'scheduled'
  | 'published';

// Schedule statuses matching backend ScheduledPost.Status
export type ScheduleStatus =
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

// ContentIdea matching backend ContentIdeaSerializer
export interface ContentIdea {
  id: number;
  title: string;
  description?: string;
  contentPillar?: string;
  platforms: Platform[];
  source: IdeaSource;
  status: IdeaStatus;
  plannedForWeek?: string;
  order: number;
  clipsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaPayload {
  title: string;
  description?: string;
  contentPillar?: string;
  platforms?: Platform[];
  source?: IdeaSource;
}

export interface UpdateIdeaPayload {
  title?: string;
  description?: string;
  contentPillar?: string;
  status?: IdeaStatus;
  platforms?: Platform[];
  plannedForWeek?: string;
  order?: number;
}

export interface ClipScene {
  id: string;
  type: string;
  content: Record<string, unknown>;
  duration?: number;
}

// ContentClip matching backend ContentClipSerializer
export interface ContentClip {
  id: number;
  title: string;
  description?: string;
  idea?: number;
  ideaTitle?: string;
  scenes: ClipScene[];
  duration: number;
  style: Record<string, unknown>;
  status: ClipStatus;
  reviewNotes?: string;
  scheduledPostsCount: number;
  createdAt: string;
  updatedAt: string;
}

// ScheduledPost matching backend ScheduledPostSerializer
export interface ScheduledPost {
  id: number;
  clip: number;
  clipTitle?: string;
  platform: Platform;
  platformDisplay?: string;
  textContent: string;
  platformSpecific?: Record<string, unknown>;
  scheduledFor: string;
  status: ScheduleStatus;
  statusDisplay?: string;
  publishedAt?: string;
  platformPostId?: string;
  platformUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchedulePayload {
  clip: number;
  platform: Platform;
  textContent: string;
  platformSpecific?: Record<string, unknown>;
  scheduledFor: string;
}

export interface UpdateSchedulePayload {
  platform?: Platform;
  textContent?: string;
  platformSpecific?: Record<string, unknown>;
  scheduledFor?: string;
}

// Content Engine BrandVoice matching backend BrandVoiceSerializer
export interface ContentEngineBrandVoice {
  id: number;
  tone: string;
  personalityTraits: string[];
  topics: string[];
  signaturePhrases: string[];
  defaultCta: string;
  primaryColor: string;
  accentColor: string;
  visualStyle: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateContentEngineBrandVoicePayload {
  tone?: string;
  personalityTraits?: string[];
  topics?: string[];
  signaturePhrases?: string[];
  defaultCta?: string;
  primaryColor?: string;
  accentColor?: string;
  visualStyle?: string;
}

// Content Engine Tab types
export type ContentEngineTab = 'ideas' | 'create' | 'calendar' | 'brand';

export interface TabConfig {
  id: ContentEngineTab;
  label: string;
  icon: string;
}

// ContentPillar matching backend Taxonomy with taxonomy_type='content_pillar'
export interface ContentPillar {
  id: number;
  name: string;
  slug: string;
  taxonomyType: string;
  taxonomyTypeDisplay: string;
  description?: string;
  isActive: boolean;
  color?: string;
  websiteUrl?: string;
  logoUrl?: string;
  usageTips?: string;
  bestFor?: string;
  parentId?: number | null;
}

// Suggested idea from Echo agent
export interface SuggestedIdea {
  title: string;
  description?: string;
  hook?: string;
  pillarId?: number;
  pillarName?: string;
  platforms?: Platform[];
}
