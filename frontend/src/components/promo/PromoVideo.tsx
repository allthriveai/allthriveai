import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HookScene } from './scenes/HookScene';
import { PortfolioScene } from './scenes/PortfolioScene';
import { BattleScene } from './scenes/BattleScene';
import { CommunityScene } from './scenes/CommunityScene';
import { CTAScene } from './scenes/CTAScene';

type SceneType = 'hook' | 'portfolio' | 'battle' | 'community' | 'cta';

const SCENE_TIMING: Record<SceneType, { start: number; end: number }> = {
  hook: { start: 0, end: 4000 },           // 0-4s: Hook (overwhelm → fun)
  battle: { start: 4000, end: 12000 },      // 4-12s: Battle scene (8s)
  portfolio: { start: 12000, end: 19000 },  // 12-19s: Portfolio scene (7s)
  community: { start: 19000, end: 25000 },  // 19-25s: Community scene (6s)
  cta: { start: 25000, end: 30000 },        // 25-30s: CTA (5s)
};

// Set to false to enable full 30-second promo
const DEV_MODE = false;

export function usePromoTimeline() {
  // In DEV_MODE, start at the battle scene's start time
  const [elapsed, setElapsed] = useState(DEV_MODE ? SCENE_TIMING.battle.start : 0);
  const [scene, setScene] = useState<SceneType>(DEV_MODE ? 'battle' : 'hook');
  const [isPlaying, setIsPlaying] = useState(true);

  const restart = useCallback(() => {
    setElapsed(DEV_MODE ? SCENE_TIMING.battle.start : 0);
    setScene(DEV_MODE ? 'battle' : 'hook');
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

      // Determine scene based on elapsed time
      for (const [sceneName, timing] of Object.entries(SCENE_TIMING)) {
        if (now >= timing.start && now < timing.end) {
          setScene(sceneName as SceneType);
          break;
        }
      }

      // Loop after 30 seconds (or 18s in dev mode for battle only)
      const maxTime = DEV_MODE ? SCENE_TIMING.battle.end : 30000;
      if (now >= maxTime) {
        setElapsed(DEV_MODE ? SCENE_TIMING.battle.start : 0);
        setScene(DEV_MODE ? 'battle' : 'hook');
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [isPlaying, elapsed]);

  // Calculate progress within current scene (0-1)
  const timing = SCENE_TIMING[scene];
  const sceneProgress = Math.min(1, Math.max(0, (elapsed - timing.start) / (timing.end - timing.start)));

  return { elapsed, scene, sceneProgress, isPlaying, restart, togglePlayPause };
}

interface PromoVideoProps {
  onComplete?: () => void;
}

export function PromoVideo({ onComplete: _onComplete }: PromoVideoProps) {
  const { elapsed, scene, sceneProgress, isPlaying, restart, togglePlayPause } = usePromoTimeline();

  // Scene-local elapsed time (time since scene started)
  const sceneElapsed = elapsed - SCENE_TIMING[scene].start;

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#020617]">
      {/* 9:16 Portrait Container with Instagram safe zones */}
      <div
        className="relative overflow-hidden bg-[#020617]"
        style={{
          width: '100%',
          maxWidth: '430px', // iPhone 14 Pro Max width
          aspectRatio: '9/16',
        }}
      >
        {/* Instagram safe zone overlay - content must stay within this area */}
        <div
          className="absolute inset-x-0 z-10 pointer-events-none"
          style={{
            top: '18%',      // Safe zone starts 18% from top
            bottom: '28%',   // Safe zone ends 28% from bottom (caption area)
          }}
        />
        {/* Background grid pattern */}
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
            <BattleScene
              key="battle"
              progress={sceneProgress}
              elapsed={sceneElapsed}
            />
          )}
          {scene === 'portfolio' && (
            <PortfolioScene
              key="portfolio"
              elapsed={sceneElapsed}
            />
          )}
          {scene === 'community' && (
            <CommunityScene
              key="community"
              elapsed={sceneElapsed}
            />
          )}
          {scene === 'cta' && (
            <CTAScene
              key="cta"
              elapsed={sceneElapsed}
            />
          )}
        </AnimatePresence>

      </div>

      {/* Dev controls - placed outside video frame */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-white/50 z-50">
        <button
          onClick={togglePlayPause}
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="font-mono">
          {(elapsed / 1000).toFixed(1)}s / {scene}
        </span>
        <button
          onClick={restart}
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors"
        >
          Restart
        </button>
      </div>
    </div>
  );
}

export default PromoVideo;
