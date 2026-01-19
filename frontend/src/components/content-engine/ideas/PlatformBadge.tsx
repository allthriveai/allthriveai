/**
 * Platform Badge Component
 * US-004: Ideas Tab with list view and quick capture
 */

import type { Platform } from '@/types/contentEngine';

interface PlatformBadgeProps {
  platform: Platform;
  size?: 'sm' | 'md';
}

const PLATFORM_STYLES: Record<Platform, { bg: string; text: string; border: string; label: string }> = {
  linkedin: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'LinkedIn',
  },
  youtube: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'YouTube',
  },
  twitter: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    label: 'Twitter',
  },
};

export function PlatformBadge({ platform, size = 'sm' }: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[platform];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`
        inline-flex items-center rounded border font-medium
        ${style.bg} ${style.text} ${style.border} ${sizeClasses}
      `}
    >
      {style.label}
    </span>
  );
}
