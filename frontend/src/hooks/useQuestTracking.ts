/**
 * Hook for tracking page visits and profile views for quest progress.
 *
 * This hook provides:
 * - Page visit tracking with path-based deduplication (only tracks once per session)
 * - Profile view tracking with username-based deduplication
 * - Automatic celebration display when quests are completed
 *
 * Usage:
 *   const { trackPage, trackProfile } = useQuestTracking();
 *
 *   // In useEffect
 *   useEffect(() => {
 *     trackPage('/explore', 'Explore');
 *   }, [trackPage]);
 */

import { useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useQuestCompletion } from '@/contexts/QuestCompletionContext';
import { trackPageVisit, trackProfileView } from '@/services/thriveCircle';

export function useQuestTracking() {
  const { isAuthenticated } = useAuth();
  const { showCelebration } = useQuestCompletion();

  // Track which pages/profiles have been tracked this session
  const trackedPaths = useRef<Set<string>>(new Set());
  const trackedProfiles = useRef<Set<string>>(new Set());

  /**
   * Track a page visit for quest progress
   * Only tracks once per page per session (path-based deduplication)
   */
  const trackPage = useCallback(
    async (pagePath: string, pageName?: string) => {
      // Skip if not authenticated
      if (!isAuthenticated) return;

      // Skip if already tracked this session
      if (trackedPaths.current.has(pagePath)) return;

      // Mark as tracked immediately to prevent duplicate calls
      trackedPaths.current.add(pagePath);

      try {
        const response = await trackPageVisit(pagePath, pageName);

        // Show celebration if quests were completed
        if (response.completedQuests && response.completedQuests.length > 0) {
          showCelebration(
            response.completedQuests.map(q => ({
              id: q.id,
              title: q.title,
              description: '', // Page visits don't return description
              pointsAwarded: q.pointsAwarded,
              categoryName: q.categoryName,
            }))
          );
        }
      } catch (error) {
        // Remove from tracked on error so it can be retried
        trackedPaths.current.delete(pagePath);
        console.error('Failed to track page visit:', error);
      }
    },
    [isAuthenticated, showCelebration]
  );

  /**
   * Track viewing another user's profile for quest progress
   * Only tracks once per profile per session (username-based deduplication)
   */
  const trackProfile = useCallback(
    async (username: string) => {
      // Skip if not authenticated
      if (!isAuthenticated) return;

      // Skip if already tracked this session
      if (trackedProfiles.current.has(username)) return;

      // Mark as tracked immediately to prevent duplicate calls
      trackedProfiles.current.add(username);

      try {
        const response = await trackProfileView(username);

        // Show celebration if quests were completed
        if (response.completedQuests && response.completedQuests.length > 0) {
          showCelebration(
            response.completedQuests.map(q => ({
              id: q.id,
              title: q.title,
              description: q.description || '',
              pointsAwarded: q.pointsAwarded,
              categoryName: q.categoryName,
            }))
          );
        }
      } catch (error) {
        // Remove from tracked on error so it can be retried
        trackedProfiles.current.delete(username);
        console.error('Failed to track profile view:', error);
      }
    },
    [isAuthenticated, showCelebration]
  );

  return { trackPage, trackProfile };
}
