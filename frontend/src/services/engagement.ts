/**
 * Engagement tracking service for personalization learning.
 *
 * Tracks user engagement signals (time spent, scroll depth, view milestones)
 * and batches them for efficient backend processing.
 *
 * Uses debouncing and batching to minimize API calls while ensuring
 * data is captured even on page unload.
 */

import { api } from './api';

// Event types matching backend EngagementEvent.EventType
export type EngagementEventType =
  | 'view'
  | 'view_milestone'
  | 'scroll_depth'
  | 'time_spent'
  | 'like';

interface EngagementEvent {
  event_type: EngagementEventType;
  project_id: number;
  payload: Record<string, unknown>;
}

interface BatchResponse {
  created: number;
  event_ids: number[];
  errors?: Array<{ index: number; error: string }>;
}

// Event buffer for batching
let eventBuffer: EngagementEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

// Configuration
const FLUSH_INTERVAL_MS = 10000; // Flush every 10 seconds
const MAX_BUFFER_SIZE = 20; // Flush when buffer reaches this size

/**
 * Add an event to the buffer and schedule a flush.
 */
function queueEvent(event: EngagementEvent): void {
  eventBuffer.push(event);

  // Flush immediately if buffer is full
  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents();
    return;
  }

  // Schedule a delayed flush
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushEvents();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush all queued events to the backend.
 */
export async function flushEvents(): Promise<BatchResponse | null> {
  // Clear the timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Get events and clear buffer
  const events = eventBuffer;
  eventBuffer = [];

  if (events.length === 0) {
    return null;
  }

  try {
    const response = await api.post<BatchResponse>('/engagement/batch/', {
      events,
    });
    return response.data;
  } catch (error) {
    // On failure, put events back in buffer for retry
    eventBuffer = [...events, ...eventBuffer];
    console.debug('Failed to flush engagement events:', error);
    return null;
  }
}

/**
 * Track a view milestone (user viewed project for 30+ seconds).
 */
export function trackViewMilestone(
  projectId: number,
  thresholdSeconds: number = 30
): void {
  queueEvent({
    event_type: 'view_milestone',
    project_id: projectId,
    payload: { threshold_seconds: thresholdSeconds },
  });
}

/**
 * Track time spent on a project.
 *
 * @param projectId - The project being viewed
 * @param seconds - Total time on page in seconds
 * @param activeSeconds - Active interaction time (optional)
 */
export function trackTimeSpent(
  projectId: number,
  seconds: number,
  activeSeconds?: number
): void {
  const payload: Record<string, number> = { seconds };
  if (activeSeconds !== undefined) {
    payload.active_seconds = activeSeconds;
  }

  queueEvent({
    event_type: 'time_spent',
    project_id: projectId,
    payload,
  });
}

/**
 * Track scroll depth reached on a project.
 *
 * @param projectId - The project being viewed
 * @param depthPercent - Maximum scroll depth as percentage (0-100)
 */
export function trackScrollDepth(projectId: number, depthPercent: number): void {
  queueEvent({
    event_type: 'scroll_depth',
    project_id: projectId,
    payload: { depth_percent: Math.round(depthPercent) },
  });
}

/**
 * Track a project view event.
 * Note: This is separate from the existing view tracking in tracking.ts
 * which is used for trending calculations. This is for personalization.
 */
export function trackView(projectId: number): void {
  queueEvent({
    event_type: 'view',
    project_id: projectId,
    payload: {},
  });
}

/**
 * Register event handlers for page unload to flush pending events.
 * Call this once when the app initializes.
 */
export function initializeEngagementTracking(): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Use sendBeacon for reliable delivery on page hide
      sendBeaconFlush();
    }
  };

  const handleBeforeUnload = () => {
    sendBeaconFlush();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
  };
}

/**
 * Use sendBeacon for reliable delivery when page is unloading.
 */
function sendBeaconFlush(): void {
  if (eventBuffer.length === 0) return;

  const events = eventBuffer;
  eventBuffer = [];

  // Build the URL with proper base
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/api/engagement/batch/`;

  // sendBeacon with JSON payload
  const blob = new Blob([JSON.stringify({ events })], {
    type: 'application/json',
  });

  // Note: sendBeacon doesn't support custom headers, so CSRF token
  // must be handled via cookie (SameSite attribute handles this)
  try {
    const success = navigator.sendBeacon(url, blob);
    if (!success) {
      console.debug('sendBeacon failed, events may be lost');
    }
  } catch (error) {
    console.debug('sendBeacon error:', error);
  }
}

/**
 * Get the current buffer size (useful for debugging).
 */
export function getBufferSize(): number {
  return eventBuffer.length;
}

/**
 * Clear the event buffer (useful for testing).
 */
export function clearBuffer(): void {
  eventBuffer = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}
