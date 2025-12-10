import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface DynamicGradientCardProps {
  title: string;
  /** Primary gradient color (from category jewel colors) */
  fromColor: string;
  /** Secondary gradient color (from category jewel colors) */
  toColor: string;
  categoryName?: string;
  projectId?: number;
}

/**
 * Generates deterministic orb positions based on project ID
 * Uses the category's jewel colors for a cohesive look
 */
function generateOrbStyles(projectId: number, _fromColor: string, toColor: string) {
  const seed = projectId || 1;

  return [
    {
      id: 'orb1',
      color: 'rgba(255,255,255,0.4)',
      opacity: 0.6,
      size: 80 + (seed % 30),
      x: 15 + (seed % 25),
      y: 15 + ((seed * 2) % 25),
      blur: 'blur-[80px]',
    },
    {
      id: 'orb2',
      color: 'rgba(255,255,255,0.3)',
      opacity: 0.5,
      size: 70 + ((seed * 3) % 35),
      x: 70 + ((seed * 4) % 20),
      y: 60 + ((seed * 5) % 25),
      blur: 'blur-[70px]',
    },
    {
      id: 'orb3',
      color: toColor,
      opacity: 0.4,
      size: 60 + ((seed * 6) % 25),
      x: 40 + ((seed * 7) % 30),
      y: 80 + ((seed * 8) % 15),
      blur: 'blur-[60px]',
    },
  ];
}

/**
 * DynamicGradientCard - Beautiful gradient card using category jewel colors
 *
 * Displays a dark background with animated jewel-colored orbs based on the
 * project's category. Each category has its own jewel tone (sapphire, emerald, etc.)
 */
export const DynamicGradientCard = memo(function DynamicGradientCard({
  title,
  fromColor,
  toColor,
  categoryName,
  projectId = 1,
}: DynamicGradientCardProps) {
  const orbs = useMemo(
    () => generateOrbStyles(projectId, fromColor, toColor),
    [projectId, fromColor, toColor]
  );

  return (
    <div
      className="w-full aspect-[4/3] flex items-center justify-center p-8 pb-48 md:pb-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`,
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Animated gradient orbs layer using category colors */}
      <div className="absolute inset-0 overflow-hidden">
        {orbs.map((orb, index) => (
          <motion.div
            key={orb.id}
            className={`absolute rounded-full ${orb.blur}`}
            style={{
              width: `${orb.size}%`,
              height: `${orb.size}%`,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              opacity: orb.opacity,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              x: [0, 10, -5, 0],
              y: [0, -8, 5, 0],
              scale: [1, 1.05, 0.98, 1],
            }}
            transition={{
              duration: 8 + index * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent)`,
        }}
      />

      {/* Wave pattern overlay with animated squiggles */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`wave-${projectId}`} width="100" height="20" patternUnits="userSpaceOnUse">
            <motion.path
              initial={{ d: 'M0 10 Q 25 0, 50 10 T 100 10' }}
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1"
              animate={{
                d: [
                  'M0 10 Q 25 0, 50 10 T 100 10',
                  'M0 10 Q 25 20, 50 10 T 100 10',
                  'M0 10 Q 25 0, 50 10 T 100 10',
                ],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#wave-${projectId})`} />
      </svg>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise-subtle opacity-20 mix-blend-overlay pointer-events-none" />

      {/* Content - Title shown by default on desktop, hidden on hover (footer overlay shows it) */}
      <div className="text-center relative z-10 group-hover:opacity-0 transition-opacity duration-300 hidden md:block">
        <h3 className="text-3xl font-bold text-white drop-shadow-lg leading-tight line-clamp-3">
          {title}
        </h3>
        {categoryName && (
          <span
            className="inline-block mt-3 px-3 py-1 text-xs font-medium rounded-full backdrop-blur-sm border bg-white/20 border-white/30 text-white"
          >
            {categoryName}
          </span>
        )}
      </div>

      {/* Bottom fade for footer overlap */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

      {/* Subtle glow at bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
        style={{
          background: `linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)`,
        }}
      />
    </div>
  );
});

export default DynamicGradientCard;
