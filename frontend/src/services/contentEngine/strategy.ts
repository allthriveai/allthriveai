/**
 * Content Engine Strategy API Service
 * Manages user content strategy for Echo coaching
 */

import { api } from '../api';
import type { Strategy, UpdateStrategyPayload } from '@/types/contentEngine';

/**
 * Get user's strategy (creates one if not exists)
 */
export async function getStrategy(): Promise<Strategy> {
  const response = await api.get('/content-engine/strategy/');
  return response.data;
}

/**
 * Update user's strategy (partial updates supported)
 */
export async function updateStrategy(data: UpdateStrategyPayload): Promise<Strategy> {
  const response = await api.put('/content-engine/strategy/', data);
  return response.data;
}

/**
 * Strategy API object for convenience
 */
export const strategyApi = {
  get: getStrategy,
  update: updateStrategy,
};
