/**
 * BattleDeadlineCountdown Component
 *
 * Displays countdown timer for async battles:
 * - Async deadline: Shows days/hours remaining (e.g., "2d 14h")
 * - Turn timer: Shows MM:SS countdown with urgency styling
 */

import { useState, useEffect, useCallback } from 'react';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

type CountdownVariant = 'deadline' | 'turn';

interface BattleDeadlineCountdownProps {
  targetDate: string; // ISO date string
  variant?: CountdownVariant;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isExpired: boolean;
}

function calculateTimeRemaining(targetDate: string): TimeRemaining {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total, isExpired: false };
}

function formatDeadline(time: TimeRemaining): string {
  if (time.isExpired) return 'Expired';

  if (time.days > 0) {
    return `${time.days}d ${time.hours}h`;
  }
  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m`;
  }
  return `${time.minutes}m`;
}

function formatTurnTimer(time: TimeRemaining): string {
  if (time.isExpired) return '0:00';

  const mins = time.minutes + time.hours * 60 + time.days * 24 * 60;
  const secs = time.seconds.toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getUrgencyLevel(time: TimeRemaining, variant: CountdownVariant): 'normal' | 'warning' | 'critical' {
  if (time.isExpired) return 'critical';

  if (variant === 'turn') {
    // Turn timer: critical under 30 sec, warning under 1 min
    if (time.total < 30000) return 'critical';
    if (time.total < 60000) return 'warning';
    return 'normal';
  } else {
    // Deadline: critical under 6 hours, warning under 24 hours
    if (time.total < 6 * 60 * 60 * 1000) return 'critical';
    if (time.total < 24 * 60 * 60 * 1000) return 'warning';
    return 'normal';
  }
}

export function BattleDeadlineCountdown({
  targetDate,
  variant = 'deadline',
  onExpire,
  className,
  showIcon = true,
  size = 'md',
}: BattleDeadlineCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(targetDate)
  );
  const [hasExpired, setHasExpired] = useState(false);

  // Reset hasExpired when targetDate changes (e.g., deadline extended)
  useEffect(() => {
    setHasExpired(false);
    setTimeRemaining(calculateTimeRemaining(targetDate));
  }, [targetDate]);

  const updateTime = useCallback(() => {
    const newTime = calculateTimeRemaining(targetDate);
    setTimeRemaining(newTime);

    if (newTime.isExpired && !hasExpired) {
      setHasExpired(true);
      onExpire?.();
    }
  }, [targetDate, hasExpired, onExpire]);

  useEffect(() => {
    // Update interval based on variant
    // Turn timer: every second for accurate MM:SS
    // Deadline: every minute for d/h/m display
    const interval = variant === 'turn' ? 1000 : 60000;
    const timer = setInterval(updateTime, interval);

    return () => clearInterval(timer);
  }, [updateTime, variant]);

  const urgency = getUrgencyLevel(timeRemaining, variant);
  const formattedTime =
    variant === 'turn'
      ? formatTurnTimer(timeRemaining)
      : formatDeadline(timeRemaining);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const urgencyClasses = {
    normal: 'text-slate-400',
    warning: 'text-amber-400',
    critical: 'text-red-400 animate-pulse',
  };

  const urgencyBgClasses = {
    normal: 'bg-slate-800/50',
    warning: 'bg-amber-900/30 border border-amber-500/30',
    critical: 'bg-red-900/30 border border-red-500/30',
  };

  const IconComponent = urgency === 'critical' ? ExclamationTriangleIcon : ClockIcon;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
        urgencyBgClasses[urgency],
        sizeClasses[size],
        className
      )}
      role="timer"
      aria-live={urgency === 'critical' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {showIcon && (
        <IconComponent
          className={clsx(iconSizeClasses[size], urgencyClasses[urgency])}
          aria-hidden="true"
        />
      )}
      <span className={clsx('font-mono font-medium', urgencyClasses[urgency])}>
        {formattedTime}
      </span>
      <span className="sr-only">
        {variant === 'turn'
          ? `${formattedTime} remaining to submit your prompt`
          : `${formattedTime} until deadline`}
      </span>
    </div>
  );
}

export default BattleDeadlineCountdown;
