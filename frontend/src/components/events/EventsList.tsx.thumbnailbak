import { format } from 'date-fns';
import {
  CalendarIcon,
  MapPinIcon,
  LinkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { Event } from '@/services/eventsService';

interface EventsListProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
}

export function EventsList({ events, onEventClick }: EventsListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No events found
        </p>
      </div>
    );
  }

  const formatEventDate = (event: Event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);

    if (event.is_all_day) {
      return format(start, 'MMMM d, yyyy');
    }

    const isSameDay =
      start.getDate() === end.getDate() &&
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();

    if (isSameDay) {
      return `${format(start, 'MMM d, yyyy • h:mm a')} - ${format(end, 'h:mm a')}`;
    }

    return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'MMM d, h:mm a')}`;
  };

  const getEventStatus = (event: Event) => {
    if (event.is_ongoing) {
      return { label: 'Ongoing', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    }
    if (event.is_upcoming) {
      return { label: 'Upcoming', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    }
    return { label: 'Past', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
  };

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const status = getEventStatus(event);

        return (
          <div
            key={event.id}
            onClick={() => onEventClick?.(event)}
            className={`p-4 rounded-lg border transition-all cursor-pointer ${
              event.is_past
                ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:shadow-md'
            }`}
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: event.color,
            }}
          >
            {/* Thumbnail */}
            {event.thumbnail && (
              <img
                src={event.thumbnail}
                alt={event.title}
                className="w-full h-32 object-cover rounded-md mb-3"
              />
            )}

            {/* Event header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex-1">
                {event.title}
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
                {status.label}
              </span>
            </div>

            {/* Event details */}
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {/* Date/Time */}
              <div className="flex items-start gap-2">
                {event.is_all_day ? (
                  <CalendarIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <ClockIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <span className="flex-1">{formatEventDate(event)}</span>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="flex-1">{event.location}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mt-2">
                  {event.description}
                </p>
              )}

              {/* Event URL */}
              {event.event_url && (
                <a
                  href={event.event_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline mt-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Event details</span>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
