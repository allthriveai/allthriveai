/**
 * Types for Admin Topics Management
 */

export interface Topic {
  id: number;
  slug: string;
  title: string;
  description: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
}

export interface TopicQueryParams {
  isActive?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface CreateTopicPayload {
  slug: string;
  title: string;
  description: string;
  color: string;
  isActive?: boolean;
}

export interface UpdateTopicPayload {
  slug?: string;
  title?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export interface TopicStats {
  total: number;
  active: number;
  inactive: number;
  topTopics: {
    id: number;
    title: string;
    slug: string;
    projectCount: number;
  }[];
}

export interface BulkToggleActivePayload {
  topicIds: number[];
  isActive: boolean;
}
