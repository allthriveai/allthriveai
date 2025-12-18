/**
 * API service for the UAT Scenarios feature.
 * All endpoints require admin authentication.
 */

import { api } from './api';
import type {
  UATScenario,
  UATCategory,
  UATTestRun,
  UATScenarioStats,
  UATScenarioAssignee,
  UATScenarioQueryParams,
  CreateUATScenarioPayload,
  UpdateUATScenarioPayload,
  CreateUATTestRunPayload,
  UpdateUATTestRunPayload,
  CreateUATCategoryPayload,
  UpdateUATCategoryPayload,
} from '@/types/uatScenarios';

const BASE_URL = '/admin/uat-scenarios';

// Helper to build query string from params
function buildQueryString(params: UATScenarioQueryParams): string {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.latestResult) searchParams.set('latest_result', params.latestResult);
  if (params.category) searchParams.set('category', params.category.toString());
  if (params.archived !== undefined) searchParams.set('archived', params.archived.toString());
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortDir) searchParams.set('sort_dir', params.sortDir);
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export const uatScenariosService = {
  // ========== SCENARIOS ==========

  /**
   * Get all scenarios with optional filters
   */
  async getScenarios(params: UATScenarioQueryParams = {}): Promise<UATScenario[]> {
    const queryString = buildQueryString(params);
    const response = await api.get<UATScenario[] | { results: UATScenario[] }>(
      `${BASE_URL}/scenarios/${queryString}`
    );
    const data = response.data;
    return Array.isArray(data) ? data : data.results || [];
  },

  /**
   * Get a single scenario by ID
   */
  async getScenario(id: number): Promise<UATScenario> {
    const response = await api.get<UATScenario>(`${BASE_URL}/scenarios/${id}/`);
    return response.data;
  },

  /**
   * Create a new scenario
   */
  async createScenario(payload: CreateUATScenarioPayload): Promise<UATScenario> {
    const response = await api.post<UATScenario>(`${BASE_URL}/scenarios/`, payload);
    return response.data;
  },

  /**
   * Update a scenario
   */
  async updateScenario(id: number, payload: UpdateUATScenarioPayload): Promise<UATScenario> {
    const response = await api.patch<UATScenario>(`${BASE_URL}/scenarios/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a scenario
   */
  async deleteScenario(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/scenarios/${id}/`);
  },

  /**
   * Reorder scenarios
   */
  async reorderScenarios(order: number[]): Promise<{ status: string }> {
    const response = await api.post<{ status: string }>(`${BASE_URL}/scenarios/reorder/`, { order });
    return response.data;
  },

  /**
   * Get scenario statistics
   */
  async getStats(): Promise<UATScenarioStats> {
    const response = await api.get<UATScenarioStats>(`${BASE_URL}/scenarios/stats/`);
    return response.data;
  },

  /**
   * Create a task from a failed scenario
   */
  async createTaskFromScenario(scenarioId: number): Promise<{ taskId: number; status: string }> {
    const response = await api.post<{ taskId: number; status: string }>(
      `${BASE_URL}/scenarios/${scenarioId}/create_task/`
    );
    return response.data;
  },

  // ========== TEST RUNS ==========

  /**
   * Get test runs with optional filters
   */
  async getTestRuns(params: { scenario?: number; result?: string; testedBy?: number } = {}): Promise<UATTestRun[]> {
    const searchParams = new URLSearchParams();
    if (params.scenario) searchParams.set('scenario', params.scenario.toString());
    if (params.result) searchParams.set('result', params.result);
    if (params.testedBy) searchParams.set('tested_by', params.testedBy.toString());
    const queryString = searchParams.toString();
    const response = await api.get<UATTestRun[] | { results: UATTestRun[] }>(
      `${BASE_URL}/test-runs/${queryString ? `?${queryString}` : ''}`
    );
    const data = response.data;
    return Array.isArray(data) ? data : data.results || [];
  },

  /**
   * Get a single test run by ID
   */
  async getTestRun(id: number): Promise<UATTestRun> {
    const response = await api.get<UATTestRun>(`${BASE_URL}/test-runs/${id}/`);
    return response.data;
  },

  /**
   * Create a new test run
   */
  async createTestRun(payload: CreateUATTestRunPayload): Promise<UATTestRun> {
    const response = await api.post<UATTestRun>(`${BASE_URL}/test-runs/`, payload);
    return response.data;
  },

  /**
   * Update a test run
   */
  async updateTestRun(id: number, payload: UpdateUATTestRunPayload): Promise<UATTestRun> {
    const response = await api.patch<UATTestRun>(`${BASE_URL}/test-runs/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a test run
   */
  async deleteTestRun(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/test-runs/${id}/`);
  },

  // ========== CATEGORIES ==========

  /**
   * Get all categories
   */
  async getCategories(): Promise<UATCategory[]> {
    const response = await api.get<UATCategory[] | { results: UATCategory[] }>(
      `${BASE_URL}/categories/`
    );
    const data = response.data;
    return Array.isArray(data) ? data : data.results || [];
  },

  /**
   * Get a single category by ID
   */
  async getCategory(id: number): Promise<UATCategory> {
    const response = await api.get<UATCategory>(`${BASE_URL}/categories/${id}/`);
    return response.data;
  },

  /**
   * Create a new category
   */
  async createCategory(payload: CreateUATCategoryPayload): Promise<UATCategory> {
    const response = await api.post<UATCategory>(`${BASE_URL}/categories/`, payload);
    return response.data;
  },

  /**
   * Update a category
   */
  async updateCategory(id: number, payload: UpdateUATCategoryPayload): Promise<UATCategory> {
    const response = await api.patch<UATCategory>(`${BASE_URL}/categories/${id}/`, payload);
    return response.data;
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/categories/${id}/`);
  },

  /**
   * Reorder categories
   */
  async reorderCategories(order: number[]): Promise<{ status: string }> {
    const response = await api.post<{ status: string }>(`${BASE_URL}/categories/reorder/`, {
      order,
    });
    return response.data;
  },

  // ========== ADMINS ==========

  /**
   * Get list of admin users (for assignee dropdown)
   */
  async getAdminUsers(): Promise<UATScenarioAssignee[]> {
    const response = await api.get<UATScenarioAssignee[] | { results: UATScenarioAssignee[] }>(
      `${BASE_URL}/admins/`
    );
    const data = response.data;
    return Array.isArray(data) ? data : data.results || [];
  },
};

export default uatScenariosService;
