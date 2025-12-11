import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  MagnifyingGlassIcon,
  UserGroupIcon,
  ArrowsRightLeftIcon,
  XMarkIcon,
  UserMinusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import {
  listCircles,
  listCircleUsers,
  moveUserToCircle,
  removeUserFromCircle,
  TIER_OPTIONS,
  type Circle,
  type CircleUser,
} from '@/services/adminCircles';

export default function CircleManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [users, setUsers] = useState<CircleUser[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [hasCircleFilter, setHasCircleFilter] = useState<string>('');

  // Modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CircleUser | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCircleUsers({
        search: searchQuery || undefined,
        tier: tierFilter || undefined,
        hasCircle: hasCircleFilter ? hasCircleFilter === 'true' : undefined,
        limit: 100,
      });
      setUsers(data.users);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tierFilter, hasCircleFilter]);

  // Fetch circles for the dropdown
  const fetchCircles = useCallback(async () => {
    try {
      setCirclesLoading(true);
      const data = await listCircles({ isActive: true, limit: 100 });
      setCircles(data.circles);
    } catch (err: any) {
      console.error('Failed to fetch circles:', err);
    } finally {
      setCirclesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
      fetchCircles();
    }
  }, [user, fetchUsers, fetchCircles]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.role === 'admin') {
        fetchUsers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, tierFilter, hasCircleFilter, user, fetchUsers]);

  // Handle move user
  const handleMoveUser = async () => {
    if (!selectedUser || !selectedCircleId) return;

    setActionLoading(true);
    setError(null);

    try {
      const result = await moveUserToCircle(selectedUser.id, selectedCircleId);
      setSuccessMessage(
        `Moved ${selectedUser.username} to ${result.newCircle.name}`
      );
      setShowMoveModal(false);
      setSelectedUser(null);
      setSelectedCircleId('');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to move user');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle remove user from circle
  const handleRemoveUser = async (targetUser: CircleUser) => {
    if (!confirm(`Remove ${targetUser.username} from their circle?`)) return;

    setActionLoading(true);
    setError(null);

    try {
      const result = await removeUserFromCircle(targetUser.id);
      setSuccessMessage(result.message);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove user');
    } finally {
      setActionLoading(false);
    }
  };

  // Open move modal
  const openMoveModal = (targetUser: CircleUser) => {
    setSelectedUser(targetUser);
    setSelectedCircleId('');
    setShowMoveModal(true);
  };

  // Clear success message after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Get tier badge color
  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      seedling: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
      sprout: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
      blossom: 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400',
      bloom: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
      evergreen: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
    };
    return colors[tier] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
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
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  Thrive <span className="text-emerald-600 dark:text-emerald-400">Circle</span> Management
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Move users between circles or remove them
                </p>
              </div>
            </div>
          </header>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-green-700 dark:text-green-400">{successMessage}</p>
            </div>
          )}

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

          {/* Filters */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, username, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            {/* Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
            >
              <option value="">All Tiers</option>
              {TIER_OPTIONS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>

            {/* Has Circle Filter */}
            <select
              value={hasCircleFilter}
              onChange={(e) => setHasCircleFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
            >
              <option value="">All Users</option>
              <option value="true">In a Circle</option>
              <option value="false">Not in a Circle</option>
            </select>
          </div>

          {/* Users List */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-emerald-200 dark:border-emerald-500/30 border-t-emerald-500 dark:border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <UserGroupIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  {searchQuery || tierFilter || hasCircleFilter
                    ? 'No users found matching your filters'
                    : 'No users found'}
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
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-white/30">
                        {targetUser.avatarUrl ? (
                          <img
                            src={targetUser.avatarUrl}
                            alt={targetUser.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white text-lg font-semibold">
                            {(targetUser.firstName || targetUser.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {targetUser.firstName && targetUser.lastName
                              ? `${targetUser.firstName} ${targetUser.lastName}`
                              : targetUser.username}
                          </p>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getTierColor(targetUser.tier)}`}>
                            {targetUser.tierDisplay}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {targetUser.totalPoints} pts
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          @{targetUser.username}
                        </p>
                        {targetUser.currentCircle ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            Current: {targetUser.currentCircle.name}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Not in a circle this week
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Move Button */}
                      <button
                        onClick={() => openMoveModal(targetUser)}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="Move to different circle"
                      >
                        <ArrowsRightLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Move</span>
                      </button>

                      {/* Remove Button (only if in a circle) */}
                      {targetUser.currentCircle && (
                        <button
                          onClick={() => handleRemoveUser(targetUser)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          title="Remove from circle"
                        >
                          <UserMinusIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Move Modal */}
          {showMoveModal && selectedUser && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Move User to Circle
                  </h3>
                  <button
                    onClick={() => setShowMoveModal(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Moving <span className="font-medium text-slate-900 dark:text-white">@{selectedUser.username}</span>
                  {selectedUser.currentCircle && (
                    <> from <span className="text-emerald-600 dark:text-emerald-400">{selectedUser.currentCircle.name}</span></>
                  )}
                </p>

                {/* Circle Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Target Circle
                  </label>
                  {circlesLoading ? (
                    <div className="p-4 text-center text-slate-500">Loading circles...</div>
                  ) : (
                    <select
                      value={selectedCircleId}
                      onChange={(e) => setSelectedCircleId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500/50"
                    >
                      <option value="">Select a circle...</option>
                      {circles
                        .filter((c) => c.id !== selectedUser.currentCircle?.id)
                        .map((circle) => (
                          <option key={circle.id} value={circle.id}>
                            {circle.name} ({circle.tierDisplay} - {circle.memberCount} members)
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowMoveModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMoveUser}
                    disabled={!selectedCircleId || actionLoading}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? 'Moving...' : 'Move User'}
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
