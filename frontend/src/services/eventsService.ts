import { API_BASE_URL, apiFetch } from '@/config/api';

export type RSVPStatus = 'going' | 'maybe' | 'not_going';

export interface EventRSVP {
  id: number;
  event: number;
  user: number;
  user_username: string;
  status: RSVPStatus;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  event_url: string;
  is_all_day: boolean;
  color: string;
  thumbnail: string;
  created_by: number | null;
  created_by_username: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  is_past: boolean;
  is_upcoming: boolean;
  is_ongoing: boolean;
  rsvp_count: number;
  going_count: number;
  maybe_count: number;
  user_rsvp_status: RSVPStatus | null;
}

export interface CreateEventData {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  event_url?: string;
  is_all_day?: boolean;
  color?: string;
  thumbnail?: string;
  is_published?: boolean;
}

const EVENTS_API_URL = `${API_BASE_URL}/api/v1/events/`;

export const eventsService = {
  // Get all events
  async getEvents(): Promise<Event[]> {
    try {
      const response = await apiFetch(EVENTS_API_URL);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view events');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      const data = await response.json();
      // Handle both array and paginated response formats
      return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
      // Network error or other fetch failure
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      // Re-throw if it's already our custom error
      throw error;
    }
  },

  // Get a single event
  async getEvent(id: number): Promise<Event> {
    const response = await apiFetch(`${EVENTS_API_URL}${id}/`);
    if (!response.ok) {
      throw new Error('Failed to fetch event');
    }
    return response.json();
  },

  // Get upcoming events
  async getUpcomingEvents(): Promise<Event[]> {
    const response = await apiFetch(`${EVENTS_API_URL}upcoming/`);
    if (!response.ok) {
      throw new Error('Failed to fetch upcoming events');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get past events
  async getPastEvents(): Promise<Event[]> {
    const response = await apiFetch(`${EVENTS_API_URL}past/`);
    if (!response.ok) {
      throw new Error('Failed to fetch past events');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get ongoing events
  async getOngoingEvents(): Promise<Event[]> {
    const response = await apiFetch(`${EVENTS_API_URL}ongoing/`);
    if (!response.ok) {
      throw new Error('Failed to fetch ongoing events');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get events in date range
  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const response = await apiFetch(
      `${EVENTS_API_URL}date_range/?start=${startDate}&end=${endDate}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch events by date range');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Create event (admin only)
  async createEvent(data: CreateEventData): Promise<Event> {
    const response = await apiFetch(EVENTS_API_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create event');
    }
    return response.json();
  },

  // Update event (admin only)
  async updateEvent(id: number, data: Partial<CreateEventData>): Promise<Event> {
    const response = await apiFetch(`${EVENTS_API_URL}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update event');
    }
    return response.json();
  },

  // Delete event (admin only)
  async deleteEvent(id: number): Promise<void> {
    const response = await apiFetch(`${EVENTS_API_URL}${id}/`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete event');
    }
  },

  // RSVP to an event
  async rsvpToEvent(eventId: number, status: RSVPStatus): Promise<{ message: string; rsvp: EventRSVP }> {
    const response = await apiFetch(`${EVENTS_API_URL}${eventId}/rsvp/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to RSVP to event');
    }
    return response.json();
  },

  // Remove RSVP from an event
  async removeRSVP(eventId: number): Promise<void> {
    const response = await apiFetch(`${EVENTS_API_URL}${eventId}/rsvp/`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove RSVP');
    }
  },
};

// Explicit type exports for better compatibility
export type { Event, CreateEventData };
