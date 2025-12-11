/**
 * LinksSection - Social and external links display
 *
 * Displays user's social links and custom links. In edit mode,
 * allows editing both the user's core social links (synced to profile)
 * and adding custom links (stored in section content).
 */

import { useState } from 'react';
import { PlusIcon, XMarkIcon, LinkIcon, GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGithub,
  faLinkedin,
  faTwitter,
  faYoutube,
  faInstagram,
  faTiktok,
  faDiscord,
  faTwitch,
  faMedium,
  faDribbble,
  faBehance,
  faFigma,
} from '@fortawesome/free-brands-svg-icons';
import type { LinksSectionContent, LinkItem } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';

// Social link fields that can be edited inline
export interface SocialLinksUpdate {
  websiteUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
}

interface LinksSectionProps {
  content: LinksSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: LinksSectionContent) => void;
  onSocialLinksUpdate?: (links: SocialLinksUpdate) => Promise<void>;
}

// Icon mapping for known platforms
const PLATFORM_ICONS: Record<string, typeof faGithub> = {
  github: faGithub,
  linkedin: faLinkedin,
  twitter: faTwitter,
  youtube: faYoutube,
  instagram: faInstagram,
  tiktok: faTiktok,
  discord: faDiscord,
  twitch: faTwitch,
  medium: faMedium,
  dribbble: faDribbble,
  behance: faBehance,
  figma: faFigma,
};

// Detect platform from URL
function detectPlatform(url: string): string | null {
  const lowercaseUrl = url.toLowerCase();
  for (const platform of Object.keys(PLATFORM_ICONS)) {
    if (lowercaseUrl.includes(platform)) {
      return platform;
    }
  }
  return null;
}

// Core social link definitions for inline editing
const SOCIAL_LINK_FIELDS = [
  { key: 'website_url', fieldKey: 'websiteUrl', label: 'Website', icon: 'website', placeholder: 'https://yourwebsite.com' },
  { key: 'github_url', fieldKey: 'githubUrl', label: 'GitHub', icon: 'github', placeholder: 'https://github.com/username' },
  { key: 'linkedin_url', fieldKey: 'linkedinUrl', label: 'LinkedIn', icon: 'linkedin', placeholder: 'https://linkedin.com/in/username' },
  { key: 'twitter_url', fieldKey: 'twitterUrl', label: 'Twitter', icon: 'twitter', placeholder: 'https://twitter.com/username' },
  { key: 'youtube_url', fieldKey: 'youtubeUrl', label: 'YouTube', icon: 'youtube', placeholder: 'https://youtube.com/@username' },
  { key: 'instagram_url', fieldKey: 'instagramUrl', label: 'Instagram', icon: 'instagram', placeholder: 'https://instagram.com/username' },
] as const;

