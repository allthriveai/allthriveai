import { useState, useEffect, useRef } from 'react';
import { getTools } from '@/services/tools';
import type { Tool } from '@/types/models';
import { MagnifyingGlassIcon, XMarkIcon, Bars2Icon } from '@heroicons/react/24/outline';

interface ToolSelectorProps {
  selectedToolIds: number[];
  onChange: (toolIds: number[]) => void;
  disabled?: boolean;
  /** Initial tools to display immediately (before API loads) */
  initialSelectedTools?: Array<{ id: number; name: string; slug: string; logoUrl?: string; tagline?: string }>;
}

export function ToolSelector({ selectedToolIds, onChange, disabled, initialSelectedTools }: ToolSelectorProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Tool[]>(
    // Use initial tools if provided, cast to Tool type
    (initialSelectedTools as Tool[]) || []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load all tools on mount
  useEffect(() => {
    async function loadTools() {
      try {
        const response = await getTools({ ordering: 'name' });
        setTools(response.results);
      } catch (error) {
        console.error('Failed to load tools:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTools();
  }, []);

  // Update selected tools when IDs change - preserve order from selectedToolIds
  // Use either API-loaded tools OR initial tools as the source for mapping
  useEffect(() => {
    if (selectedToolIds.length > 0) {
      // Use API tools if loaded, otherwise fall back to initialSelectedTools
      const sourceTools = tools.length > 0 ? tools : (initialSelectedTools as Tool[]) || [];
      if (sourceTools.length > 0) {
        // Map IDs to tools while preserving the order from selectedToolIds
        const selected = selectedToolIds
          .map(id => sourceTools.find(tool => tool.id === id))
          .filter((tool): tool is Tool => tool !== undefined);
        // Only update if we found at least some tools to avoid clearing display
        if (selected.length > 0) {
          setSelectedTools(selected);
        }
      }
    }
  }, [tools, selectedToolIds, initialSelectedTools]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleTool = (tool: Tool) => {
    if (disabled) return;

    const isSelected = selectedToolIds.includes(tool.id);
    if (isSelected) {
      onChange(selectedToolIds.filter(id => id !== tool.id));
    } else {
      onChange([...selectedToolIds, tool.id]);
    }
  };

  const handleRemoveTool = (toolId: number) => {
    if (disabled) return;
    onChange(selectedToolIds.filter(id => id !== toolId));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add some styling feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || disabled) return;

    // Reorder the tools
    const newSelectedTools = [...selectedTools];
    const [draggedTool] = newSelectedTools.splice(draggedIndex, 1);
    newSelectedTools.splice(dropIndex, 0, draggedTool);

    // Update state immediately for optimistic UI
    setSelectedTools(newSelectedTools);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Notify parent of new order
    onChange(newSelectedTools.map(t => t.id));
  };

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Loading tools...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected Tools Display - with drag and drop reordering */}
      {selectedTools.length > 0 && (
        <div className="space-y-2">
          {selectedTools.length > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              First tool appears in project teaser. Drag to reorder.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {selectedTools.map((tool, index) => (
              <div
                key={tool.id}
                draggable={!disabled && selectedTools.length > 1}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                  index === 0
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 ring-2 ring-amber-300 dark:ring-amber-700'
                    : 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                } ${
                  !disabled && selectedTools.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''
                } ${
                  dragOverIndex === index && draggedIndex !== index
                    ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
                    : ''
                }`}
              >
                {/* Drag handle */}
                {!disabled && selectedTools.length > 1 && (
                  <Bars2Icon className="w-3 h-3 opacity-50" />
                )}
                {tool.logoUrl && (
                  <img
                    src={tool.logoUrl}
                    alt={tool.name}
                    className="w-4 h-4 rounded object-cover pointer-events-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="font-medium pointer-events-none">{tool.name}</span>
                {index === 0 && <span className="text-xs opacity-75 pointer-events-none">(featured)</span>}
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTool(tool.id);
                    }}
                    className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                    type="button"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Selector */}
      <div className="relative" ref={dropdownRef}>
        {/* Search Input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search tools..."
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Dropdown List */}
        {isDropdownOpen && !disabled && (
          <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
            {filteredTools.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No tools found
              </div>
            ) : (
              <div className="py-1">
                {filteredTools.map(tool => {
                  const isSelected = selectedToolIds.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleToggleTool(tool)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      {tool.logoUrl && (
                        <img
                          src={tool.logoUrl}
                          alt={tool.name}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                            {tool.name}
                          </span>
                          {isSelected && (
                            <span className="text-xs text-primary-600 dark:text-primary-400">✓</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {tool.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
