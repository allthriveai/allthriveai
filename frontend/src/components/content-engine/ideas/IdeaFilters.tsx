/**
 * Idea Filters Component
 * US-004: Ideas Tab with list view and quick capture
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import type { IdeaStatus } from '@/types/contentEngine';

interface IdeaFiltersProps {
  status: IdeaStatus | 'all';
  onStatusChange: (status: IdeaStatus | 'all') => void;
}

const STATUS_OPTIONS: { value: IdeaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'archived', label: 'Archived' },
];

export function IdeaFilters({ status, onStatusChange }: IdeaFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <FontAwesomeIcon icon={faFilter} className="text-slate-400 text-sm" />
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as IdeaStatus | 'all')}
        className="input-glass py-1.5 px-3 text-sm min-w-[120px]"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
