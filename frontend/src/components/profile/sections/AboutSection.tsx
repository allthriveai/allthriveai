/**
 * AboutSection - Bio/story display with rich text
 */

import { useState } from 'react';
import { MapPinIcon, UserIcon } from '@heroicons/react/24/outline';
import type { AboutSectionContent } from '@/types/profileSections';
import type { ProfileUser } from './ProfileSectionRenderer';

interface AboutSectionProps {
  content: AboutSectionContent;
  user: ProfileUser;
  isEditing?: boolean;
  onUpdate?: (content: AboutSectionContent) => void;
}

export function AboutSection({ content, user, isEditing, onUpdate }: AboutSectionProps) {
  const [editedBio, setEditedBio] = useState(content?.bio || user.bio || '');

  const showLocation = content?.showLocation !== false;
  const showPronouns = content?.showPronouns !== false;
  const showStatus = content?.showStatus !== false;

  // Use content bio first, fallback to user bio
  const bio = content?.bio || user.bio || '';

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newBio = e.target.value;
    setEditedBio(newBio);
    if (onUpdate) {
      onUpdate({ ...content, bio: newBio });
    }
  };

  // Empty state when not editing and no bio
  if (!bio && !isEditing) {
    return null;
  }

  return (
    <div className="py-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        About
      </h2>

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

      {/* Bio content */}
      {isEditing ? (
        <textarea
          value={editedBio}
          onChange={handleBioChange}
          placeholder="Tell your story..."
          rows={6}
          className="w-full p-4 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      ) : bio ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bio }}
        />
      ) : (
        <p className="text-gray-500 dark:text-gray-400 italic">
          No bio yet
        </p>
      )}

      {/* Empty state for editing */}
      {isEditing && !editedBio && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
          Write something about yourself to help visitors get to know you
        </p>
      )}
    </div>
  );
}
