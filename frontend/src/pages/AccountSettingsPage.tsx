import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SettingsLayout } from '@/components/layouts/SettingsLayout';
import { ImageUpload } from '@/components/forms/ImageUpload';
import { api } from '@/services/api';
import axios from 'axios';

interface ProfileFormData {
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  avatarUrl: string;
  websiteUrl: string;
  calendarUrl: string;
}

export default function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    firstName: '',
    lastName: '',
    bio: '',
    avatarUrl: '',
    websiteUrl: '',
    calendarUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
        websiteUrl: user.websiteUrl || '',
        calendarUrl: user.calendarUrl || '',
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
        username: formData.username.toLowerCase().trim(),
        first_name: formData.firstName,
        last_name: formData.lastName,
        bio: formData.bio,
        avatar_url: formData.avatarUrl,
        website_url: formData.websiteUrl,
        calendar_url: formData.calendarUrl,
      };

      await api.patch('/me/profile/', payload);
      
      // Refresh user data
      await refreshUser();
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      const errorMsg = axios.isAxiosError(error) && error.response?.data?.detail
        ? String(error.response.data.detail)
        : 'Failed to update profile. Please try again.';
      setErrorMessage(errorMsg);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <SettingsLayout>
        <div className="p-8">
          <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Edit Profile
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Update your username and manage your account
              </p>
            </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Photo Section */}
            <div className="flex items-start gap-6">
              <ImageUpload
                currentImage={formData.avatarUrl}
                onImageUploaded={(url) => {
                  setFormData(prev => ({ ...prev, avatarUrl: url }));
                }}
                onImageRemoved={() => {
                  setFormData(prev => ({ ...prev, avatarUrl: '' }));
                }}
              />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Profile Photo
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Upload a profile photo by dragging and dropping or clicking to select a file. 
                  Images are stored securely and will be displayed on your profile.
                </p>
                {formData.avatarUrl && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
                      Current URL: {formData.avatarUrl}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information */}
            <div className="glass-strong rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
                Profile Information
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    3-30 characters, lowercase letters, numbers, hyphens, and underscores
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    {formData.bio.length} / 5000 characters
                  </p>
                </div>

                <div>
                  <label htmlFor="websiteUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    id="websiteUrl"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleChange}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Your personal website or portfolio
                  </p>
                </div>

                <div>
                  <label htmlFor="calendarUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Calendar URL
                  </label>
                  <input
                    type="url"
                    id="calendarUrl"
                    name="calendarUrl"
                    value={formData.calendarUrl}
                    onChange={handleChange}
                    placeholder="https://calendly.com/yourusername"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Link to your Calendly, Cal.com, or other booking calendar
                  </p>
                </div>
              </div>
            </div>

            {/* Account Information - Read Only */}
            <div className="glass-strong rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
                Account Information
              </h2>
              
              <div className="space-y-5">
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
                    Account Role
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
      </SettingsLayout>
    </DashboardLayout>
  );
}
