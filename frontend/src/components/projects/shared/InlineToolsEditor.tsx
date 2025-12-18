/**
 * InlineToolsEditor - Inline editable "Built With" section for projects
 *
 * Shows tools as clickable chips in view mode.
 * In edit mode, shows a ToolSelector dropdown for adding/removing tools.
 */

import { useState, useCallback, useEffect } from 'react';
import { CodeBracketIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ToolSelector } from '../ToolSelector';
import type { ToolSummary } from '@/types/models';

interface InlineToolsEditorProps {
  tools: ToolSummary[];
  toolIds: number[];
  isEditing: boolean;
  onToolClick: (toolSlug: string) => void;
  onToolsChange: (toolIds: number[]) => Promise<void>;
  isSaving?: boolean;
}

export function InlineToolsEditor({
  tools,
  toolIds,
  isEditing,
  onToolClick,
  onToolsChange,
  isSaving = false,
}: InlineToolsEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle tool selection changes - save immediately on change
  const handleToolsUpdate = useCallback(async (newToolIds: number[]) => {
    try {
      await onToolsChange(newToolIds);
    } catch (error) {
      console.error('Failed to update tools:', error);
    }
  }, [onToolsChange]);

  // Reset expanded state when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      setIsExpanded(false);
    }
  }, [isEditing]);

  // View mode - show tools as clickable chips
  if (!isEditing) {
    if (!tools || tools.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] pl-1">Built With</p>
        <div className="flex flex-wrap gap-3">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolClick(tool.slug)}
              className="group flex items-center gap-2.5 px-4 py-2 bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/30 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              {tool.logoUrl ? (
                <img src={tool.logoUrl} alt={tool.name} className="w-5 h-5 rounded-md object-cover shadow-sm" />
              ) : (
                <CodeBracketIcon className="w-5 h-5 text-white/70" />
              )}
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Edit mode - show tools with edit button or expanded selector
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] pl-1">Built With</p>
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all"
            disabled={isSaving}
          >
            <PencilIcon className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      {isExpanded ? (
        <div className="relative z-50 p-4 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/20 space-y-4 shadow-2xl">
          <div className="[&_input]:!bg-white/10 [&_input]:!border-white/20 [&_input]:!text-white [&_input]:placeholder:!text-white/40 [&_.text-gray-900]:!text-white [&_.text-gray-500]:!text-white/60 [&_.dark\\:text-white]:!text-white [&_.dark\\:text-gray-400]:!text-white/60 [&_.bg-white]:!bg-gray-800 [&_.dark\\:bg-gray-800]:!bg-gray-800 [&_.border-gray-200]:!border-white/20 [&_.dark\\:border-gray-700]:!border-white/20 [&_.hover\\:bg-gray-50]:hover:!bg-white/10 [&_.dark\\:hover\\:bg-gray-700]:hover:!bg-white/10 [&_.bg-primary-50]:!bg-primary-500/20 [&_.dark\\:bg-primary-900\\/20]:!bg-primary-500/20 [&_.text-primary-700]:!text-primary-300 [&_.dark\\:text-primary-300]:!text-primary-300 [&_.bg-amber-100]:!bg-amber-500/20 [&_.dark\\:bg-amber-900\\/30]:!bg-amber-500/20 [&_.text-amber-800]:!text-amber-300 [&_.dark\\:text-amber-200]:!text-amber-300 [&_.ring-amber-300]:!ring-amber-500/50 [&_.dark\\:ring-amber-700]:!ring-amber-500/50 [&_.absolute]:!z-[60]">
            <ToolSelector
              selectedToolIds={toolIds}
              onChange={handleToolsUpdate}
              disabled={isSaving}
              initialSelectedTools={tools}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setIsExpanded(false)}
              className="px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tools && tools.length > 0 ? (
            tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => onToolClick(tool.slug)}
                className="group flex items-center gap-2.5 px-4 py-2 bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-xl border border-white/10 hover:border-white/30 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {tool.logoUrl ? (
                  <img src={tool.logoUrl} alt={tool.name} className="w-5 h-5 rounded-md object-cover shadow-sm" />
                ) : (
                  <CodeBracketIcon className="w-5 h-5 text-white/70" />
                )}
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{tool.name}</span>
              </button>
            ))
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white/70 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-xl border border-dashed border-white/20 hover:border-white/30 transition-all"
              disabled={isSaving}
            >
              <PlusIcon className="w-5 h-5" />
              <span className="text-sm">Add tools & technologies</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
