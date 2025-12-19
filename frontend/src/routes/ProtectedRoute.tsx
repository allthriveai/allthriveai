import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Storage key for guest battle ID
const GUEST_BATTLE_ID_KEY = 'guest_battle_id';

// Helper to get stored guest battle ID
export function getGuestBattleId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GUEST_BATTLE_ID_KEY);
  } catch {
    return null;
  }
}

// Helper to store guest battle ID (called when guest joins a battle)
export function setGuestBattleId(battleId: string | number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_BATTLE_ID_KEY, String(battleId));
  } catch {
    // localStorage not available (private browsing, etc.)
  }
}

// Helper to clear guest battle ID (called when guest converts to full account)
export function clearGuestBattleId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_BATTLE_ID_KEY);
  } catch {
    // localStorage not available
  }
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectIfAuthenticated?: boolean;
  allowGuest?: boolean; // Allow guest users to access this route
}

export function ProtectedRoute({
  children,
  redirectIfAuthenticated = false,
  allowGuest = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Check if user is a guest
  const isGuestUser = user?.isGuest ?? false;
  const guestBattleId = getGuestBattleId();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Redirect authenticated users away from login page
  // BUT allow guest users to stay - they're trying to convert to a full account
  if (redirectIfAuthenticated && isAuthenticated && !isGuestUser) {
    return <Navigate to="/home" replace />;
  }

  // Redirect unauthenticated users to auth (chat onboarding)
  if (!redirectIfAuthenticated && !isAuthenticated) {
    return <Navigate to="/auth" state={{ returnUrl: location.pathname }} replace />;
  }

  // Handle guest user restrictions
  if (isGuestUser && !allowGuest) {
    // Check if this is a battle page the guest participated in
    const battleMatch = location.pathname.match(/^\/battles\/(\d+)/);
    const requestedBattleId = battleMatch ? battleMatch[1] : null;

    // Allow guest to access their own battle
    if (requestedBattleId && requestedBattleId === guestBattleId) {
      return <>{children}</>;
    }

    // Redirect guest to their battle (with signup banner) or to auth
    if (guestBattleId) {
      return <Navigate to={`/battles/${guestBattleId}`} replace />;
    } else {
      // No battle ID stored, redirect to auth
      return <Navigate to="/auth" state={{ returnUrl: location.pathname }} replace />;
    }
  }

  return <>{children}</>;
}
