// Content Engine TypeScript Types
// US-002: TypeScript types for Content Engine models

export type IdeaStatus = 'saved' | 'planned' | 'in_progress' | 'archived';
export type Platform = 'linkedin' | 'youtube' | 'twitter';
export type ClipStatus = 'draft' | 'ready' | 'scheduled' | 'published';
export type ScheduleStatus = 'scheduled' | 'published' | 'failed';

export interface ContentIdea {
  id: number;
  title: string;
  description?: string;
  status: IdeaStatus;
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaPayload {
  title: string;
  description?: string;
  platforms?: Platform[];
}

export interface UpdateIdeaPayload {
  title?: string;
  description?: string;
  status?: IdeaStatus;
  platforms?: Platform[];
}

export interface ClipScene {
  id: string;
  type: string;
  content: Record<string, unknown>;
  duration?: number;
}

export interface ContentClip {
  id: number;
  title: string;
  scenes: ClipScene[];
  status: ClipStatus;
  ideaId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledPost {
  id: number;
  clipId: number;
  clip?: ContentClip;
  platform: Platform;
  scheduledFor: string;
  status: ScheduleStatus;
  createdAt: string;
}

export interface CreateSchedulePayload {
  clipId: number;
  platform: Platform;
  scheduledFor: string;
}

export interface UpdateSchedulePayload {
  platform?: Platform;
  scheduledFor?: string;
}

export interface BrandVoice {
  id: number;
  tone: string;
  personality: string[];
  topics: string[];
  signaturePhrases: string[];
  primaryColor: string;
  accentColor: string;
}

export interface UpdateBrandVoicePayload {
  tone?: string;
  personality?: string[];
  topics?: string[];
  signaturePhrases?: string[];
  primaryColor?: string;
  accentColor?: string;
}

// Content Engine Tab types
export type ContentEngineTab = 'ideas' | 'create' | 'calendar' | 'brand';

export interface TabConfig {
  id: ContentEngineTab;
  label: string;
  icon: string;
}
