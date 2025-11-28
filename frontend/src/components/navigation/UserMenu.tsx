import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import type { User } from '@/types/models';

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to log out. Please try again.');
    }
  };

  const menuItems = [
    {
      label: 'My Profile',
      onClick: () => {
        navigate(`/${user.username}?tab=showcase`);
        setIsOpen(false);
      },
    },
    {
      label: 'My Projects',
      onClick: () => {
        navigate(`/${user.username}?tab=playground`);
        setIsOpen(false);
      },
    },
    {
      label: 'Account Settings',
      onClick: () => {
        navigate('/account/settings');
        setIsOpen(false);
      },
    },
    {
      label: 'Thrive Circle',
      onClick: () => {
        navigate('/thrive-circle');
        setIsOpen(false);
      },
    },
  ];

  const handleAvatarClick = () => {
    // Toggle dropdown
    setIsOpen(!isOpen);
    // Navigate to profile page
    navigate(`/${user.username}?tab=showcase`);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Avatar Button - Liquid Glass */}
      <button
        onClick={handleAvatarClick}
        className="flex items-center gap-2 p-0.5 rounded-full ring-2 ring-white/20 hover:ring-4 hover:ring-teal-400/50 transition-all duration-300 hover:scale-105 shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 backdrop-blur-xl"
        aria-label="User menu"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center overflow-hidden border border-white/30">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-semibold">
              {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown Menu - Light/Dark mode support */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-2xl border border-white/30 dark:border-white/20 py-2 animate-fade-in transition-all duration-200 animate-scale-in"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-white/20 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white/30 shadow-lg shadow-teal-500/30">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName || user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-lg font-semibold">
                    {(user.fullName || user.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user.fullName || user.username}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-white/20 dark:border-white/10 pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 hover:scale-[1.02] backdrop-blur-xl"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
