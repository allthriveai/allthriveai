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

  // Add a class to the body so TopNavigation can adjust its position
  useEffect(() => {
    if (session?.isImpersonating) {
      document.body.classList.add('impersonating');
    } else {
      document.body.classList.remove('impersonating');
    }
    return () => {
      document.body.classList.remove('impersonating');
    };
  }, [session?.isImpersonating]);

  // Check impersonation status on mount and when location changes
  useEffect(() => {
    async function checkStatus() {
      // Only check if authenticated
      if (!isAuthenticated) {
        console.log('[ImpersonationBanner] Not authenticated, skipping status check');
        setSession(null);
        return;
      }

      try {
        console.log('[ImpersonationBanner] Checking impersonation status...');
        const status = await getImpersonationStatus();
        console.log('[ImpersonationBanner] Status response:', status);
        if (status.isImpersonating) {
          setSession(status);
        } else {
          setSession(null);
        }
      } catch (err) {
        // Not impersonating or error - clear session
        console.error('[ImpersonationBanner] Error checking status:', err);
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
  if (!session?.isImpersonating) {
    return null;
  }


  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-10 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center">
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <ShieldExclamationIcon className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <span className="text-sm font-medium">
              Impersonating{' '}
              <strong className="font-bold">@{session.targetUser?.username}</strong>
              {session.originalUser && (
                <span className="opacity-80 ml-1">
                  (as @{session.originalUser.username})
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
                  Stop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
