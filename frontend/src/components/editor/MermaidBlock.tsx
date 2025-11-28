import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import mermaid from 'mermaid';
import {
  Bars3Icon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { ProjectBlock } from '@/types/models';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
});

interface MermaidBlockProps {
  block: ProjectBlock & { id: string };
  onUpdate: (id: string, block: ProjectBlock) => void;
  onDelete: (id: string) => void;
}

/**
 * Wrapper for sortable blocks with drag handle
 */
function SortableBlock({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative mb-4">
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <Bars3Icon className="w-5 h-5 text-gray-400" />
      </div>

      {children}
    </div>
  );
}

/**
 * Mermaid Diagram Block - renders interactive diagrams
 */
export function MermaidBlock({ block, onUpdate, onDelete }: MermaidBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(block.type === 'mermaid' ? block.code : '');
  const [caption, setCaption] = useState(
    block.type === 'mermaid' ? block.caption || '' : ''
  );
  const [error, setError] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  // Render diagram when code changes
  useEffect(() => {
    if (!isEditing && code && diagramRef.current) {
      renderDiagram();
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

  const handleSave = () => {
    if (!code.trim()) {
      setError('Diagram code cannot be empty');
      return;
    }

    onUpdate(block.id, {
      type: 'mermaid',
      code: code.trim(),
      caption,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset to original values
    if (block.type === 'mermaid') {
      setCode(block.code);
      setCaption(block.caption || '');
    }
    setError(null);
    setIsEditing(false);
  };

  return (
    <SortableBlock id={block.id}>
      <div className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mermaid Diagram
            </span>
            {error && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Edit diagram"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(block.id)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
                  title="Delete diagram"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600 rounded"
                  title="Save"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Cancel"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit Mode */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
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
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Caption (optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                placeholder="Diagram caption..."
              />
            </div>
          </div>
        ) : (
          /* Rendered Diagram */
          <div>
            <div
              ref={diagramRef}
              className="flex justify-center items-center p-4 bg-white dark:bg-gray-900 rounded-lg overflow-x-auto"
            >
              {!code && (
                <span className="text-gray-400">No diagram code</span>
              )}
            </div>
            {caption && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
                {caption}
              </p>
            )}
          </div>
        )}
      </div>
    </SortableBlock>
  );
}

/**
 * Code Snippet Block - for displaying code with syntax highlighting
 */
interface CodeSnippetBlockProps {
  block: ProjectBlock & { id: string };
  onUpdate: (id: string, block: ProjectBlock) => void;
  onDelete: (id: string) => void;
}

export function CodeSnippetBlock({
  block,
  onUpdate,
  onDelete,
}: CodeSnippetBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(
    block.type === 'code_snippet' ? block.code : ''
  );
  const [language, setLanguage] = useState(
    block.type === 'code_snippet' ? block.language : 'javascript'
  );
  const [filename, setFilename] = useState(
    block.type === 'code_snippet' ? block.filename || '' : ''
  );

  const handleSave = () => {
    onUpdate(block.id, {
      type: 'code_snippet',
      code: code.trim(),
      language,
      filename: filename || undefined,
    });
    setIsEditing(false);
  };

  return (
    <SortableBlock id={block.id}>
      <div className="glass-subtle rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {/* Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Code Snippet
            </span>
            {filename && !isEditing && (
              <span className="text-xs text-gray-500 font-mono">{filename}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(block.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                  <option value="java">Java</option>
                  <option value="csharp">C#</option>
                  <option value="cpp">C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="bash">Bash</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Filename (optional)
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  placeholder="example.js"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="// Your code here..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm">
              <code className={`language-${language} text-gray-100`}>{code}</code>
            </pre>
          </div>
        )}
      </div>
    </SortableBlock>
  );
}
