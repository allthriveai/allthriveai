/**
 * UATScenarioTableView - Table view for UAT scenarios with test history
 */
import { useState, useCallback, useMemo } from 'react';
import type { UATScenario, UATCategory, UATScenarioAssignee, UATTestRun } from '@/types/uatScenarios';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  TicketIcon,
  PlusCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, MinusCircleIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';

const ITEMS_PER_PAGE = 25;

interface UATScenarioTableViewProps {
  scenarios: UATScenario[];
  categories: UATCategory[];
  admins: UATScenarioAssignee[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onScenarioClick: (scenario: UATScenario) => void;
  onDeleteScenario: (scenarioId: number) => void;
  onCreateTask: (scenarioId: number) => void;
  onAddTestRun: (scenario: UATScenario) => void;
}

type SortField = 'title' | 'category' | 'priority' | 'testRunCount' | 'latestResult' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Priority color mapping
const priorityColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  low: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  medium: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  high: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  critical: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
};

function getPriorityColors(priority: string) {
  return priorityColorMap[priority] || priorityColorMap.medium;
}

// Color mapping
const colorMap: Record<string, { bg: string; text: string }> = {
  slate: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-300' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300' },
  green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300' },
  red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300' },
};

function getColorClasses(color: string) {
  return colorMap[color] || colorMap.slate;
}

