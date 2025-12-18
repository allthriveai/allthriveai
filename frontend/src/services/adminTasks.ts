/**
 * API service for the Admin Task Tracker feature.
 * All endpoints require admin authentication.
 */

import { api } from './api';
import type {
  Task,
  TaskOption,
  TaskDashboard,
  TaskStats,
  TaskAdminUser,
  TaskQueryParams,
  CreateTaskPayload,
  UpdateTaskPayload,
  BulkUpdateTasksPayload,
  ReorderTaskPayload,
  TaskOptionPayload,
  TaskDashboardPayload,
  TaskOptionType,
} from '@/types/tasks';

const BASE_URL = '/admin/tasks';

// Helper to build query string from params
function buildQueryString(params: TaskQueryParams): string {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.taskType) searchParams.set('task_type', params.taskType);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.assignee) searchParams.set('assignee', params.assignee);
  if (params.due) searchParams.set('due', params.due);
  if (params.search) searchParams.set('search', params.search);
  if (params.archived) searchParams.set('archived', params.archived);
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortDir) searchParams.set('sort_dir', params.sortDir);
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const adminTasksService = {
  // ========== TASKS ==========

  /**
   * Get all tasks with optional filters
   */
  async getTasks(params: TaskQueryParams = {}): Promise<Task[]> {
    const queryString = buildQueryString(params);
    const response = await api.get<Task[] | { results: Task[] }>(`${BASE_URL}/tasks/${queryString}`);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  /**
   * Get a single task by ID
   */
  async getTask(id: number): Promise<Task> {
    const response = await api.get<Task>(`${BASE_URL}/tasks/${id}/`);
    return response.data;
  },

  /**
   * Create a new task
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async createTask(payload: CreateTaskPayload): Promise<Task> {
    const response = await api.post<Task>(`${BASE_URL}/tasks/`, payload);
    return response.data;
  },

  /**
   * Update a task
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async updateTask(id: number, payload: UpdateTaskPayload): Promise<Task> {
    const response = await api.patch<Task>(`${BASE_URL}/tasks/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a task
   */
  async deleteTask(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/tasks/${id}/`);
  },

  /**
   * Bulk update multiple tasks
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async bulkUpdateTasks(payload: BulkUpdateTasksPayload): Promise<{ status: string; count: number }> {
    const response = await api.post<{ status: string; count: number }>(`${BASE_URL}/tasks/bulk_update/`, payload);
    return response.data;
  },

  /**
   * Reorder a task (within or across columns)
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async reorderTask(payload: ReorderTaskPayload): Promise<{ status: string }> {
    const response = await api.post<{ status: string }>(`${BASE_URL}/tasks/reorder/`, payload);
    return response.data;
  },

  /**
   * Get task statistics
   */
  async getStats(): Promise<TaskStats> {
    const response = await api.get<TaskStats>(`${BASE_URL}/tasks/stats/`);
    return response.data;
  },

  // ========== CSV IMPORT/EXPORT ==========

  /**
   * Export tasks to CSV file
   * Returns blob URL for download
   */
  async exportToCsv(params: TaskQueryParams = {}): Promise<void> {
    const queryString = buildQueryString(params);
    const response = await api.get(`${BASE_URL}/tasks/export_csv/${queryString}`, {
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'tasks.csv';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Import tasks from CSV file
   */
  async importFromCsv(file: File): Promise<{
    created: number;
    updated: number;
    errors: string[];
    total_errors: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<{
      created: number;
      updated: number;
      errors: string[];
      total_errors: number;
    }>(`${BASE_URL}/tasks/import_csv/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Download CSV import template
   */
  async downloadCsvTemplate(): Promise<void> {
    const response = await api.get(`${BASE_URL}/tasks/csv_template/`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'task_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ========== OPTIONS ==========

  /**
   * Get all task options, optionally filtered by type
   */
  async getOptions(optionType?: TaskOptionType): Promise<TaskOption[]> {
    const params = optionType ? `?option_type=${optionType}` : '';
    const response = await api.get<TaskOption[] | { results: TaskOption[] }>(`${BASE_URL}/options/${params}`);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  /**
   * Get options by type (convenience methods)
   */
  async getStatuses(): Promise<TaskOption[]> {
    return this.getOptions('status');
  },

  async getTypes(): Promise<TaskOption[]> {
    return this.getOptions('type');
  },

  async getPriorities(): Promise<TaskOption[]> {
    return this.getOptions('priority');
  },

  /**
   * Create a new option
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async createOption(payload: TaskOptionPayload): Promise<TaskOption> {
    const response = await api.post<TaskOption>(`${BASE_URL}/options/`, payload);
    return response.data;
  },

  /**
   * Update an option
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async updateOption(id: number, payload: Partial<TaskOptionPayload>): Promise<TaskOption> {
    const response = await api.patch<TaskOption>(`${BASE_URL}/options/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete an option
   */
  async deleteOption(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/options/${id}/`);
  },

  /**
   * Reorder options within a type
   */
  async reorderOptions(optionType: TaskOptionType, order: number[]): Promise<{ status: string }> {
    const response = await api.post<{ status: string }>(`${BASE_URL}/options/reorder/`, {
      option_type: optionType,
      order,
    });
    return response.data;
  },

  // ========== DASHBOARDS ==========

  /**
   * Get all dashboards (shared + own private)
   */
  async getDashboards(): Promise<TaskDashboard[]> {
    const response = await api.get<TaskDashboard[] | { results: TaskDashboard[] }>(`${BASE_URL}/dashboards/`);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },

  /**
   * Get a single dashboard
   */
  async getDashboard(id: number): Promise<TaskDashboard> {
    const response = await api.get<TaskDashboard>(`${BASE_URL}/dashboards/${id}/`);
    return response.data;
  },

  /**
   * Create a new dashboard
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async createDashboard(payload: TaskDashboardPayload): Promise<TaskDashboard> {
    const response = await api.post<TaskDashboard>(`${BASE_URL}/dashboards/`, payload);
    return response.data;
  },

  /**
   * Update a dashboard
   * Note: API interceptor automatically converts camelCase to snake_case
   */
  async updateDashboard(id: number, payload: Partial<TaskDashboardPayload>): Promise<TaskDashboard> {
    const response = await api.patch<TaskDashboard>(`${BASE_URL}/dashboards/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a dashboard
   */
  async deleteDashboard(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/dashboards/${id}/`);
  },

  /**
   * Reorder dashboards
   */
  async reorderDashboards(order: number[]): Promise<{ status: string }> {
    const response = await api.post<{ status: string }>(`${BASE_URL}/dashboards/reorder/`, { order });
    return response.data;
  },

  // ========== ADMINS ==========

  /**
   * Get list of admin users (for assignee dropdown)
   */
  async getAdminUsers(): Promise<TaskAdminUser[]> {
    const response = await api.get<TaskAdminUser[] | { results: TaskAdminUser[] }>(`${BASE_URL}/admins/`);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results || []);
  },
};

export default adminTasksService;
