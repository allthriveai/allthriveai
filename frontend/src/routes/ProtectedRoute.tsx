import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectIfAuthenticated?: boolean;
}

export function ProtectedRoute({ children, redirectIfAuthenticated = false }: ProtectedRouteProps) {
  console.log('[ProtectedRoute] START - before hooks');
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] AFTER hooks', {
    path: location.pathname,
    isAuthenticated,
    isLoading,
    redirectIfAuthenticated
  });

  // Show loading state while checking authentication
  if (isLoading) {
    console.log('[ProtectedRoute] Showing loading state');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Redirect authenticated users away from login page
  if (redirectIfAuthenticated && isAuthenticated) {
    console.log('[ProtectedRoute] Redirecting to /explore (authenticated at auth page)');
    return <Navigate to="/explore" replace />;
  }

  // Redirect unauthenticated users to auth (chat onboarding)
  if (!redirectIfAuthenticated && !isAuthenticated) {
    console.log('[ProtectedRoute] Redirecting to /auth (not authenticated)', location.pathname);
    return <Navigate to="/auth" state={{ returnUrl: location.pathname }} replace />;
  }

  console.log('[ProtectedRoute] Rendering children');
  return <>{children}</>;
}
