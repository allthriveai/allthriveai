import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { QuestCompletionProvider } from '@/contexts/QuestCompletionContext';
import { SubscribeModalProvider } from '@/components/billing';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SubscribeModalProvider>
            <BrowserRouter>
              <AuthProvider>
                <QuestCompletionProvider>
                  <AppRoutes />
                </QuestCompletionProvider>
              </AuthProvider>
            </BrowserRouter>
          </SubscribeModalProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
