import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { LeftSidebar } from '@/components/profile/LeftSidebar';
import { ProfileCenter } from '@/components/profile/ProfileCenter';
import { RightChatPanel } from '@/components/profile/RightChatPanel';

export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'showcase' | 'playground' | 'settings'>('showcase');
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      {/* Menu Toggle Button - Always visible */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        className="fixed top-4 left-4 z-30 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
      >
        <Bars3Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Left Sidebar */}
      <LeftSidebar
        onMenuClick={handleMenuClick}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Center Profile */}
      <ProfileCenter
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

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
