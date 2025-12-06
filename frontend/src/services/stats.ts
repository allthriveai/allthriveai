/**
 * Platform statistics service
 */
import { api } from './api';

export interface PlatformStats {
  activeCreators: number;
  projectsShared: number;
  collectivePoints: number;
}

/**
 * Get platform-wide statistics
 * Public endpoint for landing page
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await api.get('/stats/platform/');
  return response.data;
}

/**
 * Format large numbers with K, M suffix
 */
export function formatStat(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M+`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K+`;
  }
  return `${num}+`;
}
