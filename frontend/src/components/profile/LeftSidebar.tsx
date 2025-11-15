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
} from '@heroicons/react/24/outline';

interface LeftSidebarProps {
  onMenuClick: (menuItem: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItem {
  label: string;
  href: string;
  onClick?: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function LeftSidebar({ onMenuClick, isOpen, onToggle }: LeftSidebarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<string[]>(['EXPLORE']);

  const toggleSection = (title: string) => {
    setOpenSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
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
      items: [
        { label: 'For You', href: '#' },
        { label: 'Trending', href: '#' },
        { label: 'Topics', href: '#' },
        { label: 'Tools', href: '#' },
        { label: 'Profile', href: '#' },
      ],
    },
    {
      title: 'PLAY',
      items: [
        { label: 'Leaderboards', href: '#' },
        { label: "This Week's Challenge", href: '#' },
        { label: 'Side Quests', href: '#' },
      ],
    },
    {
      title: 'LEARN',
      items: [
        { label: 'Learning Paths', href: '#' },
        { label: 'Mentorship', href: '#' },
      ],
    },
    {
      title: 'MEMBERSHIP',
      items: [
        { label: 'Perks', href: '#' },
        { label: 'Tool Discounts', href: '#' },
        { label: 'Events Calendar', href: '#' },
        { label: 'Pricing', href: '#' },
      ],
    },
    {
      title: 'ABOUT',
      items: [
        { label: 'About Us', href: '#' },
        { label: 'Values', href: '#' },
        { label: 'Support', href: '#' },
        { label: 'Chat', href: '#' },
        { label: 'Chrome Extension', href: '#' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { label: 'My Profile', href: '#' },
        { label: 'My Projects', href: '#' },
        { label: 'My Account', href: '#' },
        { label: 'Report an Issue', href: '#' },
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
        className={`fixed md:relative w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header with close button */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <HomeIcon className="w-5 h-5" />
            <span className="font-semibold">All Thrive</span>
          </button>

          {/* Close button (mobile only) */}
          <button
            onClick={onToggle}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

      {/* Menu Sections */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-2">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <span>{section.title}</span>
              {openSections.includes(section.title) ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>

            {/* Section Items */}
            {openSections.includes(section.title) && (
              <div className="mt-1 space-y-1">
                {section.items.map((item) => (
                  <a
                    key={item.label}
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
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span className="font-medium">Log Out</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="w-full flex items-center gap-3 px-4 py-3 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
            <span className="font-medium">Log In</span>
          </button>
        )}
      </div>
      </div>
    </>
  );
}
