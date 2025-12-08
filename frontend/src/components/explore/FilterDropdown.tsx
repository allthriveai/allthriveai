import { useState, Fragment } from 'react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import {
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import type { Taxonomy } from '@/types/models';
import { JEWEL_HEX } from '@/utils/categoryColors';

// Map color names to hex values
const getColorHex = (colorName?: string): string => {
  if (!colorName) return '#6B7280';
  const hex = JEWEL_HEX[colorName as keyof typeof JEWEL_HEX];
  return hex || '#6B7280';
};

interface Tool {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
}

interface FilterDropdownProps {
  categories: Taxonomy[];
  tools: Tool[];
  selectedCategorySlugs: string[];
  selectedToolSlugs: string[];
  onCategoriesChange: (slugs: string[]) => void;
  onToolsChange: (slugs: string[]) => void;
  compact?: boolean; // For inline-in-input style
}

export function FilterDropdown({
  categories,
  tools,
  selectedCategorySlugs,
  selectedToolSlugs,
  onCategoriesChange,
  onToolsChange,
  compact = false,
}: FilterDropdownProps) {
  const [categorySearch, setCategorySearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'categories' | 'tools'>('categories');

  const totalSelected = selectedCategorySlugs.length + selectedToolSlugs.length;

  // Filter options based on search
  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const toggleCategory = (slug: string) => {
    if (selectedCategorySlugs.includes(slug)) {
      onCategoriesChange(selectedCategorySlugs.filter((s) => s !== slug));
    } else {
      onCategoriesChange([...selectedCategorySlugs, slug]);
    }
  };

  const toggleTool = (slug: string) => {
    if (selectedToolSlugs.includes(slug)) {
      onToolsChange(selectedToolSlugs.filter((s) => s !== slug));
    } else {
      onToolsChange([...selectedToolSlugs, slug]);
    }
  };

  const clearAll = () => {
    onCategoriesChange([]);
    onToolsChange([]);
  };

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            className={`
              flex items-center gap-1.5 text-sm font-medium transition-all focus:outline-none
              ${compact
                ? `px-2 py-1 rounded-md ${
                    totalSelected > 0
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                : `px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                    totalSelected > 0
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`
              }
            `}
          >
            <FunnelIcon className="w-4 h-4" />
            {totalSelected > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-xs font-bold bg-primary-600 text-white rounded-full">
                {totalSelected}
              </span>
            )}
            {!compact && (
              <>
                <span>{totalSelected > 0 ? 'Filters' : 'Filters'}</span>
                <ChevronDownIcon
                  className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </PopoverButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel className="absolute right-0 z-[100] mt-3 w-80 sm:w-96 origin-top-right">
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                {/* Header with tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <div className="flex">
                    <button
                      onClick={() => setActiveSection('categories')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeSection === 'categories'
                          ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      Categories
                      {selectedCategorySlugs.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                          {selectedCategorySlugs.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveSection('tools')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeSection === 'tools'
                          ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      Tools
                      {selectedToolSlugs.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                          {selectedToolSlugs.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Search input */}
                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${activeSection}...`}
                      value={activeSection === 'categories' ? categorySearch : toolSearch}
                      onChange={(e) =>
                        activeSection === 'categories'
                          ? setCategorySearch(e.target.value)
                          : setToolSearch(e.target.value)
                      }
                      className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Options list */}
                <div className="max-h-64 overflow-y-auto p-2">
                  {activeSection === 'categories' ? (
                    filteredCategories.length > 0 ? (
                      <div className="space-y-1">
                        {filteredCategories.map((category) => {
                          const isSelected = selectedCategorySlugs.includes(category.slug);
                          const categoryColor = getColorHex(category.color);
                          return (
                            <button
                              key={category.slug}
                              onClick={() => toggleCategory(category.slug)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                                border-l-4
                              `}
                              style={{
                                borderLeftColor: categoryColor,
                                backgroundColor: isSelected ? `${categoryColor}20` : undefined,
                              }}
                            >
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                style={{
                                  backgroundColor: categoryColor,
                                  boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${categoryColor}` : undefined,
                                }}
                              >
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <span
                                className={`text-sm flex-1 ${
                                  isSelected
                                    ? 'font-semibold text-gray-900 dark:text-white'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {category.name}
                              </span>
                              {isSelected && (
                                <XMarkIcon className="w-4 h-4 ml-auto text-gray-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No categories found
                      </p>
                    )
                  ) : filteredTools.length > 0 ? (
                    <div className="space-y-1">
                      {filteredTools.map((tool) => {
                        const isSelected = selectedToolSlugs.includes(tool.slug);
                        return (
                          <button
                            key={tool.slug}
                            onClick={() => toggleTool(tool.slug)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all
                              ${
                                isSelected
                                  ? 'bg-cyan-50 dark:bg-cyan-900/30'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }
                            `}
                          >
                            <div
                              className={`
                                w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden
                                bg-white border ${
                                  isSelected
                                    ? 'border-cyan-400 dark:border-cyan-600 ring-2 ring-offset-1 ring-cyan-400'
                                    : 'border-gray-200 dark:border-gray-600'
                                }
                              `}
                            >
                              {tool.logoUrl ? (
                                <img
                                  src={tool.logoUrl}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                />
                              ) : (
                                <WrenchScrewdriverIcon className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                            <span
                              className={`text-sm ${
                                isSelected
                                  ? 'font-medium text-cyan-700 dark:text-cyan-300'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {tool.name}
                            </span>
                            {isSelected && (
                              <XMarkIcon className="w-4 h-4 ml-auto text-gray-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No tools found
                    </p>
                  )}
                </div>

                {/* Footer with clear button */}
                {totalSelected > 0 && (
                  <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <button
                      onClick={clearAll}
                      className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
}

// Selected filters display component (shows as pills below search)
export function SelectedFilters({
  categories,
  tools,
  selectedCategorySlugs,
  selectedToolSlugs,
  onRemoveCategory,
  onRemoveTool,
  onClearAll,
}: {
  categories: Taxonomy[];
  tools: Tool[];
  selectedCategorySlugs: string[];
  selectedToolSlugs: string[];
  onRemoveCategory: (slug: string) => void;
  onRemoveTool: (slug: string) => void;
  onClearAll: () => void;
}) {
  const totalSelected = selectedCategorySlugs.length + selectedToolSlugs.length;

  if (totalSelected === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category pills */}
      {selectedCategorySlugs.map((slug) => {
        const category = categories.find((c) => c.slug === slug);
        if (!category) return null;
        const categoryColor = getColorHex(category.color);
        return (
          <button
            key={slug}
            onClick={() => onRemoveCategory(slug)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            {category.name}
            <XMarkIcon className="w-3 h-3" />
          </button>
        );
      })}

      {/* Tool pills */}
      {selectedToolSlugs.map((slug) => {
        const tool = tools.find((t) => t.slug === slug);
        if (!tool) return null;
        return (
          <button
            key={slug}
            onClick={() => onRemoveTool(slug)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
          >
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-white border border-cyan-300 dark:border-cyan-700">
              {tool.logoUrl ? (
                <img src={tool.logoUrl} alt="" className="w-3 h-3 object-contain" />
              ) : (
                <WrenchScrewdriverIcon className="w-2 h-2 text-gray-400" />
              )}
            </div>
            {tool.name}
            <XMarkIcon className="w-3 h-3" />
          </button>
        );
      })}

      {/* Clear all */}
      <button
        onClick={onClearAll}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
