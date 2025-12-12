import { api } from './api';
import type { Project } from '@/types/models';

/**
 * Topic detail response from the API.
 * Includes AI-generated definition and related projects.
 */
export interface TopicDetail {
  slug: string;
  displayName: string;
  description: string;
  projects: Project[];
  projectCount: number;
  exploreUrl: string;
}

/**
 * Get topic definition and related projects.
 *
 * If the topic hasn't been seen before, the backend will
 * generate a definition using AI and cache it.
 *
 * @param slug - Topic slug (e.g., "ai-agents", "machine-learning")
 * @param limit - Maximum number of related projects to return (default: 10)
 */
export async function getTopicDetail(
  slug: string,
  limit: number = 10
): Promise<TopicDetail> {
  const params = new URLSearchParams();
  if (limit !== 10) {
    params.set('limit', limit.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `/topics/${slug}/?${queryString}` : `/topics/${slug}/`;

  const response = await api.get<TopicDetail>(url);
  return response.data;
}

/**
 * Normalize a topic string to a URL-safe slug.
 * Converts to lowercase and replaces spaces/underscores with hyphens.
 */
export function normalizeTopicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
