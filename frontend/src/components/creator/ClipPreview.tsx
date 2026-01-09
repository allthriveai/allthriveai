/**
 * ClipPreview - 9:16 animated preview for social clips
 *
 * Renders the clip using Framer Motion animations in a portrait container
 * optimized for LinkedIn/YouTube Shorts. Supports rich visual elements.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo,
  faPlay,
  faRobot,
  faBrain,
  faBolt,
  faLightbulb,
  faRocket,
  faCode,
  faDatabase,
  faCloud,
  faMagicWandSparkles,
  faChartLine,
  faGears,
  faShieldHalved,
  faArrowRight,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import type { SocialClipContent, Scene, VisualElement } from '@/types/clips';
import { getCurrentScene, getSceneProgress } from '@/types/clips';

// Icon mapping for dynamic icon rendering
const ICON_MAP: Record<string, IconDefinition> = {
  robot: faRobot,
  brain: faBrain,
  bolt: faBolt,
  lightbulb: faLightbulb,
  rocket: faRocket,
  code: faCode,
  database: faDatabase,
  cloud: faCloud,
  magic: faMagicWandSparkles,
  chart: faChartLine,
  gears: faGears,
  shield: faShieldHalved,
  arrow: faArrowRight,
};

interface ClipPreviewProps {
  clipData: SocialClipContent;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onComplete: () => void;
}

export interface ClipPreviewHandle {
  captureFrame: () => Promise<Blob | null>;
  getElement: () => HTMLDivElement | null;
}

export const ClipPreview = forwardRef<ClipPreviewHandle, ClipPreviewProps>(
  function ClipPreview(
    { clipData, isPlaying, currentTime, onTimeUpdate, onComplete },
    ref
  ) {
    const animationRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(Date.now());
    const containerRef = useRef<HTMLDivElement>(null);

    // Expose methods for video capture
    useImperativeHandle(ref, () => ({
      captureFrame: async () => {
        if (!containerRef.current) return null;
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(containerRef.current, {
          backgroundColor: '#020617',
          scale: 2,
        });
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      },
      getElement: () => containerRef.current,
    }));

    // Run animation loop
    useEffect(() => {
      if (!isPlaying || clipData.scenes.length === 0) {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        return;
      }

      const animate = () => {
        const now = Date.now();
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        const newTime = currentTime + delta;

        if (newTime >= clipData.duration) {
          onTimeUpdate(clipData.duration);
          onComplete();
          return;
        }

        onTimeUpdate(newTime);
        animationRef.current = requestAnimationFrame(animate);
      };

      lastTimeRef.current = Date.now();
      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [isPlaying, clipData.duration, currentTime, onTimeUpdate, onComplete]);

    // Get current scene
    const currentScene = getCurrentScene(clipData.scenes, currentTime);
    const sceneProgress = currentScene ? getSceneProgress(currentScene, currentTime) : 0;

    // Empty state
    if (clipData.scenes.length === 0) {
      return (
        <div className="relative w-full max-w-[430px] aspect-[9/16] rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
              <FontAwesomeIcon icon={faVideo} className="text-3xl text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">No clip yet</h3>
            <p className="text-secondary text-sm">
              Chat with the assistant to create your first clip
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full max-w-[430px] aspect-[9/16] rounded-3xl overflow-hidden bg-[#020617] border border-white/10 shadow-2xl"
      >
        {/* Dynamic background based on scene */}
        <SceneBackground scene={currentScene} style={clipData.style} />

        {/* Animated grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Scene content */}
        <AnimatePresence mode="wait">
          {currentScene && (
            <SceneRenderer
              key={currentScene.id}
              scene={currentScene}
              progress={sceneProgress}
              style={clipData.style}
            />
          )}
        </AnimatePresence>

        {/* Floating particles */}
        <FloatingParticles style={clipData.style} />

        {/* Play indicator when paused */}
        {!isPlaying && clipData.scenes.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-40">
            <div className="w-20 h-20 rounded-full bg-cyan-500/30 backdrop-blur-sm flex items-center justify-center">
              <FontAwesomeIcon icon={faPlay} className="text-3xl text-white ml-1" />
            </div>
          </div>
        )}
      </div>
    );
  }
);

