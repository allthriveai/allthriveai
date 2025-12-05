import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { getMyEmailPreferences, updateMyEmailPreferences, type EmailPreferences } from '@/services/notifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faTrophy, faUsers, faBell, faRocket, faStar, faSpinner } from '@fortawesome/free-solid-svg-icons';

interface NotificationToggleProps {
  id: string;
  label: string;
  description: string;
  icon: any;
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}

function NotificationToggle({ id, label, description, icon, enabled, disabled, onChange }: NotificationToggleProps) {
  return (
    <div className="flex items-start gap-4 p-4 glass-subtle rounded-lg border border-white/10">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
        <FontAwesomeIcon icon={icon} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-1">
          <label htmlFor={id} className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
            {label}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={`${id}-label`}
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
              enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="sr-only">Toggle {label}</span>
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p id={`${id}-label`} className="text-xs text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        setIsLoading(true);
        setError(null);
        const prefs = await getMyEmailPreferences();
        setPreferences(prefs);
      } catch (err: any) {
        console.error('Failed to load email preferences:', err);
        setError(err?.error || 'Failed to load email preferences');
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleToggle = async (field: keyof EmailPreferences, value: boolean) => {
    if (!preferences) return;

    // Optimistically update UI
    const updatedPreferences = { ...preferences, [field]: value };
    setPreferences(updatedPreferences);
    setSaveStatus('idle');

    try {
      setIsSaving(true);
      // Only send the changed field
      const updateData = { [field]: value };
      await updateMyEmailPreferences(updateData);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to update email preferences:', err);
      // Revert on error
      setPreferences(preferences);
      setSaveStatus('error');
      setError(err?.error || 'Failed to update preferences');
      setTimeout(() => {
        setSaveStatus('idle');
        setError(null);
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Email Notifications
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage which emails you'd like to receive from AllThrive AI
            </p>
          </div>

            {/* Loading State */}
            {isLoading && (
              <div className="glass-strong rounded-xl p-12 border border-white/20 text-center">
                <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-primary-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400">Loading preferences...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div role="alert" className="glass-strong rounded-xl p-4 border border-red-500/20 bg-red-500/5 mb-6">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Save Status */}
            {saveStatus === 'success' && (
              <div role="status" className="glass-strong rounded-xl p-4 border border-green-500/20 bg-green-500/5 mb-6">
                <p className="text-sm text-green-600 dark:text-green-400">✓ Preferences saved successfully</p>
              </div>
            )}

            {/* Preferences Form */}
            {!isLoading && preferences && (
              <div className="space-y-6">
                {/* Transactional Emails (Always On) */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Essential Emails
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      These emails are required for account security and cannot be disabled
                    </p>
                  </div>

                  <div className="space-y-3">
                    <NotificationToggle
                      id="email-billing"
                      label="Billing & Account"
                      description="Payment receipts, billing alerts, and important account updates"
                      icon={faEnvelope}
                      enabled={preferences.emailBilling}
                      disabled={true}
                      onChange={() => {}}
                    />

                    <NotificationToggle
                      id="email-welcome"
                      label="Welcome & Onboarding"
                      description="Getting started guides and welcome messages"
                      icon={faRocket}
                      enabled={preferences.emailWelcome}
                      disabled={true}
                      onChange={() => {}}
                    />
                  </div>
                </div>

                {/* Activity Emails */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Activity Notifications
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Get notified about your activity, achievements, and community interactions
                    </p>
                  </div>

                  <div className="space-y-3">
                    <NotificationToggle
                      id="email-battles"
                      label="Prompt Battles"
                      description="Battle invitations, results, and leaderboard updates"
                      icon={faTrophy}
                      enabled={preferences.emailBattles}
                      onChange={(value) => handleToggle('emailBattles', value)}
                    />

                    <NotificationToggle
                      id="email-achievements"
                      label="Achievements"
                      description="Notifications when you unlock new achievements and milestones"
                      icon={faTrophy}
                      enabled={preferences.emailAchievements}
                      onChange={(value) => handleToggle('emailAchievements', value)}
                    />

                    <NotificationToggle
                      id="email-social"
                      label="Social Activity"
                      description="New followers, comments on your projects, and mentions"
                      icon={faUsers}
                      enabled={preferences.emailSocial}
                      onChange={(value) => handleToggle('emailSocial', value)}
                    />

                    <NotificationToggle
                      id="email-quests"
                      label="Quests & Streaks"
                      description="Quest assignments, streak reminders, and progress updates"
                      icon={faBell}
                      enabled={preferences.emailQuests}
                      onChange={(value) => handleToggle('emailQuests', value)}
                    />
                  </div>
                </div>

                {/* Marketing Emails */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      Marketing & Updates
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Stay informed about new features, tips, and special offers
                    </p>
                  </div>

                  <div className="space-y-3">
                    <NotificationToggle
                      id="email-marketing"
                      label="Product Updates & Newsletters"
                      description="New features, tips & tricks, community highlights, and special offers"
                      icon={faStar}
                      enabled={preferences.emailMarketing}
                      onChange={(value) => handleToggle('emailMarketing', value)}
                    />
                  </div>
                </div>

                {/* Saving Indicator */}
                {isSaving && (
                  <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                    Saving...
                  </div>
                )}
              </div>
            )}
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
