import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile, deactivateAccount, deleteAccount } from '@/services/auth';
import {
  getPersonalizationSettings,
  updatePersonalizationSettings,
  resetPersonalizationSettings,
  exportPersonalizationData,
  deletePersonalizationData,
  type PersonalizationSettings,
} from '@/services/personalization';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faUserSlash, faTrash, faSpinner, faDownload, faShieldHalved, faRotateLeft, faTrophy, faUsers } from '@fortawesome/free-solid-svg-icons';
import { getErrorMessage } from '@/utils/errors';

export default function PrivacySettingsPage() {
  const { user, refreshUser, logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const [playgroundIsPublic, setPlaygroundIsPublic] = useState(user?.playgroundIsPublic ?? true);
  const [isProfilePublic, setIsProfilePublic] = useState(user?.isProfilePublic ?? true);
  const [allowLlmTraining, setAllowLlmTraining] = useState(user?.allowLlmTraining ?? false);
  const [gamificationIsPublic, setGamificationIsPublic] = useState(user?.gamificationIsPublic ?? true);
  const [allowSimilarityMatching, setAllowSimilarityMatching] = useState(user?.allowSimilarityMatching ?? true);
  const [saving, setSaving] = useState(false);
  const [resettingSettings, setResettingSettings] = useState(false);

  // Personalization settings
  const [personalizationSettings, setPersonalizationSettings] = useState<PersonalizationSettings | null>(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(true);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);

  // Data management
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [dataActionError, setDataActionError] = useState<string | null>(null);

  // Account action modals
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPlaygroundIsPublic(user.playgroundIsPublic ?? true);
      setIsProfilePublic(user.isProfilePublic ?? true);
      setAllowLlmTraining(user.allowLlmTraining ?? false);
      setGamificationIsPublic(user.gamificationIsPublic ?? true);
      setAllowSimilarityMatching(user.allowSimilarityMatching ?? true);
    }
  }, [user]);

  // Fetch personalization settings
  useEffect(() => {
    async function fetchPersonalizationSettings() {
      try {
        const settings = await getPersonalizationSettings();
        setPersonalizationSettings(settings);
      } catch (error) {
        console.error('Failed to fetch personalization settings:', error);
      } finally {
        setPersonalizationLoading(false);
      }
    }
    fetchPersonalizationSettings();
  }, []);

  const handleTogglePlayground = async (value: boolean) => {
    try {
      setSaving(true);
      setPlaygroundIsPublic(value);
      await updateProfile({ playgroundIsPublic: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update privacy setting:', error);
      // Revert on error
      setPlaygroundIsPublic(!value);
      alert('Failed to update privacy setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProfilePublic = async (value: boolean) => {
    try {
      setSaving(true);
      setIsProfilePublic(value);
      await updateProfile({ isProfilePublic: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update profile visibility:', error);
      // Revert on error
      setIsProfilePublic(!value);
      alert('Failed to update profile visibility. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLlmTraining = async (value: boolean) => {
    try {
      setSaving(true);
      setAllowLlmTraining(value);
      await updateProfile({ allowLlmTraining: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update LLM training setting:', error);
      // Revert on error
      setAllowLlmTraining(!value);
      alert('Failed to update LLM training setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGamificationPublic = async (value: boolean) => {
    try {
      setSaving(true);
      setGamificationIsPublic(value);
      await updateProfile({ gamificationIsPublic: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update gamification visibility:', error);
      // Revert on error
      setGamificationIsPublic(!value);
      alert('Failed to update gamification visibility. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSimilarityMatching = async (value: boolean) => {
    try {
      setSaving(true);
      setAllowSimilarityMatching(value);
      await updateProfile({ allowSimilarityMatching: value });
      await refreshUser();
    } catch (error) {
      console.error('Failed to update similarity matching setting:', error);
      // Revert on error
      setAllowSimilarityMatching(!value);
      alert('Failed to update similarity matching setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle personalization setting toggle
  const handlePersonalizationToggle = async (
    key: keyof PersonalizationSettings,
    value: boolean
  ) => {
    if (!personalizationSettings) return;

    const previousValue = personalizationSettings[key];
    try {
      setPersonalizationSaving(true);
      setPersonalizationSettings({ ...personalizationSettings, [key]: value });
      await updatePersonalizationSettings({ [key]: value });
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      // Revert on error
      setPersonalizationSettings({ ...personalizationSettings, [key]: previousValue });
      alert('Failed to update setting. Please try again.');
    } finally {
      setPersonalizationSaving(false);
    }
  };

  // Reset personalization settings to defaults
  const handleResetSettings = async () => {
    try {
      setResettingSettings(true);
      setDataActionError(null);
      const result = await resetPersonalizationSettings();
      setPersonalizationSettings(result.settings);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setDataActionError('Failed to reset settings. Please try again.');
    } finally {
      setResettingSettings(false);
    }
  };

  // Export personalization data
  const handleExportData = async () => {
    try {
      setExportingData(true);
      setDataActionError(null);
      const data = await exportPersonalizationData();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `allthrive-personalization-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      setDataActionError('Failed to export data. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  // Delete personalization data
  const handleDeletePersonalizationData = async () => {
    try {
      setDeletingData(true);
      setDataActionError(null);
      await deletePersonalizationData();

      // Reset local state
      setPersonalizationSettings({
        useTopicSelections: true,
        learnFromViews: true,
        learnFromLikes: true,
        considerSkillLevel: true,
        factorContentDifficulty: true,
        useSocialSignals: true,
        discoveryBalance: 50,
        allowTimeTracking: true,
        allowScrollTracking: true,
        excitedFeatures: [],
        desiredIntegrations: [],
        desiredIntegrationsOther: '',
        createdAt: '',
        updatedAt: '',
      });

      setShowDeleteDataModal(false);
      alert('Personalization data has been deleted successfully.');
    } catch (error) {
      console.error('Failed to delete personalization data:', error);
      setDataActionError('Failed to delete data. Please try again.');
    } finally {
      setDeletingData(false);
    }
  };

  const handleDeactivateAccount = async () => {
    try {
      setAccountActionLoading(true);
      setAccountActionError(null);
      const result = await deactivateAccount();

      if (result.success) {
        // Log out user after deactivation
        await authLogout();
        navigate('/auth', {
          state: {
            message: 'Your account has been deactivated. Contact support to reactivate.'
          }
        });
      }
    } catch (error) {
      console.error('Failed to deactivate account:', getErrorMessage(error));
      setAccountActionError(getErrorMessage(error) || 'Failed to deactivate account. Please try again.');
    } finally {
      setAccountActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      setAccountActionError('Please type "DELETE MY ACCOUNT" to confirm.');
      return;
    }

    try {
      setAccountActionLoading(true);
      setAccountActionError(null);
      const result = await deleteAccount(deleteConfirmation);

      if (result.success) {
        // Log out user after deletion
        await authLogout();
        navigate('/auth', {
          state: {
            message: 'Your account has been permanently deleted.'
          }
        });
      }
    } catch (error) {
      console.error('Failed to delete account:', getErrorMessage(error));
      setAccountActionError(getErrorMessage(error) || 'Failed to delete account. Please try again.');
    } finally {
      setAccountActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Privacy & Security
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Control who can see your content and activities
              </p>
            </div>

            {/* Profile Visibility Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Profile Visibility
              </h2>

              <div className="space-y-4">
                {/* Profile Public Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                        Public Profile
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Allow your profile to appear in search engines and sitemaps. Disable for complete privacy.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isProfilePublic}
                        onChange={(e) => handleToggleProfilePublic(e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                {/* Playground Public Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                        Public Playground
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Allow others to view your Playground projects. Disable to make it private.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={playgroundIsPublic}
                        onChange={(e) => handleTogglePlayground(e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                {/* Gamification Public Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <FontAwesomeIcon icon={faTrophy} className="text-amber-500" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">
                          Public Achievements
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Display your achievements, level, and Thrive Circle tier on your public profile.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gamificationIsPublic}
                        onChange={(e) => handleToggleGamificationPublic(e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* AI & LLM Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                AI & Machine Learning
              </h2>

              <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      Allow AI Model Training
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      Allow AI models like ChatGPT and Claude to use your public profile and projects for training.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      When disabled, AI crawlers (GPTBot, ClaudeBot, etc.) will be blocked from indexing your content. Traditional search engines (Google, Bing) are unaffected.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowLlmTraining}
                      onChange={(e) => handleToggleLlmTraining(e.target.checked)}
                      disabled={saving}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Personalization & Recommendations Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <FontAwesomeIcon icon={faShieldHalved} className="text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Personalization & Recommendations
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Control how AllThrive learns from your activity to personalize recommendations. These settings also affect what Ember knows about you.
              </p>

              {personalizationLoading ? (
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-primary-600 mr-2" />
                    <span className="text-slate-600 dark:text-slate-400">Loading settings...</span>
                  </div>
                </div>
              ) : personalizationSettings ? (
                <div className="space-y-4">
                  {/* Learning Signals */}
                  <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Learning Signals</h3>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Use my topic selections</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Use your manually selected interests for recommendations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.useTopicSelections} onChange={(e) => handlePersonalizationToggle('useTopicSelections', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Learn from my views</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Improve recommendations based on projects you view</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.learnFromViews} onChange={(e) => handlePersonalizationToggle('learnFromViews', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Learn from my likes</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Improve recommendations based on projects you like</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.learnFromLikes} onChange={(e) => handlePersonalizationToggle('learnFromLikes', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Use social signals</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Consider who you follow and engage with for recommendations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.useSocialSignals} onChange={(e) => handlePersonalizationToggle('useSocialSignals', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Skill & Difficulty */}
                  <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Skill Level Matching</h3>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Match to my skill level</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Recommend content appropriate for your experience level</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.considerSkillLevel} onChange={(e) => handlePersonalizationToggle('considerSkillLevel', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Consider content difficulty</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Factor in how challenging content is when making recommendations</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.factorContentDifficulty} onChange={(e) => handlePersonalizationToggle('factorContentDifficulty', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Tracking Controls */}
                  <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4">Engagement Tracking</h3>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Track time on pages</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Use time spent on content to understand your interests better</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.allowTimeTracking} onChange={(e) => handlePersonalizationToggle('allowTimeTracking', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Track scroll depth</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Use how far you scroll to understand engagement</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={personalizationSettings.allowScrollTracking} onChange={(e) => handlePersonalizationToggle('allowScrollTracking', e.target.checked)} disabled={personalizationSaving} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Collaborative Filtering */}
                  <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <FontAwesomeIcon icon={faUsers} className="text-primary-600 dark:text-primary-400" />
                      <h3 className="font-medium text-slate-900 dark:text-slate-100">Collaborative Filtering</h3>
                    </div>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Allow similarity matching</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          Enable recommendations based on users with similar interests. When enabled, your anonymous activity patterns help improve recommendations for you and others.
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          Disabling this means your recommendations will only use your own activity and selected topics.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={allowSimilarityMatching} onChange={(e) => handleToggleSimilarityMatching(e.target.checked)} disabled={saving} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Reset to Defaults */}
                  <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faRotateLeft} className="text-slate-500" />
                          <h3 className="font-medium text-slate-900 dark:text-slate-100">Reset to Defaults</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Reset all personalization settings to their default values. This will enable all learning signals and tracking options.
                        </p>
                      </div>
                      <button
                        onClick={handleResetSettings}
                        disabled={resettingSettings || personalizationSaving}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex-shrink-0 disabled:opacity-50 flex items-center gap-2"
                      >
                        {resettingSettings && <FontAwesomeIcon icon={faSpinner} spin />}
                        {resettingSettings ? 'Resetting...' : 'Reset'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <p className="text-slate-600 dark:text-slate-400">Unable to load personalization settings. Please refresh the page.</p>
                </div>
              )}
            </div>

            {/* Data Management Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Your Data</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Export or delete your personalization data. This includes your tags, interactions, and recommendation preferences.</p>

              <div className="space-y-4">
                {/* Export Data */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faDownload} className="text-primary-600 dark:text-primary-400" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">Export Personalization Data</h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Download a copy of all your personalization data including tags, interests, and interaction history.</p>
                    </div>
                    <button onClick={handleExportData} disabled={exportingData} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 flex items-center gap-2">
                      {exportingData && <FontAwesomeIcon icon={faSpinner} spin />}
                      {exportingData ? 'Exporting...' : 'Export'}
                    </button>
                  </div>
                </div>

                {/* Delete Personalization Data */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-orange-200 dark:border-orange-900/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faTrash} className="text-orange-600 dark:text-orange-400" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">Delete Personalization Data</h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Remove all personalization data including tags, interaction history, and learned preferences.</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">This will reset Ember's knowledge about you. Your account and projects remain unaffected.</p>
                    </div>
                    <button onClick={() => setShowDeleteDataModal(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex-shrink-0">Delete Data</button>
                  </div>
                </div>

                {dataActionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{dataActionError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Account Actions
              </h2>

              <div className="space-y-4">
                {/* Deactivate Account */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-orange-200 dark:border-orange-900/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faUserSlash} className="text-orange-600 dark:text-orange-400" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">
                          Deactivate Account
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Temporarily disable your account. Your profile and data will be hidden but can be restored later.
                      </p>
                      <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1 list-disc list-inside">
                        <li>Your subscription will be canceled at the end of the current billing period</li>
                        <li>Your profile will be hidden from other users</li>
                        <li>All data is preserved for reactivation</li>
                        <li>Contact support to reactivate</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => setShowDeactivateModal(true)}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex-shrink-0"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>

                {/* Delete Account */}
                <div className="bg-white dark:bg-gray-800 rounded p-6 border border-red-200 dark:border-red-900/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faTrash} className="text-red-600 dark:text-red-400" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">
                          Delete Account Permanently
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        <strong className="text-red-600 dark:text-red-400">Warning:</strong> This action is irreversible. All your data will be permanently deleted.
                      </p>
                      <ul className="text-xs text-slate-500 dark:text-slate-500 space-y-1 list-disc list-inside">
                        <li>Your subscription will be canceled immediately</li>
                        <li>Your Stripe customer account will be deleted</li>
                        <li>All projects, comments, and activity will be permanently deleted</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex-shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex gap-3">
                <div className="text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Privacy Settings Guide:</strong>
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Profile Visibility:</strong> Control what appears publicly on your profile, including achievements and projects.</li>
                    <li><strong>Personalization:</strong> Control how AllThrive learns from your activity. These settings also affect what Ember knows about you.</li>
                    <li><strong>Similarity Matching:</strong> When disabled, recommendations use only your activity - not patterns from similar users.</li>
                    <li><strong>AI Training:</strong> Opt-out by default. Enable to help improve external AI models.</li>
                    <li><strong>Your Data:</strong> Export your data anytime or delete personalization data to reset Ember's knowledge.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deactivate Account Modal */}
        {showDeactivateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-white/20">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="text-2xl text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Deactivate Your Account?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Are you sure you want to deactivate your account? This will:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside mb-4">
                    <li>Hide your profile from other users</li>
                    <li>Cancel your subscription at the end of the current billing period</li>
                    <li>Preserve all your data for reactivation</li>
                  </ul>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    You can reactivate your account by contacting support.
                  </p>
                </div>
              </div>

              {accountActionError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{accountActionError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setAccountActionError(null);
                  }}
                  disabled={accountActionLoading}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateAccount}
                  disabled={accountActionLoading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {accountActionLoading && <FontAwesomeIcon icon={faSpinner} spin />}
                  {accountActionLoading ? 'Deactivating...' : 'Deactivate Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-red-500/20">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <FontAwesomeIcon icon={faTrash} className="text-2xl text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Permanently Delete Account?
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-3">
                    Warning: This action cannot be undone!
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Deleting your account will:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside mb-4">
                    <li>Cancel your subscription immediately</li>
                    <li>Delete your Stripe customer account</li>
                    <li>Permanently delete all projects and comments</li>
                    <li>Remove all achievements and activity data</li>
                  </ul>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE MY ACCOUNT</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => {
                    setDeleteConfirmation(e.target.value);
                    setAccountActionError(null);
                  }}
                  placeholder="DELETE MY ACCOUNT"
                  disabled={accountActionLoading}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              {accountActionError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{accountActionError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                    setAccountActionError(null);
                  }}
                  disabled={accountActionLoading}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={accountActionLoading || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {accountActionLoading && <FontAwesomeIcon icon={faSpinner} spin />}
                  {accountActionLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Personalization Data Modal */}
        {showDeleteDataModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-orange-500/20">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <FontAwesomeIcon icon={faTrash} className="text-2xl text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Delete Personalization Data?
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside mb-4">
                    <li>All your interest tags</li>
                    <li>Interaction history (views, likes)</li>
                    <li>Learned preferences</li>
                    <li>Ember's knowledge about you</li>
                  </ul>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Your account, projects, and profile remain unaffected.
                  </p>
                </div>
              </div>

              {dataActionError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{dataActionError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteDataModal(false);
                    setDataActionError(null);
                  }}
                  disabled={deletingData}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePersonalizationData}
                  disabled={deletingData}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingData && <FontAwesomeIcon icon={faSpinner} spin />}
                  {deletingData ? 'Deleting...' : 'Delete Data'}
                </button>
              </div>
            </div>
          </div>
        )}
      </SettingsLayout>
    </DashboardLayout>
  );
}
