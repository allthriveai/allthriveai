import { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Main layout component that wraps all pages
 * Provides basic page structure - footers are handled by individual layouts (DashboardLayout, etc.)
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
