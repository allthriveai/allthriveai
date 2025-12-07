/**
 * SkillsSection - Skill badges/tags display
 */

import { useState } from 'react';
import { PlusIcon, XMarkIcon, TagIcon } from '@heroicons/react/24/outline';
import type { SkillsSectionContent, Skill } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';

interface SkillsSectionProps {
  content: SkillsSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: SkillsSectionContent) => void;
}

export function SkillsSection({ content, user, isEditing, onUpdate }: SkillsSectionProps) {
  const [newSkill, setNewSkill] = useState('');
  const skills = content?.skills || [];
  const layout = content?.layout || 'tags';

  // Group skills by category if layout is 'categories'
  const groupedSkills = layout === 'categories'
    ? skills.reduce((acc: Record<string, Skill[]>, skill) => {
        const category = skill.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(skill);
        return acc;
      }, {})
    : null;

  const handleAddSkill = () => {
    if (!newSkill.trim() || !onUpdate) return;

    const skill: Skill = {
      name: newSkill.trim(),
    };

    onUpdate({
      ...content,
      skills: [...skills, skill],
    });
    setNewSkill('');
  };

  const handleRemoveSkill = (index: number) => {
    if (!onUpdate) return;
    const newSkills = skills.filter((_, i) => i !== index);
    onUpdate({ ...content, skills: newSkills });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  // Get level color
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'expert':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'advanced':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'intermediate':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'beginner':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  // Empty state when not editing
  if (skills.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Skills
      </h2>

      {layout === 'categories' && groupedSkills ? (
        // Grouped by category
        <div className="space-y-6">
          {Object.entries(groupedSkills).map(([category, categorySkills]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {categorySkills.map((skill, index) => (
                  <SkillTag
                    key={`${skill.name}-${index}`}
                    skill={skill}
                    isEditing={isEditing}
                    onRemove={() => {
                      const globalIndex = skills.findIndex(s => s.name === skill.name);
                      if (globalIndex !== -1) handleRemoveSkill(globalIndex);
                    }}
                    getLevelColor={getLevelColor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : layout === 'bars' ? (
        // Progress bars
        <div className="space-y-3">
          {skills.map((skill, index) => (
            <div key={`${skill.name}-${index}`} className="relative group">
              {isEditing && (
                <button
                  onClick={() => handleRemoveSkill(index)}
                  className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {skill.name}
                </span>
                {skill.level && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {skill.level}
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    skill.level === 'expert' ? 'w-full bg-purple-500' :
                    skill.level === 'advanced' ? 'w-4/5 bg-blue-500' :
                    skill.level === 'intermediate' ? 'w-3/5 bg-green-500' :
                    skill.level === 'beginner' ? 'w-2/5 bg-yellow-500' :
                    'w-1/2 bg-gray-400'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Tags (default)
        <div className="flex flex-wrap gap-2">
          {skills.map((skill, index) => (
            <SkillTag
              key={`${skill.name}-${index}`}
              skill={skill}
              isEditing={isEditing}
              onRemove={() => handleRemoveSkill(index)}
              getLevelColor={getLevelColor}
            />
          ))}
        </div>
      )}

      {/* Add Skill Input (editing) */}
      {isEditing && (
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a skill..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAddSkill}
            disabled={!newSkill.trim()}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {skills.length === 0 && isEditing && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          Add skills to showcase your expertise
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Skill Tag Component
// ============================================================================

interface SkillTagProps {
  skill: Skill;
  isEditing?: boolean;
  onRemove: () => void;
  getLevelColor: (level?: string) => string;
}

function SkillTag({ skill, isEditing, onRemove, getLevelColor }: SkillTagProps) {
  return (
    <div
      className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${getLevelColor(skill.level)}`}
    >
      {skill.icon && (
        <img src={skill.icon} alt="" className="w-4 h-4" />
      )}
      <span>{skill.name}</span>
      {isEditing && (
        <button
          onClick={onRemove}
          className="ml-1 p-0.5 text-current opacity-50 hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
