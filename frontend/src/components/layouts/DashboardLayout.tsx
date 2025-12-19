import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { RightAboutPanel } from '@/components/about';
import { RightEventsCalendarPanel } from '@/components/events/RightEventsCalendarPanel';
import { IntelligentChatPanel } from '@/components/chat/IntelligentChatPanel';
import { CommentTray } from '@/components/projects/CommentTray';
import { QuestTray } from '@/components/side-quests/QuestTray';
import { Footer } from '@/components/landing/Footer';
import { EmberAdventureBanner, useEmberOnboardingContextSafe } from '@/components/onboarding';
import { PendingBattleBanner } from '@/components/battles';
import { AsyncBattleBanner } from '@/components/battles/AsyncBattleBanner';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { TopicTrayProvider } from '@/context/TopicTrayContext';
import { ProjectPreviewTrayProvider, useProjectPreviewTraySafe } from '@/context/ProjectPreviewTrayContext';
import { useAuth } from '@/hooks/useAuth';
import { useActiveQuest } from '@/hooks/useActiveQuest';
import type { Project, UserSideQuest } from '@/types/models';

// Constants
const GITHUB_OAUTH_TIMESTAMP_KEY = 'github_oauth_timestamp';
const EMBER_OPEN_CHAT_KEY = 'ember_open_chat';
const OVERLAY_CLASSNAME = 'fixed inset-0 bg-black/20 z-30 md:hidden';

/**
 * Inner component that registers the main scroll container with the tray context.
 * This must be used inside ProjectPreviewTrayProvider.
 */
