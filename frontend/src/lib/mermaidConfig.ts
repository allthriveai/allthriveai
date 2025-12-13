/**
 * Shared Mermaid configuration matching the neon glass aesthetic
 */
import mermaid from 'mermaid';

// Custom theme variables matching the neon glass aesthetic
export const mermaidThemeVariables = {
  // Primary colors - cyan/teal theme
  primaryColor: '#0e7490',      // cyan-700
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#06b6d4', // cyan-500

  // Secondary colors
  secondaryColor: '#134e4a',    // teal-900
  secondaryTextColor: '#ffffff',
  secondaryBorderColor: '#14b8a6', // teal-500

  // Tertiary colors
  tertiaryColor: '#164e63',     // cyan-900
  tertiaryTextColor: '#ffffff',
  tertiaryBorderColor: '#22d3ee', // cyan-400

  // Background and text
  background: '#0f172a',        // slate-900
  mainBkg: '#1e293b',           // slate-800
  nodeBkg: '#0f172a',           // slate-900
  nodeBorder: '#06b6d4',        // cyan-500

  // Lines and edges
  lineColor: '#06b6d4',         // cyan-500

  // Text colors
  textColor: '#e2e8f0',         // slate-200

  // Flowchart specific
  clusterBkg: '#1e293b',        // slate-800
  clusterBorder: '#334155',     // slate-700

  // State diagram
  labelColor: '#e2e8f0',

  // Fonts
  fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  fontSize: '14px',
};

// Full Mermaid configuration
export const mermaidConfig = {
  startOnLoad: false,
  theme: 'base' as const,
  themeVariables: mermaidThemeVariables,
  securityLevel: 'loose' as const,
  flowchart: {
    curve: 'basis' as const,
    padding: 20,
  },
};

// Initialize Mermaid with the custom theme (call once per app)
let initialized = false;
export function initializeMermaid(force = false) {
  if (!initialized || force) {
    mermaid.initialize(mermaidConfig);
    initialized = true;
  }
}
