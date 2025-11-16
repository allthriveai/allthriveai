import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  HomeIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  icon: any;
  items: MenuItem[];
}

export function LeftSidebar({ onMenuClick, isOpen, onToggle }: LeftSidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<string[]>(['EXPLORE']);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);

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
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
      ],
    },
    {
      title: 'LEARN',
      icon: faGraduationCap,
      items: [
        { label: 'Learning Paths', href: '#' },
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
        { label: 'Chat', href: '#' },
        { label: 'Whats New', href: '#' },
        { 
          label: 'About All Thrive',
          subItems: [
            { label: 'About Us', href: '#' },
            { label: 'Our Values', href: '#' },
          ]
        },
        { label: 'Pricing', href: '#' },
      ],
    },
    {
      title: 'ACCOUNT',
      icon: faUser,
      items: [
        { label: 'My Profile', href: '#' },
        { label: 'My Projects', href: '#' },
        { label: 'My Account', href: '#' },
        { label: 'Chrome Extension', href: '#' },
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
        className={`fixed h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto z-50 transition-all duration-300 ${
          isOpen ? 'w-64 translate-x-0' : 'w-20 translate-x-0 max-md:-translate-x-full'
        }`}
      >
        {/* Header with close/collapse buttons */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          {isOpen ? (
            <>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
                <span className="font-semibold">All Thrive</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Collapse button (desktop only) */}
                <button
                  onClick={onToggle}
                  className="hidden md:block p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {/* Close button (mobile only) */}
                <button
                  onClick={onToggle}
                  className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Close sidebar"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <HomeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onToggle}
                className="hidden md:flex items-center justify-center p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      {/* Menu Sections */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full flex items-center px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors ${
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
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
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
                                  if (subItem.onClick) {
                                    e.preventDefault();
                                    subItem.onClick();
                                  }
                                }}
                                className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
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
                          if (item.onClick) {
                            e.preventDefault();
                            item.onClick();
                          }
                        }}
                        className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        {item.label}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Auth Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${
              isOpen ? '' : 'justify-center px-0'
            }`}
            title={!isOpen ? 'Log Out' : undefined}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {isOpen && <span className="font-medium">Log Out</span>}
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors ${
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
    </>
  );
}