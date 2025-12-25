import { useState, useEffect } from 'react';
import {
  getUserPersonalization,
  deleteUserTag,
  getPersonalizationSettings,
  updatePersonalizationSettings,
  resetPersonalizationSettings,
  exportPersonalizationData,
  deletePersonalizationData,
  type PersonalizationSettings,
} from '@/services/personalization';
import type { UserTag } from '@/types/models';
import { TaxonomyPreferences } from './TaxonomyPreferences';
import {
  SparklesIcon,
  XMarkIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  HeartIcon,
  AcademicCapIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  BriefcaseIcon,
  BoltIcon,
  ShoppingBagIcon,
  PuzzlePieceIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  LinkIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '@/hooks/useTheme';

// Feature options for "What features are you most excited about?"
const FEATURE_OPTIONS = [
  { key: 'portfolio', label: 'AI Portfolio', description: 'Auto-showcase your work', icon: BriefcaseIcon },
  { key: 'battles', label: 'Prompt Battles', description: 'Compete with AI prompts', icon: BoltIcon },
  { key: 'microlearning', label: 'Explore', description: 'See what others are building', icon: PuzzlePieceIcon },
  { key: 'learning', label: 'Learning Paths', description: 'Structured AI education', icon: AcademicCapIcon },
  { key: 'marketplace', label: 'Marketplace', description: 'Sell courses & projects', icon: ShoppingBagIcon },
  { key: 'challenges', label: 'Games & Challenges', description: 'Weekly games and challenges', icon: CalendarDaysIcon },
  { key: 'investing', label: 'Investing', description: 'Find AI projects', icon: CurrencyDollarIcon },
  { key: 'community', label: 'Community', description: 'Connect with members', icon: UserGroupIcon },
];

// Integration options for portfolio import
const INTEGRATION_OPTIONS = [
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'figma', label: 'Figma' },
  { key: 'url', label: 'Paste any URL' },
];

