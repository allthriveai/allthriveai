/**
 * Day Schedule Component
 * US-007: Calendar Tab with month view
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay } from '@fortawesome/free-solid-svg-icons';
import { ScheduleCard } from './ScheduleCard';
import type { ScheduledPost } from '@/types/contentEngine';

interface DayScheduleProps {
  date: string;
  posts: ScheduledPost[];
  onDelete?: (id: number) => void;
}

export function DaySchedule({ date, posts, onDelete }: DayScheduleProps) {
  // Format the date for display
  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Check if the date is today
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isToday = date === todayStr;

  return (
    <div className="mt-4">
      {/* Date header */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-slate-400">
          {displayDate}
          {isToday && (
            <span className="ml-2 text-cyan-400">(Today)</span>
          )}
        </h3>
      </div>

      {/* Posts list or empty state */}
      {posts.length === 0 ? (
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faCalendarDay} className="text-2xl text-slate-600 mb-2" />
          <p className="text-sm text-slate-500">No content scheduled</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <ScheduleCard key={post.id} post={post} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
