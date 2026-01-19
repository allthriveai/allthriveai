/**
 * Content Engine Pillars API Service
 * US-017: Pillars API service for fetching content pillars
 */

import { api } from '../api';
import type { ContentPillar } from '@/types/contentEngine';

export interface PillarsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContentPillar[];
}

/**
 * Get list of content pillars from the taxonomy API
 * Filters by taxonomy_type=content_pillar
 */
export async function getContentPillars(): Promise<ContentPillar[]> {
  const response = await api.get<PillarsListResponse>(
    '/taxonomies/?taxonomy_type=content_pillar'
  );
  return response.data.results;
}

/**
 * Pillars API object for convenience
 */
export const pillarsApi = {
  list: getContentPillars,
};
