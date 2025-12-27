import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { QuestCompletionProvider } from '@/contexts/QuestCompletionContext';
import { SubscribeModalProvider } from '@/components/billing';
import { BattleNotificationProvider } from '@/components/battles/BattleNotificationProvider';
import { AsyncBattleProvider } from '@/contexts/AsyncBattleContext';
import { MessagesTrayProvider } from '@/context/MessagesTrayContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes';
import { Sentry } from '@/utils/sentry';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostHogProvider } from '@/lib/analytics';
import { ScrollToTop } from '@/components/ScrollToTop';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Custom fallback component for Sentry ErrorBoundary
function ErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-700 mb-4">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
          >
            Go Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <ErrorBoundary>
        <PostHogProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <SubscribeModalProvider>
                <BrowserRouter>
                  <ScrollToTop />
                  <AuthProvider>
                    <BattleNotificationProvider>
                      <AsyncBattleProvider>
                        <QuestCompletionProvider>
                          <MessagesTrayProvider>
                            <MainLayout>
                              <AppRoutes />
                            </MainLayout>
                          </MessagesTrayProvider>
                        </QuestCompletionProvider>
                      </AsyncBattleProvider>
                    </BattleNotificationProvider>
                  </AuthProvider>
                </BrowserRouter>
              </SubscribeModalProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </PostHogProvider>
      </ErrorBoundary>
    </Sentry.ErrorBoundary>
  );
}

export default App;
