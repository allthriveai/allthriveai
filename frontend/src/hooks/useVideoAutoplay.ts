import { useEffect, useState, useRef, type RefObject } from 'react';

interface UseVideoAutoplayOptions {
  /** Threshold for when to start autoplay (0-1, default 0.5 = 50% visible) */
  playThreshold?: number;
  /** Threshold for when to pause (0-1, default 0.2 = 20% visible) */
  pauseThreshold?: number;
  /** Whether autoplay is enabled (default true) */
  enabled?: boolean;
}

interface UseVideoAutoplayReturn {
  /** Whether the element is currently visible enough to play */
  shouldPlay: boolean;
  /** Whether the element is currently in the viewport at all */
  isVisible: boolean;
  /** Ref to attach to the container element */
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Hook for managing video autoplay based on viewport visibility.
 *
 * Uses IntersectionObserver to detect when an element is visible
 * and returns state for whether the video should play.
 *
 * @example
 * ```tsx
 * function VideoCard({ videoUrl }) {
 *   const { shouldPlay, containerRef } = useVideoAutoplay();
 *
 *   return (
 *     <div ref={containerRef}>
 *       <video
 *         src={videoUrl}
 *         autoPlay={shouldPlay}
 *         muted
 *         playsInline
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoAutoplay({
  playThreshold = 0.5,
  pauseThreshold = 0.2,
  enabled = true,
}: UseVideoAutoplayOptions = {}): UseVideoAutoplayReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);
  const lastRatioRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShouldPlay(false);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const ratio = entry.intersectionRatio;
          const wasVisible = lastRatioRef.current >= pauseThreshold;
          lastRatioRef.current = ratio;

          // Update visibility state
          setIsVisible(ratio > 0);

          // Start playing when crossing playThreshold from below
          if (ratio >= playThreshold) {
            setShouldPlay(true);
          }
          // Stop playing when crossing pauseThreshold from above
          else if (wasVisible && ratio < pauseThreshold) {
            setShouldPlay(false);
          }
        });
      },
      {
        // Multiple thresholds to detect crossing points
        threshold: [0, pauseThreshold, playThreshold, 0.8, 1],
        // Use root margin to start observing slightly before element enters viewport
        rootMargin: '50px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [enabled, playThreshold, pauseThreshold]);

  return {
    shouldPlay: enabled && shouldPlay,
    isVisible,
    containerRef,
  };
}

/**
 * Global video manager to limit concurrent playing videos.
 * Ensures only a limited number of videos play simultaneously to save resources.
 */
class VideoAutoplayManager {
  private static instance: VideoAutoplayManager;
  private playingVideos: Set<string> = new Set();
  private maxConcurrent = 2;

  private constructor() {}

  static getInstance(): VideoAutoplayManager {
    if (!VideoAutoplayManager.instance) {
      VideoAutoplayManager.instance = new VideoAutoplayManager();
    }
    return VideoAutoplayManager.instance;
  }

  canPlay(videoId: string): boolean {
    if (this.playingVideos.has(videoId)) return true;
    return this.playingVideos.size < this.maxConcurrent;
  }

  registerPlaying(videoId: string): void {
    this.playingVideos.add(videoId);
  }

  unregisterPlaying(videoId: string): void {
    this.playingVideos.delete(videoId);
  }

  getPlayingCount(): number {
    return this.playingVideos.size;
  }
}

export const videoAutoplayManager = VideoAutoplayManager.getInstance();
