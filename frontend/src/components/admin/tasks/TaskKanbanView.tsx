import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, KanbanColumn } from '@/types/tasks';
import { PlusIcon, CalendarIcon, UserCircleIcon } from '@heroicons/react/24/outline';

interface TaskKanbanViewProps {
  columns: KanbanColumn[];
  onTaskClick: (task: Task) => void;
  onReorder: (taskId: number, newStatusId: number | undefined, newOrder: number) => void;
  onQuickCreate: (statusId: number) => void;
}

// Color mapping for Tailwind colors
const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  slate: { bg: 'bg-slate-100 dark:bg-slate-500/20', border: 'border-slate-300 dark:border-slate-500/30', text: 'text-slate-700 dark:text-slate-300' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-300 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-300' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', border: 'border-yellow-300 dark:border-yellow-500/30', text: 'text-yellow-700 dark:text-yellow-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-purple-300 dark:border-purple-500/30', text: 'text-purple-700 dark:text-purple-300' },
  green: { bg: 'bg-green-100 dark:bg-green-500/20', border: 'border-green-300 dark:border-green-500/30', text: 'text-green-700 dark:text-green-300' },
  red: { bg: 'bg-red-100 dark:bg-red-500/20', border: 'border-red-300 dark:border-red-500/30', text: 'text-red-700 dark:text-red-300' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', border: 'border-orange-300 dark:border-orange-500/30', text: 'text-orange-700 dark:text-orange-300' },
};

function getColorClasses(color: string) {
  return colorMap[color] || colorMap.slate;
}

// Task Card component
interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const priorityColor = task.priorityDetail ? getColorClasses(task.priorityDetail.color) : null;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completedAt;

  return (
    <div
      onClick={onClick}
      className={`p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Type Badge */}
      {task.taskTypeDetail && (
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-2 ${
            getColorClasses(task.taskTypeDetail.color).bg
          } ${getColorClasses(task.taskTypeDetail.color).text}`}
        >
          {task.taskTypeDetail.name}
        </span>
      )}

      {/* Title */}
      <h4 className="font-medium text-slate-900 dark:text-white mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          {/* Priority */}
          {priorityColor && (
            <span
              className={`px-1.5 py-0.5 rounded ${priorityColor.bg} ${priorityColor.text}`}
            >
              {task.priorityDetail?.name}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${
                isOverdue ? 'text-red-600 dark:text-red-400' : ''
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        {task.assigneeDetail ? (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
            {task.assigneeDetail.avatar ? (
              <img
                src={task.assigneeDetail.avatar}
                alt={task.assigneeDetail.firstName || task.assigneeDetail.email}
                className="w-full h-full object-cover"
              />
            ) : (
              (task.assigneeDetail.firstName?.[0] || task.assigneeDetail.email[0]).toUpperCase()
            )}
          </div>
        ) : (
          <UserCircleIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
        )}
      </div>
    </div>
  );
}

// Sortable Task Card wrapper
function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

// Column component
interface KanbanColumnProps {
  column: KanbanColumn;
  onTaskClick: (task: Task) => void;
  onQuickCreate: () => void;
}

function KanbanColumnComponent({ column, onTaskClick, onQuickCreate }: KanbanColumnProps) {
  const colors = getColorClasses(column.status.color);

  return (
    <div className="flex-shrink-0 w-72 md:w-80 flex flex-col max-h-full">
      {/* Column Header */}
      <div
        className={`px-3 py-2.5 rounded-t-lg border-b-2 ${colors.bg} ${colors.border}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${colors.text}`}>
              {column.status.name}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}
            >
              {column.tasks.length}
            </span>
          </div>
          <button
            onClick={onQuickCreate}
            className={`p-1 rounded hover:bg-white/50 dark:hover:bg-black/20 ${colors.text}`}
            title="Add task"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50 dark:bg-slate-900/50 rounded-b-lg border border-t-0 border-slate-200 dark:border-slate-700 min-h-[200px]">
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskKanbanView({
  columns,
  onTaskClick,
  onReorder,
  onQuickCreate,
}: TaskKanbanViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumnByTaskId = useCallback(
    (taskId: number) => {
      return columns.find((col) => col.tasks.some((t) => t.id === taskId));
    },
    [columns]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const taskId = active.id as number;
      const column = findColumnByTaskId(taskId);
      const task = column?.tasks.find((t) => t.id === taskId);
      if (task) {
        setActiveTask(task);
      }
    },
    [findColumnByTaskId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as number;
      const overId = over.id;

      // Find source and destination columns
      const sourceColumn = findColumnByTaskId(activeId);
      if (!sourceColumn) return;

      // Check if dropping over a column header (status id is the column id)
      const isOverColumn = columns.some((col) => col.status.id === overId);

      let destinationColumn: KanbanColumn | undefined;
      let newOrder: number;

      if (isOverColumn) {
        // Dropped on column header - add to end of column
        destinationColumn = columns.find((col) => col.status.id === overId);
        newOrder = destinationColumn?.tasks.length || 0;
      } else {
        // Dropped on another task
        destinationColumn = findColumnByTaskId(overId as number);
        if (!destinationColumn) return;

        const overIndex = destinationColumn.tasks.findIndex(
          (t) => t.id === overId
        );
        newOrder = overIndex >= 0 ? overIndex : destinationColumn.tasks.length;
      }

      if (!destinationColumn) return;

      // If same column and same position, no change needed
      if (
        sourceColumn.status.id === destinationColumn.status.id &&
        sourceColumn.tasks.findIndex((t) => t.id === activeId) === newOrder
      ) {
        return;
      }

      // Trigger reorder
      onReorder(
        activeId,
        sourceColumn.status.id !== destinationColumn.status.id
          ? destinationColumn.status.id
          : undefined,
        newOrder
      );
    },
    [columns, findColumnByTaskId, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-0 md:px-0">
        {columns.map((column) => (
          <KanbanColumnComponent
            key={column.status.id}
            column={column}
            onTaskClick={onTaskClick}
            onQuickCreate={() => onQuickCreate(column.status.id)}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-3 scale-105">
            <TaskCard task={activeTask} onClick={() => {}} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
