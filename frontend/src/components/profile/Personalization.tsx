import { useState, useEffect } from 'react';
import {
  getUserPersonalization,
  bulkCreateTags,
  deleteUserTag,
  getPersonalizationSettings,
  updatePersonalizationSettings,
  resetPersonalizationSettings,
  exportPersonalizationData,
  deletePersonalizationData,
  type PersonalizationSettings,
} from '@/services/personalization';
import type { Taxonomy, UserTag } from '@/types/models';
import {
  SparklesIcon,
  TagIcon,
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
} from '@heroicons/react/24/outline';
import { useTheme } from '@/hooks/useTheme';

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
  lime: 'bg-lime-500',
  violet: 'bg-violet-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  slate: 'bg-slate-500',
  fuchsia: 'bg-fuchsia-500',
};

export function Personalization() {
  const { theme, toggleTheme } = useTheme();
  const [manualTags, setManualTags] = useState<UserTag[]>([]);
  const [autoTags, setAutoTags] = useState<UserTag[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Taxonomy[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(new Set());
  const [isSavingTopics, setIsSavingTopics] = useState(false);
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
    setSettings({ ...settings, discovery_balance: value });

    try {
      setSavingSettings(true);
      const updated = await updatePersonalizationSettings({ discovery_balance: value });
      setSettings(updated);
    } catch (err: any) {
      console.error('Failed to update discovery balance:', err);
      setSettings(previousSettings);
      setSettingsError('Failed to save setting');
    } finally {
      setSavingSettings(false);
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
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personalization-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export data:', err);
      setDataError('Failed to export your data. Please try again.');
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
      setManualTags([]);
      setAutoTags([]);
      setSelectedTopicIds(new Set());
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

  async function handleSaveTopics() {
    try {
      setIsSavingTopics(true);
      setError(null);

      // Find which topics to add (newly selected)
      const existingIds = new Set(
        manualTags.filter(tag => tag.taxonomy?.taxonomyType === 'topic').map(tag => tag.taxonomy!.id)
      );
      const toAdd = Array.from(selectedTopicIds).filter(id => !existingIds.has(id));

      // Find which tags to remove (unselected topics)
      const toRemove = manualTags.filter(
        tag => tag.taxonomy?.taxonomyType === 'topic' && !selectedTopicIds.has(tag.taxonomy.id)
      );

      // Add new topic tags
      if (toAdd.length > 0) {
        const newTags = await bulkCreateTags(toAdd);
        setManualTags(prev => [...prev, ...newTags]);
      }

      // Remove unselected topic tags
      for (const tag of toRemove) {
        await deleteUserTag(tag.id);
        setManualTags(prev => prev.filter(t => t.id !== tag.id));
      }
    } catch (err: any) {
      console.error('Failed to save topics:', err);
      setError(err?.error || 'Failed to save topics');
    } finally {
      setIsSavingTopics(false);
    }
  }

  function toggleTopic(topicId: number) {
    setSelectedTopicIds(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }


  async function loadPersonalization() {
    try {
      setError(null);
      const data = await getUserPersonalization();
      setManualTags(data.manual_tags || []);
      setAutoTags(data.auto_generated_tags || []);
      setAvailableTopics(data.available_topics || []);

      // Pre-select existing topics
      const existingTopicIds = new Set(
        (data.selected_topics || []).map((topic: Taxonomy) => topic.id)
      );
      setSelectedTopicIds(existingTopicIds);
    } catch (err: any) {
      console.error('Failed to load personalization:', err);
      // Don't block the page for personalization errors - just show warning
      console.warn('Personalization data unavailable, continuing with topics only');
      setAutoTags([]);
      setManualTags([]);
      setAvailableTopics([]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Personalization
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Select your interests and preferences to personalize your experience.
          We also automatically generate tags based on your activity.
        </p>
      </div>

      {error && (
        <div className="glass-subtle rounded-xl p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Theme Preference */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          {theme === 'dark' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          Appearance
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose how All Thrive looks to you. Your preference will be saved automatically.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <SunIcon className="w-6 h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Light</h4>
                  {theme === 'light' && (
                    <CheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
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
            className={`p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <MoonIcon className="w-6 h-6 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Dark</h4>
                  {theme === 'dark' && (
                    <CheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
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
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              Recommendation Controls
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fine-tune what influences your personalized recommendations.
            </p>
          </div>
          <button
            onClick={handleResetSettings}
            disabled={settingsSaving || settingsLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
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
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                What should influence your recommendations?
              </h4>
              <div className="space-y-3">
                {/* Topic selections toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <TagIcon className="w-5 h-5 text-primary-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Topic Selections</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Use your selected topics above</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('use_topic_selections', !settings.use_topic_selections)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.use_topic_selections
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.use_topic_selections ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Learn from views toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <EyeIcon className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Views & Engagement</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Learn from projects you view</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('learn_from_views', !settings.learn_from_views)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.learn_from_views
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.learn_from_views ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Learn from likes toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <HeartIcon className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Likes & Bookmarks</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Learn from projects you like or save</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('learn_from_likes', !settings.learn_from_likes)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.learn_from_likes
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.learn_from_likes ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Skill level toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AcademicCapIcon className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Skill Level</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Match content to your experience level</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('consider_skill_level', !settings.consider_skill_level)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.consider_skill_level
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.consider_skill_level ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Social signals toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserGroupIcon className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Social Context</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Consider what people you follow like</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('use_social_signals', !settings.use_social_signals)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.use_social_signals
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.use_social_signals ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Discovery Balance Slider */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Discovery vs Familiar
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>More of what I like</span>
                  <span>Surprise me more</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.discovery_balance}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  disabled={settingsSaving}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {settings.discovery_balance < 33
                      ? 'Mostly familiar content'
                      : settings.discovery_balance > 66
                        ? 'Lots of new discoveries'
                        : 'Balanced mix'}
                  </span>
                </div>
              </div>
            </div>

            {/* Privacy Controls */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4" />
                Privacy Controls
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Control what behavioral data we collect to improve recommendations.
              </p>
              <div className="space-y-3">
                {/* Time tracking toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Time Tracking</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Track how long you view content</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('allow_time_tracking', !settings.allow_time_tracking)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.allow_time_tracking
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.allow_time_tracking ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Scroll tracking toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <EyeIcon className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Scroll Tracking</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Track scroll depth on content</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleSetting('allow_scroll_tracking', !settings.allow_scroll_tracking)}
                    disabled={settingsSaving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.allow_scroll_tracking
                        ? 'bg-primary-500'
                        : 'bg-gray-300 dark:bg-gray-500 ring-1 ring-inset ring-gray-400 dark:ring-gray-400'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.allow_scroll_tracking ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Topics Section */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TagIcon className="w-5 h-5" />
              Topics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select topics you're interested in to personalize your Explore feed.
            </p>
          </div>
          <button
            onClick={handleSaveTopics}
            disabled={isSavingTopics}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isSavingTopics ? (
              <>
                <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save Topics
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
          {availableTopics.map((topic) => {
            const isSelected = selectedTopicIds.has(topic.id);
            const colorClass: string = topic.color ? (COLOR_CLASSES as Record<string, string>)[topic.color] || 'bg-gray-500' : 'bg-gray-500';

            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-full mt-0.5 flex-shrink-0 ${colorClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {topic.name}
                      </h4>
                      {isSelected && (
                        <CheckIcon className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {topic.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedTopicIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You've selected {selectedTopicIds.size} topic{selectedTopicIds.size !== 1 ? 's' : ''}.
              These will be used to personalize your Explore feed.
            </p>
          </div>
        )}
      </div>


      {/* How We're Personalizing For You */}
      {(() => {
        const toolTags = autoTags.filter(tag => tag.taxonomy?.taxonomyType === 'tool');
        const hasPreferences = toolTags.length > 0 || selectedTopicIds.size > 0;

        if (!hasPreferences) {
          return (
            <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-6 h-6 text-gray-400" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  How We're Personalizing For You
                </h3>
              </div>
              <div className="text-center py-6">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Select some topics above and create projects to personalize your Explore feed!
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  We'll show you more projects matching your selected topics and the tools you use.
                </p>
              </div>
            </div>
          );
        }

        // Get topic labels
        const selectedTopicLabels = Array.from(selectedTopicIds)
          .map(id => availableTopics.find(t => t.id === id)?.name)
          .filter(Boolean);

        // Build personalized message
        const toolNames = toolTags.map(t => t.name);
        const toolList = toolNames.length === 1
          ? toolNames[0]
          : toolNames.length === 2
          ? `${toolNames[0]} and ${toolNames[1]}`
          : `${toolNames.slice(0, -1).join(', ')}, and ${toolNames[toolNames.length - 1]}`;

        const topicList = selectedTopicLabels.length === 1
          ? selectedTopicLabels[0]
          : selectedTopicLabels.length === 2
          ? `${selectedTopicLabels[0]} and ${selectedTopicLabels[1]}`
          : selectedTopicLabels.length > 2
          ? `${selectedTopicLabels.slice(0, -1).join(', ')}, and ${selectedTopicLabels[selectedTopicLabels.length - 1]}`
          : null;

        return (
          <div className="glass-subtle rounded-xl p-6 border border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
            <div className="flex items-center gap-2 mb-4">
              <SparklesIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                How We're Personalizing For You
              </h3>
            </div>

            <div className="space-y-4">
              {/* Topics */}
              {selectedTopicIds.size > 0 && (
                <div className="p-4 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-primary-200 dark:border-primary-700">
                  <p className="text-lg text-gray-900 dark:text-white mb-1">
                    You're interested in <span className="font-bold text-primary-700 dark:text-primary-300">{topicList}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ({selectedTopicIds.size} {selectedTopicIds.size === 1 ? 'topic' : 'topics'} selected)
                  </p>
                </div>
              )}

              {/* Tools */}
              {toolTags.length > 0 && (
                <div className="p-4 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-primary-200 dark:border-primary-700">
                  <p className="text-lg text-gray-900 dark:text-white mb-1">
                    We noticed you uploaded projects with <span className="font-bold text-primary-700 dark:text-primary-300">{toolList}</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ({toolTags.reduce((sum, t) => sum + (t.interactionCount || 0), 0)} {toolTags.reduce((sum, t) => sum + (t.interactionCount || 0), 0) === 1 ? 'mention' : 'mentions'} across your projects)
                  </p>
                </div>
              )}

              <div className="grid gap-3">
                {(selectedTopicIds.size > 0 || toolTags.length > 0) && (
                  <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        So we're showing you more projects about{' '}
                        {selectedTopicIds.size > 0 && toolTags.length > 0 ? (
                          <>
                            <span className="font-semibold">{topicList}</span> using <span className="font-semibold">{toolList}</span>
                          </>
                        ) : selectedTopicIds.size > 0 ? (
                          <span className="font-semibold">{topicList}</span>
                        ) : (
                          <>
                            <span className="font-semibold">{toolList}</span>
                          </>
                        )}{' '}
                        in your "For You" feed
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    ↑
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedTopicIds.size > 0 && toolTags.length > 0 ? (
                        'Select more topics and keep creating projects to improve your personalized feed'
                      ) : selectedTopicIds.size > 0 ? (
                        'Create projects and mention tools you use to get even better recommendations'
                      ) : (
                        'Select topics above and keep creating projects to get even better recommendations'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-primary-200 dark:border-primary-800">
                <a
                  href="/explore?tab=for-you"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
                >
                  <SparklesIcon className="w-5 h-5" />
                  View Your Personalized Feed
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Auto-detected Preferences */}
      {autoTags.length > 0 && (
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
        </div>
      )}

      {/* No preferences yet */}
      {autoTags.length === 0 && (
        <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Auto-Detected Preferences Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your first project to start building your personalized experience!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mention tools like "ChatGPT", "Claude", or "Midjourney" in your project descriptions,
              and we'll automatically detect your preferences.
            </p>
          </div>
        </div>
      )}

      {/* Your Data Section */}
      <div className="glass-subtle rounded-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Your Data
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          You have full control over your personalization data. Export a copy or delete it at any time.
        </p>

        {dataError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{dataError}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Export Data */}
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-start gap-3">
              <ArrowDownTrayIcon className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Export Your Data</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Download all your personalization data including settings, topics, and detected preferences as a JSON file.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
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
          <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <TrashIcon className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Delete Personalization Data</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Permanently delete all your topics, detected preferences, interaction history, and settings.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  Delete All Personalization Data?
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will permanently delete:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1 ml-4">
                <li>• All your selected topics and interests</li>
                <li>• All auto-detected preferences</li>
                <li>• Your interaction history</li>
                <li>• Your recommendation settings</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Your "For You" feed will be reset. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
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
