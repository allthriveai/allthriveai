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
  MagnifyingGlassIcon,
  XMarkIcon,
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

// Grouped taxonomy options for better organization
const PROFILE_OPTIONS: TaxonomyOption[] = [
  {
    type: 'personality',
    label: 'Personality Type',
    description: 'Your MBTI personality type helps us understand how you learn best',
    icon: UserIcon,
    isMultiSelect: false,
  },
  {
    type: 'role',
    label: 'Roles',
    description: 'What roles describe you best?',
    icon: BriefcaseIcon,
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

const INTEREST_OPTIONS: TaxonomyOption[] = [
  {
    type: 'interest',
    label: 'Interests',
    description: 'What AI topics interest you most?',
    icon: SparklesIcon,
    isMultiSelect: true,
  },
  {
    type: 'goal',
    label: 'Goals',
    description: 'What are you trying to achieve with AI?',
    icon: RocketLaunchIcon,
    isMultiSelect: true,
  },
];

const LEARNING_OPTIONS: TaxonomyOption[] = [
  {
    type: 'learning_style',
    label: 'Learning Styles',
    description: 'How do you prefer to learn new things?',
    icon: BookOpenIcon,
    isMultiSelect: true,
  },
];

// Combined for data loading
const TAXONOMY_OPTIONS: TaxonomyOption[] = [
  ...PROFILE_OPTIONS,
  ...INTEREST_OPTIONS,
  ...LEARNING_OPTIONS,
];

export function TaxonomyPreferences() {
  const [preferences, setPreferences] = useState<TaxonomyPreferencesType | null>(null);
  const [availableTaxonomies, setAvailableTaxonomies] = useState<Record<string, Taxonomy[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

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

  // Helper function to render a taxonomy option accordion
  const renderTaxonomyOption = (option: TaxonomyOption) => {
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
              <>
                {/* Search filter - show when there are 10+ options */}
                {available.length >= 10 && (
                  <div className="relative mb-3">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${option.label.toLowerCase()}...`}
                      value={searchQueries[option.type] || ''}
                      onChange={(e) =>
                        setSearchQueries((prev) => ({
                          ...prev,
                          [option.type]: e.target.value,
                        }))
                      }
                      className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {searchQueries[option.type] && (
                      <button
                        onClick={() =>
                          setSearchQueries((prev) => ({
                            ...prev,
                            [option.type]: '',
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <XMarkIcon className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                )}

                {/* Taxonomy options - scrollable container */}
                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-2 -m-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                  {available
                    .filter((taxonomy) => {
                      const query = searchQueries[option.type]?.toLowerCase() || '';
                      if (!query) return true;
                      return taxonomy.name.toLowerCase().includes(query);
                    })
                    .map((taxonomy) => {
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

                {/* No results message */}
                {searchQueries[option.type] &&
                  available.filter((t) =>
                    t.name.toLowerCase().includes(searchQueries[option.type]?.toLowerCase() || '')
                  ).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-2">
                      No matches found
                    </p>
                  )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Section 1: Your Profile */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Your Profile
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tell us about yourself so we can personalize your experience.
          </p>
        </div>

        <div className="space-y-3">
          {/* Skill Level - Always visible */}
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

          {/* Profile options: Personality, Roles, Industries */}
          {PROFILE_OPTIONS.map(renderTaxonomyOption)}
        </div>
      </div>

      {/* Section 2: Your Interests */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5" />
            Your Interests
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            What are you interested in? This helps us show you relevant content.
          </p>
        </div>

        <div className="space-y-3">
          {INTEREST_OPTIONS.map(renderTaxonomyOption)}
        </div>
      </div>

      {/* Section 3: How You Learn */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5" />
            How You Learn
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Understanding your learning style helps us recommend the right content format.
          </p>
        </div>

        <div className="space-y-3">
          {LEARNING_OPTIONS.map(renderTaxonomyOption)}
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}
