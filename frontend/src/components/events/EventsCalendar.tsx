import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Event } from '@/services/eventsService';

interface EventsCalendarProps {
  events: Event[];
  onDateClick?: (date: Date, events: Event[]) => void;
}

export function EventsCalendar({ events, onDateClick }: EventsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Get all days in month
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start to align with week start (Sunday)
  const startPadding = monthStart.getDay();
  const paddedDays = Array(startPadding).fill(null).concat(daysInMonth);

  const getEventsForDate = (date: Date): Event[] => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return date >= eventStart && date <= eventEnd;
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDateClick = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    onDateClick?.(date, dayEvents);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {format(currentDate, 'MMMM yyyy')}
        </h3>

        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          const dayEvents = getEventsForDate(day);
          const hasEvents = dayEvents.length > 0;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              disabled={!isCurrentMonth}
              className={`
                relative aspect-square p-1 rounded-lg text-sm transition-all
                ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed' : ''}
                ${isCurrentMonth && !isTodayDate ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                ${isTodayDate ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-semibold' : ''}
                ${hasEvents && isCurrentMonth ? 'font-medium' : ''}
              `}
            >
              <span className="block">{format(day, 'd')}</span>
              {hasEvents && isCurrentMonth && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="w-2 h-2 rounded-full bg-primary-500" />
          <span>Today</span>
          <div className="ml-3 flex gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Events</span>
          </div>
        </div>
      </div>
    </div>
  );
}
