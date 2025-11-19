import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Check for error in URL
        const errorParam = searchParams.get('error');
        if (errorParam) {
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        // Get tokens from URL params
        const accessToken = searchParams.get('access');
        const refreshToken = searchParams.get('refresh');

        if (!accessToken || !refreshToken) {
          setError('Missing authentication tokens. Please try again.');
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        // Store tokens in cookies (handled by the browser via Set-Cookie headers)
        // The backend already set HTTP-only cookies, but we received tokens in URL as backup

        // Refresh user data to update auth state
        await refreshUser();

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An error occurred during authentication.');
        setTimeout(() => navigate('/auth'), 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, refreshUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <div className="text-red-600 dark:text-red-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-700 dark:text-red-400 text-sm">
              {error}
            </p>
            <p className="text-red-600 dark:text-red-500 text-xs mt-2">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mb-4"></div>
        <p className="text-gray-700 dark:text-gray-300 font-medium">
          Completing authentication...
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
          Please wait while we redirect you.
        </p>
      </div>
    </div>
  );
}