// Background component with dynamic gradients and images
function SceneBackground({
  scene,
  style,
}: {
  scene: Scene | null;
  style: SocialClipContent['style'];
}) {
  const bgGradient = scene?.content.backgroundGradient;
  const bgImage = scene?.content.backgroundImage;

  return (
    <>
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: bgGradient || `radial-gradient(ellipse at 50% 30%, ${style.primaryColor}15 0%, transparent 50%),
                       radial-gradient(ellipse at 50% 70%, ${style.accentColor}10 0%, transparent 50%),
                       linear-gradient(180deg, #020617 0%, #0a1628 50%, #020617 100%)`,
        }}
      />

      {/* Background image if provided */}
      {bgImage && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={bgImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/60 to-[#020617]/80" />
        </motion.div>
      )}

      {/* Animated glow orbs */}
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${style.primaryColor}20 0%, transparent 70%)` }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${style.accentColor}15 0%, transparent 70%)` }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </>
  );
}

// Floating particles for visual interest
function FloatingParticles({ style }: { style: SocialClipContent['style'] }) {
  const particles = Array.from({ length: 3 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    x: 15 + i * 35, // Spread evenly across width
    delay: i * 2,
    duration: 8 + Math.random() * 4, // Slower: 8-12 seconds
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
          }}
          initial={{ y: '100vh', opacity: 0 }}
          animate={{
            y: '-10vh',
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Visual element renderer
function VisualRenderer({
  visual,
  style,
  delay = 0,
}: {
  visual: VisualElement;
  style: SocialClipContent['style'];
  delay?: number;
}) {
  const animations = {
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    slide: { initial: { x: -50, opacity: 0 }, animate: { x: 0, opacity: 1 } },
    zoom: { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 } },
    bounce: { initial: { y: 50, opacity: 0 }, animate: { y: 0, opacity: 1 } },
    pulse: { initial: { scale: 0.8, opacity: 0 }, animate: { scale: [1, 1.05, 1], opacity: 1 } },
    float: { initial: { y: 20, opacity: 0 }, animate: { y: [0, -10, 0], opacity: 1 } },
  };

  const anim = animations[visual.animation || 'fade'];
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-32 h-32',
    full: 'w-full h-auto',
  };

  const size = sizeClasses[visual.size || 'medium'];

  return (
    <motion.div
      className={`${size} flex items-center justify-center`}
      initial={anim.initial}
      animate={anim.animate}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay,
        ...(visual.animation === 'float' ? { duration: 2, repeat: Infinity } : {}),
      }}
    >
      {visual.type === 'icon' && visual.icon && ICON_MAP[visual.icon] && (
        <div
          className="w-full h-full rounded-2xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${style.primaryColor}20, ${style.accentColor}15)`,
            border: `2px solid ${style.primaryColor}30`,
          }}
        >
          <FontAwesomeIcon
            icon={ICON_MAP[visual.icon]}
            className="text-3xl"
            style={{ color: style.primaryColor }}
          />
        </div>
      )}

      {visual.type === 'emoji' && visual.emoji && (
        <span className="text-5xl">{visual.emoji}</span>
      )}

      {visual.type === 'image' && visual.src && (
        <img
          src={visual.src}
          alt={visual.alt || ''}
          className="w-full h-full object-cover rounded-xl"
        />
      )}

      {visual.type === 'code' && visual.code && (
        <div className="w-full bg-slate-800/80 rounded-xl p-4 font-mono text-sm text-cyan-300 overflow-hidden">
          <pre className="whitespace-pre-wrap">{visual.code}</pre>
        </div>
      )}
    </motion.div>
  );
}

// Scene renderer - handles different scene types
interface SceneRendererProps {
  scene: Scene;
  progress: number;
  style: SocialClipContent['style'];
}

function SceneRenderer({ scene, progress, style }: SceneRendererProps) {
  switch (scene.type) {
    case 'hook':
      return <HookScene scene={scene} progress={progress} style={style} />;
    case 'point':
    case 'example':
      return <PointScene scene={scene} progress={progress} style={style} />;
    case 'cta':
      return <CTAScene scene={scene} progress={progress} style={style} />;
    default:
      return <PointScene scene={scene} progress={progress} style={style} />;
  }
}

