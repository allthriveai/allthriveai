/**
 * CircleActivityToast - Real-time activity notifications with Neon Glass aesthetic
 * Shows animated toasts when circle members do things like give kudos
 */

import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar,
  faHeart,
  faLightbulb,
  faPalette,
  faHandshake,
  faHandsHelping,
  faRocket,
  faFire,
  faTrophy,
  faBolt,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { KudosType } from '@/types/models';

export type CircleActivityType =
  | 'kudos_given'
  | 'project_created'
  | 'streak_achieved'
  | 'challenge_progress'
  | 'level_up'
  | 'member_joined';

export interface CircleActivityEvent {
  id: string;
  type: CircleActivityType;
  username: string;
  targetUsername?: string;
  kudosType?: KudosType;
  message?: string;
  timestamp: string;
}

interface ToastItem extends CircleActivityEvent {
  isExiting?: boolean;
}

interface CircleActivityToastProps {
  events: CircleActivityEvent[];
  onDismiss?: (id: string) => void;
  maxVisible?: number;
  autoHideDuration?: number;
}

const KUDOS_CONFIG: Record<KudosType, { icon: typeof faHeart; color: string; label: string }> = {
  great_project: { icon: faPalette, color: 'text-purple-400', label: 'Great Project' },
  helpful: { icon: faHandshake, color: 'text-blue-400', label: 'Helpful' },
  inspiring: { icon: faStar, color: 'text-yellow-400', label: 'Inspiring' },
  creative: { icon: faLightbulb, color: 'text-orange-400', label: 'Creative' },
  supportive: { icon: faHandsHelping, color: 'text-emerald-400', label: 'Supportive' },
  welcome: { icon: faHeart, color: 'text-pink-400', label: 'Welcome' },
};

const ACTIVITY_CONFIG: Record<CircleActivityType, { icon: typeof faStar; color: string; bgColor: string }> = {
  kudos_given: { icon: faStar, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20 border-yellow-500/30' },
  project_created: { icon: faRocket, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  streak_achieved: { icon: faFire, color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
  challenge_progress: { icon: faTrophy, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20 border-emerald-500/30' },
  level_up: { icon: faBolt, color: 'text-cyan-bright', bgColor: 'bg-cyan-500/20 border-cyan-500/30' },
  member_joined: { icon: faHeart, color: 'text-pink-400', bgColor: 'bg-pink-500/20 border-pink-500/30' },
};

function getActivityMessage(event: CircleActivityEvent): string {
  switch (event.type) {
    case 'kudos_given':
      const kudosLabel = event.kudosType ? KUDOS_CONFIG[event.kudosType]?.label : 'kudos';
      return `gave ${kudosLabel} to ${event.targetUsername}`;
    case 'project_created':
      return 'published a new project';
    case 'streak_achieved':
      return `hit a ${event.message || '7-day'} streak!`;
    case 'challenge_progress':
      return 'contributed to the challenge';
    case 'level_up':
      return `leveled up to ${event.message || 'Sprout'}!`;
    case 'member_joined':
      return 'joined your circle';
    default:
      return 'did something awesome';
  }
}

function ActivityToast({
  event,
  onDismiss,
  isExiting
}: {
  event: ToastItem;
  onDismiss: () => void;
  isExiting?: boolean;
}) {
  const config = ACTIVITY_CONFIG[event.type];
  const kudosConfig = event.kudosType ? KUDOS_CONFIG[event.kudosType] : null;
  const icon = kudosConfig?.icon || config.icon;
  const color = kudosConfig?.color || config.color;

  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-xl
        bg-background/95 backdrop-blur-md border border-white/10
        shadow-[0_0_30px_rgba(0,0,0,0.5)]
        transform transition-all duration-300 ease-out
        ${isExiting
          ? 'opacity-0 translate-x-full'
          : 'opacity-100 translate-x-0 animate-slide-in-right'
        }
      `}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl ${config.bgColor} border flex items-center justify-center flex-shrink-0 shadow-neon`}>
        <FontAwesomeIcon icon={icon} className={`${color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-bold text-white">{event.username}</span>{' '}
          <span className="text-slate-400">{getActivityMessage(event)}</span>
        </p>
        <p className="text-xs text-slate-600 mt-0.5">just now</p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
      >
        <FontAwesomeIcon icon={faTimes} className="text-slate-500 text-xs" />
      </button>

      {/* Neon accent line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b ${
        event.type === 'kudos_given' ? 'from-yellow-400 to-orange-500' :
        event.type === 'project_created' ? 'from-purple-400 to-pink-500' :
        event.type === 'streak_achieved' ? 'from-orange-400 to-red-500' :
        event.type === 'level_up' ? 'from-cyan-400 to-blue-500' :
        'from-pink-400 to-purple-500'
      }`} />
    </div>
  );
}

export function CircleActivityToast({
  events,
  onDismiss,
  maxVisible = 3,
  autoHideDuration = 5000
}: CircleActivityToastProps) {
  const [visibleToasts, setVisibleToasts] = useState<ToastItem[]>([]);

  // Add new events to visible toasts
  useEffect(() => {
    if (events.length === 0) return;

    const newEvent = events[events.length - 1];

    // Check if already showing this event
    if (visibleToasts.some(t => t.id === newEvent.id)) return;

    setVisibleToasts(prev => {
      const updated = [...prev, { ...newEvent, isExiting: false }];
      // Keep only maxVisible toasts
      if (updated.length > maxVisible) {
        return updated.slice(-maxVisible);
      }
      return updated;
    });
  }, [events, maxVisible]);

  // Auto-hide toasts after duration
  useEffect(() => {
    if (visibleToasts.length === 0) return;

    const timers = visibleToasts.map(toast => {
      if (toast.isExiting) return null;

      return setTimeout(() => {
        handleDismiss(toast.id);
      }, autoHideDuration);
    });

    return () => {
      timers.forEach(timer => timer && clearTimeout(timer));
    };
  }, [visibleToasts, autoHideDuration]);

  const handleDismiss = useCallback((id: string) => {
    // Start exit animation
    setVisibleToasts(prev =>
      prev.map(t => t.id === id ? { ...t, isExiting: true } : t)
    );

    // Remove after animation
    setTimeout(() => {
      setVisibleToasts(prev => prev.filter(t => t.id !== id));
      onDismiss?.(id);
    }, 300);
  }, [onDismiss]);

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
      {visibleToasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ActivityToast
            event={toast}
            onDismiss={() => handleDismiss(toast.id)}
            isExiting={toast.isExiting}
          />
        </div>
      ))}
    </div>
  );
}

// Export a simple hook to manage activity events
export function useCircleActivityToasts() {
  const [events, setEvents] = useState<CircleActivityEvent[]>([]);

  const addEvent = useCallback((event: Omit<CircleActivityEvent, 'id' | 'timestamp'>) => {
    const newEvent: CircleActivityEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const dismissEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  return { events, addEvent, dismissEvent };
}