export function Personalization() {
  const { theme, toggleTheme } = useTheme();
  const [autoTags, setAutoTags] = useState<UserTag[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Personalization settings state
  const [settings, setSettings] = useState<PersonalizationSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Data management state
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Feature interests state (local editing)
  const [localExcitedFeatures, setLocalExcitedFeatures] = useState<string[]>([]);
  const [localDesiredIntegrations, setLocalDesiredIntegrations] = useState<string[]>([]);
  const [localIntegrationsOther, setLocalIntegrationsOther] = useState('');
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [featuresError, setFeaturesError] = useState<string | null>(null);

  useEffect(() => {
    loadPersonalization();
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setSettingsLoading(true);
      setSettingsError(null);
      const data = await getPersonalizationSettings();
      setSettings(data);
      // Sync local feature interest state
      setLocalExcitedFeatures(data.excitedFeatures || []);
      setLocalDesiredIntegrations(data.desiredIntegrations || []);
      setLocalIntegrationsOther(data.desiredIntegrationsOther || '');
    } catch (err: any) {
      console.error('Failed to load personalization settings:', err);
      setSettingsError('Failed to load settings');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleToggleSetting(key: keyof PersonalizationSettings, value: boolean) {
    if (!settings) return;

    const previousSettings = settings;
    // Optimistic update
    setSettings({ ...settings, [key]: value });

    try {
      setSavingSettings(true);
      const updated = await updatePersonalizationSettings({ [key]: value });
      setSettings(updated);
    } catch (err: any) {
      console.error('Failed to update setting:', err);
      setSettings(previousSettings); // Revert on error
      setSettingsError('Failed to save setting');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSliderChange(value: number) {
    if (!settings) return;

    const previousSettings = settings;
    setSettings({ ...settings, discoveryBalance: value });

    try {
      setSavingSettings(true);
      const updated = await updatePersonalizationSettings({ discoveryBalance: value });
      setSettings(updated);
    } catch (err: any) {
      console.error('Failed to update discovery balance:', err);
      setSettings(previousSettings);
      setSettingsError('Failed to save setting');
    } finally {
      setSavingSettings(false);
    }
  }

  // Toggle feature in local state
  function toggleFeature(key: string) {
    const isSelected = localExcitedFeatures.includes(key);
    const newFeatures = isSelected
      ? localExcitedFeatures.filter((f) => f !== key)
      : [...localExcitedFeatures, key];

    // Clear integrations if portfolio is deselected
    if (key === 'portfolio' && isSelected) {
      setLocalDesiredIntegrations([]);
      setLocalIntegrationsOther('');
    }

    setLocalExcitedFeatures(newFeatures);
  }

  // Toggle integration in local state
  function toggleIntegration(key: string) {
    const isSelected = localDesiredIntegrations.includes(key);
    setLocalDesiredIntegrations(
      isSelected
        ? localDesiredIntegrations.filter((i) => i !== key)
        : [...localDesiredIntegrations, key]
    );
  }

  // Check if there are unsaved feature changes
  function hasFeatureChanges() {
    if (!settings) return false;
    const featuresChanged = JSON.stringify(localExcitedFeatures.sort()) !== JSON.stringify([...(settings.excitedFeatures || [])].sort());
    const integrationsChanged = JSON.stringify(localDesiredIntegrations.sort()) !== JSON.stringify([...(settings.desiredIntegrations || [])].sort());
    const otherChanged = localIntegrationsOther !== (settings.desiredIntegrationsOther || '');
    return featuresChanged || integrationsChanged || otherChanged;
  }

  // Save feature interests
  async function handleSaveFeatureInterests() {
    try {
      setIsSavingFeatures(true);
      setFeaturesError(null);
      const updated = await updatePersonalizationSettings({
        excitedFeatures: localExcitedFeatures,
        desiredIntegrations: localDesiredIntegrations,
        desiredIntegrationsOther: localIntegrationsOther,
      });
      setSettings(updated);
      // Sync local state with saved values
      setLocalExcitedFeatures(updated.excitedFeatures || []);
      setLocalDesiredIntegrations(updated.desiredIntegrations || []);
      setLocalIntegrationsOther(updated.desiredIntegrationsOther || '');
    } catch (err: any) {
      console.error('Failed to save feature interests:', err);
      setFeaturesError('Failed to save feature interests');
    } finally {
      setIsSavingFeatures(false);
    }
  }

  async function handleResetSettings() {
    try {
      setSavingSettings(true);
      setSettingsError(null);
      const result = await resetPersonalizationSettings();
      setSettings(result.settings);
    } catch (err: any) {
      console.error('Failed to reset settings:', err);
      setSettingsError('Failed to reset settings');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleExportData() {
    try {
      setIsExporting(true);
      setDataError(null);
      const data = await exportPersonalizationData();

      // Create and download JSON file
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `personalization-data-${new Date().toISOString().split('T')[0]}.json`;

      // Create and configure download link
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);

      // Trigger download
      a.click();

      // Clean up after a short delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err: unknown) {
      const error = err as { message?: string; response?: { data?: { detail?: string } } };
      console.error('Failed to export data:', err);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to export your data. Please try again.';
      setDataError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteData() {
    try {
      setIsDeleting(true);
      setDataError(null);
      await deletePersonalizationData();

      // Clear local state
      setAutoTags([]);
      setSettings(null);
      setShowDeleteConfirm(false);

      // Reload settings (will create fresh defaults)
      await loadSettings();
    } catch (err: any) {
      console.error('Failed to delete data:', err);
      setDataError('Failed to delete your data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRemoveAutoTag(tagId: number) {
    try {
      await deleteUserTag(tagId);
      setAutoTags(prev => prev.filter(t => t.id !== tagId));
    } catch (err: any) {
      console.error('Failed to remove tag:', err);
      setError(err?.error || 'Failed to remove tag');
    }
  }

  async function loadPersonalization() {
    try {
      setError(null);
      const data = await getUserPersonalization();
      setAutoTags(data.autoGeneratedTags || []);
    } catch (err: any) {
      console.error('Failed to load personalization:', err);
      setAutoTags([]);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
          Personalization
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Customize your experience. Tell us about yourself and we'll show you more relevant content.
        </p>
      </div>

      {error && (
        <div className="glass-subtle rounded-xl p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Section 1-3: Your Profile, Interests, How You Learn (from TaxonomyPreferences) */}
      <TaxonomyPreferences />

      {/* Feature Interests */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              Feature Interests
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Tell us which features you're most excited about so we can prioritize your experience.
            </p>
          </div>
          <button
            onClick={handleSaveFeatureInterests}
            disabled={isSavingFeatures || !hasFeatureChanges()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
          >
            {isSavingFeatures ? (
              <>
                <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>

        {featuresError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{featuresError}</p>
          </div>
        )}

        {settingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Feature Cards - 2 column grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURE_OPTIONS.map((feature) => {
                const isSelected = localExcitedFeatures.includes(feature.key);
                const Icon = feature.icon;

                return (
                  <button
                    key={feature.key}
                    onClick={() => toggleFeature(feature.key)}
                    className={`text-left p-3 sm:p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                            {feature.label}
                          </h4>
                          {isSelected && (
                            <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Integration preferences - shown when AI Portfolio is selected */}
            {localExcitedFeatures.includes('portfolio') && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Where should we import your portfolio from?
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Select all that apply. We'll prioritize building these integrations.
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTEGRATION_OPTIONS.map((integration) => {
                    const isSelected = localDesiredIntegrations.includes(integration.key);
                    return (
                      <button
                        key={integration.key}
                        onClick={() => toggleIntegration(integration.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {integration.label}
                      </button>
                    );
                  })}
                </div>

                {/* Other integration text input */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Other integration you'd like to see:
                  </label>
                  <input
                    type="text"
                    value={localIntegrationsOther}
                    onChange={(e) => setLocalIntegrationsOther(e.target.value)}
                    placeholder="e.g., Behance, Dribbble, Notion..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Summary of selections */}
            {localExcitedFeatures.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  You've selected {localExcitedFeatures.length} feature{localExcitedFeatures.length !== 1 ? 's' : ''}.
                  {hasFeatureChanges() && (
                    <span className="text-primary-600 dark:text-primary-400 ml-1">
                      Click Save to update your preferences.
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {theme === 'dark' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            Appearance
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose how All Thrive looks to you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <SunIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">Light</h4>
                  {theme === 'light' && (
                    <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Bright and clear
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => theme === 'light' && toggleTheme()}
            className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <MoonIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">Dark</h4>
                  {theme === 'dark' && (
                    <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Easy on the eyes
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Recommendation Controls */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              Recommendation Settings
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fine-tune what influences your personalized recommendations.
            </p>
          </div>
          <button
            onClick={handleResetSettings}
            disabled={settingsSaving || settingsLoading}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>

        {settingsError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{settingsError}</p>
          </div>
        )}

        {settingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : settings ? (
          <div className="space-y-6">
            {/* Recommendation Signals */}
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                What should influence your recommendations?
              </h4>
              <div className="space-y-2 sm:space-y-3">
                {/* Detected preferences toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <TagIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Detected Preferences</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Use tools detected from your projects</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('useTopicSelections', !settings.useTopicSelections)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.useTopicSelections
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.useTopicSelections ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Learn from views toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Views & Engagement</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Learn from projects you view</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('learnFromViews', !settings.learnFromViews)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.learnFromViews
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.learnFromViews ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Learn from likes toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <HeartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Likes & Bookmarks</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Learn from projects you like or save</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('learnFromLikes', !settings.learnFromLikes)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.learnFromLikes
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.learnFromLikes ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Skill level toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <AcademicCapIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Skill Level</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Use your skill level from Your Profile above</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('considerSkillLevel', !settings.considerSkillLevel)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.considerSkillLevel
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.considerSkillLevel ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Social signals toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <UserGroupIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Social Context</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Consider what people you follow like</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('useSocialSignals', !settings.useSocialSignals)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.useSocialSignals
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.useSocialSignals ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Discovery Balance Slider */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                Discovery vs Familiar
              </h4>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                  <span>More of what I like</span>
                  <span>Surprise me more</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.discoveryBalance}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  disabled={settingsSaving}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                    {settings.discoveryBalance < 33
                      ? 'Mostly familiar content'
                      : settings.discoveryBalance > 66
                        ? 'Lots of new discoveries'
                        : 'Balanced mix'}
                  </span>
                </div>
              </div>
            </div>

            {/* Privacy Controls */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4" />
                Privacy Controls
              </h4>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                Control what behavioral data we collect to improve recommendations.
              </p>
              <div className="space-y-2 sm:space-y-3">
                {/* Time tracking toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Time Tracking</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Track how long you view content</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('allowTimeTracking', !settings.allowTimeTracking)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.allowTimeTracking
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.allowTimeTracking ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Scroll tracking toggle */}
                <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Scroll Tracking</p>
                      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">Track scroll depth on content</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('allowScrollTracking', !settings.allowScrollTracking)}
                    disabled={settingsSaving}
                    className={`relative w-11 sm:w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      settings.allowScrollTracking
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-700 ring-1 ring-inset ring-gray-400 dark:ring-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.allowScrollTracking ? 'translate-x-5 sm:translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Your Personalization Summary - combines auto-detected preferences */}
      {autoTags.length > 0 ? (
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              What We've Learned About You
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Based on your projects and activity, we've detected these preferences.
            The more you mention a tool, the higher its confidence score.
          </p>

          {/* Group by category */}
          {(() => {
            const toolTags = autoTags.filter(tag => tag.taxonomyCategory === 'tool');
            const otherTags = autoTags.filter(tag => tag.taxonomyCategory !== 'tool');

            return (
              <div className="space-y-6">
                {/* Tools Section */}
                {toolTags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      AI Tools You Use
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {toolTags.map((tag) => {
                        // Calculate confidence percentage
                        const confidencePercent = Math.round((tag.confidenceScore || 0) * 100);

                        return (
                          <div
                            key={tag.id}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 text-gray-900 dark:text-white rounded-lg text-sm border border-primary-200 dark:border-primary-800"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tag.name}</span>
                              <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold">
                                {confidencePercent}%
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {tag.interactionCount} {tag.interactionCount === 1 ? 'mention' : 'mentions'}
                            </span>
                            <button
                              onClick={() => handleRemoveAutoTag(tag.id)}
                              className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              aria-label={`Remove ${tag.name}`}
                              title="Remove this preference"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
                      These tools are used to personalize your "For You" feed on the Explore page.
                    </p>
                  </div>
                )}

                {/* Other Auto Tags */}
                {otherTags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Other Detected Preferences
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {otherTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-full text-sm border border-gray-200 dark:border-gray-700"
                        >
                          <span>{tag.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({tag.interactionCount})
                          </span>
                          <button
                            onClick={() => handleRemoveAutoTag(tag.id)}
                            className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            aria-label={`Remove ${tag.name}`}
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* View Feed CTA */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href="/explore?tab=for-you"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <SparklesIcon className="w-4 h-4" />
              View Your Personalized Feed
            </a>
          </div>
        </div>
      ) : (
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Your Personalization Summary
            </h3>
          </div>
          <div className="text-center py-6">
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              We haven't detected any preferences yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create projects and mention tools like "ChatGPT", "Claude", or "Midjourney" in your descriptions,
              and we'll automatically learn your preferences to personalize your feed.
            </p>
          </div>
        </div>
      )}

      {/* Your Data Section */}
      <div className="glass-subtle rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            Your Data
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          You have full control over your personalization data. Export a copy or delete it at any time.
        </p>

        {dataError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">{dataError}</p>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {/* Export Data */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-start gap-2 sm:gap-3">
              <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Export Your Data</p>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Download all your personalization data including settings, topics, and detected preferences as a JSON file.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 w-full sm:w-auto flex-shrink-0"
            >
              {isExporting ? (
                <>
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Export
                </>
              )}
            </button>
          </div>

          {/* Delete Data */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2 sm:gap-3">
              <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Delete Personalization Data</p>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Permanently delete all your topics, detected preferences, interaction history, and settings.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 w-full sm:w-auto flex-shrink-0"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-start sm:items-center gap-3 mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Delete All Personalization Data?
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                This will permanently delete:
              </p>
              <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 space-y-1 ml-4">
                <li>• All your selected topics and interests</li>
                <li>• All auto-detected preferences</li>
                <li>• Your interaction history</li>
                <li>• Your recommendation settings</li>
              </ul>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                Your "For You" feed will be reset. This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={isDeleting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="w-4 h-4" />
                      Delete Everything
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
