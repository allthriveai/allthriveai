/**
 * Content Engine Schedule API Service
 * US-006: Schedule API service and hooks
 */

import { api } from '../api';
import type {
  ScheduledPost,
  CreateSchedulePayload,
  UpdateSchedulePayload,
  Platform,
  ScheduleStatus,
} from '@/types/contentEngine';

export interface ScheduleListParams {
  startDate?: string;
  endDate?: string;
  platform?: Platform;
  status?: ScheduleStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedScheduleResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ScheduledPost[];
}

export interface ScheduleByDay {
  [date: string]: ScheduledPost[];
}

/**
 * Get paginated list of scheduled posts
 */
export async function getSchedule(params?: ScheduleListParams): Promise<PaginatedScheduleResponse> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.set('start_date', params.startDate);
  if (params?.endDate) queryParams.set('end_date', params.endDate);
  if (params?.platform) queryParams.set('platform', params.platform);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());

  const queryString = queryParams.toString();
  const url = queryString ? `/content-engine/schedule/?${queryString}` : '/content-engine/schedule/';
  const response = await api.get(url);
  return response.data;
}

/**
 * Get a single scheduled post by ID
 */
export async function getScheduledPost(id: number): Promise<ScheduledPost> {
  const response = await api.get(`/content-engine/schedule/${id}/`);
  return response.data;
}

/**
 * Create a new scheduled post
 */
export async function createScheduledPost(data: CreateSchedulePayload): Promise<ScheduledPost> {
  const response = await api.post('/content-engine/schedule/', data);
  return response.data;
}

/**
 * Update an existing scheduled post
 */
export async function updateScheduledPost(id: number, data: UpdateSchedulePayload): Promise<ScheduledPost> {
  const response = await api.patch(`/content-engine/schedule/${id}/`, data);
  return response.data;
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(id: number): Promise<void> {
  await api.delete(`/content-engine/schedule/${id}/`);
}

/**
 * Get calendar view data for a date range
 */
export async function getCalendarData(startDate: string, endDate: string): Promise<ScheduledPost[]> {
  const response = await api.get('/content-engine/calendar/', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
}

/**
 * Group scheduled posts by day
 */
export function groupByDay(posts: ScheduledPost[]): ScheduleByDay {
  return posts.reduce((acc, post) => {
    // Extract just the date portion
    const date = post.scheduledFor.split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(post);
    // Sort by time within the day
    acc[date].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    return acc;
  }, {} as ScheduleByDay);
}

/**
 * Schedule API object for convenience
 */
export const scheduleApi = {
  list: getSchedule,
  get: getScheduledPost,
  create: createScheduledPost,
  update: updateScheduledPost,
  delete: deleteScheduledPost,
  calendar: getCalendarData,
  groupByDay,
};
