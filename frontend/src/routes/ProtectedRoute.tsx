import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectIfAuthenticated?: boolean;
}

export function ProtectedRoute({ children, redirectIfAuthenticated = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Redirect authenticated users away from login page
  if (redirectIfAuthenticated && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect unauthenticated users to login
  if (!redirectIfAuthenticated && !isAuthenticated) {
    return <Navigate to="/login" state={{ returnUrl: location.pathname }} replace />;
  }

  return <>{children}</>;
}
