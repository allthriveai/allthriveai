/**
 * EchoContextPanel - Dynamic side panel for Echo Creator Coach
 * TASK-026: Renders different content based on mode from useEchoAgent
 *
 * Features:
 * - Mode-based content switching with smooth CSS transitions
 * - 30% width on desktop, bottom drawer on mobile
 * - Placeholder content for each mode (filled in subsequent stories)
 * - Panel skeleton during transitions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LightBulbIcon,
  PaintBrushIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEchoAgent } from '@/context/EchoAgentContext';
import { QuickActionsPanel } from './panels/QuickActionsPanel';
import { BrainstormContext } from './panels/BrainstormContext';
import { IdeasListPanel } from './panels/IdeasListPanel';
import type { EchoMode } from '@/types/contentEngine';

interface EchoContextPanelProps {
  className?: string;
  onClose?: () => void;
  onSendMessage?: (message: string) => void;
}

// Mode-specific icons
const modeIcons: Record<EchoMode, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  idle: SparklesIcon,
  brainstorm: LightBulbIcon,
  create: PaintBrushIcon,
  schedule: CalendarDaysIcon,
  review: ClipboardDocumentCheckIcon,
};

// Mode-specific titles
const modeTitles: Record<EchoMode, string> = {
  idle: 'Getting Started',
  brainstorm: 'Brainstorm',
  create: 'Create',
  schedule: 'Schedule',
  review: 'Review',
};

// Mode-specific descriptions
const modeDescriptions: Record<EchoMode, string> = {
  idle: 'Start a conversation with Echo to brainstorm content ideas.',
  brainstorm: 'Explore ideas and let Echo help refine them.',
  create: 'Turn your ideas into engaging content clips.',
  schedule: 'Plan when and where to publish your content.',
  review: 'Review and improve your saved content ideas.',
};

// Mode-specific styling
const modeStyles: Record<EchoMode, { accent: string; glow: string; border: string; bg: string }> = {
  idle: {
    accent: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
  },
  brainstorm: {
    accent: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
  create: {
    accent: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
  },
  schedule: {
    accent: 'text-green-400',
    glow: 'shadow-green-500/20',
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
  },
  review: {
    accent: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
};

// Panel skeleton for loading states
function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-6 bg-slate-700/50 rounded w-2/3" />
      <div className="h-4 bg-slate-700/50 rounded w-full" />
      <div className="h-4 bg-slate-700/50 rounded w-5/6" />
      <div className="h-24 bg-slate-700/50 rounded mt-4" />
      <div className="h-24 bg-slate-700/50 rounded" />
    </div>
  );
}

// Mode-specific content components
interface ModeContentProps {
  mode: EchoMode;
  onSendMessage?: (message: string) => void;
}

function ModeContent({ mode, onSendMessage }: ModeContentProps) {
  const styles = modeStyles[mode];

  switch (mode) {
    case 'idle':
      // Use QuickActionsPanel for idle/welcome state
      return (
        <QuickActionsPanel
          onSendMessage={onSendMessage || (() => {})}
        />
      );

    case 'brainstorm':
      return <BrainstormContext />;

    case 'create':
      return (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
            <h4 className="text-sm font-medium text-white mb-2">Clip Preview</h4>
            <p className="text-sm text-slate-400">
              Your clip preview will appear here as you create.
            </p>
          </div>
          <div className={`p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
            <h4 className="text-sm font-medium text-white mb-2">Style Options</h4>
            <p className="text-sm text-slate-400">
              Style and format options will be available here.
            </p>
          </div>
        </div>
      );

    case 'schedule':
      return (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
            <h4 className="text-sm font-medium text-white mb-2">Selected Dates</h4>
            <p className="text-sm text-slate-400">
              Calendar mini-view will appear here.
            </p>
          </div>
          <div className={`p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
            <h4 className="text-sm font-medium text-white mb-2">Platform Options</h4>
            <p className="text-sm text-slate-400">
              Platform-specific options will be configurable here.
            </p>
          </div>
        </div>
      );

    case 'review':
      // Use IdeasListPanel for review mode - full-height list with filters and quick capture
      return <IdeasListPanel className="h-full -m-4" />;

    default:
      // Unknown mode - show debug info in dev
      if (process.env.NODE_ENV === 'development') {
        return (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <h4 className="text-sm font-medium text-red-400 mb-2">Unknown Mode</h4>
            <p className="text-sm text-slate-400">
              Mode &quot;{mode}&quot; is not recognized.
            </p>
          </div>
        );
      }
      return null;
  }
}

export function EchoContextPanel({ className = '', onClose, onSendMessage }: EchoContextPanelProps) {
  const { mode } = useEchoAgent();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayMode, setDisplayMode] = useState<EchoMode>(mode);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Handle mode transitions with animation
  useEffect(() => {
    if (mode !== displayMode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayMode(mode);
        setIsTransitioning(false);
      }, 150); // Half of transition duration
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [mode, displayMode]);

  // Get current mode styling
  const styles = modeStyles[displayMode];
  const Icon = modeIcons[displayMode];
  const title = modeTitles[displayMode];
  const description = modeDescriptions[displayMode];

  // Mobile drawer toggle
  const toggleMobileDrawer = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  // Close handler
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setIsMobileOpen(false);
    }
  }, [onClose]);

  // Panel content
  const panelContent = useMemo(
    () => (
      <>
        {/* Header */}
        <div className={`p-4 border-b border-slate-700/50 ${styles.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${styles.bg} border ${styles.border}`}>
                <Icon className={`w-5 h-5 ${styles.accent}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-slate-400">{description}</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                aria-label="Close panel"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content with transition */}
        <div
          className={`
            flex-1 overflow-y-auto p-4
            transition-opacity duration-300 ease-in-out
            ${isTransitioning ? 'opacity-0' : 'opacity-100'}
          `}
        >
          {isTransitioning ? <PanelSkeleton /> : <ModeContent mode={displayMode} onSendMessage={onSendMessage} />}
        </div>
      </>
    ),
    [displayMode, isTransitioning, styles, Icon, title, description, onClose, handleClose, onSendMessage]
  );

  // Build aria-label describing current mode
  const ariaLabel = `Context panel for ${title} mode: ${description}`;

  return (
    <>
      {/* Desktop panel - 30% width side panel */}
      <aside
        aria-label={ariaLabel}
        className={`
          hidden lg:flex flex-col
          w-[30%] min-w-[280px] max-w-[400px]
          h-full
          glass-panel rounded-xl
          border border-slate-700/50
          transition-all duration-300 ease-in-out
          ${styles.glow}
          ${className}
        `}
      >
        {panelContent}
      </aside>

      {/* Mobile drawer trigger */}
      <button
        type="button"
        onClick={toggleMobileDrawer}
        aria-label={`Open ${title} panel`}
        aria-expanded={isMobileOpen}
        className={`
          lg:hidden fixed bottom-20 right-4 z-40
          p-3 rounded-full
          glass-panel border ${styles.border}
          ${styles.glow} shadow-lg
          transition-all duration-200
          hover:scale-105
        `}
      >
        <Icon className={`w-6 h-6 ${styles.accent}`} />
      </button>

      {/* Mobile drawer - slides up from bottom, 60% height */}
      <div
        aria-label={ariaLabel}
        className={`
          lg:hidden fixed inset-x-0 bottom-0 z-50
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Backdrop */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 -z-10"
            onClick={handleClose}
            aria-hidden="true"
          />
        )}

        {/* Drawer content */}
        <div
          className={`
            flex flex-col
            h-[60vh]
            glass-panel rounded-t-2xl
            border-t border-x border-slate-700/50
            ${styles.glow}
          `}
        >
          {/* Drag handle */}
          <button
            type="button"
            onClick={toggleMobileDrawer}
            className="flex justify-center py-2"
            aria-label="Close drawer"
          >
            <div className="w-12 h-1 rounded-full bg-slate-600" />
          </button>

          {panelContent}
        </div>
      </div>
    </>
  );
}

export default EchoContextPanel;
