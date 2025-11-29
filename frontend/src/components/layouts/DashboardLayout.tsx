import { useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { RightChatPanel } from '@/components/chat/RightChatPanel';
import { RightAboutPanel } from '@/components/about';
import { RightEventsCalendarPanel } from '@/components/events/RightEventsCalendarPanel';
import { RightAddProjectChat } from '@/components/projects/RightAddProjectChat';

interface DashboardLayoutProps {
  children: ReactNode | ((props: { openChat: (menuItem: string) => void; openAddProject: () => void }) => ReactNode);
  openAboutPanel?: boolean;
}

export function DashboardLayout({ children, openAboutPanel = false }: DashboardLayoutProps) {
  const { theme } = useTheme();
  const [chatOpen, setChatOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(openAboutPanel);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);

  // Auto-open about panel when prop is true
  useEffect(() => {
    if (openAboutPanel) {
      setAboutOpen(true);
      setChatOpen(false);
      setSelectedMenuItem(null);
    }
  }, [openAboutPanel]);

  // Check for GitHub OAuth return and auto-open Add Project panel
  useEffect(() => {
    const oauthReturn = localStorage.getItem('github_oauth_return');
    console.log('🔍 DashboardLayout checking OAuth return:', { oauthReturn });

    if (oauthReturn === 'add_project_chat') {
      console.log('✅ Opening Add Project panel after OAuth return');
      // Open the Add Project panel automatically
      handleOpenAddProject();
    }
  }, []);

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

  const handleOpenAddProject = () => {
    // Open Add Project panel with 4 options
    setAddProjectOpen(true);
    setChatOpen(false);
    setAboutOpen(false);
    setEventsOpen(false);
    setSelectedMenuItem(null);
  };

  const handleCloseAddProject = () => {
    setAddProjectOpen(false);
  };

  const backgroundImage = theme === 'dark' ? '/dark.jpeg' : '/light.jpeg';

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background Layer */}
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${
          theme === 'light' ? '-scale-x-100 -scale-y-100' : ''
        }`}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Main App Layout */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Navigation */}
        <TopNavigation
          onMenuClick={handleMenuClick}
          onAddProject={handleOpenAddProject}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-pt-16">
          <div className="pt-16">
            {typeof children === 'function' ? children({ openChat: handleMenuClick, openAddProject: handleOpenAddProject }) : children}
          </div>
        </main>

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

        {/* Right Add Project Chat */}
        <RightAddProjectChat
          isOpen={addProjectOpen}
          onClose={handleCloseAddProject}
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

        {/* Overlay when add project is open */}
        {addProjectOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={handleCloseAddProject}
          />
        )}
      </div>
    </div>
  );
}
