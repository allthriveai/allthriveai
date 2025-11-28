import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ProjectBlock } from '@/types/models';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
});

interface MermaidBlockEditorProps {
  block: ProjectBlock;
  onChange: (updates: Partial<ProjectBlock>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Inline Mermaid editor for use in BlockEditor (already wrapped with sortable)
 */
export function MermaidBlockEditor({ block, onChange, onFocus, onBlur }: MermaidBlockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(block.type === 'mermaid' ? block.code || '' : '');
  const [caption, setCaption] = useState(block.type === 'mermaid' ? block.caption || '' : '');
  const [error, setError] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  // Render diagram when code changes or when component mounts
  useEffect(() => {
    if (!isEditing && code) {
      // Small delay to ensure ref is ready
      const timer = setTimeout(() => {
        if (diagramRef.current) {
          renderDiagram();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [code, isEditing]);

  const renderDiagram = async () => {
    if (!diagramRef.current || !code) return;

    try {
      setError(null);
      // Clear previous diagram
      diagramRef.current.innerHTML = '';

      // Render new diagram
      const { svg } = await mermaid.render(diagramId, code);
      diagramRef.current.innerHTML = svg;
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      setError('Invalid diagram syntax');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    onFocus?.();
  };

  const handleSave = () => {
    if (!code.trim()) {
      setError('Diagram code cannot be empty');
      return;
    }

    const updates = {
      type: 'mermaid' as const,
      code: code.trim(),
      caption,
    };

    onChange(updates);
    setIsEditing(false);
    onBlur?.();
  };

  const handleCancel = () => {
    // Reset to original values
    if (block.type === 'mermaid') {
      setCode(block.code || '');
      setCaption(block.caption || '');
    }
    setError(null);
    setIsEditing(false);
    onBlur?.();
  };

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-2">
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
            title="Edit diagram"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
        )}
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Mermaid Diagram
        </span>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
              Mermaid Code
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="graph TD&#10;  A[Start] --> B[Process]&#10;  B --> C[End]"
            />
            <p className="text-xs text-gray-500 mt-1">
              <a
                href="https://mermaid.js.org/intro/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                Mermaid syntax guide
              </a>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
              Caption (optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              placeholder="Diagram caption..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1"
            >
              <CheckIcon className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm rounded flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Rendered Diagram */
        <div>
          <div
            ref={diagramRef}
            className="flex justify-center items-center p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto"
          >
            {!code && (
              <span className="text-gray-400 text-sm">No diagram code</span>
            )}
          </div>
          {caption && (
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center mt-2">
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mermaid editor for column blocks (simpler version)
 */
export function MermaidColumnBlockEditor({ block, onChange }: { block: ProjectBlock; onChange: (updates: Partial<ProjectBlock>) => void }) {
  return <MermaidBlockEditor block={block} onChange={onChange} />;
}
