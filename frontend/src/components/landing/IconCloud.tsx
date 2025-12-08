import { useEffect, useMemo, useState } from 'react';
import { Cloud, fetchSimpleIcons, renderSimpleIcon } from 'react-icon-cloud';
import type { ComponentProps } from 'react';

// Hook to detect mobile screen size
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}


type SimpleIcon = any;

// AI tool slugs from Simple Icons
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
  'amazonaws',
  'googlecloud',
  'canva',
  'figma',
  'notion',
  'linear',
];

// Custom icons that aren't in Simple Icons (use local images)
const customIconImages = [
  '/lovable-icon-bg-light.png',
];

const getCloudProps = (isMobile: boolean): Omit<ComponentProps<typeof Cloud>, 'children'> => ({
  containerProps: {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      pointerEvents: isMobile ? 'none' : 'auto',
    },
  },
  options: {
    reverse: true,
    depth: 1,
    wheelZoom: false,
    imageScale: 2,
    activeCursor: isMobile ? 'default' : 'pointer',
    tooltip: isMobile ? null : 'native',
    initial: isMobile ? [0, 0] : [0.1, -0.1],
    clickToFront: isMobile ? 0 : 500,
    tooltipDelay: 0,
    outlineColour: '#0000',
    maxSpeed: isMobile ? 0 : 0.02,
    minSpeed: isMobile ? 0 : 0.01,
    freezeActive: true,
    freezeDecel: true,
    frozen: isMobile,
  },
});

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
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchSimpleIcons({ slugs: aiToolSlugs }).then(setData).catch(console.error);
  }, []);

  const cloudProps = useMemo(() => getCloudProps(isMobile), [isMobile]);

  const renderedIcons = useMemo(() => {
    if (!data) return null;

    // Render Simple Icons
    const simpleIcons = Object.values(data.simpleIcons)
      .filter((icon): icon is SimpleIcon => icon !== undefined)
      .map((icon) => renderCustomIcon(icon));

    // Render custom image icons
    const imageIcons = customIconImages.map((src, index) => (
      <a key={`custom-${index}`} href="#" onClick={(e) => e.preventDefault()}>
        <img src={src} alt="Lovable" width={42} height={42} style={{ borderRadius: '8px' }} />
      </a>
    ));

    return [...simpleIcons, ...imageIcons];
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
