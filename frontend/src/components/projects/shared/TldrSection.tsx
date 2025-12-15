/**
 * TldrSection - Reusable description/TL;DR section with customizable gradient
 *
 * Features:
 * - Customizable background color via color picker
 * - Left accent bar with gradient or custom color
 * - Inline editing support for owners
 * - Preset color palette + custom color picker
 *
 * Used in: DefaultProjectLayout, GitHubProjectLayout, FigmaProjectLayout
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { SwatchIcon } from '@heroicons/react/24/outline';
import { InlineEditableText } from './InlineEditable';
import { updateProject } from '@/services/projects';
import type { Project } from '@/types/models';
import { renderContent } from '@/utils/markdown';

interface TldrSectionProps {
  project: Project;
  isEditing: boolean;
  onProjectUpdate: (project: Project) => void;
  /** Optional class name for the container */
  className?: string;
  /** Use dark mode styling (for dark backgrounds) */
  darkMode?: boolean;
}

/** Preset colors for the color picker */
const PRESET_COLORS = [
  '#22d3ee', // cyan
  '#a855f7', // purple
  '#f97316', // orange
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // blue
  '#eab308', // yellow
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export function TldrSection({
  project,
  isEditing,
  onProjectUpdate,
  className = '',
  darkMode = true,
}: TldrSectionProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle description change
  const handleDescriptionChange = useCallback(async (newDescription: string) => {
    try {
      const updated = await updateProject(project.id, { description: newDescription });
      onProjectUpdate(updated);
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  }, [project.id, onProjectUpdate]);

  // Handle background color change
  const handleBgColorChange = useCallback(async (color: string) => {
    try {
      const updatedContent = {
        ...project.content,
        tldrBgColor: color,
      };
      const updated = await updateProject(project.id, { content: updatedContent });
      onProjectUpdate(updated);
      setShowColorPicker(false);
    } catch (error) {
      console.error('Failed to update TL;DR background color:', error);
    }
  }, [project.id, project.content, onProjectUpdate]);

  const bgColor = project.content?.tldrBgColor;

  // Only render if there's a description or the owner is editing
  if (!project.description && !isEditing) {
    return null;
  }

  // Styling classes based on dark mode
  const containerClasses = darkMode
    ? 'relative p-6 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden'
    : 'relative p-6 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl overflow-hidden';

  const textClasses = darkMode
    ? 'prose prose-lg prose-invert max-w-none pl-2'
    : 'prose prose-lg dark:prose-invert max-w-none pl-2';

  const buttonClasses = darkMode
    ? 'p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white/80 hover:text-white transition-colors border border-white/20'
    : 'p-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-white/20 dark:hover:bg-white/30 text-gray-700 hover:text-gray-900 dark:text-white/80 dark:hover:text-white transition-colors border border-gray-300 dark:border-white/20';

  return (
    <div
      className={`${containerClasses} ${className}`}
      style={{
        backgroundColor: bgColor
          ? `${bgColor}20`
          : darkMode
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Left accent bar - uses tldrBgColor or default gradient */}
      <div
        className="absolute top-0 left-0 w-1.5 h-full opacity-80"
        style={{
          background: bgColor
            ? bgColor
            : 'linear-gradient(to bottom, var(--color-primary-400), var(--color-secondary-400))',
        }}
      />

      {/* Color picker button for owners in edit mode */}
      {isEditing && (
        <div className="absolute top-3 right-3" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={buttonClasses}
            title="Change background color"
          >
            <SwatchIcon className="w-5 h-5" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full right-0 mt-2 p-3 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/20 shadow-2xl z-50">
              <p className="text-xs text-white/60 mb-3 font-medium">Background Color</p>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleBgColorChange(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      bgColor === color
                        ? 'border-white'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor || '#22d3ee'}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                />
                <span className="text-xs text-white/60">Custom</span>
              </div>
              {bgColor && (
                <button
                  onClick={() => handleBgColorChange('')}
                  className="mt-3 w-full px-3 py-1.5 text-xs text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Reset to default
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing ? (
        <InlineEditableText
          value={project.description || ''}
          isEditable={isEditing}
          onChange={handleDescriptionChange}
          placeholder="Add a description for your project..."
          className={textClasses}
          multiline
          rows={4}
        />
      ) : (
        <div
          className={textClasses}
          dangerouslySetInnerHTML={{
            __html: renderContent(project.description || '')
          }}
        />
      )}
    </div>
  );
}

export default TldrSection;
