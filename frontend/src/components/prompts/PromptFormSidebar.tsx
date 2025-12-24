/**
 * Prompt Form Sidebar Component
 *
 * A right sidebar form for creating and editing AI prompts.
 * Allows users to enter prompt text, title, description, select tools,
 * add topics, and configure visibility settings.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { ToolSelector } from '@/components/projects/ToolSelector';
import { useTheme } from '@/hooks/useTheme';
import { createProject, updateProject } from '@/services/projects';
import type { Project, ProjectPayload, Tool } from '@/types/models';

interface PromptFormSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (prompt: Project) => void;
  editPrompt?: Project | null;
}

export function PromptFormSidebar({
  isOpen,
  onClose,
  onSave,
  editPrompt,
}: PromptFormSidebarProps) {
  const { theme } = useTheme();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [description, setDescription] = useState('');
  const [toolIds, setToolIds] = useState<number[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // UI state
  const [shouldRender, setShouldRender] = useState(false);
  const [visuallyOpen, setVisuallyOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if this is edit mode
  const isEditMode = !!editPrompt;

  // Initialize form when editing
  useEffect(() => {
    if (editPrompt) {
      setTitle(editPrompt.title || '');
      // Use heroQuote if available, fallback to prompt.text or description
      const promptContent = editPrompt.content as { prompt?: { text?: string }; heroQuote?: string };
      setPromptText(promptContent?.heroQuote || promptContent?.prompt?.text || editPrompt.description || '');
      setDescription(editPrompt.description || '');
      setToolIds(editPrompt.tools || []);
      setTopics(editPrompt.topics || []);
      setIsPrivate(editPrompt.isPrivate || false);
    } else {
      // Reset form for new prompt
      setTitle('');
      setPromptText('');
      setDescription('');
      setToolIds([]);
      setTopics([]);
      setIsPrivate(false);
    }
    setError(null);
  }, [editPrompt, isOpen]);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleAddTopic = () => {
    const trimmed = topicInput.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !topics.includes(trimmed)) {
      setTopics([...topics, trimmed]);
    }
    setTopicInput('');
  };

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter((t) => t !== topic));
  };

  const handleTopicKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTopic();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !promptText.trim()) {
      setError('Title and prompt text are required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: ProjectPayload = {
        title: title.trim(),
        description: description.trim() || promptText.slice(0, 200),
        type: 'prompt',
        isPrivate,
        isShowcased: false,
        tools: toolIds,
        topics,
        content: {
          prompt: {
            text: promptText.trim(),
          },
          // Set hero display to show the prompt
          heroDisplayMode: 'quote',
          heroQuote: promptText.trim(),
        },
      };

      let savedPrompt: Project;

      if (isEditMode && editPrompt) {
        savedPrompt = await updateProject(editPrompt.id, payload);
      } else {
        savedPrompt = await createProject(payload);
      }

      onSave?.(savedPrompt);
      onClose();
    } catch (err) {
      console.error('Failed to save prompt:', err);
      setError('Failed to save prompt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${
          visuallyOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-full max-w-lg border-l border-gray-200 dark:border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${
          visuallyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          backgroundColor: theme === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                <FontAwesomeIcon icon={faLightbulb} className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {isEditMode ? 'Edit Prompt' : 'Add New Prompt'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Share a prompt you use with AI tools
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Blog Post Outline Generator"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                required
              />
            </div>

            {/* Prompt Text */}
            <div>
              <label
                htmlFor="promptText"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Prompt Text <span className="text-red-500">*</span>
              </label>
              <textarea
                id="promptText"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Enter your prompt here. Use [placeholders] for variable content..."
                rows={8}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm resize-y"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tip: Use [brackets] for variables like [topic] or [tone]
              </p>
            </div>

            {/* Description (optional) */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this prompt does and when to use it..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
              />
            </div>

            {/* AI Tools */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Works with <span className="text-gray-400">(optional)</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Select the AI tools this prompt works best with
              </p>
              <ToolSelector
                selectedToolIds={toolIds}
                onChange={setToolIds}
                initialSelectedTools={editPrompt?.toolsDetails as Tool[]}
              />
            </div>

            {/* Topics */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topics <span className="text-gray-400">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400"
                  >
                    #{topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(topic)}
                      className="hover:text-cyan-900 dark:hover:text-cyan-200"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={handleTopicKeyDown}
                  placeholder="Add a topic..."
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Visibility
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    !isPrivate
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <GlobeAltIcon
                    className={`w-5 h-5 ${
                      !isPrivate ? 'text-cyan-500' : 'text-gray-400'
                    }`}
                  />
                  <div className="text-left">
                    <p
                      className={`font-medium ${
                        !isPrivate
                          ? 'text-cyan-700 dark:text-cyan-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Public
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Visible in explore feed and your profile
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isPrivate
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <LockClosedIcon
                    className={`w-5 h-5 ${
                      isPrivate ? 'text-cyan-500' : 'text-gray-400'
                    }`}
                  />
                  <div className="text-left">
                    <p
                      className={`font-medium ${
                        isPrivate
                          ? 'text-cyan-700 dark:text-cyan-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Private
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Only visible to you in your prompt library
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving || !title.trim() || !promptText.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-600 text-white font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                'Save Changes'
              ) : (
                'Create Prompt'
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
