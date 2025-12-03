import { useEffect, useMemo, useState } from 'react';
import { Cloud, fetchSimpleIcons, renderSimpleIcon } from 'react-icon-cloud';
import type { ComponentProps } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimpleIcon = any;

// AI tool slugs from Simple Icons
const aiToolSlugs = [
  'openai',
  'anthropic',
  'huggingface',
  'google',
  'meta',
  'nvidia',
  'pytorch',
  'tensorflow',
  'github',
  'python',
  'javascript',
  'typescript',
  'react',
  'nodedotjs',
  'firebase',
  'vercel',
  'amazonaws',
  'googlecloud',
  'canva',
  'figma',
  'notion',
  'linear',
];

const cloudProps: Omit<ComponentProps<typeof Cloud>, 'children'> = {
  containerProps: {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    },
  },
  options: {
    reverse: true,
    depth: 1,
    wheelZoom: false,
    imageScale: 2,
    activeCursor: 'pointer',
    tooltip: 'native',
    initial: [0.1, -0.1],
    clickToFront: 500,
    tooltipDelay: 0,
    outlineColour: '#0000',
    maxSpeed: 0.02,
    minSpeed: 0.01,
    freezeActive: true,
    freezeDecel: true,
  },
};

const renderCustomIcon = (icon: SimpleIcon) => {
  return renderSimpleIcon({
    icon,
    bgHex: '#080510',
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

type IconData = Awaited<ReturnType<typeof fetchSimpleIcons>>;

export function IconCloud() {
  const [data, setData] = useState<IconData | null>(null);

  useEffect(() => {
    fetchSimpleIcons({ slugs: aiToolSlugs }).then(setData).catch(console.error);
  }, []);

  const renderedIcons = useMemo(() => {
    if (!data) return null;
    return Object.values(data.simpleIcons)
      .filter((icon): icon is SimpleIcon => icon !== undefined)
      .map((icon) => renderCustomIcon(icon));
  }, [data]);

  if (!renderedIcons) {
    return (
      <div className="w-full h-full flex items-center justify-center" role="status" aria-live="polite">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading AI tools...</span>
      </div>
    );
  }

  return (
    <Cloud {...cloudProps}>
      {renderedIcons}
    </Cloud>
  );
}
