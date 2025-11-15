import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface OAuthButtonsProps {
  onEmailClick: () => void;
}

export function OAuthButtons({ onEmailClick }: OAuthButtonsProps) {
  const { refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    setIsLoading(true);
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Create a form and submit it to open in popup
    // This bypasses the GET intermediate page
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${backendUrl}/accounts/${provider}/login/`;
    form.target = 'oauth_popup';
    
    // Add CSRF token (we'll need to get it from cookies)
    const csrfToken = document.cookie.split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    
    if (csrfToken) {
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrfmiddlewaretoken';
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);
    }
    
    // Add process input
    const processInput = document.createElement('input');
    processInput.type = 'hidden';
    processInput.name = 'process';
    processInput.value = 'login';
    form.appendChild(processInput);
    
    document.body.appendChild(form);
    
    // Open popup
    const popup = window.open(
      '',
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      setIsLoading(false);
      document.body.removeChild(form);
      alert('Please allow popups for this site to sign in with ' + provider);
      return;
    }
    
    // Submit form to popup
    form.submit();
    document.body.removeChild(form);

    // Poll for popup close and check authentication
    const pollTimer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(pollTimer);
        // Check if user is now authenticated
        try {
          await refreshUser();
          // If we get here, user is authenticated
          window.location.href = '/dashboard';
        } catch (error) {
          // User cancelled or authentication failed
          setIsLoading(false);
        }
      }
    }, 500);
  };

  return (
    <div className="space-y-3 w-full max-w-sm">
      <button
        onClick={() => handleOAuthLogin('google')}
        type="button"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </button>

      <button
        onClick={() => handleOAuthLogin('github')}
        type="button"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
        </svg>
        Continue with GitHub
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-3 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">Or</span>
        </div>
      </div>

      <button
        onClick={onEmailClick}
        type="button"
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-indigo-600 dark:border-indigo-500 rounded-xl text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium text-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Continue with Email
      </button>
    </div>
  );
}
