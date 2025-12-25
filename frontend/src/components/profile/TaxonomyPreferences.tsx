import { useState, useEffect } from 'react';
import {
  getTaxonomyPreferences,
  updateTaxonomyPreferences,
  getTaxonomiesByType,
  type TaxonomyPreferences as TaxonomyPreferencesType,
  type SkillLevel,
} from '@/services/personalization';
import type { Taxonomy } from '@/types/models';
import {
  UserIcon,
  BookOpenIcon,
  BriefcaseIcon,
  RocketLaunchIcon,
  SparklesIcon,
  BuildingOfficeIcon,
  CheckIcon,
  ChevronDownIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

interface TaxonomyOption {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isMultiSelect: boolean;
}

interface SkillLevelOption {
  value: SkillLevel;
  label: string;
  description: string;
}

const SKILL_LEVEL_OPTIONS: SkillLevelOption[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to AI - want clear explanations and step-by-step guidance',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with basics - ready for more depth',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Experienced - prefer concise, technical content',
  },
];

const TAXONOMY_OPTIONS: TaxonomyOption[] = [
  {
    type: 'personality',
    label: 'Personality Type',
    description: 'Your MBTI personality type helps us understand how you learn best',
    icon: UserIcon,
    isMultiSelect: false,
  },
  {
    type: 'learning_style',
    label: 'Learning Styles',
    description: 'How do you prefer to learn new things?',
    icon: BookOpenIcon,
    isMultiSelect: true,
  },
  {
    type: 'role',
    label: 'Roles',
    description: 'What roles describe you best?',
    icon: BriefcaseIcon,
    isMultiSelect: true,
  },
  {
    type: 'goal',
    label: 'Goals',
    description: 'What are you trying to achieve with AI?',
    icon: RocketLaunchIcon,
    isMultiSelect: true,
  },
  {
    type: 'interest',
    label: 'Interests',
    description: 'What AI topics interest you most?',
    icon: SparklesIcon,
    isMultiSelect: true,
  },
  {
    type: 'industry',
    label: 'Industries',
    description: 'What industries are you working in or interested in?',
    icon: BuildingOfficeIcon,
    isMultiSelect: true,
  },
];

