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
  console.log('[getPlatformStats] Making API call...');
  const response = await api.get('/stats/platform/');
  console.log('[getPlatformStats] Full response:', response);
  console.log('[getPlatformStats] Response data:', response.data);
  console.log('[getPlatformStats] Data type:', typeof response.data);
  console.log('[getPlatformStats] Data keys:', response.data ? Object.keys(response.data) : 'no data');
  console.log('[getPlatformStats] activeCreators:', response.data?.activeCreators);
  console.log('[getPlatformStats] active_creators:', response.data?.active_creators);
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
