import { useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface UseSwipeGestureProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60, // Lower threshold for easier mobile swiping
  enabled = true,
}: UseSwipeGestureProps) {
  const [{ x, y, rotate }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    config: { tension: 300, friction: 30 }
  }));

  const bind = useDrag(
    ({ active, movement: [mx, my], direction: [xDir], velocity: [vx] }) => {
      if (!enabled) {
        api.start({ x: 0, y: 0, rotate: 0, immediate: true });
        return;
      }

      // Lower velocity threshold for easier flick detection on mobile
      const trigger = vx > 0.15;
      const dir = xDir < 0 ? -1 : 1;

      if (!active && trigger) {
        // Card was flicked with enough velocity
        if (dir === 1 && onSwipeRight) {
          api.start({ x: 300, rotate: 20, config: { tension: 200, friction: 20 } });
          setTimeout(() => onSwipeRight(), 150);
        } else if (dir === -1 && onSwipeLeft) {
          api.start({ x: -300, rotate: -20, config: { tension: 200, friction: 20 } });
          setTimeout(() => onSwipeLeft(), 150);
        } else {
          api.start({ x: 0, y: 0, rotate: 0 });
        }
      } else if (!active && Math.abs(mx) > threshold) {
        // Card was dragged past threshold
        if (mx > threshold && onSwipeRight) {
          api.start({ x: 300, rotate: 20, config: { tension: 200, friction: 20 } });
          setTimeout(() => onSwipeRight(), 150);
        } else if (mx < -threshold && onSwipeLeft) {
          api.start({ x: -300, rotate: -20, config: { tension: 200, friction: 20 } });
          setTimeout(() => onSwipeLeft(), 150);
        } else {
          api.start({ x: 0, y: 0, rotate: 0 });
        }
      } else if (active) {
        // While dragging - constrain vertical movement for cleaner swipes
        api.start({
          x: mx,
          y: my * 0.3, // Reduce vertical movement
          rotate: mx / 15, // Slightly less rotation
          immediate: true
        });
      } else {
        api.start({ x: 0, y: 0, rotate: 0 });
      }
    },
    {
      // Better touch handling settings
      filterTaps: true, // Don't trigger on taps
      axis: 'x', // Primarily horizontal movement
      bounds: { left: -200, right: 200 }, // Limit drag distance
      rubberband: true, // Elastic feel at bounds
    }
  );

  const reset = () => {
    api.start({ x: 0, y: 0, rotate: 0, immediate: true });
  };

  return { bind, styles: { x, y, rotate }, reset };
}
