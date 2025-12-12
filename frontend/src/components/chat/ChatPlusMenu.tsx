import React, { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFigma, faGithub, faGitlab, faLinkedin, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faBagShopping, faCircleQuestion, faCommentDots, faEllipsis, faLink, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/hooks/useAuth';

export type IntegrationType = 'github' | 'gitlab' | 'figma' | 'youtube' | 'linkedin' | 'create-visual' | 'ask-help' | 'describe' | 'create-product' | 'import-url' | 'clear-conversation';

interface ChatPlusMenuProps {
  onIntegrationSelect: (type: IntegrationType) => void;
  disabled?: boolean;
  /** Controlled open state - lifted to parent to survive re-renders */
  isOpen: boolean;
  /** Callback when open state should change */
  onOpenChange: (open: boolean) => void;
}

interface IntegrationOption {
  type: IntegrationType;
  label: string;
  icon: typeof faGithub | string; // string for emoji
  description: string;
  available: boolean;
  isPrimary?: boolean; // Show in main menu vs "More" submenu
}

const integrationOptions: IntegrationOption[] = [
  // Primary options - always visible
  {
    type: 'import-url',
    label: 'Import from URL',
    icon: faLink,
    description: 'Paste any webpage to create a project',
    available: true,
    isPrimary: true,
  },
  {
    type: 'create-visual',
    label: 'Create Image/Infographic',
    icon: '🍌',
    description: 'Generate visuals with AI',
    available: true,
    isPrimary: true,
  },
  {
    type: 'ask-help',
    label: 'Ask for Help',
    icon: faCircleQuestion,
    description: 'Browse common questions & get help',
    available: true,
    isPrimary: true,
  },
  {
    type: 'clear-conversation',
    label: 'Clear Conversation',
    icon: faTrashCan,
    description: 'Start fresh (you can also use /clear)',
    available: true,
    isPrimary: true,
  },
  // Secondary options - in "More Integrations" submenu
  {
    type: 'github',
    label: 'Add from GitHub',
    icon: faGithub,
    description: 'Import a repository',
    available: true,
    isPrimary: false,
  },
  {
    type: 'gitlab',
    label: 'Add from GitLab',
    icon: faGitlab,
    description: 'Import a project',
    available: true,
    isPrimary: false,
  },
  {
    type: 'figma',
    label: 'Add from Figma',
    icon: faFigma,
    description: 'Import a design',
    available: true,
    isPrimary: false,
  },
  {
    type: 'youtube',
    label: 'Add from YouTube',
    icon: faYoutube,
    description: 'Import a video',
    available: true,
    isPrimary: false,
  },
  {
    type: 'linkedin',
    label: 'Add from LinkedIn',
    icon: faLinkedin,
    description: 'Import from your profile',
    available: true,
    isPrimary: false,
  },
  {
    type: 'describe',
    label: 'Describe Anything',
    icon: faCommentDots,
    description: 'Tell me about your project',
    available: true,
    isPrimary: false,
  },
  {
    type: 'create-product',
    label: 'Create Product',
    icon: faBagShopping,
    description: 'Coming Soon',
    available: false,
    isPrimary: false,
  },
];

export function ChatPlusMenu({ onIntegrationSelect, disabled = false, isOpen, onOpenChange }: ChatPlusMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const { user } = useAuth();

  // Filter integration options based on user role
  // Only admins and creators can see "Create Product"
  const isCreatorOrAdmin = user?.role === 'creator' || user?.role === 'admin';
  const filteredOptions = integrationOptions.filter(option => {
    if (option.type === 'create-product') {
      return isCreatorOrAdmin;
    }
    return true;
  });

  const primaryOptions = filteredOptions.filter(opt => opt.isPrimary);
  const secondaryOptions = filteredOptions.filter(opt => !opt.isPrimary);

  // Click-outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
        setShowMoreMenu(false);
        setFocusedIndex(0);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  // Reset submenu when main menu closes
  useEffect(() => {
    if (!isOpen) {
      setShowMoreMenu(false);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      const currentOptions = showMoreMenu ? secondaryOptions : primaryOptions;
      const totalItems = showMoreMenu ? currentOptions.length : currentOptions.length + 1; // +1 for "More" button

      switch (event.key) {
        case 'Escape':
          if (showMoreMenu) {
            setShowMoreMenu(false);
            setFocusedIndex(primaryOptions.length); // Focus on "More" button
          } else {
            onOpenChange(false);
            setFocusedIndex(0);
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case 'ArrowRight':
          if (!showMoreMenu && focusedIndex === primaryOptions.length) {
            setShowMoreMenu(true);
            setFocusedIndex(0);
          }
          break;
        case 'ArrowLeft':
          if (showMoreMenu) {
            setShowMoreMenu(false);
            setFocusedIndex(primaryOptions.length);
          }
          break;
        case 'Enter':
          if (showMoreMenu) {
            if (focusedIndex >= 0 && focusedIndex < secondaryOptions.length) {
              handleSelect(secondaryOptions[focusedIndex].type);
            }
          } else {
            if (focusedIndex < primaryOptions.length) {
              handleSelect(primaryOptions[focusedIndex].type);
            } else if (focusedIndex === primaryOptions.length) {
              setShowMoreMenu(true);
              setFocusedIndex(0);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, onOpenChange, showMoreMenu, primaryOptions, secondaryOptions]);

  const handleSelect = (type: IntegrationType) => {
    onOpenChange(false);
    setShowMoreMenu(false);
    setFocusedIndex(0);
    onIntegrationSelect(type);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onOpenChange(!isOpen);
    setFocusedIndex(0);
  };

  const renderOption = (option: IntegrationOption, index: number, isFocused: boolean) => (
    <button
      key={option.type}
      role="menuitem"
      onClick={() => option.available && handleSelect(option.type)}
      onMouseEnter={() => setFocusedIndex(index)}
      disabled={!option.available}
      className={`
        w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors
        ${isFocused && option.available ? 'bg-slate-100 dark:bg-slate-700' : ''}
        ${!option.available ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {typeof option.icon === 'string' ? (
        <span className="text-xl leading-none mt-0.5 flex-shrink-0">{option.icon}</span>
      ) : (
        <FontAwesomeIcon icon={option.icon} className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {option.label}
          {!option.available && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Coming Soon
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400">
          {option.available ? option.description : 'This feature is coming soon'}
        </div>
      </div>
    </button>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        onMouseDown={(e) => {
          // Prevent the click-outside handler from firing on the same event
          e.stopPropagation();
        }}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add integration"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 bottom-full mb-2 w-64 origin-bottom-left bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
        >
          <div className="p-2">
            {/* Primary options */}
            {primaryOptions.map((option, index) =>
              renderOption(option, index, focusedIndex === index && !showMoreMenu)
            )}

            {/* Divider */}
            <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

            {/* More Integrations button */}
            <div className="relative">
              <button
                role="menuitem"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                onMouseEnter={() => setFocusedIndex(primaryOptions.length)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors
                  ${focusedIndex === primaryOptions.length ? 'bg-slate-100 dark:bg-slate-700' : ''}
                  ${showMoreMenu ? 'bg-slate-100 dark:bg-slate-700' : ''}
                `}
              >
                <FontAwesomeIcon icon={faEllipsis} className="w-5 h-5 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    More Integrations
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400" />
              </button>

              {/* Submenu - positioned above the main menu */}
              {showMoreMenu && (
                <div
                  role="menu"
                  className="absolute left-0 bottom-full mb-1 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                  onMouseLeave={() => {
                    // Only close if mouse leaves to the left (back to main menu)
                    // Keep open if moving within submenu
                  }}
                >
                  <div className="p-2">
                    {secondaryOptions.map((option, index) =>
                      renderOption(option, index, focusedIndex === index && showMoreMenu)
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
