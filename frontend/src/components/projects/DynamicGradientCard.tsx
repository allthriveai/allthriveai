import { memo, useMemo } from 'react';

interface DynamicGradientCardProps {
  title: string;
  fromColor: string;
  toColor: string;
  categoryName?: string;
  projectId?: number;
}

/**
 * Generates deterministic orb positions based on project ID
 */
function generateOrbStyles(projectId: number, fromColor: string, toColor: string) {
  const seed = projectId || 1;

  return [
    {
      id: 'orb1',
      color: fromColor,
      size: 60 + (seed % 20),
      x: 10 + (seed % 30),
      y: 10 + ((seed * 2) % 30),
    },
    {
      id: 'orb2',
      color: toColor,
      size: 50 + ((seed * 3) % 25),
      x: 60 + ((seed * 4) % 30),
      y: 50 + ((seed * 5) % 30),
    },
    {
      id: 'orb3',
      color: `${fromColor}88`,
      size: 40 + ((seed * 6) % 20),
      x: 30 + ((seed * 7) % 40),
      y: 70 + ((seed * 8) % 20),
    },
  ];
}

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
      {/* Static gradient mesh/orbs layer - no animations */}
      <div className="absolute inset-0 overflow-hidden">
        {orbs.map((orb) => (
          <div
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
          />
        ))}
      </div>

      {/* Static wave pattern overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={`wave-${projectId}`} width="100" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M0 10 Q 25 5, 50 10 T 100 10"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#wave-${projectId})`} />
      </svg>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise-subtle opacity-40 mix-blend-overlay pointer-events-none" />

      {/* Content - Title shown by default on desktop, hidden on hover (footer overlay shows it) */}
      <div className="text-center relative z-10 group-hover:opacity-0 transition-opacity duration-300 hidden md:block">
        <h3 className="text-3xl font-bold text-white drop-shadow-lg leading-tight line-clamp-3">
          {title}
        </h3>
        {categoryName && (
          <span className="inline-block mt-3 px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-white/90 backdrop-blur-sm">
            {categoryName}
          </span>
        )}
      </div>

      {/* Bottom fade for footer overlap */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
    </div>
  );
});

export default DynamicGradientCard;
