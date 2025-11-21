import { useState, ReactNode, useEffect } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { LeftSidebar } from '@/components/navigation/LeftSidebar';
import { RightChatPanel } from '@/components/chat/RightChatPanel';
import { RightAboutPanel } from '@/components/about';
import { RightEventsCalendarPanel } from '@/components/events/RightEventsCalendarPanel';

interface DashboardLayoutProps {
  children: ReactNode | ((props: { openChat: (menuItem: string) => void }) => ReactNode);
  openAboutPanel?: boolean;
}

export function DashboardLayout({ children, openAboutPanel = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(openAboutPanel);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);

  // Auto-open about panel when prop is true
  useEffect(() => {
    if (openAboutPanel) {
      setAboutOpen(true);
      setChatOpen(false);
      setSelectedMenuItem(null);
    }
  }, [openAboutPanel]);

  const handleMenuClick = (menuItem: string) => {
    if (menuItem === 'About Us') {
      const wasOpen = aboutOpen;
      setAboutOpen(true);
      setChatOpen(false);
      setEventsOpen(false);
      setSelectedMenuItem(null);
      // Scroll to About Us section
      setTimeout(() => {
        const element = document.getElementById('about-us');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, wasOpen ? 50 : 150); // Shorter delay if already open
    } else if (menuItem === 'Our Values') {
      setAboutOpen(true);
      setChatOpen(false);
      setEventsOpen(false);
      setSelectedMenuItem(null);
      // Wait for panel to open and then scroll to the element
      setTimeout(() => {
        const element = document.getElementById('our-values');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else if (menuItem === 'Events Calendar') {
      setEventsOpen(true);
      setChatOpen(false);
      setAboutOpen(false);
      setSelectedMenuItem(null);
    } else {
      setSelectedMenuItem(menuItem);
      setChatOpen(true);
      setAboutOpen(false);
      setEventsOpen(false);
    }
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setSelectedMenuItem(null);
  };

  const handleCloseAbout = () => {
    setAboutOpen(false);
  };

  const handleCloseEvents = () => {
    setEventsOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-brand-dark">
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
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-20 max-md:ml-0'
      }`}>
        {typeof children === 'function' ? children({ openChat: handleMenuClick }) : children}
      </div>

      {/* Right Chat Panel */}
      <RightChatPanel
        isOpen={chatOpen}
        onClose={handleCloseChat}
        selectedMenuItem={selectedMenuItem}
      />

      {/* Right About Panel */}
      <RightAboutPanel
        isOpen={aboutOpen}
        onClose={handleCloseAbout}
      />

      {/* Right Events Calendar Panel */}
      <RightEventsCalendarPanel
        isOpen={eventsOpen}
        onClose={handleCloseEvents}
      />

      {/* Overlay when chat is open */}
      {chatOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={handleCloseChat}
        />
      )}

      {/* Overlay when about is open */}
      {aboutOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={handleCloseAbout}
        />
      )}

      {/* Overlay when events is open */}
      {eventsOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={handleCloseEvents}
        />
      )}
    </div>
  );
}
