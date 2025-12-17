/**
 * ProfileTabMenu Component
 *
 * A customizable tab menu for profile pages with a "+" dropdown for overflow tabs.
 * Users can pin up to 3 tabs to the main bar, with remaining tabs in the dropdown.
 * Preferences are stored in localStorage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTh,
  faFlask,
  faPaperclip,
  faStore,
  faBolt,
  faGraduationCap,
  faChartLine,
  faPlus,
  faStar as faStarSolid,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarOutline } from '@fortawesome/free-regular-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

const STORAGE_KEY = 'profile_pinned_tabs';
const MAX_PINNED = 4;
const ALWAYS_PINNED: ProfileTabId[] = ['showcase', 'playground'];

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
  ownProfileOnly?: boolean; // Only show when viewing own profile
  creatorOnly?: boolean; // Only show for creators
}

// All possible tabs with their metadata
const ALL_TABS: ProfileTab[] = [
  { id: 'showcase', label: 'Showcase', icon: faTh },
  { id: 'playground', label: 'Playground', icon: faFlask },
  { id: 'clipped', label: 'Clipped', icon: faPaperclip },
  { id: 'marketplace', label: 'Shop', icon: faStore, creatorOnly: true },
  { id: 'my-battles', label: 'My Battles', icon: faBolt, ownProfileOnly: true },
  { id: 'learning', label: 'Learning', icon: faGraduationCap, ownProfileOnly: true },
  { id: 'activity', label: 'Activity', icon: faChartLine, ownProfileOnly: true },
  { id: 'battles', label: 'Battles', icon: faBolt }, // For Pip only
];

interface ProfileTabMenuProps {
  activeTab: ProfileTabId;
  onTabChange: (tabId: ProfileTabId) => void;
  availableTabs: ProfileTabId[];
  isOwnProfile: boolean;
  isCreator?: boolean;
  pinnedTabs?: ProfileTabId[]; // External pinned tabs state (controlled mode)
}

// Export tab metadata for use in external "More" menu
export { ALL_TABS, ALWAYS_PINNED, MAX_PINNED };
export { loadPinnedTabs, savePinnedTabs };

// Get default pinned tabs based on context
function getDefaultPinnedTabs(availableTabs: ProfileTabId[], isCreator: boolean): ProfileTabId[] {
  // Always start with the required pinned tabs
  const alwaysPinned = ALWAYS_PINNED.filter((tab) => availableTabs.includes(tab));

  // Additional tabs to fill remaining slots (priority order)
  const additionalPriority: ProfileTabId[] = isCreator
    ? ['clipped', 'marketplace', 'my-battles', 'learning', 'activity']
    : ['clipped', 'my-battles', 'learning', 'activity'];

  const additionalTabs = additionalPriority
    .filter((tab) => availableTabs.includes(tab) && !alwaysPinned.includes(tab))
    .slice(0, MAX_PINNED - alwaysPinned.length);

  return [...alwaysPinned, ...additionalTabs];
}

// Load pinned tabs from localStorage
function loadPinnedTabs(): ProfileTabId[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
        return parsed as ProfileTabId[];
      }
    }
  } catch {
    // Invalid stored value
  }
  return null;
}

// Save pinned tabs to localStorage
function savePinnedTabs(tabs: ProfileTabId[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // localStorage not available
  }
}

export function ProfileTabMenu({
  activeTab,
  onTabChange,
  availableTabs,
  isOwnProfile,
  isCreator = false,
  pinnedTabs: externalPinnedTabs,
}: ProfileTabMenuProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [internalPinnedTabs, setInternalPinnedTabs] = useState<ProfileTabId[]>(() => {
    const stored = loadPinnedTabs();
    // Always ensure showcase and playground are first (in that order) if available
    const alwaysPinned = ALWAYS_PINNED.filter((tab) => availableTabs.includes(tab));

    if (stored) {
      // Filter stored tabs to only include available tabs, excluding always-pinned ones
      const customTabs = stored.filter(
        (t) => availableTabs.includes(t) && !ALWAYS_PINNED.includes(t)
      );
      // Combine: always pinned first, then custom tabs
      const combined = [...alwaysPinned, ...customTabs].slice(0, MAX_PINNED);
      if (combined.length > 0) return combined;
    }
    return getDefaultPinnedTabs(availableTabs, isCreator);
  });

  // Use external pinned tabs if provided, otherwise use internal state
  const pinnedTabs = externalPinnedTabs ?? internalPinnedTabs;
  const setPinnedTabs = setInternalPinnedTabs;

  // Drag and drop state
  const [draggedTab, setDraggedTab] = useState<ProfileTabId | null>(null);
  const [dragOverTab, setDragOverTab] = useState<ProfileTabId | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get tab metadata
  const getTab = useCallback(
    (id: ProfileTabId): ProfileTab | undefined => ALL_TABS.find((t) => t.id === id),
    []
  );

  // Tabs that are not pinned (shown in dropdown)
  const unpinnedTabs = availableTabs.filter((id) => !pinnedTabs.includes(id));

  // Custom pinned tabs (excluding always-pinned tabs like showcase/playground)
  const customPinnedTabs = pinnedTabs.filter((id) => !ALWAYS_PINNED.includes(id));

  // The "+" menu is now consolidated into the "More" menu in ProfilePage
  // This component only renders the pinned tabs
  const showPlusMenu = false;

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Handle escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isDropdownOpen]);

  // Toggle pin status
  const togglePin = useCallback(
    (tabId: ProfileTabId) => {
      // Never allow unpinning always-pinned tabs (showcase, playground)
      if (ALWAYS_PINNED.includes(tabId)) return;

      setPinnedTabs((current) => {
        let newPinned: ProfileTabId[];

        if (current.includes(tabId)) {
          // Unpin - remove from custom slots
          newPinned = current.filter((t) => t !== tabId);
        } else {
          // Pin - replace oldest custom tab if at max
          if (current.length >= MAX_PINNED) {
            // Find first non-always-pinned tab to replace
            const indexToReplace = current.findIndex((t) => !ALWAYS_PINNED.includes(t));
            if (indexToReplace === -1) return current; // All are always-pinned (shouldn't happen)
            newPinned = current.filter((_, i) => i !== indexToReplace);
            newPinned.push(tabId);
          } else {
            newPinned = [...current, tabId];
          }
        }

        savePinnedTabs(newPinned);
        return newPinned;
      });
    },
    []
  );

  // Handle tab selection from dropdown
  const handleDropdownTabSelect = useCallback(
    (tabId: ProfileTabId) => {
      onTabChange(tabId);
      setIsDropdownOpen(false);
    },
    [onTabChange]
  );

  // Drag and drop handlers for reordering pinned tabs
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, tabId: ProfileTabId) => {
      // Don't allow dragging always-pinned tabs or if not profile owner
      if (!isOwnProfile || ALWAYS_PINNED.includes(tabId)) {
        e.preventDefault();
        return;
      }
      setDraggedTab(tabId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabId);
      // Add a slight delay to show the dragging state
      setTimeout(() => {
        (e.target as HTMLElement).style.opacity = '0.5';
      }, 0);
    },
    [isOwnProfile]
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLElement>) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedTab(null);
    setDragOverTab(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>, tabId: ProfileTabId) => {
      e.preventDefault();
      // Don't show drag-over state on always-pinned tabs
      if (draggedTab && draggedTab !== tabId && !ALWAYS_PINNED.includes(tabId)) {
        setDragOverTab(tabId);
      }
    },
    [draggedTab]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>, targetTabId: ProfileTabId) => {
      e.preventDefault();
      // Don't allow dropping onto always-pinned tabs or same tab
      if (!draggedTab || draggedTab === targetTabId || ALWAYS_PINNED.includes(targetTabId)) {
        setDraggedTab(null);
        setDragOverTab(null);
        return;
      }

      setPinnedTabs((current) => {
        const draggedIndex = current.indexOf(draggedTab);
        const targetIndex = current.indexOf(targetTabId);

        if (draggedIndex === -1 || targetIndex === -1) return current;

        const newPinned = [...current];
        // Remove dragged item and insert at target position
        newPinned.splice(draggedIndex, 1);
        newPinned.splice(targetIndex, 0, draggedTab);

        savePinnedTabs(newPinned);
        return newPinned;
      });

      setDraggedTab(null);
      setDragOverTab(null);
    },
    [draggedTab]
  );

  // Check if active tab is in dropdown (needs visual indicator)
  const activeTabInDropdown = unpinnedTabs.includes(activeTab);

  return (
    <div className="flex items-center space-x-1">
      {/* Pinned Tabs */}
      {pinnedTabs.map((tabId) => {
        const tab = getTab(tabId);
        if (!tab) return null;

        const isDragOver = dragOverTab === tabId;
        const isAlwaysPinned = ALWAYS_PINNED.includes(tabId);
        const canDrag = isOwnProfile && !isAlwaysPinned && pinnedTabs.length > ALWAYS_PINNED.length;

        return (
          <button
            key={tabId}
            onClick={() => onTabChange(tabId)}
            draggable={canDrag}
            onDragStart={(e) => handleDragStart(e, tabId)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, tabId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tabId
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            } ${isDragOver ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900' : ''} ${
              canDrag ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            role="tab"
            aria-selected={activeTab === tabId}
            title={canDrag ? `${tab.label} (drag to reorder)` : tab.label}
          >
            <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}

      {/* "+" Menu Button */}
      {showPlusMenu && (
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center justify-center w-9 h-9 ml-2 mr-4 rounded-lg transition-all duration-200
              backdrop-blur-md
              border
              shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
              hover:scale-[1.05] active:scale-[0.95]
              ${
              isDropdownOpen || activeTabInDropdown
                ? 'bg-primary-50/80 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 border-primary-200/60 dark:border-primary-500/30 shadow-[0_4px_12px_rgba(99,102,241,0.15),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_12px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'bg-white/70 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-white/50 dark:border-white/20 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/70 dark:hover:bg-primary-500/15 hover:border-primary-200/50 dark:hover:border-primary-500/25'
            }`}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            aria-label="More tabs"
          >
            <FontAwesomeIcon
              icon={faPlus}
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-45' : ''}`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              role="menu"
            >
              {/* Unpinned tabs */}
              {unpinnedTabs.map((tabId) => {
                const tab = getTab(tabId);
                if (!tab) return null;

                return (
                  <div
                    key={tabId}
                    className="flex items-center px-2"
                  >
                    <button
                      onClick={() => handleDropdownTabSelect(tabId)}
                      className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeTab === tabId
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                      role="menuitem"
                    >
                      <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {activeTab === tabId && (
                        <FontAwesomeIcon icon={faCheck} className="w-3 h-3 ml-auto" />
                      )}
                    </button>
                    <button
                      onClick={() => togglePin(tabId)}
                      className="p-2 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                      title="Pin to tab bar"
                      aria-label={`Pin ${tab.label} to tab bar`}
                    >
                      <FontAwesomeIcon icon={faStarOutline} className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {/* Divider */}
              {customPinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
                <div className="border-t border-gray-200 dark:border-slate-700 my-2" />
              )}

              {/* Custom pinned tabs section (for unpinning - excludes always-pinned tabs) */}
              {customPinnedTabs.length > 0 && (
                <>
                  <div className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span>Your Pinned Tabs</span>
                  </div>
                  {customPinnedTabs.map((tabId) => {
                    const tab = getTab(tabId);
                    if (!tab) return null;

                    return (
                      <div
                        key={`pinned-${tabId}`}
                        className="flex items-center px-2"
                      >
                        <button
                          onClick={() => handleDropdownTabSelect(tabId)}
                          className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                            activeTab === tabId
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                          role="menuitem"
                        >
                          <FontAwesomeIcon icon={tab.icon} className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                        <button
                          onClick={() => togglePin(tabId)}
                          className="p-2 text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                          title="Unpin from tab bar"
                          aria-label={`Unpin ${tab.label} from tab bar`}
                        >
                          <FontAwesomeIcon icon={faStarSolid} className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileTabMenu;