// Result icon component
function ResultIcon({ result, size = 'sm' }: { result: 'pass' | 'fail' | 'na'; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  switch (result) {
    case 'pass':
      return <CheckCircleIcon className={`${sizeClass} text-green-500`} />;
    case 'fail':
      return <XCircleIcon className={`${sizeClass} text-red-500`} />;
    case 'na':
      return <MinusCircleIcon className={`${sizeClass} text-slate-400`} />;
  }
}

// Test run row component
function TestRunRow({ run }: { run: UATTestRun }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
      <ResultIcon result={run.result} size="sm" />
      <span className="text-slate-600 dark:text-slate-400 min-w-[70px]">
        {new Date(run.dateTested).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
      <span className="text-slate-500 dark:text-slate-400 truncate">
        {run.testedByDetail?.firstName || run.testedByDetail?.email?.split('@')[0] || 'Unknown'}
      </span>
    </div>
  );
}

export function UATScenarioTableView({
  scenarios,
  categories: _categories,
  admins: _admins,
  selectedIds,
  onSelectionChange,
  onScenarioClick,
  onDeleteScenario,
  onCreateTask,
  onAddTestRun,
}: UATScenarioTableViewProps) {
  void _categories;
  void _admins;
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Sort scenarios
  const sortedScenarios = useMemo(() => [...scenarios].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'category':
        comparison = (a.categoryDetail?.name || '').localeCompare(b.categoryDetail?.name || '');
        break;
      case 'priority': {
        const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
        comparison = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        break;
      }
      case 'testRunCount':
        comparison = a.testRunCount - b.testRunCount;
        break;
      case 'latestResult': {
        const resultOrder = { pass: 1, fail: 2, na: 3, null: 4 };
        const aResult = a.latestTestRun?.result || null;
        const bResult = b.latestTestRun?.result || null;
        comparison = (resultOrder[aResult || 'null'] || 4) - (resultOrder[bResult || 'null'] || 4);
        break;
      }
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  }), [scenarios, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedScenarios.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedScenarios = sortedScenarios.slice(startIndex, endIndex);

  // Reset to page 1 when scenarios change (e.g., filtering)
  useMemo(() => {
    if (currentPage > 1 && startIndex >= sortedScenarios.length) {
      setCurrentPage(1);
    }
  }, [sortedScenarios.length, currentPage, startIndex]);

  const handleSort = useCallback((field: SortField) => {
    setCurrentPage(1); // Reset to page 1 when sorting
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === scenarios.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(scenarios.map((s) => s.id));
    }
  }, [selectedIds.length, scenarios, onSelectionChange]);

  const handleSelectScenario = useCallback(
    (scenarioId: number) => {
      if (selectedIds.includes(scenarioId)) {
        onSelectionChange(selectedIds.filter((id) => id !== scenarioId));
      } else {
        onSelectionChange([...selectedIds, scenarioId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4" />
    ) : (
      <ChevronDownIcon className="w-4 h-4" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {/* Checkbox */}
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === scenarios.length && scenarios.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
                />
              </th>
              {/* Title */}
              <th className="px-4 py-3 text-left min-w-[200px]">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Scenario
                  <SortIcon field="title" />
                </button>
              </th>
              {/* Description */}
              <th className="px-4 py-3 text-left min-w-[250px]">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Description
                </span>
              </th>
              {/* Category */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('category')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Category
                  <SortIcon field="category" />
                </button>
              </th>
              {/* Priority */}
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Priority
                  <SortIcon field="priority" />
                </button>
              </th>
              {/* Test History */}
              <th className="px-4 py-3 text-left min-w-[220px]">
                <button
                  onClick={() => handleSort('testRunCount')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Test History
                  <SortIcon field="testRunCount" />
                </button>
              </th>
              {/* Actions */}
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {paginatedScenarios.map((scenario) => {
              const isSelected = selectedIds.includes(scenario.id);
              const categoryColors = scenario.categoryDetail
                ? getColorClasses(scenario.categoryDetail.color)
                : null;
              const latestResult = scenario.latestTestRun?.result;

              return (
                <tr
                  key={scenario.id}
                  className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                    isSelected ? 'bg-cyan-50 dark:bg-cyan-500/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectScenario(scenario.id)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500 mt-1"
                    />
                  </td>
                  {/* Title */}
                  <td className="px-4 py-3 align-top">
                    <button
                      onClick={() => onScenarioClick(scenario)}
                      className="text-left group"
                    >
                      <div className="font-medium text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {scenario.title}
                      </div>
                    </button>
                  </td>
                  {/* Description */}
                  <td className="px-4 py-3 align-top">
                    {scenario.description ? (
                      <div className="text-sm text-slate-600 dark:text-slate-400 prose prose-sm dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 max-w-none line-clamp-4">
                        <ReactMarkdown>{scenario.description}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500 italic">No description</span>
                    )}
                  </td>
                  {/* Category */}
                  <td className="px-4 py-3 align-top">
                    {categoryColors && scenario.categoryDetail && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${categoryColors.bg} ${categoryColors.text}`}
                      >
                        {scenario.categoryDetail.name}
                      </span>
                    )}
                  </td>
                  {/* Priority */}
                  <td className="px-4 py-3 align-top">
                    {(() => {
                      const priorityColors = getPriorityColors(scenario.priority);
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded ${priorityColors.bg} ${priorityColors.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityColors.dot}`} />
                          {scenario.priorityDisplay}
                        </span>
                      );
                    })()}
                  </td>
                  {/* Test History */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      {/* Test runs list - scrollable */}
                      {scenario.testRuns && scenario.testRuns.length > 0 ? (
                        <div className="max-h-24 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                          {scenario.testRuns.map((run) => (
                            <TestRunRow key={run.id} run={run} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400 dark:text-slate-500 italic py-2">
                          Not tested yet
                        </div>
                      )}
                      {/* Add test run button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddTestRun(scenario);
                        }}
                        className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors mt-1"
                      >
                        <PlusIcon className="w-3 h-3" />
                        Add test run
                      </button>
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1">
                      {/* Create Task button - only for failed scenarios */}
                      {latestResult === 'fail' && !scenario.linkedTask && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateTask(scenario.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors rounded hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
                          title="Create task from failure"
                        >
                          <PlusCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                      {/* Link to existing task */}
                      {scenario.linkedTask && (
                        <a
                          href={`/admin/tasks?task=${scenario.linkedTask}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-cyan-500 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors rounded hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
                          title="View linked task"
                        >
                          <TicketIcon className="w-4 h-4" />
                        </a>
                      )}
                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteScenario(scenario.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-500/10"
                        title="Delete scenario"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scenarios.length === 0 && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          No scenarios found
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedScenarios.length)} of {sortedScenarios.length} scenarios
          </div>
          <div className="flex items-center gap-1">
            {/* Previous button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first, last, current, and neighbors
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                  // Add ellipsis between gaps
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                    acc.push('ellipsis');
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-slate-400 dark:text-slate-500"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-[36px] h-9 px-3 rounded-lg font-medium text-sm transition-colors ${
                        currentPage === item
                          ? 'bg-purple-600 dark:bg-purple-500 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>

            {/* Next button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
