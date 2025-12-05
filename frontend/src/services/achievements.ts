// Re-export types from separate file
export type {
  Achievement,
  UserAchievement,
  AchievementProgress,
  AchievementProgressData,
  AchievementProgressItem
} from '../types/achievements';

import type { Achievement, UserAchievement, AchievementProgress, AchievementProgressData } from '../types/achievements';

/**
 * Fetch the current user's earned achievements
 */
export async function getMyAchievements(): Promise<UserAchievement[]> {
  const api = await getApiClient();
  const response = await api.get('/me/achievements/my-achievements/');
  return response.data;
}

/**
 * Fetch the current user's achievement progress (grouped by category)
 */
export async function getMyAchievementProgress(): Promise<AchievementProgressData> {
  const api = await getApiClient();
  const response = await api.get('/me/achievements/my-progress/');
  return response.data;
}

/**
 * Fetch all available achievements
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  const api = await getApiClient();
  const response = await api.get('/me/achievements/');
  return response.data;
}

/**
 * Get achievement progress for a specific achievement
 */
export async function getAchievementProgress(achievementId: number): Promise<AchievementProgress> {
  const api = await getApiClient();
  const response = await api.get(`/me/achievements/${achievementId}/progress/`);
  return response.data;
}

/**
 * Format progress percentage for display
 */
export function formatProgressPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

/**
 * Get color classes for achievement rarity
 */
export function getRarityColorClasses(rarity: string): { from: string; to: string; text: string; bg: string } {
  const colors: { [key: string]: { from: string; to: string; text: string; bg: string } } = {
    common: {
      from: 'from-slate-400',
      to: 'to-slate-500',
      text: 'text-slate-700 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-slate-900/30',
    },
    rare: {
      from: 'from-blue-500',
      to: 'to-blue-600',
      text: 'text-blue-700 dark:text-blue-300',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    epic: {
      from: 'from-purple-500',
      to: 'to-purple-600',
      text: 'text-purple-700 dark:text-purple-300',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
    },
    legendary: {
      from: 'from-yellow-500',
      to: 'to-yellow-600',
      text: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
  };

  return colors[rarity] || colors.common;
}

/**
 * Get icon component for a category
 */
export function getCategoryIcon(category: string): string {
  const icons: { [key: string]: string } = {
    projects: 'faRocket',
    battles: 'faTrophy',
    community: 'faHeart',
    engagement: 'faBolt',
    streaks: 'faFire',
  };

  return icons[category] || 'faStar';
}

/**
 * Get display name for a category
 */
export function getCategoryDisplay(category: string): string {
  const displays: { [key: string]: string } = {
    projects: 'Project Milestones',
    battles: 'Battle Champion',
    community: 'Community',
    engagement: 'Engagement',
    streaks: 'Streaks & Activity',
  };

  return displays[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Fetch achievements for a specific user by username (public endpoint)
 */
export async function getUserAchievements(username: string): Promise<AchievementProgressData> {
  const api = await getApiClient();
  const response = await api.get(`/users/${username}/achievements/`);
  return response.data;
}

/**
 * Get api client - deferred import to avoid circular dependencies
 */
import type { AxiosInstance } from 'axios';

let cachedApi: AxiosInstance | null = null;

async function getApiClient(): Promise<AxiosInstance> {
  if (!cachedApi) {
    const { api } = await import('./api');
    cachedApi = api;
  }
  return cachedApi;
}
