import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RalphScene } from '@/components/promo/scenes/RalphScene';

const SCENE_DURATION = 38000; // 38 seconds total

export default function RalphPromoPage() {
  const [searchParams] = useSearchParams();
  const hideControls = searchParams.get('record') === 'true';
  const autoStart = searchParams.get('autostart') === 'true';
  const hidePlaceholder = searchParams.get('hidePlaceholder') === 'true';

  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoStart);
  const [hasStarted, setHasStarted] = useState(autoStart);

  const restart = useCallback(() => {
    setElapsed(0);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleStart = useCallback(() => {
    setHasStarted(true);
    restart();
  }, [restart]);

  useEffect(() => {
    if (!isPlaying) return;

    const startTime = Date.now() - elapsed;
    const interval = setInterval(() => {
      const now = Date.now() - startTime;
      setElapsed(now);

      // Loop after scene duration
      if (now >= SCENE_DURATION) {
        setElapsed(0);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [isPlaying, elapsed]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Click to start overlay */}
        {!hasStarted && (
          <button
            onClick={handleStart}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f0f0f] cursor-pointer"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="text-white/80 text-sm">Click to preview</div>
            </div>
          </button>
        )}

        {/* 4:5 Portrait Container (LinkedIn/Twitter optimized) */}
        <div
          className="relative overflow-hidden bg-[#0f0f0f]"
          style={{
            width: '100%',
            maxWidth: '540px',
            aspectRatio: '4/5',
          }}
        >
          <RalphScene elapsed={elapsed} hidePlaceholder={hidePlaceholder} />
        </div>

        {/* Dev controls - hidden in record mode, positioned below the frame */}
        {!hideControls && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-white/50 z-50">
            <button
              onClick={togglePlayPause}
              className="px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <span className="font-mono">
              {(elapsed / 1000).toFixed(1)}s
            </span>
            <button
              onClick={restart}
              className="px-3 py-1.5 bg-white/10 rounded hover:bg-white/20 transition-colors"
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
