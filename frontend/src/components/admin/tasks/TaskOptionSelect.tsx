import { useState, useRef, useEffect } from 'react';
import { PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { TaskOption, TaskOptionType } from '@/types/tasks';
import { useCreateTaskOption } from '@/hooks/useAdminTasks';

// Available colors for new options
const COLORS = [
  { name: 'slate', label: 'Gray' },
  { name: 'blue', label: 'Blue' },
  { name: 'green', label: 'Green' },
  { name: 'yellow', label: 'Yellow' },
  { name: 'orange', label: 'Orange' },
  { name: 'red', label: 'Red' },
  { name: 'purple', label: 'Purple' },
];

interface TaskOptionSelectProps {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  options: TaskOption[];
  optionType: TaskOptionType;
  placeholder?: string;
  allowNone?: boolean;
  required?: boolean;
}

export function TaskOptionSelect({
  label,
  value,
  onChange,
  options,
  optionType,
  placeholder = 'Select...',
  allowNone = false,
  required = false,
}: TaskOptionSelectProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const inputRef = useRef<HTMLInputElement>(null);
  const createOption = useCreateTaskOption();

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAdd = async () => {
    if (!newName.trim()) return;

    try {
      const created = await createOption.mutateAsync({
        optionType,
        name: newName.trim(),
        color: newColor,
      });
      // Select the newly created option
      onChange(created.id);
      setIsAdding(false);
      setNewName('');
      setNewColor('blue');
    } catch (error) {
      console.error('Failed to create option:', error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor('blue');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {isAdding ? (
        // Add new option form
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`New ${label.toLowerCase()} name`}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-cyan-500 dark:border-cyan-500/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim() || createOption.isPending}
              className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createOption.isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Color:</span>
            {COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setNewColor(color.name)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  newColor === color.name
                    ? 'border-slate-900 dark:border-white scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{
                  backgroundColor: getColorValue(color.name),
                }}
                title={color.label}
              />
            ))}
          </div>
        </div>
      ) : (
        // Select dropdown with add button
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : '')}
            className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
          >
            {allowNone && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="p-2.5 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            title={`Add new ${label.toLowerCase()}`}
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Helper to get actual color value for the color picker preview
function getColorValue(colorName: string): string {
  const colors: Record<string, string> = {
    slate: '#64748b',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
    purple: '#a855f7',
  };
  return colors[colorName] || colors.slate;
}
