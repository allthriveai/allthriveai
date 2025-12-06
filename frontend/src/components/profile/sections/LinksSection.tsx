/**
 * LinksSection - Social and external links display
 */

import { useState } from 'react';
import { PlusIcon, XMarkIcon, LinkIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
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

interface LinksSectionProps {
  content: LinksSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: LinksSectionContent) => void;
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

export function LinksSection({ content, user, isEditing, onUpdate }: LinksSectionProps) {
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Combine user's social links with custom links
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

      {/* Links display */}
      {allLinks.length > 0 && (
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

      {/* Add Link Input (editing) */}
      {isEditing && (
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g., Portfolio)"
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAddLink}
            disabled={!newLabel.trim() || !newUrl.trim()}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {allLinks.length === 0 && isEditing && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          Add links to your social profiles and portfolio
        </p>
      )}
    </div>
  );
}
