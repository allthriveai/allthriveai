import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { api } from '@/services/api';
import axios from 'axios';

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function PasswordSettingsPage() {
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLSpanElement>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (saveStatus !== 'idle') {
      setSaveStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setErrorMessage('New passwords do not match');
      setSaveStatus('error');
      return;
    }

    if (formData.newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      setSaveStatus('error');
      return;
    }

    // Check password complexity
    const hasUppercase = /[A-Z]/.test(formData.newPassword);
    const hasLowercase = /[a-z]/.test(formData.newPassword);
    const hasNumber = /[0-9]/.test(formData.newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setErrorMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      setSaveStatus('error');
      return;
    }

    setIsLoading(true);
    setSaveStatus('saving');
    setErrorMessage('');

    try {
      await api.post('/auth/change-password/', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
      });

      setSaveStatus('success');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      // Focus success message for screen readers
      setTimeout(() => successRef.current?.focus(), 100);
      timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      const errorMsg = axios.isAxiosError(error) && error.response?.data?.detail
        ? String(error.response.data.detail)
        : 'Failed to update password. Please try again.';
      setErrorMessage(errorMsg);
      setSaveStatus('error');
      // Focus error message for screen readers
      setTimeout(() => errorRef.current?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-2xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Password
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Change your password to keep your account secure
              </p>
            </div>

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="space-y-6" aria-label="Change password form">
              <div className="glass-strong rounded p-6 border border-white/20">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      required
                      aria-label="Current password"
                      aria-invalid={saveStatus === 'error'}
                      autoComplete="current-password"
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      required
                      aria-describedby="password-requirements"
                      aria-invalid={saveStatus === 'error'}
                      autoComplete="new-password"
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p id="password-requirements" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Must be at least 8 characters with uppercase, lowercase, and numbers
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      aria-label="Confirm new password"
                      aria-invalid={saveStatus === 'error'}
                      autoComplete="new-password"
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  aria-live="assertive"
                  className="glass-strong rounded p-4 border border-red-500/20 bg-red-500/5 focus:outline-none"
                >
                  <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  aria-label={isLoading ? 'Updating password' : 'Update password'}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>

                {saveStatus === 'success' && (
                  <span
                    ref={successRef}
                    tabIndex={-1}
                    role="status"
                    aria-live="polite"
                    className="text-sm text-green-600 dark:text-green-400 font-medium focus:outline-none"
                  >
                    ✓ Password updated successfully
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </SettingsLayout>
    </DashboardLayout>
  );
}
