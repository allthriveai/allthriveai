import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTheme } from '@/hooks/useTheme';
import type { MenuSection, MenuItem } from './menuData';

interface NavDropdownProps {
  label: string;
  section: MenuSection;
  isActive?: boolean;
}

export function NavDropdown({ label, section, isActive }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setOpenSubItems([]);
    }, 200);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.path && item.path !== '#') {
      if (item.external) {
        window.open(item.path, '_blank', 'noopener,noreferrer');
      } else {
        navigate(item.path);
      }
    }
    setIsOpen(false);
    setOpenSubItems([]);
  };

  const toggleSubItem = (label: string) => {
    setOpenSubItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dropdown Trigger - Click to navigate, Hover to show dropdown */}
      <button
        onClick={() => {
          // Navigate to section path if available
          if (section.path) {
            if (section.onClick) {
              section.onClick();
            } else {
              navigate(section.path);
            }
          }
        }}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 backdrop-blur-xl border ${
          isActive || isOpen
            ? 'bg-teal-400/[0.15] dark:bg-teal-500/[0.12] text-teal-700 dark:text-teal-300 border-teal-400/40 dark:border-teal-500/40 shadow-lg shadow-teal-500/20'
            : 'bg-white/[0.05] hover:bg-white/[0.15] dark:bg-white/[0.03] dark:hover:bg-white/[0.1] text-gray-900 dark:text-gray-100 border-white/20 hover:border-white/40 hover:shadow-lg hover:shadow-black/5'
        }`}
      >
        {label}
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu - Light/Dark mode support */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-64 rounded-2xl shadow-2xl border border-white/30 dark:border-white/20 py-2 animate-fade-in transition-all duration-200 animate-scale-in overflow-hidden"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          <div className="relative">
          {section.items.map((item) => (
            <div key={item.label}>
              {item.subItems ? (
                // Item with submenu
                <>
                  <button
                    onClick={() => toggleSubItem(item.label)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-white/[0.15] dark:hover:bg-white/[0.1] rounded-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
                  >
                    <span>{item.label}</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform ${
                        openSubItems.includes(item.label) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openSubItems.includes(item.label) && (
                    <div className="bg-white/[0.08] dark:bg-white/[0.05] rounded-xl mt-1 backdrop-blur-xl">
                      {item.subItems.map((subItem) => (
                        <button
                          key={subItem.label}
                          onClick={() => handleItemClick(subItem)}
                          className="w-full text-left px-8 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-white/[0.15] dark:hover:bg-white/[0.1] hover:text-gray-900 dark:hover:text-gray-100 rounded-lg transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
                        >
                          {subItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Regular menu item
                <button
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-all duration-200 rounded-xl backdrop-blur-xl ${
                    item.path === '#'
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-white/[0.15] dark:hover:bg-white/[0.1] hover:scale-[1.02]'
                  }`}
                  disabled={item.path === '#'}
                >
                  <div className="flex items-center gap-2">
                    {item.label}
                    {item.path === '#' && (
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        Coming soon
                      </span>
                    )}
                    {item.external && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </div>
                </button>
              )}
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
