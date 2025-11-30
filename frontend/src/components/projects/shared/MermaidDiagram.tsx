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

  useEffect(() => {
    if (!code) return;

    // Add delay to ensure ref is ready
    const timer = setTimeout(() => {
      if (!diagramRef.current) return;

      async function renderDiagram() {
        try {
          setError(null);
          if (diagramRef.current) {
            diagramRef.current.innerHTML = '';
            const { svg } = await mermaid.render(diagramId, code);
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
  }, [code, diagramId]);

  if (!code) {
    return null;
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-sm p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        {error}
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
