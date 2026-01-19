/**
 * Mobile Calendar Component
 * US-007: Calendar Tab with month view
 */

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { ScheduleByDay } from '@/services/contentEngine/schedule';

interface MobileCalendarProps {
  year: number;
  month: number; // 0-indexed
  selectedDate: string | null;
  scheduleByDay: ScheduleByDay;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MobileCalendar({
  year,
  month,
  selectedDate,
  scheduleByDay,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MobileCalendarProps) {
  // Generate calendar days for the month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date: dateStr, day, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date: dateStr, day, isCurrentMonth: true });
    }

    // Next month padding to fill the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let i = 1; i <= remainingDays; i++) {
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ date: dateStr, day: i, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Check if a date is today
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="glass-panel rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          aria-label="Previous month"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h2 className="text-lg font-semibold text-white">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
          aria-label="Next month"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2" role="row">
        {WEEKDAYS.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-slate-500 py-1"
            role="columnheader"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1" role="grid">
        {calendarDays.map(({ date, day, isCurrentMonth }) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const hasEvents = scheduleByDay[date]?.length > 0;

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              aria-selected={isSelected}
              className={`
                relative aspect-square flex flex-col items-center justify-center rounded text-sm transition-all
                ${!isCurrentMonth ? 'text-slate-600' : 'text-slate-300'}
                ${isToday ? 'ring-1 ring-cyan-500/50' : ''}
                ${isSelected
                  ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                  : 'hover:bg-slate-700/50'
                }
              `}
            >
              <span>{day}</span>
              {/* Event indicator dot */}
              {hasEvents && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