function MainScrollContainer({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const trayContext = useProjectPreviewTraySafe();

  useEffect(() => {
    if (trayContext?.setFeedScrollContainer && mainRef.current) {
      trayContext.setFeedScrollContainer(mainRef.current);
    }
    return () => {
      if (trayContext?.setFeedScrollContainer) {
        trayContext.setFeedScrollContainer(null);
      }
    };
  }, [trayContext]);

  return (
    <main ref={mainRef} className="flex-1 overflow-y-auto scroll-pt-16">
      {children}
    </main>
  );
}

interface DashboardLayoutProps {
  children: ReactNode | ((props: {
    openChat: (menuItem: string) => void;
    openAddProject: (welcomeMode?: boolean) => void;
    openCommentPanel: (project: Project) => void;
    openQuestTray: (quest: UserSideQuest) => void;
  }) => ReactNode);
  openAboutPanel?: boolean;
  autoCollapseSidebar?: boolean;
}

export function DashboardLayout({ children, openAboutPanel = false }: DashboardLayoutProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const onboardingContext = useEmberOnboardingContextSafe();
  const [aboutOpen, setAboutOpen] = useState(openAboutPanel);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addProjectWelcomeMode, setAddProjectWelcomeMode] = useState(false);
  const [chatSupportMode, setChatSupportMode] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentPanelProject, setCommentPanelProject] = useState<Project | null>(null);

  // Architecture regeneration state
  const [architectureRegenerateContext, setArchitectureRegenerateContext] = useState<{
    projectId: number;
    projectTitle: string;
  } | null>(null);

  // Track if component has mounted to avoid closing panels on initial render
  const hasMounted = useRef(false);

  // Quest tray state using the hook
  const {
    questTrayOpen,
    selectedQuest,
    openQuestTray,
    openActiveQuestTray,
    closeQuestTray,
    getQuestColors,
    getQuestCategory,
  } = useActiveQuest();

  // Get colors and category for the selected quest
  const selectedQuestColors = getQuestColors(selectedQuest);
  const selectedQuestCategory = getQuestCategory(selectedQuest);

  // Stable conversationId that doesn't change on every render
  // This prevents the IntelligentChatPanel from reinitializing on parent re-renders
  // Use 'chat-' prefix for general conversations (not 'project-' which forces project-creation mode)
  const conversationId = useMemo(() => `chat-${Date.now()}`, []);

  // Auto-open about panel when prop is true
  useEffect(() => {
    if (openAboutPanel) {
      setAboutOpen(true);
    }
  }, [openAboutPanel]);

  // Close all panels when location changes (user navigates to a different page)
  // Skip on initial mount to allow openAboutPanel prop to work
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

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

    handleOpenAddProject();
  }, []);

  // Check for Ember onboarding "Add Project" adventure - open chat in welcome mode
  useEffect(() => {
    const emberOpenChat = localStorage.getItem(EMBER_OPEN_CHAT_KEY);

    if (emberOpenChat === 'true') {
      // Clear immediately to prevent re-triggering
      localStorage.removeItem(EMBER_OPEN_CHAT_KEY);

      // Short delay to let the page render first
      setTimeout(() => {
        handleOpenAddProject(true); // Open in welcome mode
      }, 300);
    }
  }, [location.pathname]);

  // Listen for custom event to open add project chat (used by ClippedTab, etc.)
  useEffect(() => {
    const handleOpenAddProjectEvent = () => {
      handleOpenAddProject(false);
    };
    window.addEventListener('openAddProject', handleOpenAddProjectEvent);
    return () => window.removeEventListener('openAddProject', handleOpenAddProjectEvent);
  }, []);

  // Listen for architecture regeneration event (from ArchitectureSection)
  useEffect(() => {
    const handleArchitectureRegenerateEvent = (event: CustomEvent<{
      projectId: number;
      projectTitle: string;
      projectSlug: string;
    }>) => {
      const { projectId, projectTitle } = event.detail;
      setArchitectureRegenerateContext({ projectId, projectTitle });
      setAddProjectOpen(true);
      setAddProjectWelcomeMode(false);
      setChatSupportMode(false);
      setAboutOpen(false);
      setEventsOpen(false);
    };
    window.addEventListener('openArchitectureRegenerate', handleArchitectureRegenerateEvent as EventListener);
    return () => window.removeEventListener('openArchitectureRegenerate', handleArchitectureRegenerateEvent as EventListener);
  }, []);

  const handleMenuClick = useCallback((menuItem: string) => {
    if (menuItem === 'About Us') {
      setAboutOpen((wasOpen) => {
        // Scroll to About Us section after state update
        setTimeout(() => {
          const element = document.getElementById('about-us');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, wasOpen ? 50 : 150); // Shorter delay if already open
        return true;
      });
      setEventsOpen(false);
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
    } else if (menuItem === 'Chat') {
      // On /home, chat is embedded - don't open sidebar
      if (location.pathname === '/home') {
        return;
      }
      // Open chat panel in support mode (with help questions visible)
      setAddProjectOpen(true);
      setChatSupportMode(true);
      setAddProjectWelcomeMode(false);
      setAboutOpen(false);
      setEventsOpen(false);
    }
  }, [location.pathname]);

  const handleCloseAbout = () => {
    setAboutOpen(false);
  };

  const handleCloseEvents = () => {
    setEventsOpen(false);
  };

  const handleOpenAddProject = useCallback((welcomeMode: boolean = false) => {
    // Open Add Project panel with 4 options (or welcome mode for new users)
    setAddProjectOpen(true);
    setAddProjectWelcomeMode(welcomeMode);
    setChatSupportMode(false); // Reset support mode when opening normally
    setAboutOpen(false);
    setEventsOpen(false);
  }, []);

  const handleCloseAddProject = () => {
    setAddProjectOpen(false);
    setAddProjectWelcomeMode(false);
    setChatSupportMode(false);
    setArchitectureRegenerateContext(null);
  };

  const handleOpenCommentPanel = useCallback((project: Project) => {
    setCommentPanelProject(project);
    setCommentPanelOpen(true);
    // Close other panels
    setAboutOpen(false);
    setEventsOpen(false);
    setAddProjectOpen(false);
  }, []);

  const handleCloseCommentPanel = () => {
    setCommentPanelOpen(false);
    setCommentPanelProject(null);
  };

  return (
    <TopicTrayProvider>
    <ProjectPreviewTrayProvider>
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background is now handled by CSS in index.css - uses CSS gradients instead of images */}

      {/* Impersonation Banner - shows when admin is impersonating a user */}
      <ImpersonationBanner />

      {/* Main App Layout */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Navigation */}
        <TopNavigation
          onMenuClick={handleMenuClick}
          onOpenActiveQuest={openActiveQuestTray}
        />

        {/* Main Content Area - wrapped in MainScrollContainer for scroll-to-close support */}
        <MainScrollContainer>
          <div style={{ paddingTop: 'calc(4rem + var(--impersonation-offset, 0px))' }}>
            {/* Ember Onboarding Banner - positioned below nav, not sticky */}
            {onboardingContext?.shouldShowBanner && (
              <EmberAdventureBanner
                completedAdventures={onboardingContext.completedAdventures}
                onAdventureClick={onboardingContext.completeAdventure}
                onDismiss={onboardingContext.dismissOnboarding}
                onShowMoreRecommendations={() => {
                  window.location.href = '/onboarding';
                }}
              />
            )}
            {/* Pending Battle Banner - shows when user has created a battle challenge */}
            <PendingBattleBanner />
            {/* Async Battle Banner - shows when user has an async battle where it's their turn */}
            <AsyncBattleBanner />
            {typeof children === 'function' ? children({ openChat: handleMenuClick, openAddProject: handleOpenAddProject, openCommentPanel: handleOpenCommentPanel, openQuestTray }) : children}
          </div>
          <Footer />
        </MainScrollContainer>

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
            conversationId={
              architectureRegenerateContext
                ? `project-${architectureRegenerateContext.projectId}-architecture`
                : conversationId
            }
            welcomeMode={addProjectWelcomeMode}
            supportMode={chatSupportMode}
            architectureRegenerateContext={architectureRegenerateContext}
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
          userQuest={selectedQuest}
          colors={selectedQuestColors}
          category={selectedQuestCategory}
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
    </ProjectPreviewTrayProvider>
    </TopicTrayProvider>
  );
}
