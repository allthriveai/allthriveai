import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';
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
import {
  faCompass,
  faGamepad,
  faGraduationCap,
  faCrown,
  faUser,
  faLifeRing,
} from '@fortawesome/free-solid-svg-icons';

interface LeftSidebarProps {
  onMenuClick: (menuItem: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  subItems?: MenuItem[];
}

interface MenuSection {
  title: string;
  icon: typeof import('@fortawesome/free-solid-svg-icons').IconDefinition;
  items: MenuItem[];
}

export function LeftSidebar({ onMenuClick, isOpen, onToggle }: LeftSidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<string[]>(['EXPLORE']);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Debug: log user object when it changes
  useEffect(() => {
    console.log('LeftSidebar user:', user);
  }, [user]);

  const toggleSection = (title: string) => {
    setOpenSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    );
  };

  const toggleSubItem = (label: string) => {
    setOpenSubItems(prev =>
      prev.includes(label)
        ? prev.filter(s => s !== label)
        : [...prev, label]
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleComingSoon = () => {
    setShowComingSoon(true);
  };

  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => {
        setShowComingSoon(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  // Filter menu sections and items based on search query
  const filterMenuSections = (sections: MenuSection[]): MenuSection[] => {
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase();
    return sections
      .map(section => {
        // Check if section title matches
        const sectionMatches = section.title.toLowerCase().includes(query);

        // Filter items that match the query
        const filteredItems = section.items.filter(item => {
          const itemMatches = item.label.toLowerCase().includes(query);
          const subItemMatches = item.subItems?.some(subItem =>
            subItem.label.toLowerCase().includes(query)
          );
          return itemMatches || subItemMatches;
        });

        // Include section if title matches OR if any items match
        if (sectionMatches || filteredItems.length > 0) {
          return {
            ...section,
            items: sectionMatches ? section.items : filteredItems,
          };
        }
        return null;
      })
      .filter((section): section is MenuSection => section !== null);
  };

  // Auto-expand sections when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      // Open all sections that have matching results
      const matchingSections = filterMenuSections(menuSections).map(s => s.title);
      setOpenSections(matchingSections);

      // Open all sub-items that have matching results
      const matchingSubItems: string[] = [];
      menuSections.forEach(section => {
        section.items.forEach(item => {
          if (item.subItems?.some(sub =>
            sub.label.toLowerCase().includes(searchQuery.toLowerCase())
          )) {
            matchingSubItems.push(item.label);
          }
        });
      });
      setOpenSubItems(matchingSubItems);
    }
  }, [searchQuery]);

  const menuSections: MenuSection[] = [
    {
      title: 'EXPLORE',
      icon: faCompass,
      items: [
        { label: 'For You', href: '#' },
        { label: 'Trending', href: '#' },
        { label: 'By Topics', href: '#' },
        { label: 'By Tools', href: '#' },
        { label: 'Top Profiles', href: '#' },
      ],
    },
    {
      title: 'PLAY',
      icon: faGamepad,
      items: [
        { label: 'Leaderboards', href: '#' },
        { label: 'Vote', href: '#' },
        { label: "This Week's Challenge", href: '#' },
        { label: 'Side Quests', href: '#' },
        { label: 'Prompt Battle', onClick: () => navigate('/play/prompt-battle') },
      ],
    },
    {
      title: 'LEARN',
      icon: faGraduationCap,
      items: [
        { label: 'Learning Paths', href: '#' },
        { label: 'Quick Quizzes', onClick: () => navigate('/quick-quizzes') },
        { label: 'Mentorship Program', href: '#' },
      ],
    },
    {
      title: 'MEMBERSHIP',
      icon: faCrown,
      items: [
        { label: 'Perks', href: '#' },
        { label: 'Events Calendar', href: '#' },
      ],
    },
    {
      title: 'SUPPORT',
      icon: faLifeRing,
      items: [
        { label: 'Report an Issue', href: '#' },
        { label: 'Chat', onClick: () => onMenuClick('Chat') },
        { label: 'Whats New', href: '#' },
        {
          label: 'About All Thrive',
          subItems: [
            { label: 'About Us', onClick: () => onMenuClick('About Us') },
            { label: 'Our Values', onClick: () => onMenuClick('Our Values') },
          ]
        },
        { label: 'Pricing', href: '#' },
      ],
    },
    {
      title: 'ACCOUNT',
      icon: faUser,
      items: [
        {
          label: 'My Profile',
          href: '#',
          onClick: () => {
            if (user && user.username) {
              navigate(`/${user.username}?tab=showcase`);
            }
          }
        },
        {
          label: 'My Projects',
          href: '#',
          onClick: () => {
            if (user && user.username) {
              navigate(`/${user.username}?tab=playground`);
            }
          }
        },
        { label: 'My Account', onClick: () => navigate('/account/settings') },
        { label: 'Chrome Extension', href: '#' },
        { label: 'My Referral Codes', onClick: () => navigate('/account/settings/referrals') },
      ],
    },
  ];

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
        className={`fixed h-screen glass-strong flex flex-col overflow-y-auto z-50 transition-all duration-300 ${
          isOpen ? 'w-64 translate-x-0' : 'w-20 translate-x-0 max-md:-translate-x-full'
        }`}
      >
        {/* Header with close/collapse buttons */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          {isOpen ? (
            <>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="font-semibold">All Thrive</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Collapse button (desktop only) */}
                <button
                  onClick={onToggle}
                  className="hidden md:block p-2 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Close button (mobile only) */}
                <button
                  onClick={onToggle}
                  className="md:hidden p-2 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors"
                  aria-label="Close sidebar"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
          <div className="px-4 pt-4 pb-2">
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
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filterMenuSections(menuSections).length > 0 ? (
          filterMenuSections(menuSections).map((section) => (
          <div key={section.title} className="mb-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full flex items-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors ${
                isOpen ? 'justify-between' : 'justify-center'
              }`}
              title={!isOpen ? section.title : undefined}
            >
              <div className={`flex items-center gap-3 ${
                isOpen ? '' : 'justify-center'
              }`}>
                <FontAwesomeIcon icon={section.icon} className="w-4 h-4" />
                {isOpen && <span>{section.title}</span>}
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
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-white/5 rounded-md transition-colors"
                        >
                          <span>{item.label}</span>
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
                                href={subItem.href}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (subItem.onClick) {
                                    subItem.onClick();
                                  } else if (subItem.href === '#') {
                                    handleComingSoon();
                                  }
                                }}
                                className="block px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-white/10 dark:hover:bg-white/5 rounded-md transition-colors"
                              >
                                {subItem.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      // Regular item
                      <a
                        href={item.href}
                        onClick={(e) => {
                          e.preventDefault();
                          if (item.onClick) {
                            item.onClick();
                          } else if (item.href === '#') {
                            handleComingSoon();
                          }
                        }}
                        className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/10 dark:hover:bg-white/5 rounded-md transition-colors"
                      >
                        {item.label}
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
      <div className="p-4 border-t border-white/10 space-y-2">
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
            <span className="font-medium">
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
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {isOpen && <span className="font-medium">Log Out</span>}
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-primary-500 dark:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-primary-500/10 rounded-lg transition-colors ${
              isOpen ? '' : 'justify-center px-0'
            }`}
            title={!isOpen ? 'Log In' : undefined}
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            {isOpen && <span className="font-medium">Log In</span>}
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
