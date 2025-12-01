/**
 * MermaidDiagram - Shared Mermaid diagram renderer
 *
 * Renders Mermaid diagram code as SVG. Handles initialization,
 * error states, and unique IDs for multiple diagrams on a page.
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

/** Delay before rendering to ensure DOM ref is ready */
const RENDER_DELAY_MS = 100;

/**
 * Check if the code looks like valid Mermaid syntax.
 * Returns false if it's just plain text description.
 */
function isMermaidSyntax(code: string): boolean {
  const trimmed = code.trim();
  // Mermaid diagrams typically start with these keywords
  const mermaidKeywords = [
    'graph ', 'graph\n',
    'flowchart ', 'flowchart\n',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'gitGraph',
    'mindmap',
    'timeline',
    'quadrantChart',
    'sankey',
    'xychart',
  ];

  return mermaidKeywords.some(keyword =>
    trimmed.toLowerCase().startsWith(keyword.toLowerCase())
  );
}

/**
 * Sanitize Mermaid code to handle special characters in node labels.
 * Mermaid interprets () inside [] as shape syntax, so we quote labels that contain them.
 */
function sanitizeMermaidCode(code: string): string {
  // Match node definitions with square brackets: ID[label] or ID["label"]
  // If label contains parentheses and isn't already quoted, wrap in quotes
  return code.replace(
    /(\w+)\[([^\]"]+)\]/g,
    (match, id, label) => {
      // If label contains special characters like (), wrap in quotes
      if (/[(){}]/.test(label)) {
        return `${id}["${label}"]`;
      }
      return match;
    }
  );
}

// Initialize Mermaid globally (only runs once)
let mermaidInitialized = false;
if (!mermaidInitialized) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
  mermaidInitialized = true;
}

interface MermaidDiagramProps {
  /** Mermaid diagram code */
  code: string;
  /** Optional CSS class for the container */
  className?: string;
  /** Optional caption below the diagram */
  caption?: string;
}

export function MermaidDiagram({ code, className = '', caption }: MermaidDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  // Check if this is actually Mermaid syntax or just description text
  const isValidMermaid = code && isMermaidSyntax(code);

  useEffect(() => {
    if (!code || !isValidMermaid) return;

    // Add delay to ensure ref is ready
    const timer = setTimeout(() => {
      if (!diagramRef.current) return;

      async function renderDiagram() {
        try {
          setError(null);
          if (diagramRef.current) {
            diagramRef.current.innerHTML = '';
            // Sanitize code to handle special characters in node labels
            const sanitizedCode = sanitizeMermaidCode(code);
            const { svg } = await mermaid.render(diagramId, sanitizedCode);
            if (diagramRef.current) {
              diagramRef.current.innerHTML = svg;
            }
          }
        } catch (err) {
          console.error('Mermaid rendering error:', err);
          setError('Failed to render diagram');
        }
      }

      renderDiagram();
    }, RENDER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [code, diagramId, isValidMermaid]);

  if (!code) {
    return null;
  }

  // If the content isn't valid Mermaid syntax, display it as description text
  if (!isValidMermaid) {
    return (
      <div className={className}>
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {code}
          </p>
        </div>
        {caption && (
          <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
            {caption}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        {error}
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">Show diagram code</summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
            {code}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={diagramRef} className="flex justify-center" />
      {caption && (
        <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
          {caption}
        </p>
      )}
    </div>
  );
}
