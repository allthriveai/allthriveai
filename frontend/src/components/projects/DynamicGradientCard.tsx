import { motion } from 'framer-motion';
import { memo, useMemo } from 'react';

interface DynamicGradientCardProps {
  title: string;
  fromColor: string;
  toColor: string;
  categoryName?: string;
  projectId?: number;
}

/**
 * Generates deterministic particle properties based on project ID
 */
function generateParticles(projectId: number, fromColor: string, toColor: string) {
  const seed = projectId || 1;
  const particles = [];
  const count = 6 + (seed % 4); // 6-9 particles

  for (let i = 0; i < count; i++) {
    const pseudoRandom = (seed * (i + 1) * 9301 + 49297) % 233280;
    const rand = pseudoRandom / 233280;

    particles.push({
      id: i,
      x: (rand * 100),
      y: ((seed * (i + 2) * 7901 + 33297) % 233280) / 233280 * 100,
      size: 4 + (rand * 12), // 4-16px
      duration: 4 + (rand * 4), // 4-8s
      delay: rand * 2,
      color: i % 2 === 0 ? fromColor : toColor,
      opacity: 0.15 + (rand * 0.25), // 0.15-0.4
    });
  }
  return particles;
}

/**
 * Generates blob/orb positions for the animated gradient mesh
 */
function generateOrbs(projectId: number, fromColor: string, toColor: string) {
  const seed = projectId || 1;

  return [
    {
      id: 'orb1',
      color: fromColor,
      size: 60 + (seed % 20),
      x: 10 + (seed % 30),
      y: 10 + ((seed * 2) % 30),
      duration: 15 + (seed % 10),
    },
    {
      id: 'orb2',
      color: toColor,
      size: 50 + ((seed * 3) % 25),
      x: 60 + ((seed * 4) % 30),
      y: 50 + ((seed * 5) % 30),
      duration: 18 + ((seed * 2) % 8),
    },
    {
      id: 'orb3',
      color: `${fromColor}88`, // Semi-transparent
      size: 40 + ((seed * 6) % 20),
      x: 30 + ((seed * 7) % 40),
      y: 70 + ((seed * 8) % 20),
      duration: 12 + ((seed * 3) % 12),
    },
  ];
}

/**
 * Lighten a hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const DynamicGradientCard = memo(function DynamicGradientCard({
  title,
  fromColor,
  toColor,
  categoryName,
  projectId = 1,
}: DynamicGradientCardProps) {
  const particles = useMemo(
    () => generateParticles(projectId, fromColor, toColor),
    [projectId, fromColor, toColor]
  );

  const orbs = useMemo(
    () => generateOrbs(projectId, fromColor, toColor),
    [projectId, fromColor, toColor]
  );

  const lightFrom = useMemo(() => lightenColor(fromColor, 0.3), [fromColor]);
  const lightTo = useMemo(() => lightenColor(toColor, 0.2), [toColor]);

  return (
    <div
      className="w-full aspect-[4/3] flex items-center justify-center p-8 pb-48 md:pb-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`,
      }}
    >
      {/* Animated gradient mesh/orbs layer */}
      <div className="absolute inset-0 overflow-hidden">
        {orbs.map((orb) => (
          <motion.div
            key={orb.id}
            className="absolute rounded-full blur-3xl"
            style={{
              width: `${orb.size}%`,
              height: `${orb.size}%`,
              background: `radial-gradient(circle, ${orb.color}66 0%, transparent 70%)`,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              x: [0, 30, -20, 10, 0],
              y: [0, -25, 15, -10, 0],
              scale: [1, 1.15, 0.95, 1.1, 1],
            }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Floating particles layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              background: `radial-gradient(circle, ${particle.color}${Math.round(particle.opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
              filter: 'blur(1px)',
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, particle.id % 2 === 0 ? 15 : -15, 0],
              scale: [1, 1.2, 1],
              opacity: [particle.opacity, particle.opacity * 1.5, particle.opacity],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Shimmer/light sweep effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(105deg, transparent 40%, ${lightFrom}22 50%, ${lightTo}22 60%, transparent 70%)`,
          backgroundSize: '200% 100%',
        }}
        animate={{
          backgroundPosition: ['200% 0%', '-100% 0%'],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
          repeatDelay: 4,
        }}
      />

      {/* Subtle wave pattern overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`wave-${projectId}`} width="100" height="20" patternUnits="userSpaceOnUse">
            <motion.path
              initial={{ d: 'M0 10 Q 25 0, 50 10 T 100 10' }}
              fill="none"
              stroke="white"
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
      <div className="absolute inset-0 bg-noise-subtle opacity-40 mix-blend-overlay pointer-events-none" />

      {/* Content - Title shown by default on desktop, hidden on hover (footer overlay shows it) */}
      {/* On mobile, title is hidden since footer is always visible */}
      <div className="text-center relative z-10 group-hover:opacity-0 transition-opacity duration-300 hidden md:block">
        <motion.h3
          className="text-3xl font-bold text-white drop-shadow-lg leading-tight line-clamp-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {title}
        </motion.h3>
        {categoryName && (
          <motion.span
            className="inline-block mt-3 px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-white/90 backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {categoryName}
          </motion.span>
        )}
      </div>

      {/* Bottom fade for footer overlap */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
    </div>
  );
});

export default DynamicGradientCard;
