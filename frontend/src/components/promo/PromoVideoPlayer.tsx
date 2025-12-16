import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HookScene } from './scenes/HookScene';
import { BattleVideoScene } from './scenes/BattleVideoScene';
import { PortfolioVideoScene } from './scenes/PortfolioVideoScene';
import { CTAVideoScene } from './scenes/CTAVideoScene';

type SceneType = 'hook' | 'battle' | 'portfolio' | 'cta';

// Audio config - start song at 8 seconds (the drop)
const AUDIO_START_TIME = 8;

const SCENE_TIMING: Record<SceneType, { start: number; end: number }> = {
  hook: { start: 0, end: 4000 },              // 0-4s: Hook (overwhelm → fun)
  battle: { start: 4000, end: 9000 },         // 4-9s: Battle scene with results (5s)
  portfolio: { start: 9000, end: 16000 },     // 9-16s: Portfolio scene (7s)
  cta: { start: 16000, end: 21000 },          // 16-21s: CTA (5s)
};

const TOTAL_DURATION = 21000;

function usePromoTimeline() {
  const [elapsed, setElapsed] = useState(0);
  const [scene, setScene] = useState<SceneType>('hook');
  const [isPlaying, setIsPlaying] = useState(false);

  const restart = useCallback(() => {
    setElapsed(0);
    setScene('hook');
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const startTime = Date.now() - elapsed;
    const interval = setInterval(() => {
      const now = Date.now() - startTime;
      setElapsed(now);

      // Determine scene
      for (const [sceneName, timing] of Object.entries(SCENE_TIMING)) {
        if (now >= timing.start && now < timing.end) {
          setScene(sceneName as SceneType);
          break;
        }
      }

      // Loop
      if (now >= TOTAL_DURATION) {
        setElapsed(0);
        setScene('hook');
      }
    }, 16);

    return () => clearInterval(interval);
  }, [isPlaying, elapsed]);

  const timing = SCENE_TIMING[scene];
  const sceneProgress = Math.min(1, Math.max(0, (elapsed - timing.start) / (timing.end - timing.start)));
  const sceneElapsed = elapsed - timing.start;

  return { elapsed, scene, sceneProgress, sceneElapsed, isPlaying, restart, togglePlayPause };
}

export function PromoVideoPlayer() {
  const { elapsed, scene, sceneElapsed, isPlaying, restart, togglePlayPause } = usePromoTimeline();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Handle audio sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasStarted) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, hasStarted]);

  // Handle restart
  const lastElapsedRef = useRef(elapsed);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasStarted) return;

    if (lastElapsedRef.current > 1000 && elapsed < 100) {
      audio.currentTime = AUDIO_START_TIME;
      if (isPlaying) {
        audio.play().catch(console.error);
      }
    }
    lastElapsedRef.current = elapsed;
  }, [elapsed, hasStarted, isPlaying]);

  const handleStart = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = AUDIO_START_TIME;
      audio.play().catch(console.error);
    }
    setHasStarted(true);
    restart();
  }, [restart]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#020617]">
      <audio ref={audioRef} src="/promo.mp3" preload="auto" />

      {/* Click to start */}
      {!hasStarted && (
        <button
          onClick={handleStart}
          className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/90 cursor-pointer"
        >
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 flex items-center justify-center">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="text-white text-lg font-bold">Click to Play</div>
            <div className="text-white/60 text-sm mt-1">with sound</div>
          </div>
        </button>
      )}

      {/* 9:16 Portrait Container */}
      <div
        className="relative overflow-hidden bg-[#020617]"
        style={{
          width: '100%',
          maxWidth: '430px',
          aspectRatio: '9/16',
        }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Scenes */}
        <AnimatePresence mode="wait">
          {scene === 'hook' && (
            <HookScene
              key="hook"
              elapsed={sceneElapsed}
            />
          )}
          {scene === 'battle' && (
            <BattleVideoScene
              key="battle"
              elapsed={sceneElapsed}
              isPlaying={isPlaying}
            />
          )}
          {scene === 'portfolio' && (
            <PortfolioVideoScene
              key="portfolio"
              elapsed={sceneElapsed}
              isPlaying={isPlaying}
            />
          )}
          {scene === 'cta' && (
            <CTAVideoScene
              key="cta"
              elapsed={sceneElapsed}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Homepage link - positioned above controls */}
      <a
        href="/"
        className="fixed bottom-20 right-4 z-50 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-purple-400 transition-all shadow-lg"
      >
        Visit AllThrive
      </a>

      {/* Dev controls - positioned outside video area */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3 text-xs text-white/50 z-50 bg-slate-900/80 px-3 py-2 rounded-lg backdrop-blur-sm">
        <button
          onClick={togglePlayPause}
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="font-mono">
          {(elapsed / 1000).toFixed(1)}s / {scene}
        </span>
        <button
          onClick={restart}
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
        >
          Restart
        </button>
      </div>
    </div>
  );
}

export default PromoVideoPlayer;
