import { XMarkIcon } from '@heroicons/react/24/outline';
import { AddProjectOptions } from './AddProjectOptions';

interface RightAddProjectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
  onDescribe: () => void;
  onBuild: () => void;
  onManual: () => void;
}

export function RightAddProjectPanel({
  isOpen,
  onClose,
  onImport,
  onDescribe,
  onBuild,
  onManual,
}: RightAddProjectPanelProps) {
  return (
    <>
      {/* Sliding Panel */}
      <div
        className={`fixed right-0 top-0 w-full md:w-[480px] h-screen bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-lg transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Project
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AddProjectOptions
            onImport={onImport}
            onDescribe={onDescribe}
            onBuild={onBuild}
            onManual={onManual}
          />
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
