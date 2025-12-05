import React, { useEffect, useRef, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faBagShopping, faCircleQuestion, faCommentDots } from '@fortawesome/free-solid-svg-icons';

export type IntegrationType = 'github' | 'youtube' | 'create-visual' | 'ask-help' | 'describe' | 'create-product';

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
}

const integrationOptions: IntegrationOption[] = [
  {
    type: 'github',
    label: 'Add from GitHub',
    icon: faGithub,
    description: 'Import a repository',
    available: true,
  },
  {
    type: 'youtube',
    label: 'Add from YouTube',
    icon: faYoutube,
    description: 'Import a video',
    available: true,
  },
  {
    type: 'create-visual',
    label: 'Create Image/Infographic',
    icon: '🍌',
    description: 'Generate visuals with AI',
    available: true,
  },
  {
    type: 'describe',
    label: 'Describe Anything',
    icon: faCommentDots,
    description: 'Tell me about your project',
    available: true,
  },
  {
    type: 'ask-help',
    label: 'Ask for Help',
    icon: faCircleQuestion,
    description: 'Browse common questions & get help',
    available: true,
  },
  {
    type: 'create-product',
    label: 'Create Product',
    icon: faBagShopping,
    description: 'Create a course, template, or digital product',
    available: true,
  },
];

export function ChatPlusMenu({ onIntegrationSelect, disabled = false, isOpen, onOpenChange }: ChatPlusMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Debug: log state changes
  console.log('[ChatPlusMenu] isOpen:', isOpen);

  // Click-outside handler to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
        setFocusedIndex(0);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          onOpenChange(false);
          setFocusedIndex(0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < integrationOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : integrationOptions.length - 1
          );
          break;
        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < integrationOptions.length) {
            handleSelect(integrationOptions[focusedIndex].type);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, onOpenChange]);

  const handleSelect = (type: IntegrationType) => {
    onOpenChange(false);
    setFocusedIndex(0);
    onIntegrationSelect(type);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ChatPlusMenu] toggleMenu called, disabled:', disabled, 'current isOpen:', isOpen);
    if (disabled) return;
    console.log('[ChatPlusMenu] calling onOpenChange with:', !isOpen);
    onOpenChange(!isOpen);
    setFocusedIndex(0);
  };

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
            {/* Available integrations */}
            {integrationOptions.map((option, index) => (
              <button
                key={option.type}
                role="menuitem"
                onClick={() => handleSelect(option.type)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`
                  w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors
                  ${focusedIndex === index ? 'bg-slate-100 dark:bg-slate-700' : ''}
                `}
              >
                {typeof option.icon === 'string' ? (
                  <span className="text-xl leading-none mt-0.5 flex-shrink-0">{option.icon}</span>
                ) : (
                  <FontAwesomeIcon icon={option.icon} className="w-5 h-5 text-slate-700 dark:text-slate-300 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {option.label}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
