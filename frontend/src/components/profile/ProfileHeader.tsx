/**
 * ProfileHeader - Compact horizontal header for the Showcase tab
 *
 * This component displays a compact version of the user's profile info
 * in a horizontal layout, designed for the full-width Showcase tab
 * where the sidebar is not shown.
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPinIcon,
  CalendarIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGithub,
  faLinkedin,
  faTwitter,
  faYoutube,
  faInstagram,
} from '@fortawesome/free-brands-svg-icons';
import {
  faGlobe,
  faUserPlus,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import type { User } from '@/types/models';
import type { ProfileTemplate } from '@/types/profileSections';
import { PROFILE_TEMPLATES } from '@/types/profileSections';

interface ProfileHeaderProps {
  user: User | null;
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isFollowLoading: boolean;
  followersCount: number;
  followingCount: number;
  onFollowToggle: () => void;
  onShowFollowers: () => void;
  onShowFollowing: () => void;
  isEditing?: boolean;
  onEditToggle?: () => void;
  onExitEdit?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  currentTemplate?: ProfileTemplate;
  onTemplateChange?: (template: ProfileTemplate) => void;
  onAvatarChange?: (fileOrUrl: string | File) => void;
  isAvatarUploading?: boolean;
}

// Helper to convert tier code to display name
function getTierDisplay(tier?: string): string {
  const tierMap: Record<string, string> = {
    seedling: 'Seedling',
    sprout: 'Sprout',
    blossom: 'Blossom',
    bloom: 'Bloom',
    evergreen: 'Evergreen',
    curation: 'Curation',
  };
  return tierMap[tier || ''] || 'Seedling';
}

export function ProfileHeader({
  user,
  isOwnProfile,
  isAuthenticated,
  isFollowing,
  isFollowLoading,
  followersCount,
  followingCount,
  onFollowToggle,
  onShowFollowers,
  onShowFollowing,
  isEditing,
  onEditToggle,
  onExitEdit,
  saveStatus = 'idle',
  currentTemplate,
  onTemplateChange,
  onAvatarChange,
  isAvatarUploading,
}: ProfileHeaderProps) {
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar file selection
  const handleAvatarClick = () => {
    if (isEditing && onAvatarChange && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAvatarChange) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Pass the File object directly to avoid CSP issues with blob: URLs
    onAvatarChange(file);

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Social links
  const socialLinks = [
    { icon: faGlobe, url: user?.websiteUrl, label: 'Website' },
    { icon: faLinkedin, url: user?.linkedinUrl, label: 'LinkedIn' },
    { icon: faGithub, url: user?.githubUrl, label: 'GitHub' },
    { icon: faTwitter, url: user?.twitterUrl, label: 'Twitter' },
    { icon: faYoutube, url: user?.youtubeUrl, label: 'YouTube' },
    { icon: faInstagram, url: user?.instagramUrl, label: 'Instagram' },
  ].filter(link => link.url);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      {/* Ambient Glow Background - positioned behind avatar, emanating from the left where the image is */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-primary-500/30 dark:bg-primary-500/35 blur-[100px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      {/* Secondary cyan glow - also emanating from user image on left */}
      <div className="absolute top-1/2 left-0 w-[300px] h-[200px] rounded-full bg-cyan-500/20 dark:bg-cyan-500/20 blur-[80px] pointer-events-none" />

      {/* Profile Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="relative pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {/* Hidden file input for avatar upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload profile picture"
              />
              {/* Avatar display - different styles for editing vs viewing */}
              {isEditing && onAvatarChange ? (
                // Edit mode: Match ImageUpload component style (dashed border circle)
                <div
                  onClick={handleAvatarClick}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload image - click or drag and drop"
                  aria-disabled={isAvatarUploading}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleAvatarClick();
                    }
                  }}
                  className={`
                    relative w-32 h-32 rounded-full border-4 border-dashed
                    flex flex-col items-center justify-center cursor-pointer
                    transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                    ${user?.avatarUrl
                      ? 'border-transparent overflow-hidden group'
                      : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500 bg-slate-50 dark:bg-slate-800/50'
                    }
                    ${isAvatarUploading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {user?.avatarUrl ? (
                    // Has avatar - show image with hover overlay
                    <>
                      <img
                        src={user.avatarUrl}
                        alt={user?.fullName || user?.username || 'Profile'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                        {isAvatarUploading ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
                        ) : (
                          <>
                            <PhotoIcon className="w-10 h-10 text-white mb-1" />
                            <span className="text-xs text-white text-center px-2">Click to change</span>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    // No avatar - show upload prompt (matches ImageUpload style)
                    isAvatarUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
                        <span className="sr-only">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-1" />
                        <span className="text-xs text-slate-500 dark:text-slate-400 text-center px-2">
                          Click or drag
                        </span>
                      </>
                    )
                  )}
                </div>
              ) : (
                // View mode: Standard avatar display
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-xl ring-4 ring-white dark:ring-gray-900 shadow-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${user?.fullName || 'User'}&background=random&size=150`}
                    alt={user?.fullName || user?.username || 'Profile'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-2">
              {/* Name & Username */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                  {user?.fullName || user?.username || 'User'}
                </h1>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                @{user?.username}
              </p>

              {/* Tagline */}
              {user?.tagline && (
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                  {user.tagline}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                {user?.location && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="w-4 h-4" />
                    {user.location}
                  </span>
                )}
                {memberSince && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    Joined {memberSince}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              {/* Edit Mode Controls */}
              {isOwnProfile && isEditing && (
                <>
                  {/* Auto-save Status Indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    {saveStatus === 'saving' && (
                      <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckIcon className="w-4 h-4" />
                        Saved
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <XMarkIcon className="w-4 h-4" />
                        Save failed
                      </span>
                    )}
                  </div>
                  <button
                    onClick={onExitEdit}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Done Editing
                  </button>
                </>
              )}

              {/* Edit Button (not in edit mode) */}
              {isOwnProfile && !isEditing && onEditToggle && (
                <>
                  <Link
                    to={`/${user?.username}?preview=public`}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    See Public Profile
                  </Link>
                  <button
                    onClick={onEditToggle}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                    Edit Profile
                  </button>
                </>
              )}

              {/* Follow Button */}
              {!isOwnProfile && isAuthenticated && (
                <button
                  onClick={onFollowToggle}
                  disabled={isFollowLoading}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isFollowing
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {isFollowLoading ? (
                    <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUserPlus} className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Stats & Social Row */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Stats */}
            <div className="flex items-center gap-6">
              <button
                onClick={onShowFollowers}
                className="text-sm hover:underline"
              >
                <span className="font-bold text-gray-900 dark:text-white">{followersCount}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">Followers</span>
              </button>
              <button
                onClick={onShowFollowing}
                className="text-sm hover:underline"
              >
                <span className="font-bold text-gray-900 dark:text-white">{followingCount}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">Following</span>
              </button>
              {user?.totalPoints !== undefined && user.tier !== 'curation' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-gray-900 dark:text-white">{user.totalPoints.toLocaleString()}</span>
                  <span className="text-gray-500 dark:text-gray-400">Points</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/30">
                    {getTierDisplay(user?.tier)}
                  </span>
                </div>
              )}
            </div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-2">
                {socialLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-primary-500 hover:text-white transition-colors"
                    title={link.label}
                  >
                    <FontAwesomeIcon icon={link.icon} className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Template Selector (Edit Mode) */}
          {isOwnProfile && isEditing && onTemplateChange && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Profile Template:
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {currentTemplate ? PROFILE_TEMPLATES[currentTemplate].name : 'Select Template'}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTemplateDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                      {/* Filter out system-only templates (curation and battle_bot are auto-assigned by backend) */}
                      {(['explorer', 'builder', 'creator'] as ProfileTemplate[]).map((templateKey) => {
                        const template = PROFILE_TEMPLATES[templateKey];
                        return (
                          <button
                            key={templateKey}
                            onClick={() => {
                              onTemplateChange(templateKey);
                              setShowTemplateDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                              currentTemplate === templateKey ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                            }`}
                          >
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {template.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {template.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
