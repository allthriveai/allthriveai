/**
 * LearningChatPlusMenu - Simplified plus menu for learning chat
 *
 * Only includes essential options:
 * - Upload a file
 * - Ask for help
 * - Clear conversation
 */

import { useEffect, useRef, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudArrowUp,
  faCircleQuestion,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';

export type LearningMenuAction = 'upload-file' | 'ask-help' | 'clear-conversation';

interface LearningChatPlusMenuProps {
  onAction: (action: LearningMenuAction) => void;
  disabled?: boolean;
}

interface MenuOption {
  action: LearningMenuAction;
  label: string;
  icon: typeof faCloudArrowUp;
  description: string;
}

const menuOptions: MenuOption[] = [
  {
    action: 'upload-file',
    label: 'Upload File',
    icon: faCloudArrowUp,
    description: 'Share an image or document',
  },
  {
    action: 'ask-help',
    label: 'Ask for Help',
    icon: faCircleQuestion,
    description: 'Get help with learning topics',
  },
  {
    action: 'clear-conversation',
    label: 'Clear Conversation',
    icon: faTrashCan,
    description: 'Start a fresh conversation',
  },
];

export function LearningChatPlusMenu({ onAction, disabled = false }: LearningChatPlusMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(0);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          setFocusedIndex(0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
          break;
        case 'Enter':
          handleSelect(menuOptions[focusedIndex].action);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex]);

  const handleSelect = (action: LearningMenuAction) => {
    setIsOpen(false);
    setFocusedIndex(0);
    onAction(action);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(!isOpen);
    setFocusedIndex(0);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="More options"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <PlusIcon className="w-5 h-5 text-gray-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 bottom-full mb-2 w-56 origin-bottom-left bg-slate-800 rounded-lg shadow-lg ring-1 ring-white/10 focus:outline-none z-50"
        >
          <div className="p-1.5">
            {menuOptions.map((option, index) => (
              <button
                key={option.action}
                role="menuitem"
                onClick={() => handleSelect(option.action)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`
                  w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors
                  ${focusedIndex === index ? 'bg-white/10' : 'hover:bg-white/5'}
                `}
              >
                <FontAwesomeIcon
                  icon={option.icon}
                  className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-400">
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

export default LearningChatPlusMenu;
