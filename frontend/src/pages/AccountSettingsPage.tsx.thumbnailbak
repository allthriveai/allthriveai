import { useState, useEffect, useRef, useCallback } from 'react';
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
  tagline: string;
  location: string;
  pronouns: string;
  avatarUrl: string;
  websiteUrl: string;
  calendarUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  githubUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
}

export default function AccountSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    firstName: '',
    lastName: '',
    bio: '',
    tagline: '',
    location: '',
    pronouns: '',
    avatarUrl: '',
    websiteUrl: '',
    calendarUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    youtubeUrl: '',
    instagramUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLSpanElement>(null);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        tagline: user.tagline || '',
        location: user.location || '',
        pronouns: user.pronouns || '',
        avatarUrl: user.avatarUrl || '',
        websiteUrl: user.websiteUrl || '',
        calendarUrl: user.calendarUrl || '',
        linkedinUrl: user.linkedinUrl || '',
        twitterUrl: user.twitterUrl || '',
        githubUrl: user.githubUrl || '',
        youtubeUrl: user.youtubeUrl || '',
        instagramUrl: user.instagramUrl || '',
      });
    }
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
    setErrorMessage('');

    // Client-side validation
    if (formData.tagline.length > 150) {
      setErrorMessage('Tagline must be 150 characters or less.');
      setSaveStatus('error');
      return;
    }

    if (formData.bio.length > 5000) {
      setErrorMessage('Bio must be 5000 characters or less.');
      setSaveStatus('error');
      return;
    }

    if (formData.username.length < 3 || formData.username.length > 30) {
      setErrorMessage('Username must be between 3 and 30 characters.');
      setSaveStatus('error');
      return;
    }

    setIsLoading(true);
    setSaveStatus('saving');

    try {
      // API client will automatically convert camelCase to snake_case
      const payload = {
        username: formData.username.toLowerCase().trim(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        tagline: formData.tagline,
        location: formData.location,
        pronouns: formData.pronouns,
        avatarUrl: formData.avatarUrl,
        websiteUrl: formData.websiteUrl,
        calendarUrl: formData.calendarUrl,
        linkedinUrl: formData.linkedinUrl,
        twitterUrl: formData.twitterUrl,
        githubUrl: formData.githubUrl,
        youtubeUrl: formData.youtubeUrl,
        instagramUrl: formData.instagramUrl,
      };

      await api.patch('/me/profile/', payload);

      // Refresh user data
      await refreshUser();

      setSaveStatus('success');
      // Focus success message for screen readers
      setTimeout(() => successRef.current?.focus(), 100);
      timeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      const errorMsg = axios.isAxiosError(error) && error.response?.data?.detail
        ? String(error.response.data.detail)
        : 'Failed to update profile. Please try again.';
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
          <form onSubmit={handleSubmit} className="space-y-8" aria-label="Edit profile form">
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
                    aria-describedby="username-hint"
                    aria-invalid={saveStatus === 'error' && formData.username.length < 3}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p id="username-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                  <label htmlFor="pronouns" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Pronouns <span className="text-slate-500 dark:text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="pronouns"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleChange}
                    placeholder="e.g. she/her, he/him, they/them"
                    maxLength={50}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="tagline" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tagline <span className="text-slate-500 dark:text-slate-400">(max 150 characters)</span>
                  </label>
                  <input
                    type="text"
                    id="tagline"
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleChange}
                    placeholder="e.g. AI Engineer building creative tools"
                    maxLength={150}
                    aria-describedby="tagline-count"
                    aria-invalid={formData.tagline.length > 150}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p id="tagline-count" className="mt-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
                    {formData.tagline.length} / 150 characters
                  </p>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder='e.g. San Francisco, CA or "Remote"'
                    maxLength={100}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
                    aria-describedby="bio-count"
                    aria-invalid={formData.bio.length > 5000}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p id="bio-count" className="mt-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
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

            {/* Social Media Links */}
            <div className="glass-strong rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">
                Social Media Links
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                These links will appear on your public Showcase profile
              </p>

              <div className="space-y-5">
                <div>
                  <label htmlFor="linkedinUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    id="linkedinUrl"
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="twitterUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Twitter / X
                  </label>
                  <input
                    type="url"
                    id="twitterUrl"
                    name="twitterUrl"
                    value={formData.twitterUrl}
                    onChange={handleChange}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="githubUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    GitHub
                  </label>
                  <input
                    type="url"
                    id="githubUrl"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleChange}
                    placeholder="https://github.com/username"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="youtubeUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    YouTube
                  </label>
                  <input
                    type="url"
                    id="youtubeUrl"
                    name="youtubeUrl"
                    value={formData.youtubeUrl}
                    onChange={handleChange}
                    placeholder="https://youtube.com/@username"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="instagramUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Instagram
                  </label>
                  <input
                    type="url"
                    id="instagramUrl"
                    name="instagramUrl"
                    value={formData.instagramUrl}
                    onChange={handleChange}
                    placeholder="https://instagram.com/username"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
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
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                className="glass-strong rounded-xl p-4 border border-red-500/20 bg-red-500/5 focus:outline-none"
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
                aria-label={isLoading ? 'Saving changes' : 'Save changes'}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>

              {saveStatus === 'success' && (
                <span
                  ref={successRef}
                  tabIndex={-1}
                  role="status"
                  aria-live="polite"
                  className="text-sm text-green-600 dark:text-green-400 font-medium focus:outline-none"
                >
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
