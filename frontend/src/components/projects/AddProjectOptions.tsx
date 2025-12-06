import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { LinkIcon } from '@heroicons/react/24/outline';

interface AddProjectOptionsProps {
  onImport: () => void;
  onDescribe: () => void;
  onBuild: () => void;
  onManual: () => void;
  onImportFromUrl?: () => void;
}

export function AddProjectOptions({ onImport, onDescribe, onBuild, onManual, onImportFromUrl }: AddProjectOptionsProps) {
  return (
    <div className="p-6 space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Add a Project
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Choose how you'd like to add a project to your portfolio
        </p>
      </div>

      <div className="space-y-3">
        {/* Import from URL - NEW */}
        {onImportFromUrl && (
          <button
            onClick={onImportFromUrl}
            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/20 transition-colors">
                <LinkIcon className="w-6 h-6 text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Import from URL
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Paste any webpage URL and AI will extract project details
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Import Existing Project */}
        <button
          onClick={onImport}
          className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/20 transition-colors">
              <FontAwesomeIcon icon={faGithub} className="text-2xl text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Import Existing Project
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sync from GitHub, GitLab, or other platforms
              </p>
            </div>
          </div>
        </button>

        {/* Describe Your Project */}
        <button
          onClick={onDescribe}
          className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/20 transition-colors text-2xl">
              💬
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Describe Your Project
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                All Thrive will create your project portfolio page from your description
              </p>
            </div>
          </div>
        </button>

        {/* Build Something New */}
        <button
          onClick={onBuild}
          className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/20 transition-colors text-2xl">
              🍌
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Build Something New
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create with AI assistance
              </p>
            </div>
          </div>
        </button>

        {/* Create Project Page */}
        <button
          onClick={onManual}
          className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/20 transition-colors text-2xl">
              📝
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Create Project Page
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manually design your project page
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
