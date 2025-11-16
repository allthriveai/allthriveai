import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { api } from '@/services/api';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  bio: string;
  avatarUrl: string;
}

export default function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    bio: '',
    avatarUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Reset save status when user makes changes
    if (saveStatus !== 'idle') {
      setSaveStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSaveStatus('saving');
    setErrorMessage('');

    try {
      // Convert camelCase to snake_case for API
      const payload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        bio: formData.bio,
        avatar_url: formData.avatarUrl,
      };

      await api.patch('/auth/profile/', payload);
      
      // Refresh user data
      await refreshUser();
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setErrorMessage(error.response?.data?.detail || 'Failed to update profile. Please try again.');
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Account Settings
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your personal information and profile
            </p>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Read-only fields */}
            <div className="glass-strong rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Account Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={user?.username || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Username cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={user?.roleDisplay || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="glass-strong rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Profile Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="avatarUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    id="avatarUrl"
                    name="avatarUrl"
                    value={formData.avatarUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {formData.avatarUrl && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Preview:</p>
                      <img
                        src={formData.avatarUrl}
                        alt="Avatar preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell us about yourself..."
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formData.bio.length} characters
                  </p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="glass-strong rounded-xl p-4 border border-red-500/20 bg-red-500/5">
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            )}

            {/* Save button */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>

              {saveStatus === 'success' && (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  ✓ Changes saved successfully
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
