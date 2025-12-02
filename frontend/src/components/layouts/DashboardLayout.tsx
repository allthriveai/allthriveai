import { useState, ReactNode, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { RightAboutPanel } from '@/components/about';
import { RightEventsCalendarPanel } from '@/components/events/RightEventsCalendarPanel';
import { IntelligentChatPanel } from '@/components/chat/IntelligentChatPanel';
import { CommentTray } from '@/components/projects/CommentTray';
import { QuestTray } from '@/components/side-quests/QuestTray';
import { useAuth } from '@/hooks/useAuth';
import { useActiveQuest } from '@/hooks/useActiveQuest';
import type { Project, UserSideQuest } from '@/types/models';

// Constants
const GITHUB_OAUTH_TIMESTAMP_KEY = 'github_oauth_timestamp';
const OVERLAY_CLASSNAME = 'fixed inset-0 bg-black/20 z-30 md:hidden';

interface DashboardLayoutProps {
  children: ReactNode | ((props: {
    openChat: (menuItem: string) => void;
    openAddProject: (welcomeMode?: boolean) => void;
    openCommentPanel: (project: Project) => void;
    openQuestTray: (quest: UserSideQuest) => void;
  }) => ReactNode);
  openAboutPanel?: boolean;
}

export function DashboardLayout({ children, openAboutPanel = false }: DashboardLayoutProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(openAboutPanel);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addProjectWelcomeMode, setAddProjectWelcomeMode] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentPanelProject, setCommentPanelProject] = useState<Project | null>(null);

  // Quest tray state using the hook
  const {
    questTrayOpen,
    selectedQuest,
    activeQuest,
    openQuestTray,
    openActiveQuestTray,
    closeQuestTray,
  } = useActiveQuest();

  // Stable conversationId that doesn't change on every render
  // This prevents the IntelligentChatPanel from reinitializing on parent re-renders
  const conversationId = useMemo(() => `project-${Date.now()}`, []);

  // Auto-open about panel when prop is true
  useEffect(() => {
    if (openAboutPanel) {
      setAboutOpen(true);
    }
  }, [openAboutPanel]);

  // Close all panels when location changes (user navigates to a different page)
  useEffect(() => {
    setAboutOpen(false);
    setEventsOpen(false);
    setAddProjectOpen(false);
    setAddProjectWelcomeMode(false);
    setCommentPanelOpen(false);
    setCommentPanelProject(null);
  }, [location.pathname]);

  // Check for GitHub OAuth return and auto-open Add Project panel
  useEffect(() => {
    const oauthReturn = localStorage.getItem('github_oauth_return');
    const oauthTimestamp = localStorage.getItem(GITHUB_OAUTH_TIMESTAMP_KEY);

    // Validate return value is expected
    const validReturnValues = ['add_project_chat'] as const;
    if (!oauthReturn || !validReturnValues.includes(oauthReturn as typeof validReturnValues[number])) {
      return;
    }

    // Check for timestamp to prevent stale data (5 minute expiry)
    if (oauthTimestamp) {
      const age = Date.now() - parseInt(oauthTimestamp, 10);
      if (isNaN(age) || age > 5 * 60 * 1000) {
        // Expired or invalid - clean up and exit
        localStorage.removeItem('github_oauth_return');
        localStorage.removeItem(GITHUB_OAUTH_TIMESTAMP_KEY);
        return;
      }
    }

    // Clear immediately to prevent re-triggering on subsequent renders
    localStorage.removeItem('github_oauth_return');
    localStorage.removeItem(GITHUB_OAUTH_TIMESTAMP_KEY);

    console.log('✅ Opening Add Project panel after OAuth return');
    handleOpenAddProject();
  }, []);

  const handleMenuClick = (menuItem: string) => {
    if (menuItem === 'About Us') {
      const wasOpen = aboutOpen;
      setAboutOpen(true);
      setEventsOpen(false);
      // Scroll to About Us section
      setTimeout(() => {
        const element = document.getElementById('about-us');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, wasOpen ? 50 : 150); // Shorter delay if already open
    } else if (menuItem === 'Our Values') {
      setAboutOpen(true);
      setEventsOpen(false);
      // Wait for panel to open and then scroll to the element
      setTimeout(() => {
        const element = document.getElementById('our-values');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else if (menuItem === 'Events Calendar') {
      setEventsOpen(true);
      setAboutOpen(false);
    }
  };

  const handleCloseAbout = () => {
    setAboutOpen(false);
  };

  const handleCloseEvents = () => {
    setEventsOpen(false);
  };

  const handleOpenAddProject = (welcomeMode: boolean = false) => {
    // Open Add Project panel with 4 options (or welcome mode for new users)
    setAddProjectOpen(true);
    setAddProjectWelcomeMode(welcomeMode);
    setAboutOpen(false);
    setEventsOpen(false);
  };

  const handleCloseAddProject = () => {
    setAddProjectOpen(false);
    setAddProjectWelcomeMode(false);
  };

  const handleOpenCommentPanel = (project: Project) => {
    setCommentPanelProject(project);
    setCommentPanelOpen(true);
    // Close other panels
    setAboutOpen(false);
    setEventsOpen(false);
    setAddProjectOpen(false);
  };

  const handleCloseCommentPanel = () => {
    setCommentPanelOpen(false);
    setCommentPanelProject(null);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background is now handled by CSS in index.css - uses CSS gradients instead of images */}

      {/* Main App Layout */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Navigation */}
        <TopNavigation
          onMenuClick={handleMenuClick}
          onAddProject={handleOpenAddProject}
          onOpenActiveQuest={openActiveQuestTray}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto scroll-pt-16">
          <div className="pt-16">
            {typeof children === 'function' ? children({ openChat: handleMenuClick, openAddProject: handleOpenAddProject, openCommentPanel: handleOpenCommentPanel, openQuestTray }) : children}
          </div>
        </main>

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

        {/* Intelligent Chat Panel - only render when open so internal state resets on close */}
        {addProjectOpen && (
          <IntelligentChatPanel
            isOpen={addProjectOpen}
            onClose={handleCloseAddProject}
            conversationId={conversationId}
            welcomeMode={addProjectWelcomeMode}
          />
        )}

        {/* Page-level Comment Panel */}
        {commentPanelProject && (
          <CommentTray
            isOpen={commentPanelOpen}
            onClose={handleCloseCommentPanel}
            project={commentPanelProject}
            isAuthenticated={isAuthenticated}
          />
        )}

        {/* Quest Tray */}
        <QuestTray
          isOpen={questTrayOpen}
          onClose={closeQuestTray}
          activeQuest={selectedQuest}
        />

        {/* Overlay when about is open */}
        {aboutOpen && (
          <div className={OVERLAY_CLASSNAME} onClick={handleCloseAbout} />
        )}

        {/* Overlay when events is open */}
        {eventsOpen && (
          <div className={OVERLAY_CLASSNAME} onClick={handleCloseEvents} />
        )}

        {/* Overlay when add project is open */}
        {addProjectOpen && (
          <div className={OVERLAY_CLASSNAME} onClick={handleCloseAddProject} />
        )}

        {/* Overlay when comment panel is open */}
        {commentPanelOpen && (
          <div className={OVERLAY_CLASSNAME} onClick={handleCloseCommentPanel} />
        )}

        {/* Overlay when quest tray is open */}
        {questTrayOpen && (
          <div className={OVERLAY_CLASSNAME} onClick={closeQuestTray} />
        )}
      </div>
    </div>
  );
}
