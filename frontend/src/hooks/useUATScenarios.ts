/**
 * React Query hooks for UAT Scenarios feature
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uatScenariosService } from '@/services/uatScenarios';
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

// Query keys
export const uatKeys = {
  all: ['uatScenarios'] as const,
  // Scenarios
  scenarios: () => [...uatKeys.all, 'scenarios'] as const,
  scenarioList: (params: UATScenarioQueryParams) => [...uatKeys.scenarios(), params] as const,
  scenarioDetail: (id: number) => [...uatKeys.scenarios(), 'detail', id] as const,
  scenarioStats: () => [...uatKeys.scenarios(), 'stats'] as const,
  // Test Runs
  testRuns: () => [...uatKeys.all, 'testRuns'] as const,
  testRunList: (params: { scenario?: number; result?: string; testedBy?: number }) => [...uatKeys.testRuns(), params] as const,
  testRunDetail: (id: number) => [...uatKeys.testRuns(), 'detail', id] as const,
  // Categories
  categories: () => [...uatKeys.all, 'categories'] as const,
  categoryDetail: (id: number) => [...uatKeys.categories(), 'detail', id] as const,
  // Admins
  admins: () => [...uatKeys.all, 'admins'] as const,
};

// ========== SCENARIO HOOKS ==========

/**
 * Get scenarios with filters
 */
export function useUATScenarios(params: UATScenarioQueryParams = {}) {
  return useQuery<UATScenario[], Error>({
    queryKey: uatKeys.scenarioList(params),
    queryFn: () => uatScenariosService.getScenarios(params),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Get a single scenario
 */
export function useUATScenario(id: number, enabled: boolean = true) {
  return useQuery<UATScenario, Error>({
    queryKey: uatKeys.scenarioDetail(id),
    queryFn: () => uatScenariosService.getScenario(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 30,
  });
}

/**
 * Get scenario statistics
 */
export function useUATScenarioStats() {
  return useQuery<UATScenarioStats, Error>({
    queryKey: uatKeys.scenarioStats(),
    queryFn: () => uatScenariosService.getStats(),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Create a new scenario
 */
export function useCreateUATScenario() {
  const queryClient = useQueryClient();

  return useMutation<UATScenario, Error, CreateUATScenarioPayload>({
    mutationFn: uatScenariosService.createScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

/**
 * Update a scenario
 */
export function useUpdateUATScenario() {
  const queryClient = useQueryClient();

  return useMutation<UATScenario, Error, { id: number; payload: UpdateUATScenarioPayload }>({
    mutationFn: ({ id, payload }) => uatScenariosService.updateScenario(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

/**
 * Delete a scenario
 */
export function useDeleteUATScenario() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: uatScenariosService.deleteScenario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

/**
 * Reorder scenarios
 */
export function useReorderUATScenarios() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, number[]>({
    mutationFn: uatScenariosService.reorderScenarios,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
    },
  });
}

/**
 * Create a task from a failed scenario
 */
export function useCreateTaskFromScenario() {
  const queryClient = useQueryClient();

  return useMutation<{ taskId: number; status: string }, Error, number>({
    mutationFn: uatScenariosService.createTaskFromScenario,
    onSuccess: (_, scenarioId) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioDetail(scenarioId) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
    },
  });
}

// ========== TEST RUN HOOKS ==========

/**
 * Get test runs with optional filters
 */
export function useUATTestRuns(params: { scenario?: number; result?: string; testedBy?: number } = {}) {
  return useQuery<UATTestRun[], Error>({
    queryKey: uatKeys.testRunList(params),
    queryFn: () => uatScenariosService.getTestRuns(params),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Get a single test run
 */
export function useUATTestRun(id: number, enabled: boolean = true) {
  return useQuery<UATTestRun, Error>({
    queryKey: uatKeys.testRunDetail(id),
    queryFn: () => uatScenariosService.getTestRun(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 30,
  });
}

/**
 * Create a new test run
 */
export function useCreateUATTestRun() {
  const queryClient = useQueryClient();

  return useMutation<UATTestRun, Error, CreateUATTestRunPayload>({
    mutationFn: uatScenariosService.createTestRun,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.testRuns() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioDetail(data.scenario) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

/**
 * Update a test run
 */
export function useUpdateUATTestRun() {
  const queryClient = useQueryClient();

  return useMutation<UATTestRun, Error, { id: number; payload: UpdateUATTestRunPayload }>({
    mutationFn: ({ id, payload }) => uatScenariosService.updateTestRun(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.testRuns() });
      queryClient.invalidateQueries({ queryKey: uatKeys.testRunDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioDetail(data.scenario) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

/**
 * Delete a test run
 */
export function useDeleteUATTestRun() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: number; scenarioId: number }>({
    mutationFn: ({ id }) => uatScenariosService.deleteTestRun(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.testRuns() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarios() });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioDetail(variables.scenarioId) });
      queryClient.invalidateQueries({ queryKey: uatKeys.scenarioStats() });
    },
  });
}

// ========== CATEGORY HOOKS ==========

/**
 * Get all categories
 */
export function useUATCategories() {
  return useQuery<UATCategory[], Error>({
    queryKey: uatKeys.categories(),
    queryFn: () => uatScenariosService.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes - categories don't change often
  });
}

/**
 * Get a single category
 */
export function useUATCategory(id: number, enabled: boolean = true) {
  return useQuery<UATCategory, Error>({
    queryKey: uatKeys.categoryDetail(id),
    queryFn: () => uatScenariosService.getCategory(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new category
 */
export function useCreateUATCategory() {
  const queryClient = useQueryClient();

  return useMutation<UATCategory, Error, CreateUATCategoryPayload>({
    mutationFn: uatScenariosService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.categories() });
    },
  });
}

/**
 * Update a category
 */
export function useUpdateUATCategory() {
  const queryClient = useQueryClient();

  return useMutation<UATCategory, Error, { id: number; payload: UpdateUATCategoryPayload }>({
    mutationFn: ({ id, payload }) => uatScenariosService.updateCategory(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: uatKeys.categories() });
      queryClient.invalidateQueries({ queryKey: uatKeys.categoryDetail(variables.id) });
    },
  });
}

/**
 * Delete a category
 */
export function useDeleteUATCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: uatScenariosService.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.categories() });
    },
  });
}

/**
 * Reorder categories
 */
export function useReorderUATCategories() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, number[]>({
    mutationFn: uatScenariosService.reorderCategories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uatKeys.categories() });
    },
  });
}

// ========== ADMIN HOOKS ==========

/**
 * Get list of admin users (for assignee dropdown)
 */
export function useUATAdminUsers() {
  return useQuery<UATScenarioAssignee[], Error>({
    queryKey: uatKeys.admins(),
    queryFn: uatScenariosService.getAdminUsers,
    staleTime: 1000 * 60 * 10, // 10 minutes - admins don't change often
  });
}
