/**
 * useBottomSheetGesture - Vertical swipe gesture handling for bottom sheets
 *
 * Handles touch gestures for transitioning between bottom sheet states:
 * - collapsed (bar visible only)
 * - half (50% screen height)
 * - full (full screen)
 *
 * Features:
 * - Velocity-based fast swipes skip intermediate states
 * - Rubber band effect at boundaries
 * - Works with iOS Safari (uses native event listeners)
 */

import { useRef, useCallback, useEffect } from 'react';

export type BottomSheetState = 'collapsed' | 'half' | 'full';

// Thresholds for state transitions
const TRANSITION_THRESHOLD = 100; // pixels to trigger state change
const VELOCITY_THRESHOLD = 0.3; // pixels per ms for fast gesture
// COLLAPSED_HEIGHT reserved for future rubber band effect at collapsed state

interface UseBottomSheetGestureProps {
  sheetRef: React.RefObject<HTMLElement | null>;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  currentState: BottomSheetState;
  onStateChange: (state: BottomSheetState) => void;
  onDragOffsetChange: (offset: number) => void;
  onDraggingChange: (isDragging: boolean) => void;
  isEnabled?: boolean;
}

interface TouchInfo {
  y: number;
  time: number;
  scrollTop: number;
  state: BottomSheetState;
}

/**
 * Determine next state based on drag direction and velocity
 */
function getNextState(
  currentState: BottomSheetState,
  deltaY: number, // positive = dragging down, negative = dragging up
  velocity: number // pixels per ms
): BottomSheetState {
  const isFastSwipe = Math.abs(velocity) > VELOCITY_THRESHOLD;
  const isSignificantDrag = Math.abs(deltaY) > TRANSITION_THRESHOLD;

  if (!isSignificantDrag && !isFastSwipe) {
    return currentState; // Snap back to current state
  }

  const isSwipingDown = deltaY > 0;
  const isSwipingUp = deltaY < 0;

  // Fast swipe can skip intermediate states
  if (isFastSwipe) {
    if (isSwipingDown) {
      // Fast swipe down - go to collapsed
      return 'collapsed';
    } else {
      // Fast swipe up - go to full
      return 'full';
    }
  }

  // Normal drag - transition to adjacent state
  if (isSwipingDown) {
    switch (currentState) {
      case 'full':
        return 'half';
      case 'half':
        return 'collapsed';
      case 'collapsed':
        return 'collapsed';
    }
  } else if (isSwipingUp) {
    switch (currentState) {
      case 'collapsed':
        return 'half';
      case 'half':
        return 'full';
      case 'full':
        return 'full';
    }
  }

  return currentState;
}

export function useBottomSheetGesture({
  sheetRef,
  scrollContainerRef,
  currentState,
  onStateChange,
  onDragOffsetChange,
  onDraggingChange,
  isEnabled = true,
}: UseBottomSheetGestureProps) {
  const touchStartRef = useRef<TouchInfo | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isEnabled) return;

    const touch = e.touches[0];
    const scrollContainer = scrollContainerRef.current;

    touchStartRef.current = {
      y: touch.clientY,
      time: Date.now(),
      scrollTop: scrollContainer?.scrollTop ?? 0,
      state: currentState,
    };
  }, [isEnabled, currentState, scrollContainerRef]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isEnabled || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;
    const scrollContainer = scrollContainerRef.current;

    // Check scroll position in expanded states
    const isAtTop = scrollContainer ? scrollContainer.scrollTop <= 0 : true;
    // Note: isAtBottom calculation reserved for future rubber band effect at bottom of scroll
    // const isAtBottom = scrollContainer
    //   ? scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 5
    //   : true;

    // Allow drag in these cases:
    // 1. Collapsed state - any swipe up should expand
    // 2. At top of scroll and swiping down - should collapse
    // 3. Full state at bottom and swiping up - rubber band effect
    const shouldAllowDrag =
      currentState === 'collapsed' ||
      (deltaY > 0 && isAtTop) || // Swiping down at top
      (deltaY < 0 && currentState !== 'full'); // Swiping up (not at full)

    if (shouldAllowDrag) {
      // Prevent scroll when we're handling the drag
      if (e.cancelable) {
        e.preventDefault();
      }

      // Apply resistance to make drag feel natural
      // More resistance when dragging in "wrong" direction
      let resistance = 0.6;

      // In collapsed state, swiping down should have more resistance (can't go lower)
      if (currentState === 'collapsed' && deltaY > 0) {
        resistance = 0.2;
      }
      // In full state, swiping up should have more resistance (can't go higher)
      if (currentState === 'full' && deltaY < 0) {
        resistance = 0.2;
      }

      const dragAmount = deltaY * resistance;

      isDraggingRef.current = true;
      dragOffsetRef.current = dragAmount;
      onDraggingChange(true);
      onDragOffsetChange(dragAmount);
    }
  }, [isEnabled, currentState, scrollContainerRef, onDragOffsetChange, onDraggingChange]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isEnabled || !touchStartRef.current) {
      touchStartRef.current = null;
      return;
    }

    if (!isDraggingRef.current) {
      touchStartRef.current = null;
      return;
    }

    const endTime = Date.now();
    const duration = endTime - touchStartRef.current.time;
    const velocity = duration > 0 ? dragOffsetRef.current / duration : 0;
    const deltaY = dragOffsetRef.current;

    // Determine next state
    const nextState = getNextState(currentState, deltaY, velocity);

    // Reset drag state
    isDraggingRef.current = false;
    dragOffsetRef.current = 0;
    onDraggingChange(false);
    onDragOffsetChange(0);

    // Transition to new state
    if (nextState !== currentState) {
      onStateChange(nextState);
    }

    touchStartRef.current = null;
  }, [isEnabled, currentState, onStateChange, onDragOffsetChange, onDraggingChange]);

  // Attach native event listeners
  // IMPORTANT: Must use native listeners with { passive: false } for iOS Safari
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isEnabled) return;

    sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheet.addEventListener('touchend', handleTouchEnd, { passive: true });
    sheet.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart);
      sheet.removeEventListener('touchmove', handleTouchMove);
      sheet.removeEventListener('touchend', handleTouchEnd);
      sheet.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [sheetRef, isEnabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
