/**
 * FocusedLayout - Minimal layout for distraction-free experiences like Echo
 *
 * Features:
 * - Logo | Title on left
 * - Hamburger menu on right
 * - No footer, no sidebars
 * - Full viewport height for content
 */

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

interface FocusedLayoutProps {
  children: ReactNode;
  /** Title shown next to logo */
  title?: string;
  /** Hide even the minimal header for true full-screen */
  hideHeader?: boolean;
}

// Logo component using the AllThrive logo
function Logo() {
  return (
    <Link to="/home" className="flex items-center">
      <img
        src="/all-thrvie-logo.png"
        alt="All Thrive"
        className="h-8 w-auto"
      />
    </Link>
  );
}

export function FocusedLayout({
  children,
  title = 'ECHO',
  hideHeader = false,
}: FocusedLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950">
      {/* Minimal header */}
      {!hideHeader && (
        <header className="flex-shrink-0 h-14 border-b border-slate-800/50 flex items-center justify-between px-4">
          {/* Logo | Title */}
          <div className="flex items-center gap-3">
            <Logo />
            <div className="w-px h-6 bg-slate-700" />
            <span className="text-lg font-semibold text-white tracking-wide">
              {title}
            </span>
          </div>

          {/* Hamburger menu */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </header>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          {/* Menu panel */}
          <div className="absolute top-14 right-4 z-50 w-56 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
            {/* Home */}
            <Link
              to="/home"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <HomeIcon className="w-5 h-5" />
              Home
            </Link>

            {/* Profile */}
            {user && (
              <Link
                to={`/${user.username}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <UserCircleIcon className="w-5 h-5" />
                My Profile
              </Link>
            )}

            {/* Account Settings */}
            <Link
              to="/account/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Cog6ToothIcon className="w-5 h-5" />
              Account Settings
            </Link>

            {/* Divider */}
            <div className="my-2 border-t border-slate-700" />

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* Full-height content area */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
