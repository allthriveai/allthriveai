import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  HomeIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getMenuSections, ROUTE_PATTERNS, TIMING, TOOLS_ICON, type MenuItem } from './menuData';
import { useMenuState } from './useMenuState';
import { getTools } from '@/services/tools';
import type { Tool } from '@/types/models';

interface LeftSidebarProps {
  onMenuClick: (menuItem: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function LeftSidebar({ onMenuClick, isOpen, onToggle }: LeftSidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);

  // Load tools on mount
  useEffect(() => {
    async function loadTools() {
      try {
        const response = await getTools({ ordering: 'name' });
        setTools(response.results);
      } catch (err) {
        console.error('Failed to load tools for sidebar:', err);
        // Fail silently - sidebar will work without tools
      }
    }
    loadTools();
  }, []);

  // Memoized menu sections (base sections without tools)
  const menuSections = useMemo(
    () => getMenuSections(onMenuClick, user?.username),
    [onMenuClick, user?.username]
  );

  // Memoized menu sections WITH tools (only used when searching)
  const menuSectionsWithTools = useMemo(() => {
    if (!searchQuery.trim() || tools.length === 0) {
      return menuSections;
    }

    // When searching, add tools as a searchable section
    const sections = [...menuSections];
    sections.push({
      title: 'TOOLS',
      icon: TOOLS_ICON,
      items: tools.map(tool => ({
        label: tool.name,
        path: `/tools/${tool.slug}`,
      })),
    });

    return sections;
  }, [menuSections, tools, searchQuery]);

  // Helper function to check if a menu item is active
  const isMenuItemActive = useCallback(
    (item: MenuItem): boolean => {
      const currentPath = location.pathname;
      const currentSearch = location.search;

      // Check if item has a direct path match (not # placeholders or external)
      if (item.path && item.path !== '#' && !item.external) {
        // Exact match for paths without query params
        if (!item.path.includes('?')) {
          return currentPath === item.path;
        }
        // For paths with query params, match both path and search
        const [itemPath, itemSearch] = item.path.split('?');
        return currentPath === itemPath && currentSearch.includes(itemSearch);
      }

      // Check for specific route patterns
      const pattern = ROUTE_PATTERNS[item.label];
      if (pattern) {
        return pattern(currentPath, currentSearch, user?.username);
      }

      return false;
    },
    [location.pathname, location.search, user?.username]
  );

  // Use custom hook for menu state management
  const {
    openSections,
    openSubItems,
    filteredMenuSections,
    toggleSection,
    toggleSubItem,
  } = useMenuState({
    menuSections: menuSectionsWithTools,
    isMenuItemActive,
    searchQuery,
    pathname: location.pathname,
    search: location.search,
    username: user?.username,
  });

  // Handle logout with error notification
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // TODO: Show toast notification to user
      alert('Failed to log out. Please try again.');
    }
  }, [logout, navigate]);

  // Handle coming soon notification
  const handleComingSoon = useCallback(() => {
    setShowComingSoon(true);
  }, []);

  // Auto-hide coming soon toast
  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => {
        setShowComingSoon(false);
      }, TIMING.COMING_SOON_DURATION);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  // Shared click handler for menu items
  const handleMenuItemClick = useCallback(
    (e: React.MouseEvent, item: MenuItem) => {
      // Don't prevent default for external links
      if (item.external && item.path?.startsWith('http')) {
        return;
      }

      e.preventDefault();

      if (item.onClick) {
        item.onClick();
      } else if (item.path === '#') {
        handleComingSoon();
      } else if (item.path && !item.external) {
        navigate(item.path);
      }
    },
    [navigate, handleComingSoon]
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed h-screen glass-strong flex flex-col z-50 transition-all duration-300 ${
          isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'
        } overflow-hidden`}
      >
        {/* Header with close/collapse buttons */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          {isOpen ? (
            <>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <HomeIcon className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold whitespace-nowrap transition-opacity duration-300">
                  All Thrive
                </span>
              </button>

              <div className="flex items-center gap-2">
                {/* Close/Collapse button */}
                <button
                  onClick={onToggle}
                  className="p-2 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Close sidebar"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 md:hidden" />
                  <ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 hidden md:block" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onToggle}
                className="hidden md:flex items-center justify-center p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        {isOpen && (
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/20 rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 dark:hover:bg-white/5 rounded transition-colors"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Menu Sections */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {filteredMenuSections.length > 0 ? (
            filteredMenuSections.map((section) => (
              <div key={section.title} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.title, isOpen, onToggle)}
                  className={`w-full flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                    isOpen ? 'justify-between' : 'justify-center'
                  } ${
                    openSections.includes(section.title)
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                  title={!isOpen ? section.title : undefined}
                >
                  <div className={`flex items-center gap-3 ${isOpen ? '' : 'justify-center'}`}>
                    <FontAwesomeIcon icon={section.icon} className="w-4 h-4 flex-shrink-0" />
                    {isOpen && (
                      <span className="whitespace-nowrap transition-opacity duration-300">
                        {section.title}
                      </span>
                    )}
                  </div>
                  {isOpen && (
                    openSections.includes(section.title) ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )
                  )}
                </button>

                {/* Section Items */}
                {isOpen && openSections.includes(section.title) && (
                  <div className="mt-1 space-y-1">
                    {section.items.map((item) => (
                      <div key={item.label}>
                        {item.subItems ? (
                          // Item with submenu
                          <>
                            <button
                              onClick={() => toggleSubItem(item.label)}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all ${
                                openSubItems.includes(item.label)
                                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 font-normal'
                              }`}
                            >
                              <span className="whitespace-nowrap">{item.label}</span>
                              {openSubItems.includes(item.label) ? (
                                <ChevronUpIcon className="w-3 h-3" />
                              ) : (
                                <ChevronDownIcon className="w-3 h-3" />
                              )}
                            </button>
                            {openSubItems.includes(item.label) && (
                              <div className="ml-4 mt-1 space-y-1">
                                {item.subItems.map((subItem) => (
                                  <a
                                    key={subItem.label}
                                    href={subItem.path || '#'}
                                    onClick={(e) => handleMenuItemClick(e, subItem)}
                                    target={subItem.external ? '_blank' : undefined}
                                    rel={subItem.external ? 'noopener noreferrer' : undefined}
                                    className={`block px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                                      isMenuItemActive(subItem)
                                        ? 'bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-semibold'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 font-normal'
                                    }`}
                                  >
                                    <span className="whitespace-nowrap">{subItem.label}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          // Regular item
                          <a
                            href={item.path || '#'}
                            onClick={(e) => handleMenuItemClick(e, item)}
                            target={item.external ? '_blank' : undefined}
                            rel={item.external ? 'noopener noreferrer' : undefined}
                            className={`block px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                              isMenuItemActive(item)
                                ? 'bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-100 font-normal'
                            }`}
                          >
                            <span className="whitespace-nowrap">{item.label}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}
        </nav>

        {/* Theme Toggle & Auth Button */}
        <div className="p-4 border-t border-white/10 space-y-2 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors ${
              isOpen ? '' : 'justify-center px-0'
            }`}
            title={!isOpen ? (theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode') : undefined}
          >
            {theme === 'light' ? (
              <MoonIcon className="w-5 h-5" />
            ) : (
              <SunIcon className="w-5 h-5" />
            )}
            {isOpen && (
              <span className="font-medium whitespace-nowrap transition-opacity duration-300">
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </span>
            )}
          </button>

          {/* Auth Button */}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 rounded-lg transition-colors ${
                isOpen ? '' : 'justify-center px-0'
              }`}
              title={!isOpen ? 'Log Out' : undefined}
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <span className="font-medium whitespace-nowrap transition-opacity duration-300">
                  Log Out
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-primary-500 dark:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-primary-500/10 rounded-lg transition-colors ${
                isOpen ? '' : 'justify-center px-0'
              }`}
              title={!isOpen ? 'Log In' : undefined}
            >
              <ArrowLeftOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <span className="font-medium whitespace-nowrap transition-opacity duration-300">
                  Log In
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Coming Soon Toast */}
      {showComingSoon && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="glass-strong px-6 py-4 rounded-xl shadow-glass-xl border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Coming Soon! 🚀
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
