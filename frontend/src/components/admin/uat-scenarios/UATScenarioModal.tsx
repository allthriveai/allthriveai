/**
 * UATScenarioModal - Modal for creating/editing UAT scenarios
 */
import { useState, useEffect } from 'react';
import type {
  UATScenario,
  UATCategory,
  UATScenarioAssignee,
  CreateUATScenarioPayload,
  UpdateUATScenarioPayload,
} from '@/types/uatScenarios';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

interface UATScenarioModalProps {
  scenario: UATScenario | null;
  categories: UATCategory[];
  admins: UATScenarioAssignee[];
  onSave: (data: CreateUATScenarioPayload | UpdateUATScenarioPayload) => Promise<void>;
  onClose: () => void;
  onCreateCategory: (name: string) => Promise<UATCategory>;
  isLoading: boolean;
}

// Color options for categories
const colorOptions = ['blue', 'green', 'purple', 'red', 'orange', 'yellow', 'slate'];

export function UATScenarioModal({
  scenario,
  categories,
  admins: _admins,
  onSave,
  onClose,
  onCreateCategory,
  isLoading,
}: UATScenarioModalProps) {
  void _admins; // Not used since assignee is removed
  const isEditing = !!scenario;
  const [isClosing, setIsClosing] = useState(false);

  // Form state
  const [title, setTitle] = useState(scenario?.title || '');
  const [description, setDescription] = useState(scenario?.description || '');
  const [categoryId, setCategoryId] = useState<number | ''>(scenario?.category || '');

  // New category creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Validation
  const [errors, setErrors] = useState<{ title?: string }>({});

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }

    const data: CreateUATScenarioPayload | UpdateUATScenarioPayload = {
      title: title.trim(),
      description: description.trim(),
      category: categoryId || null,
    };

    await onSave(data);
  };

  // Handle new category creation
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    setIsCreatingCategory(true);
    try {
      const newCategory = await onCreateCategory(newCategoryName.trim());
      setCategoryId(newCategory.id);
      setShowNewCategory(false);
      setNewCategoryName('');
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setIsCreatingCategory(false);
    }
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
            {isEditing ? 'Edit Scenario' : 'New Scenario'}
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
                placeholder="Scenario title"
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
                Description (Expected Behavior)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the expected behavior and test steps..."
                rows={6}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : '')}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(true)}
                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                    title="Add new category"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 text-sm"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Color:</span>
                    <div className="flex gap-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategoryColor(color)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newCategoryColor === color ? 'ring-2 ring-offset-2 ring-cyan-500 scale-110' : ''
                          }`}
                          style={{
                            backgroundColor:
                              color === 'slate'
                                ? '#64748b'
                                : color === 'blue'
                                ? '#3b82f6'
                                : color === 'green'
                                ? '#22c55e'
                                : color === 'purple'
                                ? '#a855f7'
                                : color === 'red'
                                ? '#ef4444'
                                : color === 'orange'
                                ? '#f97316'
                                : '#eab308',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName('');
                      }}
                      className="flex-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim() || isCreatingCategory}
                      className="flex-1 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCreatingCategory ? 'Creating...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Test History Info for Editing */}
            {isEditing && scenario && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  <p className="mb-1">
                    <span className="font-medium">Test Runs:</span> {scenario.testRunCount}
                  </p>
                  {scenario.latestTestRun && (
                    <p>
                      <span className="font-medium">Latest Result:</span>{' '}
                      <span className={
                        scenario.latestTestRun.result === 'pass' ? 'text-green-600 dark:text-green-400' :
                        scenario.latestTestRun.result === 'fail' ? 'text-red-600 dark:text-red-400' :
                        'text-slate-500'
                      }>
                        {scenario.latestTestRun.resultDisplay}
                      </span>
                      {' on '}
                      {new Date(scenario.latestTestRun.dateTested).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
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
              'Create Scenario'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
