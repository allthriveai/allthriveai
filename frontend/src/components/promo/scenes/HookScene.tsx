import { useEffect, useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Cloud, fetchSimpleIcons, renderSimpleIcon } from 'react-icon-cloud';

interface HookSceneProps {
  elapsed: number;
}

// AI tool slugs from Simple Icons - same as homepage
const aiToolSlugs = [
  'openai',
  'anthropic',
  'huggingface',
  'googlegemini',
  'meta',
  'nvidia',
  'pytorch',
  'tensorflow',
  'langchain',
  'github',
  'python',
  'typescript',
  'react',
  'nodedotjs',
  'firebase',
  'vercel',
  'amazonwebservices',
  'googlecloud',
  'canva',
  'figma',
  'notion',
  'linear',
];

// Timing breakpoints within the 4-second scene
const TIMING = {
  globeStart: 0,
  questionAppears: 500,   // Start fading in words at 0.5s
  convergeStart: 2400,    // Globe starts shrinking
  logoAppears: 3000,      // Logo appears at 3s, fully visible by 3.5s
  sceneEnd: 4000,
};

type SimpleIcon = any;
type IconData = Awaited<ReturnType<typeof fetchSimpleIcons>>;

const renderCustomIcon = (icon: SimpleIcon) => {
  return renderSimpleIcon({
    icon,
    bgHex: '#020617',
    fallbackHex: '#22D3EE',
    minContrastRatio: 2,
    size: 42,
    aProps: {
      href: undefined,
      target: undefined,
      rel: undefined,
      onClick: (e: React.MouseEvent) => e.preventDefault(),
    },
  });
};

// Cloud options - faster rotation for the promo
const cloudProps = {
  containerProps: {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      pointerEvents: 'none' as const,
    },
  },
  options: {
    reverse: true,
    depth: 1,
    wheelZoom: false,
    imageScale: 2,
    activeCursor: 'default',
    tooltip: null,
    initial: [0.1, -0.1],
    clickToFront: 0,
    tooltipDelay: 0,
    outlineColour: '#0000',
    maxSpeed: 0.03, // Gentle rotation
    minSpeed: 0.02,
    freezeActive: false,
    freezeDecel: false,
  },
};

// Fade-in words component
function FadeInWords({
  startTime,
  elapsed,
}: {
  startTime: number;
  elapsed: number;
}) {
  const timeSinceStart = elapsed - startTime;

  // Three lines of words with timing
  const lines = [
    [
      { text: 'Overwhelmed', delay: 0 },
      { text: 'by', delay: 150 },
      { text: 'how', delay: 300 },
      { text: 'many', delay: 450 },
    ],
    [
      { text: 'AI tools', delay: 600 },
    ],
    [
      { text: 'are', delay: 800 },
      { text: 'out', delay: 950 },
      { text: 'there?', delay: 1100 },
    ],
  ];

  return (
    <div className="text-xl font-bold text-white leading-tight">
      {lines.map((lineWords, lineIndex) => (
        <div key={lineIndex} className="min-h-[1.5em] flex flex-wrap justify-center gap-x-2">
          {lineWords.map((word, i) => {
            const isVisible = timeSinceStart >= word.delay;
            const opacity = isVisible ? Math.min(1, (timeSinceStart - word.delay) / 150) : 0;
            return (
              <span
                key={i}
                style={{ opacity, transition: 'opacity 0.15s ease-out' }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Memoized Cloud component to prevent re-renders from parent elapsed updates
const MemoizedIconCloud = memo(function MemoizedIconCloud({ iconData }: { iconData: IconData }) {
  const renderedIcons = useMemo(() => {
    return Object.values(iconData.simpleIcons)
      .filter((icon): icon is SimpleIcon => icon !== undefined)
      .map((icon) => renderCustomIcon(icon));
  }, [iconData]);

  return (
    <div className="w-[350px] h-[350px]">
      <Cloud {...cloudProps}>
        {renderedIcons}
      </Cloud>
    </div>
  );
});

export function HookScene({ elapsed }: HookSceneProps) {
  const [iconData, setIconData] = useState<IconData | null>(null);

  const showGlobe = elapsed >= TIMING.globeStart;
  const showQuestion = elapsed >= TIMING.questionAppears && elapsed < TIMING.convergeStart;
  const isConverging = elapsed >= TIMING.convergeStart;
  const showLogo = elapsed >= TIMING.logoAppears;

  // Calculate convergence progress (0 to 1)
  const convergeProgress = isConverging
    ? Math.min(1, (elapsed - TIMING.convergeStart) / (TIMING.logoAppears - TIMING.convergeStart))
    : 0;

  // Eased convergence for smoother animation
  const easedConverge = convergeProgress * convergeProgress * (3 - 2 * convergeProgress);

  // Calculate globe scale and opacity based on convergence
  const globeScale = 1 - easedConverge * 0.8;
  const globeOpacity = showLogo ? Math.max(0, 1 - (elapsed - TIMING.logoAppears) / 400) : 1;

  // Fetch icons on mount
  useEffect(() => {
    fetchSimpleIcons({ slugs: aiToolSlugs }).then(setIconData).catch(console.error);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a1628] to-[#020617]" />

      {/* 3D Icon Cloud Globe - using CSS transform instead of re-rendering */}
      {showGlobe && iconData && (
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
          style={{
            transform: `scale(${globeScale})`,
            opacity: globeOpacity,
          }}
        >
          <MemoizedIconCloud iconData={iconData} />
        </div>
      )}

      {/* Loading state while icons fetch */}
      {showGlobe && !iconData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {/* Question text with fade-in words effect */}
      {showQuestion && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-center px-8 bg-[#020617]/80 py-4 rounded-xl backdrop-blur-sm">
            <FadeInWords
              startTime={TIMING.questionAppears}
              elapsed={elapsed}
            />
          </div>
        </motion.div>
      )}

      {/* AllThrive Logo - appears as globe converges */}
      {showLogo && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center z-30"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <motion.div
            className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mb-3"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            LET'S MAKE IT FUN
          </motion.div>
          <motion.img
            src="/all-thrvie-logo.png"
            alt="All Thrive"
            className="w-24 h-24"
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          />
          <motion.div
            className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            allthrive.ai
          </motion.div>
        </motion.div>
      )}

      {/* Particle implosion effect when converging */}
      {isConverging && !showLogo && (
        <>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const startRadius = 150;
            const currentRadius = startRadius * (1 - easedConverge);
            return (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, #22d3ee, #34d399)`,
                  left: '50%',
                  top: '50%',
                  transform: `translate(${Math.cos(angle) * currentRadius}px, ${Math.sin(angle) * currentRadius}px)`,
                  opacity: 1 - easedConverge,
                }}
              />
            );
          })}
        </>
      )}

      {/* Burst effect when logo appears */}
      {showLogo && (
        <>
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: `linear-gradient(135deg, #22d3ee, #34d399)`,
                left: '50%',
                top: '50%',
                marginLeft: -4,
                marginTop: -4,
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 0.8 }}
              animate={{
                x: Math.cos((i / 12) * Math.PI * 2) * 100,
                y: Math.sin((i / 12) * Math.PI * 2) * 100,
                scale: 0,
                opacity: 0,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}

export default HookScene;
