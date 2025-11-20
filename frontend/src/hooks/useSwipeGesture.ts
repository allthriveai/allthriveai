import { useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface UseSwipeGestureProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 100
}: UseSwipeGestureProps) {
  const [{ x, y, rotate }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    config: { tension: 300, friction: 30 }
  }));

  const bind = useDrag(({ active, movement: [mx, my], direction: [xDir], velocity: [vx] }) => {
    const trigger = vx > 0.2; // Velocity threshold for flick
    const dir = xDir < 0 ? -1 : 1;

    if (!active && trigger) {
      // Card was flicked with enough velocity
      if (dir === 1 && onSwipeRight) {
        // Swipe right
        api.start({ x: 300, rotate: 20, config: { tension: 200, friction: 20 } });
        setTimeout(() => onSwipeRight(), 150);
      } else if (dir === -1 && onSwipeLeft) {
        // Swipe left
        api.start({ x: -300, rotate: -20, config: { tension: 200, friction: 20 } });
        setTimeout(() => onSwipeLeft(), 150);
      } else {
        // Return to center
        api.start({ x: 0, y: 0, rotate: 0 });
      }
    } else if (!active && Math.abs(mx) > threshold) {
      // Card was dragged past threshold
      if (mx > threshold && onSwipeRight) {
        // Swipe right
        api.start({ x: 300, rotate: 20, config: { tension: 200, friction: 20 } });
        setTimeout(() => onSwipeRight(), 150);
      } else if (mx < -threshold && onSwipeLeft) {
        // Swipe left
        api.start({ x: -300, rotate: -20, config: { tension: 200, friction: 20 } });
        setTimeout(() => onSwipeLeft(), 150);
      } else {
        // Return to center
        api.start({ x: 0, y: 0, rotate: 0 });
      }
    } else if (active) {
      // While dragging
      api.start({
        x: mx,
        y: my,
        rotate: mx / 10,
        immediate: true
      });
    } else {
      // Return to center
      api.start({ x: 0, y: 0, rotate: 0 });
    }
  });

  const reset = () => {
    api.start({ x: 0, y: 0, rotate: 0, immediate: true });
  };

  return { bind, styles: { x, y, rotate }, reset };
}
