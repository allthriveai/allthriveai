/**
 * UATTestRunModal - Modal for adding/editing test runs
 */
import { useState, useEffect } from 'react';
import type { UATScenario, UATScenarioAssignee, UATTestRun } from '@/types/uatScenarios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon } from '@heroicons/react/24/solid';

interface UATTestRunModalProps {
  scenario: UATScenario;
  testRun?: UATTestRun | null; // If editing
  admins: UATScenarioAssignee[];
  onSave: (data: {
    scenario: number;
    dateTested: string;
    result: 'pass' | 'fail' | 'na';
    notes?: string;
  }) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

export function UATTestRunModal({
  scenario,
  testRun,
  admins: _admins,
  onSave,
  onClose,
  isLoading,
}: UATTestRunModalProps) {
  void _admins; // May be used later for tester selection
  const isEditing = !!testRun;
  const [isClosing, setIsClosing] = useState(false);

  // Form state - default to today's date
  const [dateTested, setDateTested] = useState(
    testRun?.dateTested || new Date().toISOString().split('T')[0]
  );
  const [result, setResult] = useState<'pass' | 'fail' | 'na'>(testRun?.result || 'pass');
  const [notes, setNotes] = useState(testRun?.notes || '');

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

    await onSave({
      scenario: scenario.id,
      dateTested,
      result,
      notes: notes.trim() || undefined,
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

      {/* Modal */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-50 rounded-xl transform transition-all duration-200 ease-out ${
          isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Test Run' : 'Add Test Run'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[300px]">
              {scenario.title}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Result */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Result <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResult('pass')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  result === 'pass'
                    ? 'bg-green-50 dark:bg-green-500/10 border-green-500 text-green-700 dark:text-green-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-green-300 dark:hover:border-green-500/50'
                }`}
              >
                <CheckCircleIcon className="w-5 h-5" />
                Pass
              </button>
              <button
                type="button"
                onClick={() => setResult('fail')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  result === 'fail'
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-500 text-red-700 dark:text-red-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-500/50'
                }`}
              >
                <XCircleIcon className="w-5 h-5" />
                Fail
              </button>
              <button
                type="button"
                onClick={() => setResult('na')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  result === 'na'
                    ? 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-700 dark:text-slate-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                <MinusCircleIcon className="w-5 h-5" />
                N/A
              </button>
            </div>
          </div>

          {/* Date Tested */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Date Tested <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateTested}
              onChange={(e) => setDateTested(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Test observations, issues found, etc."
              rows={3}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !dateTested}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Update Test Run'
              ) : (
                'Add Test Run'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
