/**
 * ImpersonationBanner Component
 *
 * Displays a banner at the top of the page when an admin is impersonating another user.
 * Provides a quick way to stop impersonation and return to the admin account.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ShieldExclamationIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/solid';
import {
  getImpersonationStatus,
  stopImpersonation,
  type ImpersonationSession,
} from '@/services/impersonation';

export function ImpersonationBanner() {
  const { refreshUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check impersonation status on mount and when location changes
  useEffect(() => {
    async function checkStatus() {
      // Only check if authenticated
      if (!isAuthenticated) {
        setSession(null);
        return;
      }

      try {
        const status = await getImpersonationStatus();
        if (status.is_impersonating) {
          setSession(status);
        } else {
          setSession(null);
        }
      } catch {
        // Not impersonating or error - clear session
        setSession(null);
      }
    }
    checkStatus();
  }, [isAuthenticated, location.pathname]);

  const handleStopImpersonation = async () => {
    setStopping(true);
    setError(null);

    try {
      await stopImpersonation();
      await refreshUser();
      setSession(null);
      // Navigate to admin impersonate page after stopping
      navigate('/admin/impersonate');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to stop impersonation');
      setStopping(false);
    }
  };

  // Don't render if not impersonating
  if (!session?.is_impersonating) {
    return null;
  }

  return (
    <>
      {/* Spacer to push content down when banner is visible */}
      <div className="h-10" />
      {/* Fixed banner at top */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldExclamationIcon className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <span className="text-sm font-medium">
                You are impersonating{' '}
                <strong className="font-bold">@{session.target_user?.username}</strong>
                {session.original_user && (
                  <span className="opacity-80 ml-1">
                    (logged in as @{session.original_user.username})
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {error && (
                <span className="text-xs text-white/80 bg-white/20 px-2 py-1 rounded">
                  {error}
                </span>
              )}
              <button
                onClick={handleStopImpersonation}
                disabled={stopping}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stopping ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    Stop Impersonating
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
