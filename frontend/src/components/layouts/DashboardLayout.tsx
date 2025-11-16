import { useState, ReactNode } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { LeftSidebar } from '@/components/navigation/LeftSidebar';
import { RightChatPanel } from '@/components/chat/RightChatPanel';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);

  const handleMenuClick = (menuItem: string) => {
    setSelectedMenuItem(menuItem);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setSelectedMenuItem(null);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-brand-dark overflow-hidden">
      {/* Mobile toggle button - shows when sidebar is closed on mobile */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Show sidebar"
          className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 md:hidden"
        >
          <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}

      {/* Left Sidebar */}
      <LeftSidebar
        onMenuClick={handleMenuClick}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-20 max-md:ml-0'
      }`}>
        {children}
      </div>

      {/* Right Chat Panel */}
      <RightChatPanel
        isOpen={chatOpen}
        onClose={handleCloseChat}
        selectedMenuItem={selectedMenuItem}
      />

      {/* Overlay when chat is open */}
      {chatOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={handleCloseChat}
        />
      )}
    </div>
  );
}
