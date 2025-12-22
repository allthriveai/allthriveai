/**
 * ProfileTabMenu Component
 *
 * A tab menu for profile pages that displays all available tabs.
 * All tabs are shown in the menu - no pinning or overflow needed.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTh,
  faFlask,
  faPaperclip,
  faStore,
  faBolt,
  faGraduationCap,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type ProfileTabId =
  | 'showcase'
  | 'playground'
  | 'clipped'
  | 'marketplace'
  | 'my-battles'
  | 'learning'
  | 'activity'
  | 'battles';

export interface ProfileTab {
  id: ProfileTabId;
  label: string;
  icon: IconDefinition;
  description: string; // Help text explaining what the tab is for
  ownProfileOnly?: boolean; // Only show when viewing own profile
  creatorOnly?: boolean; // Only show for creators
}

// All possible tabs with their metadata
const ALL_TABS: ProfileTab[] = [
  { id: 'showcase', label: 'Showcase', icon: faTh, description: 'Your curated profile with featured work and customizable sections' },
  { id: 'playground', label: 'Playground', icon: faFlask, description: 'All your projects and experiments in one place' },
  { id: 'clipped', label: 'Clipped', icon: faPaperclip, description: 'Projects you\'ve saved from around the web and All Thrive' },
  { id: 'marketplace', label: 'Shop', icon: faStore, description: 'Your digital products and offerings for sale', creatorOnly: true },
  { id: 'my-battles', label: 'My Battles', icon: faBolt, description: 'Creative challenges you\'ve entered and your battle history', ownProfileOnly: true },
  { id: 'learning', label: 'Learning', icon: faGraduationCap, description: 'Your learning progress is private. Only you can see this tab. Complete quizzes and side quests to level up!', ownProfileOnly: true },
  { id: 'activity', label: 'Activity', icon: faChartLine, description: 'Your activity is private. Only you can see this tab. Use this data to track your progress and discover patterns.', ownProfileOnly: true },
  { id: 'battles', label: 'Battles', icon: faBolt, description: 'Battle results and challenge outcomes' }, // For Pip only
];

interface ProfileTabMenuProps {
  activeTab: ProfileTabId;
  onTabChange: (tabId: ProfileTabId) => void;
  availableTabs: ProfileTabId[];
  isOwnProfile: boolean;
  isCreator?: boolean;
}

// Export tab metadata for use in ProfilePage
export { ALL_TABS };

export function ProfileTabMenu({
  activeTab,
  onTabChange,
  availableTabs,
}: ProfileTabMenuProps) {
  // Get tab metadata
  const getTab = (id: ProfileTabId): ProfileTab | undefined => ALL_TABS.find((t) => t.id === id);

  return (
    <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
      {/* Show all available tabs */}
      {availableTabs.map((tabId) => {
        const tab = getTab(tabId);
        if (!tab) return null;

        return (
          <button
            key={tabId}
            onClick={() => onTabChange(tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === tabId
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            role="tab"
            aria-selected={activeTab === tabId}
            title={tab.label}
          >
            <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ProfileTabMenu;