// Hook scene - attention-grabbing opener with visual
function HookScene({ scene, progress, style }: SceneRendererProps) {
  const showVisual = progress > 0.05;
  const showHeadline = progress > 0.15;
  const showBody = progress > 0.45;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Visual element */}
      <AnimatePresence>
        {showVisual && scene.content.visual && (
          <motion.div
            className="mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <VisualRenderer visual={scene.content.visual} style={style} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Headline */}
      <AnimatePresence>
        {showHeadline && (
          <motion.h1
            className="text-3xl sm:text-4xl font-black leading-tight mb-6"
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {scene.content.headline}
          </motion.h1>
        )}
      </AnimatePresence>

      {/* Body */}
      <AnimatePresence>
        {showBody && scene.content.body && (
          <motion.p
            className="text-xl text-white/90 font-medium"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          >
            {scene.content.body}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Decorations */}
      {scene.content.decorations?.map((dec, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: dec.position === 'floating' ? `${20 + i * 15}%` : undefined,
            right: dec.position === 'floating' ? `${10 + i * 5}%` : undefined,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.2 }}
        >
          <VisualRenderer visual={dec} style={style} delay={0.5 + i * 0.2} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Point scene - educational content with visual
function PointScene({ scene, progress, style }: SceneRendererProps) {
  const showVisual = progress > 0.02;
  const showHeadline = progress > 0.08;
  const showBody = progress > 0.25;
  const showBullets = progress > 0.4;
  const showCode = progress > 0.5;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Visual element - top */}
      <AnimatePresence>
        {showVisual && scene.content.visual && (
          <motion.div
            className="mb-4 flex justify-center"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <VisualRenderer visual={scene.content.visual} style={style} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Headline */}
      <AnimatePresence>
        {showHeadline && (
          <motion.h2
            className="text-2xl sm:text-3xl font-bold mb-4"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ color: style.primaryColor }}
          >
            {scene.content.headline}
          </motion.h2>
        )}
      </AnimatePresence>

      {/* Body */}
      <AnimatePresence>
        {showBody && scene.content.body && (
          <motion.p
            className="text-lg text-white/80 leading-relaxed mb-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {scene.content.body}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Code block */}
      <AnimatePresence>
        {showCode && scene.content.code && (
          <motion.div
            className="mb-4 bg-slate-800/80 rounded-xl p-4 border border-white/10"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-2 text-xs text-white/40">{scene.content.codeLanguage || 'code'}</span>
            </div>
            <pre className="font-mono text-sm text-cyan-300 overflow-hidden whitespace-pre-wrap">
              {scene.content.code}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bullets */}
      <AnimatePresence>
        {showBullets && scene.content.bullets && scene.content.bullets.length > 0 && (
          <motion.ul
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {scene.content.bullets.map((bullet, i) => (
              <motion.li
                key={i}
                className="flex items-start gap-3 text-white/80"
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
              >
                <motion.span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${style.primaryColor}30, ${style.accentColor}20)`,
                    color: style.primaryColor,
                  }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ delay: i * 0.15 + 0.2, duration: 0.3 }}
                >
                  {i + 1}
                </motion.span>
                <span>{bullet}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// CTA scene - call to action with logo
function CTAScene({ scene, progress, style }: SceneRendererProps) {
  const showLogo = progress > 0.1;
  const showContent = progress > 0.2;
  const showPulse = progress > 0.5;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo/Avatar */}
      <motion.div
        className="w-20 h-20 rounded-2xl mb-6 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${style.primaryColor}30, ${style.accentColor}20)`,
          border: `2px solid ${style.primaryColor}50`,
        }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: showLogo ? 1 : 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        {scene.content.visual?.src ? (
          <img
            src={scene.content.visual.src}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="text-2xl font-black"
            style={{ color: style.primaryColor }}
          >
            AT
          </span>
        )}
      </motion.div>

      {/* Headline */}
      <AnimatePresence>
        {showContent && (
          <motion.h2
            className="text-2xl sm:text-3xl font-bold mb-4 text-white"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            {scene.content.headline}
          </motion.h2>
        )}
      </AnimatePresence>

      {/* Body / CTA Button */}
      <AnimatePresence>
        {showContent && scene.content.body && (
          <motion.div
            className="px-8 py-4 rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: showPulse ? [1, 1.05, 1] : 1,
              opacity: 1,
            }}
            transition={{
              scale: showPulse
                ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 300, damping: 15, delay: 0.4 },
              opacity: { delay: 0.3 },
            }}
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-lg font-bold text-slate-900">
              {scene.content.body}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radial burst effect */}
      {showPulse && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border"
              style={{ borderColor: `${style.primaryColor}20` }}
              initial={{ width: 100, height: 100, opacity: 0.5 }}
              animate={{
                width: [100, 300],
                height: [100, 300],
                opacity: [0.3, 0],
              }}
              transition={{
                duration: 2,
                delay: i * 0.6,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
