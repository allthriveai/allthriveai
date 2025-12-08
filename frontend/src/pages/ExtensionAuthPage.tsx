import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { api } from '@/services/api';

/**
 * Extension Auth Page
 *
 * This page handles authentication for the All Thrive browser extension.
 * - If user is logged in: fetches extension token and redirects to callback
 * - If user is not logged in: redirects to auth page with return URL
 */
export default function ExtensionAuthPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getExtensionToken() {
      if (!isLoading && isAuthenticated && user) {
        try {
          // Fetch extension token from backend
          const response = await api.post('/extension/token/');
          const { token } = response.data;

          if (token) {
            // Build the callback URL that the extension is listening for
            const userData = JSON.stringify({
              id: user.id,
              username: user.username,
              email: user.email,
              fullName: user.fullName || '',
              avatarUrl: user.avatarUrl || '',
            });

            // Redirect to callback URL - the extension's webNavigation listener will detect this
            const callbackUrl = `/api/v1/extension/auth/callback/?token=${encodeURIComponent(token)}&user=${encodeURIComponent(userData)}`;
            window.location.href = callbackUrl;
            setStatus('success');
          } else {
            setError('Failed to get extension token');
            setStatus('error');
          }
        } catch (err) {
          console.error('Extension auth error:', err);
          setError('Failed to authenticate extension');
          setStatus('error');
        }
      }
    }

    getExtensionToken();
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to auth page with return URL
    return <Navigate to="/auth?next=/extension/auth" replace />;
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Authentication Failed</h1>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading while fetching token
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-400">Connecting extension...</p>
        <p className="text-slate-500 text-sm mt-2">This tab will close automatically.</p>
      </div>
    </div>
  );
}
