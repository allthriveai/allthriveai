import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useActiveQuest } from '@/hooks/useActiveQuest';
import { useSearchStore } from '@/hooks/useGlobalSearch';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  SunIcon,
  MoonIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { getMenuSections } from './menuData';
import { NavDropdown } from './NavDropdown';
import { MobileMenu } from './MobileMenu';
import { UserMenu } from './UserMenu';
import { ActiveQuestIndicator } from '@/components/side-quests/ActiveQuestIndicator';
import { GlobalSearchModal } from '@/components/search/GlobalSearchModal';
import { useMessagesTrayOptional } from '@/context/MessagesTrayContext';

interface TopNavigationProps {
  onMenuClick: (menuItem: string) => void;
  onOpenActiveQuest?: () => void;
}

export function TopNavigation({ onMenuClick, onOpenActiveQuest }: TopNavigationProps) {
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeQuest, abandonQuest, isAbandoningQuest, activeQuestColors, activeQuestCategory } = useActiveQuest();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openSearch } = useSearchStore();
  const messagesTray = useMessagesTrayOptional();

  const menuSections = getMenuSections(onMenuClick, user?.username);

  // Main navigation items (sections that should appear in top nav)
  // menuSections: [0]=Discover, [1]=Play, [2]=Connect, [3]=Account
  const mainNavItems = [
    { label: 'Discover', path: '/explore', section: menuSections[0] },
    { label: 'Play', section: menuSections[1] },
    { label: 'Connect', section: menuSections[2] },
  ];

  const isActivePath = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  return (
    <>
      {/* Top Navigation Bar - Liquid Glass Effect */}
      <nav
        className="fixed left-0 right-0 z-50 border-b border-white/20 dark:border-white/10"
        style={{
          top: 'var(--impersonation-offset, 0)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative">

            {/* Centered Mobile Logo */}
            <button
              onClick={() => navigate('/home')}
              className="sm:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-gray-900 dark:text-white transition-all duration-300 hover:scale-105"
            >
              <img
                src="/all-thrvie-logo.png"
                alt="All Thrive"
                className="h-8 w-auto"
              />
            </button>

            {/* Left Side - Hamburger (mobile) & Logo + Nav (desktop) */}
            <div className="flex items-center gap-4 sm:gap-8 shrink-0">
              {/* Mobile Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300 hover:scale-105"
                aria-label="Open menu"
              >
                <Bars3Icon className="w-6 h-6 text-gray-800 dark:text-gray-100" />
              </button>

              {/* Logo - Hidden on mobile, shown on desktop */}
              <button
                onClick={() => navigate('/home')}
                className="hidden sm:flex items-center gap-2 text-gray-900 dark:text-white transition-all duration-300 hover:scale-105"
              >
                <img
                  src="/all-thrvie-logo.png"
                  alt="All Thrive"
                  className="h-8 w-auto"
                />
              </button>

              {/* Desktop Navigation Links */}
              <div className="hidden lg:flex items-center gap-1">
                {mainNavItems.map((item) => (
                  item.section.items.length > 0 ? (
                    // Dropdown for sections with items
                    <NavDropdown
                      key={item.label}
                      label={item.label}
                      section={item.section}
                      isActive={item.path ? isActivePath(item.path) : false}
                    />
                  ) : (
                    // Direct link for sections without items
                    <button
                      key={item.label}
                      onClick={() => item.path && navigate(item.path)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-105 border ${
                        isActivePath(item.path)
                          ? 'bg-teal-400/[0.08] text-teal-700 dark:text-teal-300 border-teal-400/40 shadow-lg shadow-teal-500/10'
                          : 'hover:bg-white/[0.08] text-gray-900 dark:text-gray-100 border-transparent hover:border-white/30'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                ))}
              </div>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center justify-end gap-2">
              {/* Active Quest Indicator */}
              {isAuthenticated && activeQuest && onOpenActiveQuest && (
                <ActiveQuestIndicator
                  activeQuest={activeQuest}
                  onClick={onOpenActiveQuest}
                  onAbandon={abandonQuest}
                  isAbandoning={isAbandoningQuest}
                  colors={activeQuestColors}
                  category={activeQuestCategory}
                />
              )}

              {/* Search Button - Hidden on mobile, in hamburger menu */}
              <button
                onClick={openSearch}
                className="hidden sm:block p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300 hover:scale-105"
                aria-label="Search"
                title="Search (⌘K)"
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
              </button>

              {/* Chat Button - Opens sidebar chat (except on /home where chat is embedded) */}
              {isAuthenticated && (
                <button
                  onClick={() => onMenuClick('Chat')}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 text-sm font-medium border border-white/20 text-slate-900"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee, #4ade80)',
                    boxShadow: '0 2px 8px rgba(34, 211, 238, 0.15)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 211, 238, 0.25), 0 2px 8px rgba(74, 222, 128, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(34, 211, 238, 0.15)';
                  }}
                  aria-label="Open chat"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  <span className="hidden md:inline">Chat</span>
                </button>
              )}

              {/* Messages Button - Opens DM tray */}
              {isAuthenticated && messagesTray && (
                <button
                  onClick={() => messagesTray.openMessagesTray()}
                  className="hidden sm:block p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300 hover:scale-105"
                  aria-label="Open my messages"
                  title="My Messages"
                >
                  <EnvelopeIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                </button>
              )}

              {/* Theme Toggle - Hidden on mobile, in hamburger menu */}
              <button
                onClick={toggleTheme}
                className="hidden sm:block p-2 rounded-xl hover:bg-white/[0.08] border border-transparent hover:border-white/30 transition-all duration-300 hover:scale-105"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <SunIcon className="w-5 h-5 text-amber-300" />
                ) : (
                  <MoonIcon className="w-5 h-5 text-indigo-600" />
                )}
              </button>

              {/* User Menu */}
              {isAuthenticated && user ? (
                <UserMenu user={user} />
              ) : (
                <button
                  onClick={() => navigate('/auth')}
                  className="px-4 py-2 hover:bg-white/[0.08] text-gray-900 dark:text-white rounded-xl transition-all duration-300 hover:scale-105 text-sm font-medium border border-transparent hover:border-white/30"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - exclude ACCOUNT section (handled by UserMenu) */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        menuSections={menuSections.filter(s => s.title !== 'ACCOUNT')}
        onMenuClick={onMenuClick}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal />
    </>
  );
}
