/**
 * Analytics tracking service for project views and clicks.
 * Sends tracking data to the backend for trending algorithm calculations.
 */

import { api } from './api';

// View source types matching backend ViewSource enum
export type ViewSource = 'explore' | 'profile' | 'direct' | 'search' | 'embed';

// Click source types matching backend ClickSource enum
export type ClickSource =
  | 'explore_for_you'
  | 'explore_trending'
  | 'explore_new'
  | 'explore_news'
  | 'search'
  | 'profile'
  | 'related';

interface TrackViewResponse {
  status: 'recorded' | 'deduplicated';
}

interface TrackClickResponse {
  status: 'recorded';
}

interface TrackBatchClicksResponse {
  status: 'recorded';
  count: number;
}

interface ClickData {
  project_id: number;
  source: ClickSource;
  position?: number;
}

/**
 * Track a project view.
 * Called when a user navigates to a project page.
 * Views are deduplicated on the backend (5 min window).
 */
export async function trackProjectView(
  projectId: number,
  source: ViewSource = 'direct'
): Promise<TrackViewResponse | null> {
  try {
    const response = await api.post<TrackViewResponse>(
      `/projects/${projectId}/track-view/`,
      { source }
    );
    return response.data;
  } catch (error) {
    // Silently fail - tracking should not block user experience
    console.debug('Failed to track view:', error);
    return null;
  }
}

/**
 * Track a click on a project card in a feed.
 * Called when a user clicks on a project card before navigation.
 */
export async function trackProjectClick(
  projectId: number,
  source: ClickSource,
  position?: number
): Promise<TrackClickResponse | null> {
  try {
    const response = await api.post<TrackClickResponse>(
      '/projects/track-click/',
      {
        projectId,
        source,
        position,
      }
    );
    return response.data;
  } catch (error) {
    // Silently fail - tracking should not block user experience
    console.debug('Failed to track click:', error);
    return null;
  }
}

/**
 * Track multiple clicks in a batch.
 * Useful for tracking when leaving a page with queued clicks.
 */
export async function trackBatchClicks(
  clicks: ClickData[]
): Promise<TrackBatchClicksResponse | null> {
  if (clicks.length === 0) return null;

  try {
    const response = await api.post<TrackBatchClicksResponse>(
      '/projects/track-clicks/',
      { clicks }
    );
    return response.data;
  } catch (error) {
    // Silently fail - tracking should not block user experience
    console.debug('Failed to track batch clicks:', error);
    return null;
  }
}

/**
 * Determine the view source based on referrer URL.
 */
export function getViewSourceFromReferrer(): ViewSource {
  const referrer = document.referrer;
  const currentUrl = window.location.href;

  if (!referrer) {
    return 'direct';
  }

  try {
    const referrerUrl = new URL(referrer);
    const currentOrigin = window.location.origin;

    // External referrer
    if (referrerUrl.origin !== currentOrigin) {
      return 'direct';
    }

    // Check referrer path
    const path = referrerUrl.pathname;

    if (path.includes('/explore')) {
      return 'explore';
    }

    if (path.includes('/search')) {
      return 'search';
    }

    if (path.match(/^\/[^/]+$/)) {
      // Single segment path like /username
      return 'profile';
    }

    return 'direct';
  } catch {
    return 'direct';
  }
}

/**
 * Map explore tab to click source.
 */
export function getClickSourceFromTab(tab: string): ClickSource {
  switch (tab) {
    case 'for-you':
      return 'explore_for_you';
    case 'trending':
      return 'explore_trending';
    case 'new':
      return 'explore_new';
    case 'news':
      return 'explore_news';
    default:
      return 'explore_new';
  }
}
