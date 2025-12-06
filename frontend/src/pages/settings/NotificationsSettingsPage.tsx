import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { getMyNotificationPreferences, updateMyNotificationPreferences, type NotificationPreferences } from '@/services/notifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faTrophy, faUsers, faBell, faRocket, faStar, faSpinner, faMobileAlt, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

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
              enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-500 ring-1 ring-inset ring-slate-400 dark:ring-slate-400'
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
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [phoneInput, setPhoneInput] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        setIsLoading(true);
        setError(null);
        const prefs = await getMyNotificationPreferences();
        setPreferences(prefs);
        setPhoneInput(prefs.phoneNumber || '');
      } catch (err: any) {
        console.error('Failed to load notification preferences:', err);
        setError(err?.error || 'Failed to load notification preferences');
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleToggle = async (field: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    // Optimistically update UI
    const updatedPreferences = { ...preferences, [field]: value };
    setPreferences(updatedPreferences);
    setSaveStatus('idle');

    try {
      setIsSaving(true);
      // Only send the changed field
      const updateData = { [field]: value };
      await updateMyNotificationPreferences(updateData);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to update notification preferences:', err);
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

  const handlePhoneSubmit = async () => {
    if (!preferences) return;

    try {
      setIsSaving(true);
      setError(null);
      const result = await updateMyNotificationPreferences({ phoneNumber: phoneInput });
      setPreferences({
        ...preferences,
        phoneNumber: result.phoneNumber,
        phoneVerified: result.phoneVerified,
      });
      setIsEditingPhone(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Failed to update phone number:', err);
      setError(err?.response?.data?.error || err?.error || 'Invalid phone number format');
      setSaveStatus('error');
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
              Notifications
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your email and SMS notification preferences
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

                {/* SMS Notifications */}
                <div className="glass-strong rounded-xl p-6 border border-white/20">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                      SMS Notifications
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Receive text messages for battle invitations from friends
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Phone Number Input */}
                    <div className="p-4 glass-subtle rounded-lg border border-white/10">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                          <FontAwesomeIcon icon={faMobileAlt} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label htmlFor="phone-number" className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                            Phone Number
                          </label>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            Add your phone number to receive battle invitations via SMS
                          </p>

                          {isEditingPhone || !preferences.phoneNumber ? (
                            <div className="flex gap-2">
                              <input
                                id="phone-number"
                                type="tel"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                placeholder="+1 (555) 123-4567"
                                className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                              />
                              <button
                                onClick={handlePhoneSubmit}
                                disabled={isSaving || !phoneInput}
                                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                              {preferences.phoneNumber && (
                                <button
                                  onClick={() => {
                                    setPhoneInput(preferences.phoneNumber);
                                    setIsEditingPhone(false);
                                  }}
                                  className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-sm transition-colors"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-200">{preferences.phoneNumber}</span>
                                {preferences.phoneVerified ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    <FontAwesomeIcon icon={faExclamationCircle} className="text-[10px]" />
                                    Unverified
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => setIsEditingPhone(true)}
                                className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SMS Opt-in Toggle */}
                    <NotificationToggle
                      id="sms-invitations"
                      label="Battle Invitations via SMS"
                      description="Receive text messages when friends challenge you to prompt battles"
                      icon={faMobileAlt}
                      enabled={preferences.allowSmsInvitations}
                      disabled={!preferences.phoneNumber}
                      onChange={(value) => handleToggle('allowSmsInvitations', value)}
                    />

                    {!preferences.phoneNumber && (
                      <p className="text-xs text-slate-500 italic pl-14">
                        Add a phone number above to enable SMS notifications
                      </p>
                    )}
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
