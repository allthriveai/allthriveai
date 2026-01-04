/**
 * IconCloud - 3D rotating cloud of AI tool icons
 *
 * Uses react-icon-cloud to display a rotating sphere of brand icons.
 * Configurable size and icon list.
 */

import { useEffect, useMemo, useState, memo } from 'react';
import { Cloud, fetchSimpleIcons, renderSimpleIcon } from 'react-icon-cloud';

// Default AI tool slugs from Simple Icons
const DEFAULT_SLUGS = [
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

type SimpleIcon = any;
type IconData = Awaited<ReturnType<typeof fetchSimpleIcons>>;

interface IconCloudProps {
  /** Icon slugs from Simple Icons (defaults to AI tools) */
  slugs?: string[];
  /** Size of the cloud container */
  size?: number;
  /** Background color for contrast calculation */
  bgHex?: string;
  /** Fallback icon color */
  fallbackHex?: string;
  /** Icon size within the cloud */
  iconSize?: number;
  /** Rotation speed (higher = faster) */
  maxSpeed?: number;
  /** Minimum rotation speed */
  minSpeed?: number;
}

export const IconCloud = memo(function IconCloud({
  slugs = DEFAULT_SLUGS,
  size = 350,
  bgHex = '#020617',
  fallbackHex = '#22D3EE',
  iconSize = 42,
  maxSpeed = 0.03,
  minSpeed = 0.02,
}: IconCloudProps) {
  const [iconData, setIconData] = useState<IconData | null>(null);

  // Fetch icons on mount
  useEffect(() => {
    fetchSimpleIcons({ slugs }).then(setIconData).catch(console.error);
  }, [slugs]);

  const renderCustomIcon = useMemo(() => {
    return (icon: SimpleIcon) => {
      return renderSimpleIcon({
        icon,
        bgHex,
        fallbackHex,
        minContrastRatio: 2,
        size: iconSize,
        aProps: {
          href: undefined,
          target: undefined,
          rel: undefined,
          onClick: (e: React.MouseEvent) => e.preventDefault(),
        },
      });
    };
  }, [bgHex, fallbackHex, iconSize]);

  const renderedIcons = useMemo(() => {
    if (!iconData) return [];
    return Object.values(iconData.simpleIcons)
      .filter((icon): icon is SimpleIcon => icon !== undefined)
      .map((icon) => renderCustomIcon(icon));
  }, [iconData, renderCustomIcon]);

  const cloudProps = useMemo(() => ({
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
      maxSpeed,
      minSpeed,
      freezeActive: false,
      freezeDecel: false,
    },
  }), [maxSpeed, minSpeed]);

  if (!iconData) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }}>
      <Cloud {...cloudProps}>
        {renderedIcons}
      </Cloud>
    </div>
  );
});

export default IconCloud;
