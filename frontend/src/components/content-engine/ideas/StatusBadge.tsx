/**
 * Status Badge Component
 * US-004: Ideas Tab with list view and quick capture
 */

import type { IdeaStatus } from '@/types/contentEngine';

interface StatusBadgeProps {
  status: IdeaStatus;
}

const STATUS_STYLES: Record<IdeaStatus, { bg: string; text: string; label: string }> = {
  saved: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    label: 'Saved',
  },
  planned: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    label: 'Planned',
  },
  in_progress: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'In Progress',
  },
  archived: {
    bg: 'bg-slate-600/20',
    text: 'text-slate-500',
    label: 'Archived',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`
        inline-flex items-center rounded text-[10px] px-1.5 py-0.5 font-medium
        ${style.bg} ${style.text}
      `}
    >
      {style.label}
    </span>
  );
}
