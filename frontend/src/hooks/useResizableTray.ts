/**
 * Hook for making a tray resizable by dragging its edge.
 *
 * Supports right-side trays (drag left edge to widen).
 */
import { useState, useCallback, useRef, useEffect } from 'react';

interface UseResizableTrayOptions {
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels or percentage of viewport */
  maxWidth?: number;
  /** Default width in pixels */
  defaultWidth?: number;
  /** Storage key for persisting width preference */
  storageKey?: string;
  /** Whether the tray is currently open */
  isOpen?: boolean;
}

interface UseResizableTrayReturn {
  /** Current width of the tray */
  width: number;
  /** Whether the user is currently dragging */
  isDragging: boolean;
  /** Whether the tray is expanded to max width */
  isExpanded: boolean;
  /** Toggle between default and max width */
  toggleExpand: () => void;
  /** Props to spread on the resize handle element */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    style: React.CSSProperties;
    className: string;
    role: string;
    'aria-label': string;
  };
  /** Reset width to default */
  resetWidth: () => void;
}

export function useResizableTray({
  minWidth = 320,
  maxWidth = 800,
  defaultWidth = 420,
  storageKey,
  isOpen = true,
}: UseResizableTrayOptions = {}): UseResizableTrayReturn {
  // Load persisted width from localStorage
  const getInitialWidth = () => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return defaultWidth;
  };

  const [width, setWidth] = useState(getInitialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Persist width changes
  useEffect(() => {
    if (storageKey && width !== defaultWidth) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [width, storageKey, defaultWidth]);

  // Reset width when tray closes
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    startWidthRef.current = width;
  }, [width]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;

    // For right-side tray, dragging left (negative delta) should increase width
    const delta = startXRef.current - clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
    setWidth(newWidth);
  }, [isDragging, minWidth, maxWidth]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch event handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX);
    }
  }, [handleDragStart]);

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  }, [defaultWidth, storageKey]);

  // Check if tray is expanded (within 50px of max)
  const isExpanded = width >= maxWidth - 50;

  // Toggle between default and max width
  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setWidth(defaultWidth);
    } else {
      setWidth(maxWidth);
    }
  }, [isExpanded, defaultWidth, maxWidth]);

  return {
    width,
    isDragging,
    isExpanded,
    toggleExpand,
    handleProps: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      style: { cursor: 'ew-resize' },
      className: 'absolute left-0 top-0 bottom-0 w-1 hover:w-1.5 bg-transparent hover:bg-primary-500/50 transition-all z-50 group',
      role: 'separator',
      'aria-label': 'Resize tray',
    },
    resetWidth,
  };
}
