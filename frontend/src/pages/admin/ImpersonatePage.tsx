import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  MagnifyingGlassIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  getImpersonatableUsers,
  startImpersonation,
  getImpersonationLogs,
  type ImpersonatableUser,
  type ImpersonationLog,
} from '@/services/impersonation';

export default function ImpersonatePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ImpersonatableUser[]>([]);
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch impersonatable users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getImpersonatableUsers({
        search: searchQuery || undefined,
        limit: 100,
      });
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Fetch impersonation logs
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const data = await getImpersonationLogs({ limit: 50 });
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      fetchLogs();
    }
  }, [user, fetchUsers, fetchLogs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.role === 'admin') {
        fetchUsers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user, fetchUsers]);

  const handleImpersonate = async (targetUser: ImpersonatableUser) => {
    setImpersonatingId(targetUser.id);
    setError(null);

    try {
      await startImpersonation({
        user_id: targetUser.id,
        reason: reason || `Admin support for ${targetUser.username}`,
      });

      // Refresh auth state to reflect new user
      await refreshUser();

      // Navigate to the impersonated user's profile
      navigate(`/${targetUser.username}?tab=playground`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start impersonation');
      setImpersonatingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'Active';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.round(diffMins / 60);
    return `${diffHours} hr`;
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="p-6 md:p-8 max-w-6xl">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  User <span className="text-purple-600 dark:text-purple-400">Impersonation</span>
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Log in as another user for support and testing
                </p>
              </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Users
              </span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'logs'
                  ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                Audit Log
              </span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <>
              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 dark:focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 dark:focus:ring-purple-500/30"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-purple-200 dark:border-purple-500/30 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center">
                    <UserIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">
                      {searchQuery ? 'No users found matching your search' : 'No impersonatable users found'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {users.map((targetUser) => (
                      <div
                        key={targetUser.id}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white/30">
                            {targetUser.avatar_url ? (
                              <img
                                src={targetUser.avatar_url}
                                alt={targetUser.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white text-lg font-semibold">
                                {(targetUser.first_name || targetUser.username || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {targetUser.first_name && targetUser.last_name
                                  ? `${targetUser.first_name} ${targetUser.last_name}`
                                  : targetUser.username}
                              </p>
                              {targetUser.is_guest && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-full">
                                  Guest
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              @{targetUser.username} &middot; {targetUser.email}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              Joined {formatDate(targetUser.date_joined)}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => setShowReasonModal(targetUser.id)}
                          disabled={impersonatingId === targetUser.id}
                          className="ml-4 flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {impersonatingId === targetUser.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                              Switching...
                            </>
                          ) : (
                            <>
                              <ArrowRightOnRectangleIcon className="w-4 h-4" />
                              Impersonate
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              {logsLoading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-2 border-purple-200 dark:border-purple-500/30 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Loading audit log...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center">
                  <ClockIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">No impersonation sessions recorded</p>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <div className="col-span-3">Admin</div>
                    <div className="col-span-3">Target User</div>
                    <div className="col-span-3">Time</div>
                    <div className="col-span-2">Duration</div>
                    <div className="col-span-1">Status</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="md:col-span-3">
                          <p className="font-medium text-slate-900 dark:text-white">
                            @{log.admin_user.username}
                          </p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-slate-700 dark:text-slate-300">
                            @{log.target_user.username}
                          </p>
                        </div>
                        <div className="md:col-span-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(log.started_at)}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDuration(log.started_at, log.ended_at)}
                          </p>
                        </div>
                        <div className="md:col-span-1">
                          <span
                            className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              log.ended_at
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                            }`}
                          >
                            {log.ended_at ? 'Ended' : 'Active'}
                          </span>
                        </div>
                        {log.reason && (
                          <div className="md:col-span-12 mt-1">
                            <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                              Reason: {log.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Reason Modal */}
          {showReasonModal !== null && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Start Impersonation
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Optionally provide a reason for this impersonation session (for audit purposes).
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Helping user set up their profile"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 dark:focus:border-purple-500/50 resize-none"
                  rows={3}
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowReasonModal(null);
                      setReason('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const targetUser = users.find((u) => u.id === showReasonModal);
                      if (targetUser) {
                        setShowReasonModal(null);
                        handleImpersonate(targetUser);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors"
                  >
                    Start Impersonation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
