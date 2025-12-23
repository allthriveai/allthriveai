import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSearchStore } from '@/hooks/useGlobalSearch';
import { XMarkIcon, ChevronDownIcon, ChatBubbleLeftRightIcon, MagnifyingGlassIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MenuSection, MenuItem } from './menuData';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuSections: MenuSection[];
  onMenuClick: (menuItem: string) => void;
}

export function MobileMenu({ isOpen, onClose, menuSections, onMenuClick }: MobileMenuProps) {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openSearch } = useSearchStore();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);

  const toggleSection = (title: string) => {
    setOpenSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const toggleSubItem = (label: string) => {
    setOpenSubItems(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer - Liquid Glass */}
      <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white/20 dark:bg-black/30 backdrop-blur-3xl z-50 shadow-2xl border-r border-white/30 dark:border-white/20 transform transition-transform duration-300 lg:hidden overflow-y-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5 dark:to-transparent pointer-events-none" />
        {/* Header */}
        <div className="relative flex items-center justify-between p-4 border-b border-white/20 dark:border-white/10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 dark:hover:bg-white/15 border border-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 backdrop-blur-xl"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-6 h-6 text-gray-800 dark:text-gray-200" />
          </button>
        </div>

        {/* Utility Row - Search & Theme */}
        <div className="relative p-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          {/* Search Button */}
          <button
            onClick={() => {
              openSearch();
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 dark:hover:bg-white/15 border border-white/20 hover:border-white/40 rounded-xl transition-all duration-300 hover:scale-105 backdrop-blur-xl"
          >
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Search</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 dark:hover:bg-white/15 border border-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 backdrop-blur-xl"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <SunIcon className="w-5 h-5 text-amber-300" />
            ) : (
              <MoonIcon className="w-5 h-5 text-indigo-600" />
            )}
          </button>
        </div>

        {/* Chat Button - Opens sidebar chat (except on /home where chat is embedded) */}
        {isAuthenticated && user?.username && (
          <div className="relative p-4 border-b border-white/20 dark:border-white/10">
            <button
              onClick={() => {
                onMenuClick('Chat');
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-slate-900 rounded-xl transition-all duration-300 hover:scale-[1.02] font-medium shadow-lg shadow-cyan-500/30 border border-white/20"
              style={{
                background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
              }}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              Chat with Ember
            </button>
          </div>
        )}

        {/* Menu Sections */}
        <nav className="relative p-4 space-y-2">
          {menuSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {/* Section Header */}
              <button
                onClick={() => {
                  if (section.items.length > 0) {
                    toggleSection(section.title);
                  } else if (section.path) {
                    navigate(section.path);
                    onClose();
                  } else if (section.onClick) {
                    section.onClick();
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl border border-white/10 hover:border-white/30"
              >
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon icon={section.icon} className="w-4 h-4" />
                  <span>{section.title}</span>
                </div>
                {section.items.length > 0 && (
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform ${
                      openSections.includes(section.title) ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {/* Section Items */}
              {openSections.includes(section.title) && section.items.length > 0 && (
                <div className="ml-4 space-y-1">
                  {section.items.map((item) => (
                    <div key={item.label}>
                      {item.subItems ? (
                        // Item with submenu
                        <>
                          <button
                            onClick={() => toggleSubItem(item.label)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
                          >
                            <div className="flex items-center gap-2">
                              {item.icon && (
                                <FontAwesomeIcon
                                  icon={item.icon}
                                  className="w-4 h-4 !text-gray-400 dark:!text-gray-500"
                                />
                              )}
                              <span>{item.label}</span>
                            </div>
                            <ChevronDownIcon
                              className={`w-4 h-4 transition-transform ${
                                openSubItems.includes(item.label) ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {openSubItems.includes(item.label) && (
                            <div className="ml-4 space-y-1 mt-1">
                              {item.subItems.map((subItem) => (
                                <button
                                  key={subItem.label}
                                  onClick={() => handleItemClick(subItem)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
                                >
                                  <div className="flex items-center gap-2">
                                    {subItem.icon && (
                                      <FontAwesomeIcon
                                        icon={subItem.icon}
                                        className="w-3.5 h-3.5 !text-gray-400 dark:!text-gray-500"
                                      />
                                    )}
                                    <span>{subItem.label}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        // Regular menu item
                        <button
                          onClick={() => handleItemClick(item)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-all duration-200 backdrop-blur-xl ${
                            item.path === '#'
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : item.className
                                ? `${item.className} hover:bg-white/20 dark:hover:bg-white/10 hover:scale-[1.02]`
                                : 'text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/10 hover:scale-[1.02]'
                          }`}
                          disabled={item.path === '#'}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.icon && (
                                <FontAwesomeIcon
                                  icon={item.icon}
                                  className={`w-4 h-4 ${item.className ? item.className : '!text-gray-400 dark:!text-gray-500'}`}
                                />
                              )}
                              <span>{item.label}</span>
                            </div>
                            {item.path === '#' && (
                              <span className="text-xs text-gray-400 dark:text-gray-600">
                                Soon
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
