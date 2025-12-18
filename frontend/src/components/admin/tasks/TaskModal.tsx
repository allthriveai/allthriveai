import { useState, useEffect } from 'react';
import type { Task, TaskOption, TaskAdminUser } from '@/types/tasks';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { TaskOptionSelect } from './TaskOptionSelect';

interface TaskModalProps {
  task: Task | null;
  statuses: TaskOption[];
  types: TaskOption[];
  priorities: TaskOption[];
  admins: TaskAdminUser[];
  onSave: (data: Partial<Task>) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

export function TaskModal({
  task,
  statuses,
  types,
  priorities,
  admins,
  onSave,
  onClose,
  isLoading,
}: TaskModalProps) {
  const isEditing = !!task;
  const [isClosing, setIsClosing] = useState(false);

  // Form state
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [statusId, setStatusId] = useState<number | ''>(
    task?.status || statuses.find((s) => s.isDefault)?.id || ''
  );
  const [typeId, setTypeId] = useState<number | ''>(
    task?.taskType || types.find((t) => t.isDefault)?.id || ''
  );
  const [priorityId, setPriorityId] = useState<number | ''>(
    task?.priority || priorities.find((p) => p.isDefault)?.id || ''
  );
  const [assigneeId, setAssigneeId] = useState<number | ''>(task?.assignee || '');
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.split('T')[0] : ''
  );

  // Validation
  const [errors, setErrors] = useState<{ title?: string }>({});

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }

    await onSave({
      title: title.trim(),
      description: description.trim(),
      status: statusId || undefined,
      taskType: typeId || undefined,
      priority: priorityId || undefined,
      assignee: assigneeId || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Sidebar Tray */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ease-out ${
          isClosing ? 'translate-x-full' : 'translate-x-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? 'Edit Task' : 'New Task'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({});
                }}
                placeholder="Task title"
                className={`w-full px-3 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-colors ${
                  errors.title
                    ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/30'
                    : 'border-slate-200 dark:border-slate-700 focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-cyan-500/30'
                }`}
                autoFocus
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={4}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30 resize-none"
              />
            </div>

            {/* Status */}
            <TaskOptionSelect
              label="Status"
              value={statusId}
              onChange={setStatusId}
              options={statuses}
              optionType="status"
              required
            />

            {/* Type */}
            <TaskOptionSelect
              label="Type"
              value={typeId}
              onChange={setTypeId}
              options={types}
              optionType="type"
              placeholder="None"
              allowNone
            />

            {/* Priority */}
            <TaskOptionSelect
              label="Priority"
              value={priorityId}
              onChange={setPriorityId}
              options={priorities}
              optionType="priority"
              placeholder="None"
              allowNone
            />

            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
              >
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.firstName
                      ? `${admin.firstName} ${admin.lastName || ''}`
                      : admin.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions - Fixed at bottom */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create Task'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
