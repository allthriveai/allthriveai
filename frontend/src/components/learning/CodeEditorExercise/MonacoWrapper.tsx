/**
 * Monaco Editor Wrapper Component
 * Provides a full-featured code editor with syntax highlighting and error decorations
 */

import { useRef, useEffect, useCallback } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { MonacoWrapperProps } from './types';
import { getMonacoLanguage, getLanguageEditorOptions, getLanguageDisplayName } from './utils/languageConfig';

export function MonacoWrapper({
  language,
  value,
  onChange,
  feedback,
  readOnly = false,
  height = '300px',
}: MonacoWrapperProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor for better UX
    editor.updateOptions({
      glyphMargin: true,
    });

    // Define custom CSS for decorations
    const styleElement = document.getElementById('monaco-custom-styles') || document.createElement('style');
    styleElement.id = 'monaco-custom-styles';
    styleElement.textContent = `
      .monaco-editor .error-line-decoration {
        background-color: rgba(239, 68, 68, 0.15) !important;
      }
      .monaco-editor .warning-line-decoration {
        background-color: rgba(245, 158, 11, 0.15) !important;
      }
      .monaco-editor .suggestion-line-decoration {
        background-color: rgba(59, 130, 246, 0.1) !important;
      }
      .monaco-editor .glyph-error {
        background-color: #ef4444;
        border-radius: 50%;
        width: 8px !important;
        height: 8px !important;
        margin-left: 5px;
        margin-top: 6px;
      }
      .monaco-editor .glyph-warning {
        background-color: #f59e0b;
        border-radius: 50%;
        width: 8px !important;
        height: 8px !important;
        margin-left: 5px;
        margin-top: 6px;
      }
      .monaco-editor .glyph-suggestion {
        background-color: #3b82f6;
        border-radius: 50%;
        width: 8px !important;
        height: 8px !important;
        margin-left: 5px;
        margin-top: 6px;
      }
    `;
    if (!document.getElementById('monaco-custom-styles')) {
      document.head.appendChild(styleElement);
    }
  }, []);

  // Apply error/warning decorations when feedback changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);

    if (!feedback || feedback.issues.length === 0) return;

    // Create decorations from feedback issues
    const decorations: editor.IModelDeltaDecoration[] = feedback.issues
      .filter(issue => issue.line && issue.line > 0)
      .map(issue => {
        const lineNumber = issue.line!;

        // Get class names based on issue type
        let lineClassName = '';
        let glyphClassName = '';

        switch (issue.type) {
          case 'error':
            lineClassName = 'error-line-decoration';
            glyphClassName = 'glyph-error';
            break;
          case 'warning':
            lineClassName = 'warning-line-decoration';
            glyphClassName = 'glyph-warning';
            break;
          case 'suggestion':
            lineClassName = 'suggestion-line-decoration';
            glyphClassName = 'glyph-suggestion';
            break;
        }

        return {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: lineClassName,
            glyphMarginClassName: glyphClassName,
            hoverMessage: {
              value: `**${issue.type.toUpperCase()}**: ${issue.message}\n\n${issue.explanation || ''}\n\n${issue.hint ? `**Hint**: ${issue.hint}` : ''}`,
            },
          },
        };
      });

    // Apply new decorations
    decorationsRef.current = editor.deltaDecorations([], decorations);
  }, [feedback]);

  const handleChange = useCallback((newValue: string | undefined) => {
    onChange(newValue);
  }, [onChange]);

  const monacoLanguage = getMonacoLanguage(language);
  const editorOptions = getLanguageEditorOptions(language);
  const languageName = getLanguageDisplayName(language);

  return (
    <div className="relative">
      {/* Language badge */}
      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-medium rounded bg-slate-700 text-slate-300">
        {languageName}
      </div>

      <Editor
        height={height}
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          ...editorOptions,
          readOnly,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}

export default MonacoWrapper;
