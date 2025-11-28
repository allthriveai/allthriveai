import { useState, useEffect, useRef } from 'react';
import { getTools } from '@/services/tools';
import type { Tool } from '@/types/models';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ToolSelectorProps {
  selectedToolIds: number[];
  onChange: (toolIds: number[]) => void;
  disabled?: boolean;
}

export function ToolSelector({ selectedToolIds, onChange, disabled }: ToolSelectorProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Update selected tools when IDs change
  useEffect(() => {
    if (tools.length > 0) {
      const selected = tools.filter(tool => selectedToolIds.includes(tool.id));
      setSelectedTools(selected);
    }
  }, [tools, selectedToolIds]);

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
      {/* Selected Tools Display */}
      {selectedTools.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTools.map(tool => (
            <div
              key={tool.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm"
            >
              {tool.logoUrl && (
                <img
                  src={tool.logoUrl}
                  alt={tool.name}
                  className="w-4 h-4 rounded object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <span className="font-medium">{tool.name}</span>
              {!disabled && (
                <button
                  onClick={() => handleRemoveTool(tool.id)}
                  className="ml-1 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full p-0.5 transition-colors"
                  type="button"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
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
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
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
