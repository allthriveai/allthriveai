import { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { EventsCalendar } from './EventsCalendar';
import { EventsList } from './EventsList';
import { EventForm } from './EventForm';
import { eventsService } from '@/services/eventsService';
import type { Event, CreateEventData } from '@/services/eventsService';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface RightEventsCalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightEventsCalendarPanel({ isOpen, onClose }: RightEventsCalendarPanelProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; eventId: number | null }>({
    isOpen: false,
    eventId: null,
  });
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.is_staff || user?.is_superuser;

  // Memoized filtered lists for performance
  const upcomingEvents = useMemo(
    () => events.filter((e) => e.is_upcoming),
    [events]
  );

  const displayedEvents = useMemo(
    () => (view === 'calendar' ? upcomingEvents.slice(0, 3) : events),
    [view, upcomingEvents, events]
  );

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsService.getEvents();
      setEvents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load events';
      setError(errorMessage);
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (data: CreateEventData) => {
    try {
      await eventsService.createEvent(data);
      await loadEvents();
      setShowForm(false);
    } catch (err) {
      console.error('Failed to create event:', err);
      throw err;
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirm({ isOpen: true, eventId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.eventId) return;

    try {
      setDeleting(true);
      await eventsService.deleteEvent(deleteConfirm.eventId);
      await loadEvents();
      setDeleteConfirm({ isOpen: false, eventId: null });
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-full md:w-96 lg:w-[32rem] bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Events Calendar
          </h2>
          <div className="flex items-center gap-2">
            {isAdmin && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Add Event"
              >
                <PlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showForm ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Create New Event
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Cancel
                </button>
              </div>
              <EventForm
                onSubmit={handleCreateEvent}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <>
              {/* View toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setView('calendar')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    view === 'calendar'
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    view === 'list'
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  List
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                  {error}
                </div>
              ) : (
                <>
                  {view === 'calendar' ? (
                    <div className="space-y-6">
                      <EventsCalendar
                        events={events}
                        onDateClick={(date, dateEvents) => {
                          if (dateEvents.length > 0) {
                            setView('list');
                          }
                        }}
                      />
                      {/* Upcoming events preview */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Upcoming Events
                        </h3>
                        <EventsList events={displayedEvents} />
                      </div>
                    </div>
                  ) : (
                    <EventsList events={displayedEvents} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, eventId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="danger"
      />
    </>
  );
}
