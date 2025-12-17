import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  UserIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  XCircleIcon as XCircleSolidIcon,
} from '@heroicons/react/24/solid';

interface Invitation {
  id: number;
  email: string;
  name: string;
  reason: string;
  excitedFeatures: string[];
  desiredIntegrations: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string;
  approvalEmailSentAt: string | null;
  userSignedUp?: boolean;
  userJoinedAt?: string | null;
  userLastLogin?: string | null;
}

interface InvitationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function InvitationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [stats, setStats] = useState<InvitationStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
      });
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/admin/invitations/?${params}`);
      setInvitations(response.data.invitations);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch invitations');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, statusFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/admin/invitations/stats/');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchInvitations();
      fetchStats();
    }
  }, [user, fetchInvitations, fetchStats]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/invitations/${id}/approve/`);
      await Promise.all([fetchInvitations(), fetchStats()]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/invitations/${id}/reject/`);
      await Promise.all([fetchInvitations(), fetchStats()]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      await api.post('/admin/invitations/bulk-approve/', { ids: Array.from(selectedIds) });
      await Promise.all([fetchInvitations(), fetchStats()]);
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk approve');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      await api.post('/admin/invitations/bulk-reject/', { ids: Array.from(selectedIds) });
      await Promise.all([fetchInvitations(), fetchStats()]);
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to bulk reject');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleResendEmail = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/invitations/${id}/resend-email/`);
      await fetchInvitations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend email');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === invitations.filter(i => i.status === 'pending').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invitations.filter(i => i.status === 'pending').map(i => i.id)));
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

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      pending: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30',
      approved: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30',
      rejected: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
    };
    const icons = {
      pending: ClockIcon,
      approved: CheckCircleIcon,
      rejected: XCircleIcon,
    };
    const Icon = icons[status as keyof typeof icons] || ClockIcon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        <Icon className="w-3.5 h-3.5" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <AdminLayout pendingInvitationsCount={stats.pending}>
        <div className="p-6 md:p-8 max-w-6xl">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Invitation <span className="text-primary-600 dark:text-cyan-neon">Requests</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Review and manage user invitation requests
            </p>
          </header>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Pending"
              value={stats.pending}
              color="yellow"
              onClick={() => setStatusFilter('pending')}
              active={statusFilter === 'pending'}
            />
            <StatCard
              label="Approved"
              value={stats.approved}
              color="green"
              onClick={() => setStatusFilter('approved')}
              active={statusFilter === 'approved'}
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              color="red"
              onClick={() => setStatusFilter('rejected')}
              active={statusFilter === 'rejected'}
            />
            <StatCard
              label="Total"
              value={stats.total}
              color="primary"
              onClick={() => setStatusFilter('')}
              active={statusFilter === ''}
            />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 dark:focus:border-cyan-500/50 focus:ring-1 focus:ring-primary-500/30 dark:focus:ring-cyan-500/30"
              />
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && statusFilter === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  <CheckCircleSolidIcon className="w-4 h-4" />
                  Approve ({selectedIds.size})
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={bulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  <XCircleSolidIcon className="w-4 h-4" />
                  Reject ({selectedIds.size})
                </button>
              </div>
            )}
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

          {/* Invitations Table */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-primary-200 dark:border-cyan-500/30 border-t-primary-500 dark:border-t-cyan-neon rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Loading invitations...</p>
              </div>
            ) : invitations.length === 0 ? (
              <div className="p-12 text-center">
                <EnvelopeIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">No invitations found</p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400">
                  {statusFilter === 'pending' && (
                    <div className="col-span-1 flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === invitations.filter(i => i.status === 'pending').length && selectedIds.size > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-500 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500"
                      />
                    </div>
                  )}
                  <div className={statusFilter === 'pending' ? 'col-span-3' : statusFilter === 'approved' ? 'col-span-2' : 'col-span-4'}>Requester</div>
                  <div className={statusFilter === 'approved' ? 'col-span-2' : 'col-span-3'}>Reason</div>
                  <div className={statusFilter === 'approved' ? 'col-span-1' : 'col-span-2'}>Status</div>
                  {statusFilter === 'approved' && <div className="col-span-2">Email</div>}
                  {statusFilter === 'approved' && <div className="col-span-2">User Activity</div>}
                  <div className={statusFilter === 'approved' ? 'col-span-3' : 'col-span-2'}>Date</div>
                  {statusFilter === 'pending' && <div className="col-span-1">Actions</div>}
                </div>

                {/* Table Body */}
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Checkbox (pending only) */}
                      {statusFilter === 'pending' && (
                        <div className="hidden md:flex col-span-1 items-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(invitation.id)}
                            onChange={() => toggleSelect(invitation.id)}
                            disabled={invitation.status !== 'pending'}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-500 dark:text-cyan-500 focus:ring-primary-500 dark:focus:ring-cyan-500 disabled:opacity-50"
                          />
                        </div>
                      )}

                      {/* Requester */}
                      <div className={`${statusFilter === 'pending' ? 'md:col-span-3' : statusFilter === 'approved' ? 'md:col-span-2' : 'md:col-span-4'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-5 h-5 text-primary-600 dark:text-cyan-neon" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{invitation.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{invitation.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reason & Features */}
                      <div className={statusFilter === 'approved' ? 'md:col-span-2' : 'md:col-span-3'}>
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                          {invitation.reason || <span className="text-slate-400 dark:text-slate-500 italic">No reason provided</span>}
                        </p>
                        {/* Excited Features */}
                        {invitation.excitedFeatures && invitation.excitedFeatures.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {invitation.excitedFeatures.slice(0, 3).map((feature, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                                title={feature}
                              >
                                {feature.length > 20 ? feature.slice(0, 20) + '...' : feature}
                              </span>
                            ))}
                            {invitation.excitedFeatures.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                +{invitation.excitedFeatures.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        {/* Desired Integrations */}
                        {invitation.desiredIntegrations && invitation.desiredIntegrations.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {invitation.desiredIntegrations.map((integration, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300"
                              >
                                {integration}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status */}
                      <div className={`${statusFilter === 'approved' ? 'md:col-span-1' : 'md:col-span-2'} flex items-center`}>
                        <StatusBadge status={invitation.status} />
                      </div>

                      {/* Email Sent Status (approved only) */}
                      {statusFilter === 'approved' && (
                        <div className="md:col-span-2 flex items-center">
                          {invitation.approvalEmailSentAt ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30"
                              title={`Sent ${formatDate(invitation.approvalEmailSentAt)}`}
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5" />
                              Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => handleResendEmail(invitation.id)}
                              disabled={actionLoading === invitation.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/30 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              title="Click to send approval email"
                            >
                              <EnvelopeIcon className="w-3.5 h-3.5" />
                              {actionLoading === invitation.id ? 'Sending...' : 'Not Sent - Click to Send'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* User Activity (approved only) */}
                      {statusFilter === 'approved' && (
                        <div className="md:col-span-2 flex items-center">
                          {invitation.userSignedUp ? (
                            <div className="text-sm">
                              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span className="font-medium">Signed up</span>
                              </div>
                              {invitation.userLastLogin ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Last login: {formatDate(invitation.userLastLogin)}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                  Never logged in
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm">
                              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                                <ClockIcon className="w-4 h-4" />
                                <span>Not signed up yet</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date */}
                      <div className={`${statusFilter === 'approved' ? 'md:col-span-3' : 'md:col-span-2'} flex items-center`}>
                        <div className="text-sm">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <CalendarIcon className="w-4 h-4" />
                            {formatDate(invitation.createdAt)}
                          </div>
                          {invitation.reviewedBy && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                              by {invitation.reviewedBy}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions (pending only) */}
                      {statusFilter === 'pending' && (
                        <div className="md:col-span-1 flex items-center gap-2">
                          {invitation.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(invitation.id)}
                                disabled={actionLoading === invitation.id}
                                className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <CheckCircleSolidIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleReject(invitation.id)}
                                disabled={actionLoading === invitation.id}
                                className="p-2 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <XCircleSolidIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                      {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  color: 'yellow' | 'green' | 'red' | 'primary';
  onClick: () => void;
  active: boolean;
}

function StatCard({ label, value, color, onClick, active }: StatCardProps) {
  const colorStyles = {
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-500/10',
      border: active ? 'border-yellow-400 dark:border-yellow-500/50' : 'border-yellow-200 dark:border-yellow-500/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      ring: active ? 'ring-1 ring-yellow-400/30 dark:ring-yellow-500/30' : '',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-500/10',
      border: active ? 'border-green-400 dark:border-green-500/50' : 'border-green-200 dark:border-green-500/20',
      text: 'text-green-600 dark:text-green-400',
      ring: active ? 'ring-1 ring-green-400/30 dark:ring-green-500/30' : '',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: active ? 'border-red-400 dark:border-red-500/50' : 'border-red-200 dark:border-red-500/20',
      text: 'text-red-600 dark:text-red-400',
      ring: active ? 'ring-1 ring-red-400/30 dark:ring-red-500/30' : '',
    },
    primary: {
      bg: 'bg-primary-50 dark:bg-cyan-500/10',
      border: active ? 'border-primary-400 dark:border-cyan-500/50' : 'border-primary-200 dark:border-cyan-500/20',
      text: 'text-primary-600 dark:text-cyan-neon',
      ring: active ? 'ring-1 ring-primary-400/30 dark:ring-cyan-500/30' : '',
    },
  };

  const styles = colorStyles[color];

  return (
    <button
      onClick={onClick}
      className={`${styles.bg} p-4 rounded-xl border ${styles.border} ${styles.ring} hover:brightness-95 dark:hover:bg-white/[0.02] transition-all text-left`}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${styles.text}`}>{value}</p>
    </button>
  );
}
