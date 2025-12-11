/**
 * ProfileCompleteness - Shows profile completion progress for the user
 *
 * Displays a progress bar and checklist of items the user can complete
 * to make their profile more discoverable and engaging.
 */

import { useState, useMemo } from 'react';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import {
  UserCircleIcon,
  PhotoIcon,
  DocumentTextIcon,
  LinkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { User } from '@/types/models';

interface ProfileCompletenessProps {
  user: User;
  onNavigateToSettings?: () => void;
  onNavigateToField?: (fieldId: string) => void;
}

interface CompletionItem {
  id: string;
  label: string;
  description: string;
  icon: typeof UserCircleIcon;
  isComplete: boolean;
  weight: number; // How much this contributes to overall percentage
}

// Minimum character thresholds for meaningful content
const MIN_TAGLINE_LENGTH = 5; // e.g., "Dev" is too short, "Developer & Designer" is good
const MIN_BIO_LENGTH = 20; // Encourages at least a sentence or two

function getCompletionItems(user: User): CompletionItem[] {
  // Check if avatar is a real upload or preset (not the default ui-avatars fallback)
  const hasRealAvatar = !!user.avatarUrl && !user.avatarUrl.includes('ui-avatars.com');

  return [
    {
      id: 'avatar',
      label: 'Add profile photo',
      description: 'Help others recognize you',
      icon: PhotoIcon,
      isComplete: hasRealAvatar,
      weight: 20,
    },
    {
      id: 'name',
      label: 'Add your name',
      description: 'Let people know who you are',
      icon: UserCircleIcon,
      isComplete: !!(user.firstName || user.lastName),
      weight: 15,
    },
    {
      id: 'tagline',
      label: 'Write a tagline',
      description: 'Describe yourself in a few words',
      icon: SparklesIcon,
      isComplete: !!user.tagline && user.tagline.length > MIN_TAGLINE_LENGTH,
      weight: 20,
    },
    {
      id: 'bio',
      label: 'Write a bio',
      description: 'Tell your story',
      icon: DocumentTextIcon,
      isComplete: !!user.bio && user.bio.length > MIN_BIO_LENGTH,
      weight: 25,
    },
    {
      id: 'socialLinks',
      label: 'Add social links',
      description: 'Connect your other profiles',
      icon: LinkIcon,
      isComplete: !!(
        user.websiteUrl ||
        user.githubUrl ||
        user.linkedinUrl ||
        user.twitterUrl ||
        user.youtubeUrl ||
        user.instagramUrl
      ),
      weight: 20,
    },
  ];
}

function calculateCompleteness(items: CompletionItem[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = items
    .filter((item) => item.isComplete)
    .reduce((sum, item) => sum + item.weight, 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

export function ProfileCompleteness({ user, onNavigateToSettings, onNavigateToField }: ProfileCompletenessProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Memoize completion items to avoid recalculating on every render
  const items = useMemo(() => getCompletionItems(user), [user]);
  const completeness = useMemo(() => calculateCompleteness(items), [items]);
  const incompleteItems = useMemo(() => items.filter((item) => !item.isComplete), [items]);

  // Don't show if profile is 100% complete
  if (completeness === 100) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary-50 to-cyan-50 dark:from-primary-900/20 dark:to-cyan-900/20 rounded-xl border border-primary-200 dark:border-primary-800/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-primary-100/50 dark:hover:bg-primary-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            {/* Circular progress indicator */}
            {/* Circle with r=15.5 has circumference of ~97.4, we use 100 for easier percentage math */}
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className="stroke-primary-200 dark:stroke-primary-800"
                strokeWidth="3"
                pathLength="100"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                className="stroke-primary-500 dark:stroke-primary-400"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${completeness} 100`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">
              {completeness}%
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Complete your profile
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {incompleteItems.length} item{incompleteItems.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expandable checklist */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isClickable = !item.isComplete && onNavigateToField;

            const content = (
              <>
                {item.isComplete ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className={`text-sm font-medium ${
                      item.isComplete
                        ? 'text-green-700 dark:text-green-400 line-through'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.description}
                  </p>
                </div>
                {isClickable && (
                  <span className="text-xs text-primary-500 dark:text-primary-400 flex-shrink-0">
                    Fix &rarr;
                  </span>
                )}
              </>
            );

            // Render as button if clickable, div otherwise
            if (isClickable) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigateToField(item.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors bg-white dark:bg-gray-800/50 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer"
                >
                  {content}
                </button>
              );
            }

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg transition-colors bg-green-50 dark:bg-green-900/20"
              >
                {content}
              </div>
            );
          })}

          {/* Edit Profile button - only show if no field navigation available */}
          {onNavigateToSettings && !onNavigateToField && incompleteItems.length > 0 && (
            <button
              onClick={onNavigateToSettings}
              className="w-full mt-3 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      )}
    </div>
  );
}
