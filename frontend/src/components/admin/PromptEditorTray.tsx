import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface PromptChallengePrompt {
  id: number;
  promptText: string;
  category: { id: number; name: string; slug: string } | null;
  difficulty: 'easy' | 'medium' | 'hard';
  isActive: boolean;
  weight: number;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

interface PromptEditorTrayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    promptText: string;
    categoryId: number | null;
    difficulty: string;
    weight: number;
    isActive: boolean;
  }) => Promise<void>;
  editingPrompt: PromptChallengePrompt | null;
  categories: Category[];
  isLoading: boolean;
  error: string | null;
}

export function PromptEditorTray({
  isOpen,
  onClose,
  onSubmit,
  editingPrompt,
  categories,
  isLoading,
  error,
}: PromptEditorTrayProps) {
  // Track if tray should be rendered (for slide-out animation)
  const [shouldRender, setShouldRender] = useState(false);
  // Track the visual open state (delayed to allow animation)
  const [visuallyOpen, setVisuallyOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    promptText: '',
    categoryId: '',
    difficulty: 'medium',
    weight: '1.0',
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Handle transition end to unmount after closing
  const handleTransitionEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Handle open/close with proper animation timing
  useEffect(() => {
    if (isOpen) {
      // First render the component (in closed position)
      setShouldRender(true);
      // Then after a frame, trigger the open animation
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisuallyOpen(true);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      // Immediately start close animation
      setVisuallyOpen(false);
    }
  }, [isOpen]);

  // Reset form when opening with new data
  useEffect(() => {
    if (isOpen) {
      if (editingPrompt) {
        setFormData({
          promptText: editingPrompt.promptText,
          categoryId: editingPrompt.category?.id.toString() || '',
          difficulty: editingPrompt.difficulty,
          weight: editingPrompt.weight.toString(),
          isActive: editingPrompt.isActive,
        });
      } else {
        // Default to "Images & Video" category (ID: 9)
        const defaultCategory = categories.find(c => c.slug === 'images-video');
        setFormData({
          promptText: '',
          categoryId: defaultCategory?.id.toString() || '9',
          difficulty: 'medium',
          weight: '1.0',
          isActive: true,
        });
      }
      setFormError(null);
    }
  }, [isOpen, editingPrompt, categories]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.promptText.trim().length < 10) {
      setFormError('Prompt text must be at least 10 characters');
      return;
    }

    if (!formData.categoryId) {
      setFormError('Category is required');
      return;
    }

    setFormError(null);

    try {
      await onSubmit({
        promptText: formData.promptText.trim(),
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        difficulty: formData.difficulty,
        weight: parseFloat(formData.weight),
        isActive: formData.isActive,
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to save prompt');
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ease-in-out ${
          visuallyOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Sidebar Drawer */}
      <aside
        className={`fixed right-0 top-0 h-full w-full md:w-[32rem] lg:w-[36rem] border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out bg-white dark:bg-slate-900 ${
          visuallyOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-cyan-500/20 rounded-lg">
                <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingPrompt ? `ID: ${editingPrompt.id} • Used ${editingPrompt.timesUsed} times` : 'Create a new battle prompt'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Error display */}
            {(formError || error) && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{formError || error}</p>
              </div>
            )}

            {/* Prompt Text */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Prompt Text <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.promptText}
                onChange={(e) => setFormData(prev => ({ ...prev, promptText: e.target.value }))}
                rows={6}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-cyan-500/20 transition-colors"
                placeholder="Enter the prompt text that will be shown to battle participants..."
                required
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {formData.promptText.length} characters (minimum 10)
              </p>
            </div>

            {/* Category & Difficulty Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-cyan-500/20 transition-colors"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-cyan-500/20 transition-colors"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Weight & Status Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Selection Weight
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-cyan-500/20 transition-colors"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Higher weight = more likely to be selected (0.1 - 10.0)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Status
                </label>
                <div className="mt-1">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-500 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                    />
                    <div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">Active</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formData.isActive ? 'Available for battles' : 'Hidden from selection'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Stats (only when editing) */}
            {editingPrompt && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Prompt Stats</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary-600 dark:text-cyan-400">{editingPrompt.timesUsed}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Times Used</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{editingPrompt.weight.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Current Weight</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {new Date(editingPrompt.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Updated</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions - Fixed at bottom */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-primary-600 dark:bg-cyan-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingPrompt ? 'Update Prompt' : 'Create Prompt'
                )}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </>,
    document.body
  );
}