export function TaxonomyPreferences() {
  const [preferences, setPreferences] = useState<TaxonomyPreferencesType | null>(null);
  const [availableTaxonomies, setAvailableTaxonomies] = useState<Record<string, Taxonomy[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load preferences and available taxonomies in parallel
      const [prefsData, ...taxonomyData] = await Promise.all([
        getTaxonomyPreferences(),
        ...TAXONOMY_OPTIONS.map((opt) => getTaxonomiesByType(opt.type)),
      ]);

      setPreferences(prefsData);

      // Map taxonomy data to their types
      const taxonomyMap: Record<string, Taxonomy[]> = {};
      TAXONOMY_OPTIONS.forEach((opt, index) => {
        taxonomyMap[opt.type] = taxonomyData[index] || [];
      });
      setAvailableTaxonomies(taxonomyMap);
    } catch (err) {
      console.error('Failed to load taxonomy preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }

  function getSelectedIds(type: string): number[] {
    if (!preferences) return [];

    switch (type) {
      case 'personality':
        return preferences.personality ? [preferences.personality.id] : [];
      case 'learning_style':
        return preferences.learningStyles?.map((t) => t.id) || [];
      case 'role':
        return preferences.roles?.map((t) => t.id) || [];
      case 'goal':
        return preferences.goals?.map((t) => t.id) || [];
      case 'interest':
        return preferences.interests?.map((t) => t.id) || [];
      case 'industry':
        return preferences.industries?.map((t) => t.id) || [];
      default:
        return [];
    }
  }

  async function handleSelect(type: string, taxonomyId: number, isMultiSelect: boolean) {
    if (!preferences) return;

    const currentIds = getSelectedIds(type);
    let newIds: number[];

    if (isMultiSelect) {
      // Toggle selection for multi-select
      if (currentIds.includes(taxonomyId)) {
        newIds = currentIds.filter((id) => id !== taxonomyId);
      } else {
        newIds = [...currentIds, taxonomyId];
      }
    } else {
      // Single select - toggle or set
      newIds = currentIds.includes(taxonomyId) ? [] : [taxonomyId];
    }

    // Build update payload
    const updatePayload: Record<string, number | number[] | null> = {};
    switch (type) {
      case 'personality':
        updatePayload.personalityId = newIds.length > 0 ? newIds[0] : null;
        break;
      case 'learning_style':
        updatePayload.learningStyleIds = newIds;
        break;
      case 'role':
        updatePayload.roleIds = newIds;
        break;
      case 'goal':
        updatePayload.goalIds = newIds;
        break;
      case 'interest':
        updatePayload.interestIds = newIds;
        break;
      case 'industry':
        updatePayload.industryIds = newIds;
        break;
    }

    try {
      setSaving(true);
      setError(null);
      const updated = await updateTaxonomyPreferences(updatePayload);
      setPreferences(updated);
    } catch (err) {
      console.error('Failed to update preferences:', err);
      setError('Failed to save preference');
    } finally {
      setSaving(false);
    }
  }

  function getSelectedLabel(type: string): string {
    const selected = getSelectedIds(type);
    const available = availableTaxonomies[type] || [];

    if (selected.length === 0) return 'None selected';
    if (selected.length === 1) {
      const item = available.find((t) => t.id === selected[0]);
      return item?.name || 'Selected';
    }
    return `${selected.length} selected`;
  }

  async function handleSkillLevelChange(level: SkillLevel) {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      const updated = await updateTaxonomyPreferences({ skillLevel: level });
      setPreferences(updated);
    } catch (err) {
      console.error('Failed to update skill level:', err);
      setError('Failed to save skill level');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UserIcon className="w-5 h-5" />
          About You
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Tell us about yourself to personalize your experience. These are your explicit preferences.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {/* Skill Level Section - Always visible at top */}
        <div className="border border-primary-200 dark:border-primary-700 rounded-lg overflow-hidden bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
          <div className="p-3 sm:p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary-500 dark:bg-primary-900/50 flex items-center justify-center">
                <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white dark:text-primary-300" />
              </div>
              <div>
                <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                  Skill Level
                </h4>
                <p className="text-xs text-primary-700 dark:text-gray-400">
                  {preferences?.skillLevel
                    ? SKILL_LEVEL_OPTIONS.find((o) => o.value === preferences.skillLevel)?.label
                    : 'Not set'}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
              Your skill level helps Ember personalize explanations and learning content for you.
            </p>

            <div className="flex flex-wrap gap-2">
              {SKILL_LEVEL_OPTIONS.map((option) => {
                const isSelected = preferences?.skillLevel === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSkillLevelChange(option.value)}
                    disabled={saving}
                    className={`flex-1 min-w-[100px] p-3 rounded-lg text-left transition-all border-2 ${
                      isSelected
                        ? 'border-primary-500 bg-primary-100 dark:bg-primary-800/50'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium text-sm ${
                        isSelected
                          ? 'text-primary-800 dark:text-white'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {option.label}
                      </span>
                      {isSelected && <CheckIcon className="w-4 h-4 text-primary-700 dark:text-primary-400" />}
                    </div>
                    <p className={`text-xs ${
                      isSelected
                        ? 'text-primary-700 dark:text-gray-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {TAXONOMY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isExpanded = expandedSection === option.type;
          const selectedIds = getSelectedIds(option.type);
          const available = availableTaxonomies[option.type] || [];

          return (
            <div
              key={option.type}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Header - clickable to expand */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : option.type)}
                className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                      {option.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getSelectedLabel(option.type)}
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {option.description}
                    {option.isMultiSelect && (
                      <span className="text-primary-600 dark:text-primary-400 ml-1">
                        (select multiple)
                      </span>
                    )}
                  </p>

                  {available.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No options available yet
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {available.map((taxonomy) => {
                        const isSelected = selectedIds.includes(taxonomy.id);
                        return (
                          <button
                            key={taxonomy.id}
                            onClick={() =>
                              handleSelect(option.type, taxonomy.id, option.isMultiSelect)
                            }
                            disabled={saving}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {taxonomy.name}
                            {isSelected && <CheckIcon className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {saving && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}
