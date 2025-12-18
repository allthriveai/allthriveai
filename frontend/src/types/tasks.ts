/**
 * TypeScript types for the Admin Task Tracker feature.
 */

// Option types for tasks
export type TaskOptionType = 'status' | 'type' | 'priority';

// Task option (status, type, priority)
export interface TaskOption {
  id: number;
  optionType: TaskOptionType;
  name: string;
  slug: string;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
  isDefault: boolean;
  isClosedStatus: boolean;
}

// Minimal admin user for assignee
export interface TaskAdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

// Task model
export interface Task {
  id: number;
  title: string;
  description: string;
  // FK IDs
  status: number;
  taskType: number | null;
  priority: number | null;
  assignee: number | null;
  // Nested details
  statusDetail: TaskOption;
  taskTypeDetail: TaskOption | null;
  priorityDetail: TaskOption | null;
  assigneeDetail: TaskAdminUser | null;
  createdByDetail: TaskAdminUser | null;
  updatedByDetail: TaskAdminUser | null;
  // Other fields
  orderInStatus: number;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

// Task dashboard (saved view)
export interface TaskDashboard {
  id: number;
  name: string;
  slug: string;
  viewMode: 'kanban' | 'table';
  filters: TaskFilters;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  isDefault: boolean;
  order: number;
  icon: string;
  createdBy: number | null;
  createdByDetail: TaskAdminUser | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

// Task filters (used in dashboards and queries)
export interface TaskFilters {
  statusIds?: number[];
  typeIds?: number[];
  priorityIds?: number[];
  assigneeIds?: number[] | 'unassigned';
  search?: string;
  due?: 'overdue' | 'today' | 'week' | null;
  archived?: boolean;
}

// Task statistics
export interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  dueSoon: number;
  unassigned: number;
}

// Create task payload
export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: number;
  taskType?: number;
  priority?: number;
  assignee?: number | null;
  dueDate?: string | null;
}

// Update task payload
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: number;
  taskType?: number | null;
  priority?: number | null;
  assignee?: number | null;
  dueDate?: string | null;
  isArchived?: boolean;
}

// Bulk update payload
export interface BulkUpdateTasksPayload {
  taskIds: number[];
  status?: number;
  assignee?: number | null;
  priority?: number;
  isArchived?: boolean;
}

// Reorder payload
export interface ReorderTaskPayload {
  taskId: number;
  newStatusId?: number;
  newOrder: number;
}

// Create/update option payload
export interface TaskOptionPayload {
  optionType: TaskOptionType;
  name: string;
  slug?: string;
  color?: string;
  icon?: string;
  order?: number;
  isActive?: boolean;
  isDefault?: boolean;
  isClosedStatus?: boolean;
}

// Create/update dashboard payload
export interface TaskDashboardPayload {
  name: string;
  viewMode?: 'kanban' | 'table';
  filters?: TaskFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  isDefault?: boolean;
  order?: number;
  icon?: string;
  isShared?: boolean;
}

// Query params for task list
export interface TaskQueryParams {
  status?: string; // comma-separated IDs
  taskType?: string; // comma-separated IDs
  priority?: string; // comma-separated IDs
  assignee?: string; // comma-separated IDs or 'unassigned'
  due?: 'overdue' | 'today' | 'week';
  search?: string;
  archived?: string; // 'true' or 'false'
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// Kanban column (for UI)
export interface KanbanColumn {
  status: TaskOption;
  tasks: Task[];
}

// Task comment
export interface TaskComment {
  id: number;
  task: number;
  author: number | null;
  authorDetail: TaskAdminUser | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

// Create comment payload
export interface CreateTaskCommentPayload {
  task: number;
  content: string;
}

// Update comment payload
export interface UpdateTaskCommentPayload {
  content: string;
}
