/**
 * EditorTopBar - Header bar for the section editor
 *
 * Displays:
 * - Back navigation to project view
 * - Project title
 * - Save status indicator (saving, saved, unsaved changes)
 * - Preview button
 * - Settings button (opens sidebar)
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  EyeIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { useSectionEditorContext } from '@/contexts/SectionEditorContext';

export function EditorTopBar() {
  const {
    project,
    title,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    sidebarOpen,
    setSidebarOpen,
  } = useSectionEditorContext();

  // Format last saved time
  const formatLastSaved = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section: Back + Title */}
      <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
        {/* Back Button */}
        <Link
          to={`/${project.username}/${project.slug}`}
          className="flex-shrink-0 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Back to project"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>

        {/* Title + Save Status */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
            {title || 'Untitled Project'}
          </h1>
          <SaveStatusIndicator
            isSaving={isSaving}
            lastSaved={lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
            formatLastSaved={formatLastSaved}
          />
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Preview Button */}
        <Link
          to={`/${project.username}/${project.slug}`}
          target="_blank"
          className="hidden sm:flex items-center gap-2 px-3 md:px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <EyeIcon className="w-5 h-5" />
          <span className="hidden md:inline text-sm font-medium">Preview</span>
        </Link>

        {/* Mobile Preview Button */}
        <Link
          to={`/${project.username}/${project.slug}`}
          target="_blank"
          className="sm:hidden p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Preview"
        >
          <EyeIcon className="w-5 h-5" />
        </Link>

        {/* Settings Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`p-2 rounded-lg transition-colors ${
            sidebarOpen
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Project settings"
        >
          <Cog6ToothIcon className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Save Status Indicator
// ============================================================================

interface SaveStatusIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  formatLastSaved: (date: Date) => string;
}

function SaveStatusIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  formatLastSaved,
}: SaveStatusIndicatorProps) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <ExclamationCircleIcon className="w-3.5 h-3.5" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircleIcon className="w-3.5 h-3.5" />
        <span>Saved {formatLastSaved(lastSaved)}</span>
      </div>
    );
  }

  return null;
}
