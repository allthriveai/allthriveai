/**
 * Calendar Tab Component
 * US-007: Calendar Tab with month view
 */

import { useState, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faRedo } from '@fortawesome/free-solid-svg-icons';
import { useScheduleByDay, useDeleteSchedule } from '@/hooks/useSchedule';
import { MobileCalendar } from '../calendar/MobileCalendar';
import { DaySchedule } from '../calendar/DaySchedule';

export function CalendarTab() {
  // Current month state
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  // Selected date state (default to today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Calculate date range for the visible month (with padding for prev/next month days)
  const { startDate, endDate } = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // Start from the beginning of the week containing the first day
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());

    // End at the end of the week containing the last day
    const end = new Date(lastOfMonth);
    end.setDate(end.getDate() + (6 - end.getDay()));

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [year, month]);

  // Fetch schedule data
  const { schedule, isLoading, error, refetch } = useScheduleByDay(startDate, endDate);
  const { deleteSchedule } = useDeleteSchedule();

  // Navigation handlers
  const handlePrevMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // Delete handler
  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteSchedule(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete scheduled post:', err);
    }
  }, [deleteSchedule, refetch]);

  // Get posts for selected date
  const selectedDatePosts = selectedDate ? (schedule[selectedDate] || []) : [];

  // Loading state
  if (isLoading) {
    return (
      <div
        id="tabpanel-calendar"
        role="tabpanel"
        aria-labelledby="tab-calendar"
        className="h-full"
      >
        <div className="space-y-4">
          {/* Calendar skeleton */}
          <div className="glass-panel rounded-xl p-4">
            <div className="h-8 bg-slate-800/50 rounded mb-4 animate-pulse" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-800/30 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Day schedule skeleton */}
          <div className="h-6 w-32 bg-slate-800/50 rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-3 rounded-lg h-12 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        id="tabpanel-calendar"
        role="tabpanel"
        aria-labelledby="tab-calendar"
        className="h-full flex items-center justify-center"
      >
        <div className="text-center glass-panel p-8 rounded-xl max-w-md">
          <FontAwesomeIcon icon={faExclamationCircle} className="text-4xl text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Calendar</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => refetch()}
            className="btn-primary px-4 py-2 inline-flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faRedo} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="tabpanel-calendar"
      role="tabpanel"
      aria-labelledby="tab-calendar"
      className="h-full"
    >
      {/* Calendar */}
      <MobileCalendar
        year={year}
        month={month}
        selectedDate={selectedDate}
        scheduleByDay={schedule}
        onSelectDate={setSelectedDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Day schedule */}
      {selectedDate && (
        <DaySchedule
          date={selectedDate}
          posts={selectedDatePosts}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
