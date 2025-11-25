import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faFigma } from '@fortawesome/free-brands-svg-icons';
import { faRocket, faCommentDots, faBolt, faTable } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { createProject } from '@/services/projects';
import { ImportGitHubModal } from './ImportGitHubModal';

interface RightAddProjectChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RightAddProjectChat({ isOpen, onClose }: RightAddProjectChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImport = () => {
    setShowImportModal(true);
  };

  const handleDescribe = () => {
    // TODO: Switch to AI chat mode for describing project
    alert('Describe project with AI - coming soon!');
  };

  const handleBuild = () => {
    // TODO: Open nano banana workspace
    alert('Build something new with AI - coming soon!');
  };

  const handleManual = async () => {
    try {
      const newProject = await createProject({
        title: 'Untitled Project',
        description: '',
        type: 'other',
        isShowcase: true,
        content: { blocks: [] },
      });
      onClose();
      navigate(`/${user?.username}/${newProject.slug}/edit`);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }
  };

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

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI Agent Message with Buttons */}
          <div className="flex justify-start">
            <div className="max-w-md">
              {/* Text Message Bubble */}
              <div className="mb-3 px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <p className="text-sm mb-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faRocket} className="text-primary-500" />
                  Hi! Let's add a project to your portfolio.
                </p>
                <p className="text-sm">
                  How would you like to get started?
                </p>
              </div>

              {/* 4 Button Options */}
              <div className="space-y-2">
                {/* Import Existing Project */}
                <button
                  onClick={handleImport}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faGithub} className="text-slate-700 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Import Existing Project
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        From GitHub, GitLab, etc.
                      </div>
                    </div>
                  </div>
                </button>

                {/* Describe Your Project */}
                <button
                  onClick={handleDescribe}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faCommentDots} className="text-slate-700 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Describe Your Project
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        AI creates your page
                      </div>
                    </div>
                  </div>
                </button>

                {/* Build Something New */}
                <button
                  onClick={handleBuild}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faBolt} className="text-slate-700 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Build Something New
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Create with AI assistance
                      </div>
                    </div>
                  </div>
                </button>

                {/* Create Project Page */}
                <button
                  onClick={handleManual}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <FontAwesomeIcon icon={faTable} className="text-slate-700 dark:text-slate-300" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Create Project Page
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Manually design your page
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* GitHub Import Modal */}
      <ImportGitHubModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </>
  );
}
