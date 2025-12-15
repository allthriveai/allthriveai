/**
 * Hook for tracking user engagement with content.
 *
 * Automatically tracks:
 * - Time spent on page (total and active)
 * - Scroll depth reached
 * - View milestones (30+ second views)
 *
 * Usage:
 * ```tsx
 * function ProjectPage({ projectId }: { projectId: number }) {
 *   useEngagementTracking(projectId, { enabled: isAuthenticated });
 *   return <div>...</div>;
 * }
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';

import {
  flushEvents,
  trackScrollDepth,
  trackTimeSpent,
  trackViewMilestone,
} from '../services/engagement';

interface UseEngagementTrackingOptions {
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
  /** Threshold in seconds for view milestone (default: 30) */
  viewMilestoneThreshold?: number;
  /** Minimum scroll depth change to report (default: 10) */
  scrollDepthThreshold?: number;
  /** Interval in seconds for time tracking updates (default: 30) */
  timeTrackingInterval?: number;
}

interface EngagementState {
  startTime: number;
  totalTime: number;
  activeTime: number;
  lastReportedActiveTime: number;
  maxScrollDepth: number;
  lastScrollDepthReported: number;
  isActive: boolean;
  viewMilestoneTriggered: boolean;
}

/**
 * Track user engagement with a project.
 *
 * @param projectId - The project ID to track engagement for
 * @param options - Configuration options
 */
export function useEngagementTracking(
  projectId: number | null | undefined,
  options: UseEngagementTrackingOptions = {}
): void {
  const {
    enabled = true,
    viewMilestoneThreshold = 30,
    scrollDepthThreshold = 10,
    timeTrackingInterval = 30,
  } = options;

  // Track engagement state across renders
  const stateRef = useRef<EngagementState>({
    startTime: Date.now(),
    totalTime: 0,
    activeTime: 0,
    lastReportedActiveTime: 0,
    maxScrollDepth: 0,
    lastScrollDepthReported: 0,
    isActive: true,
    viewMilestoneTriggered: false,
  });

  // Store interval IDs for cleanup
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate current scroll depth
  const getScrollDepth = useCallback((): number => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollableHeight = scrollHeight - clientHeight;

    if (scrollableHeight <= 0) return 100; // No scroll needed
    return Math.min(100, Math.round((scrollTop / scrollableHeight) * 100));
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!projectId || !enabled) return;

    const depth = getScrollDepth();
    const state = stateRef.current;

    if (depth > state.maxScrollDepth) {
      state.maxScrollDepth = depth;

      // Report if we've crossed a threshold
      if (depth - state.lastScrollDepthReported >= scrollDepthThreshold) {
        trackScrollDepth(projectId, depth);
        state.lastScrollDepthReported = depth;
      }
    }
  }, [projectId, enabled, getScrollDepth, scrollDepthThreshold]);

  // Handle visibility changes (track active vs inactive time)
  const handleVisibilityChange = useCallback(() => {
    const state = stateRef.current;
    const now = Date.now();

    if (document.hidden) {
      // Page hidden - add active time
      if (state.isActive) {
        state.activeTime += (now - state.startTime) / 1000;
      }
      state.isActive = false;
    } else {
      // Page visible again
      state.startTime = now;
      state.isActive = true;
    }
  }, []);

  // Handle user activity (mouse, keyboard, touch)
  const handleActivity = useCallback(() => {
    const state = stateRef.current;
    if (!state.isActive) {
      state.isActive = true;
      state.startTime = Date.now();
    }
  }, []);

  // Send time spent data (incremental since last report)
  const sendTimeData = useCallback(() => {
    if (!projectId || !enabled) return;

    const state = stateRef.current;
    const now = Date.now();

    // Calculate current total active time
    let currentTotalActive = state.activeTime;
    if (state.isActive) {
      currentTotalActive += (now - state.startTime) / 1000;
    }

    // Calculate incremental time since last report
    const incrementalSeconds = Math.round(currentTotalActive - state.lastReportedActiveTime);
    if (incrementalSeconds > 0) {
      trackTimeSpent(projectId, incrementalSeconds, incrementalSeconds);
      // Update last reported time to current total
      state.lastReportedActiveTime = currentTotalActive;
    }
  }, [projectId, enabled]);

  // Setup effect
  useEffect(() => {
    if (!projectId || !enabled) return;

    // Reset state for new project
    stateRef.current = {
      startTime: Date.now(),
      totalTime: 0,
      activeTime: 0,
      lastReportedActiveTime: 0,
      maxScrollDepth: getScrollDepth(),
      lastScrollDepthReported: 0,
      isActive: true,
      viewMilestoneTriggered: false,
    };

    // Set up view milestone timeout
    milestoneTimeoutRef.current = setTimeout(() => {
      if (stateRef.current.isActive && !stateRef.current.viewMilestoneTriggered) {
        trackViewMilestone(projectId, viewMilestoneThreshold);
        stateRef.current.viewMilestoneTriggered = true;
      }
    }, viewMilestoneThreshold * 1000);

    // Set up periodic time tracking
    timeIntervalRef.current = setInterval(() => {
      sendTimeData();
    }, timeTrackingInterval * 1000);

    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleActivity, { passive: true });
    document.addEventListener('keydown', handleActivity, { passive: true });
    document.addEventListener('touchstart', handleActivity, { passive: true });

    // Cleanup function
    return () => {
      // Clear timers
      if (milestoneTimeoutRef.current) {
        clearTimeout(milestoneTimeoutRef.current);
        milestoneTimeoutRef.current = null;
      }
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }

      // Remove event listeners
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);

      // Send final data
      sendTimeData();

      // Report final scroll depth if significant
      const state = stateRef.current;
      if (
        state.maxScrollDepth > state.lastScrollDepthReported &&
        state.maxScrollDepth - state.lastScrollDepthReported >= scrollDepthThreshold
      ) {
        trackScrollDepth(projectId, state.maxScrollDepth);
      }

      // Flush events immediately on cleanup
      flushEvents();
    };
  }, [
    projectId,
    enabled,
    viewMilestoneThreshold,
    scrollDepthThreshold,
    timeTrackingInterval,
    getScrollDepth,
    handleScroll,
    handleVisibilityChange,
    handleActivity,
    sendTimeData,
  ]);
}

export default useEngagementTracking;