export function LinksSection({ content, user, isEditing, onUpdate, onSocialLinksUpdate }: LinksSectionProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // Local state for editing social links
  const [socialLinkEdits, setSocialLinkEdits] = useState<SocialLinksUpdate>({
    websiteUrl: user.website_url || '',
    githubUrl: user.github_url || '',
    linkedinUrl: user.linkedin_url || '',
    twitterUrl: user.twitter_url || '',
    youtubeUrl: user.youtube_url || '',
    instagramUrl: user.instagram_url || '',
  });

  // Combine user's social links with custom links (for display in non-edit mode)
  const userLinks: LinkItem[] = [];

  // Add user's social links if they exist
  if (user.website_url) userLinks.push({ label: 'Website', url: user.website_url, icon: 'website' });
  if (user.github_url) userLinks.push({ label: 'GitHub', url: user.github_url, icon: 'github' });
  if (user.linkedin_url) userLinks.push({ label: 'LinkedIn', url: user.linkedin_url, icon: 'linkedin' });
  if (user.twitter_url) userLinks.push({ label: 'Twitter', url: user.twitter_url, icon: 'twitter' });
  if (user.youtube_url) userLinks.push({ label: 'YouTube', url: user.youtube_url, icon: 'youtube' });
  if (user.instagram_url) userLinks.push({ label: 'Instagram', url: user.instagram_url, icon: 'instagram' });

  // Combine with custom links from content
  const customLinks = content?.links || [];
  const allLinks = [...userLinks, ...customLinks];
  const layout = content?.layout || 'grid';

  // Handle social link field change
  const handleSocialLinkChange = (fieldKey: string, value: string) => {
    setSocialLinkEdits(prev => ({ ...prev, [fieldKey]: value }));
  };

  // Save social links to user profile
  const handleSaveSocialLinks = async () => {
    if (!onSocialLinksUpdate) return;

    setIsSavingSocial(true);
    try {
      await onSocialLinksUpdate(socialLinkEdits);
    } finally {
      setIsSavingSocial(false);
    }
  };

  const handleAddLink = () => {
    if (!newLabel.trim() || !newUrl.trim() || !onUpdate) return;

    const platform = detectPlatform(newUrl);
    const link: LinkItem = {
      label: newLabel.trim(),
      url: newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
      icon: platform || undefined,
    };

    onUpdate({
      ...content,
      links: [...customLinks, link],
    });
    setNewLabel('');
    setNewUrl('');
  };

  const handleRemoveLink = (index: number) => {
    if (!onUpdate) return;
    // Only remove from custom links (not user's social links)
    const newLinks = customLinks.filter((_, i) => i !== index);
    onUpdate({ ...content, links: newLinks });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  };

  // Empty state when not editing and no links
  if (allLinks.length === 0 && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Links
      </h2>

      {/* Social Links Editor (editing mode) */}
      {isEditing && onSocialLinksUpdate && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Social Links
            </h3>
            <button
              onClick={handleSaveSocialLinks}
              disabled={isSavingSocial}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSavingSocial ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-3.5 h-3.5" />
                  Save Links
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SOCIAL_LINK_FIELDS.map((field) => {
              const icon = field.icon === 'website' ? null : PLATFORM_ICONS[field.icon];
              return (
                <div key={field.key} className="relative">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {field.label}
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {icon ? (
                        <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                      ) : (
                        <GlobeAltIcon className="w-4 h-4" />
                      )}
                    </div>
                    <input
                      type="url"
                      value={socialLinkEdits[field.fieldKey as keyof SocialLinksUpdate] || ''}
                      onChange={(e) => handleSocialLinkChange(field.fieldKey, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Links display */}
      {allLinks.length > 0 && !isEditing && (
        <div
          className={
            layout === 'list'
              ? 'space-y-2'
              : layout === 'buttons'
              ? 'flex flex-wrap gap-3'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
          }
        >
          {allLinks.map((link, index) => {
            const isCustomLink = index >= userLinks.length;
            const customIndex = index - userLinks.length;
            const platform = link.icon || detectPlatform(link.url);
            const icon = platform && PLATFORM_ICONS[platform];

            if (layout === 'buttons') {
              return (
                <a
                  key={`${link.label}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors"
                >
                  {icon ? (
                    <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                  ) : (
                    <GlobeAltIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{link.label}</span>
                  {isEditing && isCustomLink && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveLink(customIndex);
                      }}
                      className="ml-1 p-0.5 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </a>
              );
            }

            if (layout === 'list') {
              return (
                <a
                  key={`${link.label}-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {icon ? (
                      <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                    ) : (
                      <GlobeAltIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {link.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {link.url.replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                  {isEditing && isCustomLink && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveLink(customIndex);
                      }}
                      className="p-1.5 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </a>
              );
            }

            // Grid layout (default)
            return (
              <a
                key={`${link.label}-${index}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {icon ? (
                    <FontAwesomeIcon icon={icon} className="w-5 h-5" />
                  ) : (
                    <GlobeAltIcon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                  {link.label}
                </span>
                {isEditing && isCustomLink && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveLink(customIndex);
                    }}
                    className="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </a>
            );
          })}
        </div>
      )}

      {/* Custom Links Editor (editing mode) */}
      {isEditing && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Custom Links
          </h3>

          {/* Existing custom links */}
          {customLinks.length > 0 && (
            <div className="space-y-2 mb-4">
              {customLinks.map((link, index) => {
                const platform = link.icon || detectPlatform(link.url);
                const icon = platform && PLATFORM_ICONS[platform];
                return (
                  <div
                    key={`custom-${index}`}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      {icon ? (
                        <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                      ) : (
                        <GlobeAltIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {link.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {link.url.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveLink(index)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new custom link */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g., Portfolio)"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAddLink}
              disabled={!newLabel.trim() || !newUrl.trim()}
              className="px-3 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Add links to other platforms, portfolios, or resources
          </p>
        </div>
      )}
    </div>
  );
}
