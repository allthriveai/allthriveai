import { ReactNode, useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ChartBarIcon,
  EnvelopeIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

interface AdminSidebarItem {
  label: string;
  path: string;
  icon: typeof ChartBarIcon;
  badge?: number;
}

interface AdminLayoutProps {
  children: ReactNode;
  pendingInvitationsCount?: number;
}

export function AdminLayout({ children, pendingInvitationsCount = 0 }: AdminLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentPath = location.pathname;

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const adminNavItems: AdminSidebarItem[] = [
    {
      label: 'Analytics',
      path: '/admin/analytics',
      icon: ChartBarIcon,
    },
    {
      label: 'Invitations',
      path: '/admin/invitations',
      icon: EnvelopeIcon,
      badge: pendingInvitationsCount > 0 ? pendingInvitationsCount : undefined,
    },
    // Future admin sections can be added here:
    // {
    //   label: 'Users',
    //   path: '/admin/users',
    //   icon: UsersIcon,
    // },
    // {
    //   label: 'Content',
    //   path: '/admin/content',
    //   icon: DocumentTextIcon,
    // },
    // {
    //   label: 'Settings',
    //   path: '/admin/settings',
    //   icon: Cog6ToothIcon,
    // },
  ];

  // Find current active item
  const activeItem = adminNavItems.find(item =>
    currentPath.startsWith(item.path)
  ) || adminNavItems[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMobileNav = (path: string) => {
    navigate(path);
    setIsDropdownOpen(false);
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-full">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 glass-strong border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/10 flex-shrink-0 z-20 md:min-h-full">
        <div className="p-4 md:p-6 md:h-full">
          {/* Desktop Header */}
          <div className="hidden md:block">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-cyan-neon animate-pulse" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Admin Panel
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Platform management
            </p>
          </div>

          {/* Mobile Dropdown */}
          <div className="md:hidden relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <activeItem.icon className="w-5 h-5 text-primary-600 dark:text-cyan-neon" />
                <span className="font-medium">{activeItem.label}</span>
                {activeItem.badge && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-accent rounded-full">
                    {activeItem.badge}
                  </span>
                )}
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {adminNavItems.map((item) => {
                  const isActive = item.path === activeItem.path;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleMobileNav(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b last:border-0 border-slate-100 dark:border-white/5 ${
                        isActive
                          ? 'bg-primary-50 dark:bg-cyan-500/10 text-primary-600 dark:text-cyan-neon font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600 dark:text-cyan-neon' : 'text-slate-400 dark:text-slate-500'}`} />
                      {item.label}
                      {item.badge && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-accent rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="ml-auto text-primary-600 dark:text-cyan-neon">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex md:flex-col gap-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary-500/10 dark:bg-cyan-500/10 text-primary-600 dark:text-cyan-neon border border-primary-500/20 dark:border-cyan-500/20 shadow-sm'
                        : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`w-5 h-5 ${
                          isActive
                            ? 'text-primary-600 dark:text-cyan-neon'
                            : 'text-slate-500 dark:text-slate-500'
                        }`}
                      />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-accent rounded-full animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Admin info footer */}
          <div className="hidden md:block mt-auto pt-6 border-t border-slate-200 dark:border-white/10 mt-8">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-cyan-500/20 flex items-center justify-center">
                <span className="text-primary-600 dark:text-cyan-neon text-sm font-bold">
                  {user.username?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {user.username}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  Administrator
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
