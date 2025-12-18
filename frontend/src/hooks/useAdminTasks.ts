/**
 * React Query hooks for Admin Task Tracker
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminTasksService } from '@/services/adminTasks';
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

// Query keys
export const taskKeys = {
  all: ['adminTasks'] as const,
  // Tasks
  tasks: () => [...taskKeys.all, 'tasks'] as const,
  taskList: (params: TaskQueryParams) => [...taskKeys.tasks(), params] as const,
  taskDetail: (id: number) => [...taskKeys.tasks(), 'detail', id] as const,
  taskStats: () => [...taskKeys.tasks(), 'stats'] as const,
  // Options
  options: () => [...taskKeys.all, 'options'] as const,
  optionsByType: (type: TaskOptionType) => [...taskKeys.options(), type] as const,
  // Dashboards
  dashboards: () => [...taskKeys.all, 'dashboards'] as const,
  dashboardDetail: (id: number) => [...taskKeys.dashboards(), 'detail', id] as const,
  // Admins
  admins: () => [...taskKeys.all, 'admins'] as const,
};

// ========== TASK HOOKS ==========

/**
 * Get tasks with filters
 */
export function useTasks(params: TaskQueryParams = {}) {
  return useQuery<Task[], Error>({
    queryKey: taskKeys.taskList(params),
    queryFn: () => adminTasksService.getTasks(params),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Get a single task
 */
export function useTask(id: number, enabled: boolean = true) {
  return useQuery<Task, Error>({
    queryKey: taskKeys.taskDetail(id),
    queryFn: () => adminTasksService.getTask(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 30,
  });
}

/**
 * Get task statistics
 */
export function useTaskStats() {
  return useQuery<TaskStats, Error>({
    queryKey: taskKeys.taskStats(),
    queryFn: () => adminTasksService.getStats(),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskPayload>({
    mutationFn: adminTasksService.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskStats() });
    },
  });
}

/**
 * Update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: number; payload: UpdateTaskPayload }>({
    mutationFn: ({ id, payload }) => adminTasksService.updateTask(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskStats() });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: adminTasksService.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskStats() });
    },
  });
}

/**
 * Bulk update tasks
 */
export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string; count: number }, Error, BulkUpdateTasksPayload>({
    mutationFn: adminTasksService.bulkUpdateTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskStats() });
    },
  });
}

/**
 * Reorder a task
 */
export function useReorderTask() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, ReorderTaskPayload>({
    mutationFn: adminTasksService.reorderTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.tasks() });
    },
  });
}

// ========== OPTION HOOKS ==========

/**
 * Get all options of a specific type
 */
export function useTaskOptions(optionType?: TaskOptionType) {
  return useQuery<TaskOption[], Error>({
    queryKey: optionType ? taskKeys.optionsByType(optionType) : taskKeys.options(),
    queryFn: () => adminTasksService.getOptions(optionType),
    staleTime: 1000 * 60 * 5, // 5 minutes - options don't change often
  });
}

/**
 * Convenience hooks for specific option types
 */
export function useTaskStatuses() {
  return useTaskOptions('status');
}

export function useTaskTypes() {
  return useTaskOptions('type');
}

export function useTaskPriorities() {
  return useTaskOptions('priority');
}

/**
 * Create a new option
 */
export function useCreateTaskOption() {
  const queryClient = useQueryClient();

  return useMutation<TaskOption, Error, TaskOptionPayload>({
    mutationFn: adminTasksService.createOption,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.options() });
      queryClient.invalidateQueries({ queryKey: taskKeys.optionsByType(variables.optionType) });
    },
  });
}

/**
 * Update an option
 */
export function useUpdateTaskOption() {
  const queryClient = useQueryClient();

  return useMutation<TaskOption, Error, { id: number; payload: Partial<TaskOptionPayload> }>({
    mutationFn: ({ id, payload }) => adminTasksService.updateOption(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.options() });
    },
  });
}

/**
 * Delete an option
 */
export function useDeleteTaskOption() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: adminTasksService.deleteOption,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.options() });
    },
  });
}

/**
 * Reorder options
 */
export function useReorderTaskOptions() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, { optionType: TaskOptionType; order: number[] }>({
    mutationFn: ({ optionType, order }) => adminTasksService.reorderOptions(optionType, order),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.options() });
      queryClient.invalidateQueries({ queryKey: taskKeys.optionsByType(variables.optionType) });
    },
  });
}

// ========== DASHBOARD HOOKS ==========

/**
 * Get all dashboards
 */
export function useTaskDashboards() {
  return useQuery<TaskDashboard[], Error>({
    queryKey: taskKeys.dashboards(),
    queryFn: adminTasksService.getDashboards,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single dashboard
 */
export function useTaskDashboard(id: number, enabled: boolean = true) {
  return useQuery<TaskDashboard, Error>({
    queryKey: taskKeys.dashboardDetail(id),
    queryFn: () => adminTasksService.getDashboard(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new dashboard
 */
export function useCreateTaskDashboard() {
  const queryClient = useQueryClient();

  return useMutation<TaskDashboard, Error, TaskDashboardPayload>({
    mutationFn: adminTasksService.createDashboard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dashboards() });
    },
  });
}

/**
 * Update a dashboard
 */
export function useUpdateTaskDashboard() {
  const queryClient = useQueryClient();

  return useMutation<TaskDashboard, Error, { id: number; payload: Partial<TaskDashboardPayload> }>({
    mutationFn: ({ id, payload }) => adminTasksService.updateDashboard(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dashboards() });
      queryClient.invalidateQueries({ queryKey: taskKeys.dashboardDetail(variables.id) });
    },
  });
}

/**
 * Delete a dashboard
 */
export function useDeleteTaskDashboard() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: adminTasksService.deleteDashboard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dashboards() });
    },
  });
}

/**
 * Reorder dashboards
 */
export function useReorderTaskDashboards() {
  const queryClient = useQueryClient();

  return useMutation<{ status: string }, Error, number[]>({
    mutationFn: adminTasksService.reorderDashboards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dashboards() });
    },
  });
}

// ========== ADMIN HOOKS ==========

/**
 * Get list of admin users (for assignee dropdown)
 */
export function useAdminUsers() {
  return useQuery<TaskAdminUser[], Error>({
    queryKey: taskKeys.admins(),
    queryFn: adminTasksService.getAdminUsers,
    staleTime: 1000 * 60 * 10, // 10 minutes - admins don't change often
  });
}
