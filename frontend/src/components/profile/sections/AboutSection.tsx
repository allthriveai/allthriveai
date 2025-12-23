/**
 * AboutSection - Bio/story display with rich text
 *
 * Supports inline editing when isOwnProfile is true (click-to-edit pattern)
 */

import { useState } from 'react';
import { MapPinIcon, UserIcon, PencilIcon }from '@heroicons/react/24/outline';
import { sanitizeHtml } from '@/utils/sanitize';
import type { AboutSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';

interface AboutSectionProps {
  content: AboutSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  isOwnProfile?: boolean;
  onUpdate?: (content: AboutSectionContent) => void;
}

export function AboutSection({ content, user, isEditing, isOwnProfile, onUpdate }: AboutSectionProps) {
  const [isEditingBio, setIsEditingBio] = useState(false);
  const showLocation = content?.showLocation !== false;
  const showPronouns = content?.showPronouns !== false;
  const showStatus = content?.showStatus !== false;

  // Use content bio first, fallback to user bio
  const bio = content?.bio || user.bio || '';

  // Handle inline bio change
  const handleBioChange = async (newBio: string) => {
    if (onUpdate) {
      onUpdate({ ...content, bio: newBio });
    }
  };

  // Determine if editable: inline editing for owners, or legacy isEditing mode
  const canEdit = isOwnProfile || isEditing;

  // Empty state when not editable and no bio
  if (!bio && !canEdit) {
    return null;
  }

  return (
    <div className="py-6 w-full group/section">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          About
        </h2>
        {canEdit && !isEditingBio && (
          <button
            onClick={() => setIsEditingBio(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 opacity-0 group-hover/section:opacity-100 transition-all"
            title="Edit bio"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Meta info row */}
      {(showLocation || showPronouns || showStatus) && (
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
          {showLocation && user.location && (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="w-4 h-4" />
              <span>{user.location}</span>
            </div>
          )}
          {showPronouns && user.pronouns && (
            <div className="flex items-center gap-1.5">
              <UserIcon className="w-4 h-4" />
              <span>{user.pronouns}</span>
            </div>
          )}
          {showStatus && user.current_status && (
            <div className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              {user.current_status}
            </div>
          )}
        </div>
      )}

      {/* Bio content - inline editable for owners */}
      {(canEdit && isEditingBio) || isEditing ? (
        <div className="relative">
          <textarea
            value={bio}
            onChange={(e) => handleBioChange(e.target.value)}
            onBlur={() => setIsEditingBio(false)}
            placeholder="Tell your story..."
            rows={6}
            autoFocus
            className="w-full bg-transparent border-2 border-primary-500 rounded-lg p-3 focus:outline-none resize-none text-gray-700 dark:text-gray-300 leading-relaxed"
          />
        </div>
      ) : bio ? (
        <div
          onClick={() => canEdit && setIsEditingBio(true)}
          className={`prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition-colors' : ''}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(bio) }}
        />
      ) : canEdit ? (
        <button
          onClick={() => setIsEditingBio(true)}
          className="text-gray-400 dark:text-gray-500 italic hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
        >
          Click to add your bio...
        </button>
      ) : null}
    </div>
  );
}
