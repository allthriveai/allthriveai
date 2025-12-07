import { api } from './api';

// Note: These are the actual values sent to/received from the backend (not transformed)
export type RSVPStatus = 'going' | 'maybe' | 'not_going';

export interface EventAttendee {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface EventRSVP {
  id: number;
  event: number;
  user: number;
  userUsername: string;
  status: RSVPStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  eventUrl: string;
  isAllDay: boolean;
  color: string;
  thumbnail: string;
  createdBy: number | null;
  createdByUsername: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  isOngoing: boolean;
  rsvpCount: number;
  goingCount: number;
  maybeCount: number;
  userRsvpStatus: RSVPStatus | null;
  attendees: EventAttendee[];
}

export interface CreateEventData {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  eventUrl?: string;
  isAllDay?: boolean;
  color?: string;
  thumbnail?: string;
  isPublished?: boolean;
}

export const eventsService = {
  // Get all events
  async getEvents(): Promise<Event[]> {
    const response = await api.get<Event[] | { results: Event[] }>('/events/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get a single event
  async getEvent(id: number): Promise<Event> {
    const response = await api.get<Event>(`/events/${id}/`);
    return response.data;
  },

  // Get upcoming events
  async getUpcomingEvents(): Promise<Event[]> {
    const response = await api.get<Event[] | { results: Event[] }>('/events/upcoming/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get past events
  async getPastEvents(): Promise<Event[]> {
    const response = await api.get<Event[] | { results: Event[] }>('/events/past/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get ongoing events
  async getOngoingEvents(): Promise<Event[]> {
    const response = await api.get<Event[] | { results: Event[] }>('/events/ongoing/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Get events in date range
  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const response = await api.get<Event[] | { results: Event[] }>('/events/date_range/', {
      params: { start: startDate, end: endDate },
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  // Create event (admin only)
  async createEvent(data: CreateEventData): Promise<Event> {
    const response = await api.post<Event>('/events/', data);
    return response.data;
  },

  // Update event (admin only)
  async updateEvent(id: number, data: Partial<CreateEventData>): Promise<Event> {
    const response = await api.patch<Event>(`/events/${id}/`, data);
    return response.data;
  },

  // Delete event (admin only)
  async deleteEvent(id: number): Promise<void> {
    await api.delete(`/events/${id}/`);
  },

  // RSVP to an event
  async rsvpToEvent(eventId: number, status: RSVPStatus): Promise<{ message: string; rsvp: EventRSVP }> {
    const response = await api.post<{ message: string; rsvp: EventRSVP }>(`/events/${eventId}/rsvp/`, { status });
    return response.data;
  },

  // Remove RSVP from an event
  async removeRSVP(eventId: number): Promise<void> {
    await api.delete(`/events/${eventId}/rsvp/`);
  },
};

// Explicit type exports for better compatibility
export type { Event, CreateEventData };
