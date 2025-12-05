import { useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarIcon,
  MapPinIcon,
  LinkIcon,
  ClockIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { Event, RSVPStatus } from '@/services/eventsService';
import { eventsService } from '@/services/eventsService';

interface EventsListProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onRSVPChange?: () => void;
}

export function EventsList({ events, onEventClick, onRSVPChange }: EventsListProps) {
  const [rsvpLoading, setRsvpLoading] = useState<Record<number, boolean>>({});

  const handleRSVP = async (eventId: number, status: RSVPStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setRsvpLoading((prev) => ({ ...prev, [eventId]: true }));

    try {
      await eventsService.rsvpToEvent(eventId, status);
      onRSVPChange?.();
    } catch (error) {
      console.error('Failed to RSVP:', error);
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  };

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
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    if (event.isAllDay) {
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
    if (event.isOngoing) {
      return { label: 'Ongoing', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    }
    if (event.isUpcoming) {
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
              event.isPast
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
                {event.isAllDay ? (
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

              {/* RSVP Section - Only show for upcoming and ongoing events */}
              {!event.isPast && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Attendee avatars */}
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex -space-x-2">
                        {event.attendees.slice(0, 5).map((attendee) => (
                          <div
                            key={attendee.id}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden flex-shrink-0"
                            title={attendee.username}
                          >
                            {attendee.avatarUrl ? (
                              <img
                                src={attendee.avatarUrl}
                                alt={attendee.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs">
                                {attendee.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                        {event.goingCount > 5 && (
                          <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-medium flex-shrink-0">
                            +{event.goingCount - 5}
                          </div>
                        )}
                      </div>
                    )}
                    <UserGroupIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">
                      {event.goingCount} going
                      {event.maybeCount > 0 && `, ${event.maybeCount} maybe`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleRSVP(event.id, 'going', e)}
                      disabled={rsvpLoading[event.id]}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                        event.userRsvpStatus === 'going'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ring-2 ring-green-500'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {event.userRsvpStatus === 'going' && <CheckCircleIcon className="w-3 h-3" />}
                      Going
                    </button>
                    <button
                      onClick={(e) => handleRSVP(event.id, 'maybe', e)}
                      disabled={rsvpLoading[event.id]}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                        event.userRsvpStatus === 'maybe'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ring-2 ring-blue-500'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {event.userRsvpStatus === 'maybe' && <CheckCircleIcon className="w-3 h-3" />}
                      Maybe
                    </button>
                    <button
                      onClick={(e) => handleRSVP(event.id, 'not_going', e)}
                      disabled={rsvpLoading[event.id]}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
                        event.userRsvpStatus === 'not_going'
                          ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 ring-2 ring-gray-500'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {event.userRsvpStatus === 'not_going' && <CheckCircleIcon className="w-3 h-3" />}
                      Can't Go
                    </button>
                  </div>
                </div>
              )}

              {/* Event URL */}
              {event.eventUrl && (
                <a
                  href={event.eventUrl}
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
