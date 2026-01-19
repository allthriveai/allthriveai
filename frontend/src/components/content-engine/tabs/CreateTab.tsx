/**
 * Create Tab - Chat-first clip creator with responsive layout
 * US-005: Create Tab with responsive chat layout
 *
 * Mobile: Preview at top (9:16), chat below, input at bottom
 * Desktop: Chat on left, preview on right (side-by-side)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipCreatorChatPanel } from '@/components/creator/ClipCreatorChatPanel';
import { ClipPreview } from '@/components/creator/ClipPreview';
import type { SocialClipContent } from '@/types/clips';

interface CreateTabProps {
  isActive?: boolean;
}

export function CreateTab({ isActive = true }: CreateTabProps) {
  const [clipData, setClipData] = useState<SocialClipContent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const previewRef = useRef<{ captureFrame: () => Promise<Blob | null>; getElement: () => HTMLDivElement | null }>(null);

  // Handle clip updates from chat
  const handleClipUpdate = useCallback((newClipData: SocialClipContent) => {
    setClipData(newClipData);
    setCurrentTime(0);
    setIsPlaying(true);
  }, []);

  // Handle time updates from preview
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle playback complete
  const handleComplete = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    if (!clipData) return;
    setIsPlaying((prev) => !prev);
  }, [clipData]);

  // Pause when tab becomes inactive
  useEffect(() => {
    if (!isActive && isPlaying) {
      setIsPlaying(false);
    }
  }, [isActive, isPlaying]);

  // Empty clip data for preview
  const emptyClipData: SocialClipContent = {
    template: 'explainer',
    scenes: [],
    duration: 0,
    style: {
      primaryColor: '#22D3EE',
      accentColor: '#10B981',
    },
  };

  return (
    <div
      id="tabpanel-create"
      role="tabpanel"
      aria-labelledby="tab-create"
      className="h-full"
    >
      {/* Mobile layout: stacked */}
      <div className="md:hidden flex flex-col h-full">
        {/* Preview (collapsible on mobile) */}
        <div className="flex-shrink-0 flex justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-[200px]" onClick={togglePlayback}>
            <ClipPreview
              ref={previewRef}
              clipData={clipData || emptyClipData}
              isPlaying={isPlaying}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onComplete={handleComplete}
            />
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ClipCreatorChatPanel onClipUpdate={handleClipUpdate} />
        </div>
      </div>

      {/* Desktop layout: side-by-side */}
      <div className="hidden md:flex h-full gap-4">
        {/* Chat panel - left side */}
        <div className="flex-1 min-w-0 glass-panel rounded-xl overflow-hidden">
          <ClipCreatorChatPanel onClipUpdate={handleClipUpdate} />
        </div>

        {/* Preview - right side */}
        <div className="w-[320px] lg:w-[380px] flex-shrink-0 flex flex-col items-center justify-center p-4 glass-panel rounded-xl">
          <div className="w-full" onClick={togglePlayback}>
            <ClipPreview
              ref={previewRef}
              clipData={clipData || emptyClipData}
              isPlaying={isPlaying}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onComplete={handleComplete}
            />
          </div>

          {/* Playback controls */}
          {clipData && (
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-400">
                {isPlaying ? 'Playing...' : 'Click preview to play'}
              </p>
              {clipData.duration > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {(currentTime / 1000).toFixed(1)}s / {(clipData.duration / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
