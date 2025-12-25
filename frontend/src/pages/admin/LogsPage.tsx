/**
 * Admin Log Streaming Dashboard
 *
 * Real-time log viewer with filtering for admin users.
 * Streams logs from Docker (local) or CloudWatch (production).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAdminLogs } from '@/hooks/useAdminLogs';
import type { LogEntry, LogFilters, LogLevel, LogService } from '@/types/adminLogs';
import {
  CommandLineIcon,
  FunnelIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BugAntIcon,
  XCircleIcon,
  PauseIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

// Log level colors and icons
const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DEBUG: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    icon: BugAntIcon,
  },
  INFO: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: InformationCircleIcon,
  },
  WARNING: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: ExclamationTriangleIcon,
  },
  ERROR: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: XCircleIcon,
  },
  CRITICAL: {
    color: 'text-red-500',
    bgColor: 'bg-red-600/20',
    icon: XCircleIcon,
  },
};

// Service colors
const SERVICE_COLORS: Record<LogService, string> = {
  web: 'text-emerald-400',
  celery: 'text-purple-400',
  'celery-beat': 'text-orange-400',
};

interface LogRowProps {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function LogRow({ log, isExpanded, onToggle }: LogRowProps) {
  const levelConfig = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.INFO;
  const LevelIcon = levelConfig.icon;
  const serviceColor = SERVICE_COLORS[log.service] || 'text-gray-400';

  const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  return (
    <div
      className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
        isExpanded ? 'bg-white/5' : ''
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3 px-4 py-2 font-mono text-sm">
        {/* Timestamp */}
        <span className="text-gray-500 whitespace-nowrap">{timestamp}</span>

        {/* Level */}
        <span
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${levelConfig.color} ${levelConfig.bgColor}`}
        >
          <LevelIcon className="w-3 h-3" />
          {log.level}
        </span>

        {/* Service */}
        <span className={`text-xs font-medium ${serviceColor} whitespace-nowrap`}>
          [{log.service}]
        </span>

        {/* Message */}
        <span className="text-gray-300 flex-1 break-all">{log.message}</span>

        {/* Metadata badges */}
        {log.userId && (
          <span className="text-xs text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
            user:{log.userId}
          </span>
        )}
        {log.requestId && (
          <span className="text-xs text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded truncate max-w-[100px]">
            req:{log.requestId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && log.raw && (
        <div className="px-4 py-2 bg-gray-900/50 border-t border-white/5">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap overflow-x-auto">
            {log.raw}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state (local, before sending to hook)
  const [levelFilter, setLevelFilter] = useState<LogLevel | ''>('');
  const [serviceFilter, setServiceFilter] = useState<LogService | ''>('');
  const [searchPattern, setSearchPattern] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [requestIdFilter, setRequestIdFilter] = useState('');

  // Build filters object
  const filters: LogFilters = useMemo(() => {
    const f: LogFilters = {};
    if (levelFilter) f.level = levelFilter;
    if (serviceFilter) f.service = serviceFilter;
    if (searchPattern) f.pattern = searchPattern;
    if (userIdFilter) f.userId = parseInt(userIdFilter, 10) || undefined;
    if (requestIdFilter) f.requestId = requestIdFilter;
    return f;
  }, [levelFilter, serviceFilter, searchPattern, userIdFilter, requestIdFilter]);

  // Use admin logs hook
  const { logs, isConnected, isConnecting, error, setFilters, clearLogs } = useAdminLogs({
    initialFilters: filters,
    onError: (err) => console.error('[LogsPage] Error:', err),
  });

  // Update filters when they change
  useEffect(() => {
    setFilters(filters);
  }, [filters, setFilters]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Logs to display (memoized for stable reference)
  const displayedLogs = logs;

  // Redirect non-admins
  if (!authLoading && (!user || user.role !== 'admin')) {
    return <Navigate to="/home" replace />;
  }

  // Loading state
  if (authLoading) {
    return (
      <DashboardLayout>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-400" />
          </div>
        </AdminLayout>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <AdminLayout>
        <div className="flex flex-col h-[calc(100vh-200px)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CommandLineIcon className="w-6 h-6 text-primary-400" />
              <h1 className="text-xl font-bold text-white">Log Stream</h1>

              {/* Connection status */}
              <span
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isConnecting
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? 'bg-emerald-400 animate-pulse'
                      : isConnecting
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-red-400'
                  }`}
                />
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Pause/Resume */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isPaused
                    ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {isPaused ? (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <PauseIcon className="w-4 h-4" />
                    Pause
                  </>
                )}
              </button>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  showFilters
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <FunnelIcon className="w-4 h-4" />
                Filters
              </button>

              {/* Clear */}
              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-700/50 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-white/10">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Level filter */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Level</label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value as LogLevel | '')}
                    className="w-full px-3 py-1.5 bg-gray-900/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">All Levels</option>
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                {/* Service filter */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service</label>
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value as LogService | '')}
                    className="w-full px-3 py-1.5 bg-gray-900/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">All Services</option>
                    <option value="web">web</option>
                    <option value="celery">celery</option>
                    <option value="celery-beat">celery-beat</option>
                  </select>
                </div>

                {/* User ID filter */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">User ID</label>
                  <input
                    type="number"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    placeholder="e.g., 123"
                    className="w-full px-3 py-1.5 bg-gray-900/50 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Request ID filter */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Request ID</label>
                  <input
                    type="text"
                    value={requestIdFilter}
                    onChange={(e) => setRequestIdFilter(e.target.value)}
                    placeholder="e.g., abc123"
                    className="w-full px-3 py-1.5 bg-gray-900/50 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {/* Search pattern (regex) */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Search (regex)</label>
                  <input
                    type="text"
                    value={searchPattern}
                    onChange={(e) => setSearchPattern(e.target.value)}
                    placeholder="e.g., error|exception"
                    className="w-full px-3 py-1.5 bg-gray-900/50 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <XCircleIcon className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Log list */}
          <div
            ref={logsContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-gray-900/50 rounded-lg border border-white/10"
          >
            {displayedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <CommandLineIcon className="w-12 h-12 mb-2" />
                <p>No logs yet</p>
                <p className="text-sm">Logs will appear here as they stream in</p>
              </div>
            ) : (
              <>
                {displayedLogs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    isExpanded={expandedLogId === log.id}
                    onToggle={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  />
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>

          {/* Footer status bar */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>{displayedLogs.length} logs</span>
              {isPaused && <span className="text-yellow-400">Paused</span>}
              {!autoScroll && !isPaused && (
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-primary-400 hover:text-primary-300"
                >
                  Jump to latest
                </button>
              )}
            </div>
            <div>
              {isConnected ? (
                <span className="text-emerald-400">Streaming live</span>
              ) : (
                <span className="text-gray-500">Not connected</span>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </DashboardLayout>
  );
}
