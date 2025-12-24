import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavigation } from '@/components/navigation/TopNavigation';
import { RightAboutPanel } from '@/components/about';
import { RightEventsCalendarPanel } from '@/components/events/RightEventsCalendarPanel';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { CommentTray } from '@/components/projects/CommentTray';
import { QuestTray } from '@/components/side-quests/QuestTray';
import { MessagesTray } from '@/components/community/Messages/MessagesTray';
import { useMessagesTrayOptional } from '@/context/MessagesTrayContext';
import { Footer } from '@/components/landing/Footer';
import { PendingBattleBanner } from '@/components/battles';
import { AsyncBattleBanner } from '@/components/battles/AsyncBattleBanner';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { TopicTrayProvider } from '@/context/TopicTrayContext';
import { ProjectPreviewTrayProvider, useProjectPreviewTraySafe } from '@/context/ProjectPreviewTrayContext';
import { LearningPathPreviewTrayProvider } from '@/context/LearningPathPreviewTrayContext';
import { LessonPreviewTrayProvider } from '@/context/LessonPreviewTrayContext';
import { PointsNotificationProvider } from '@/context/PointsNotificationContext';
import { GlobalPointsAwardOverlay } from '@/components/thrive-circle/PointsAwardOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useActiveQuest } from '@/hooks/useActiveQuest';
import { useStableConversationId } from '@/hooks/useStableConversationId';
import type { Project, UserSideQuest, LearningGoal } from '@/types/models';

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

interface LearningSetupContext {
  needsSetup: boolean;
  onSelectGoal: (goal: LearningGoal) => void;
  onSkip: () => void;
  isPending: boolean;
}

// Chat context determines which quick actions to show in the Ember chat
type ChatContext = 'learn' | 'explore' | 'project' | 'default';

interface OpenChatOptions {
  welcomeMode?: boolean;
  context?: ChatContext;
  expanded?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode | ((props: {
    openChat: (menuItem: string) => void;
    openAddProject: (options?: boolean | OpenChatOptions) => void;
    openCommentPanel: (project: Project) => void;
    openQuestTray: (quest: UserSideQuest) => void;
    setLearningSetupContext: (context: LearningSetupContext | null) => void;
  }) => ReactNode);
  openAboutPanel?: boolean;
  autoCollapseSidebar?: boolean;
  /** Hide footer for full-viewport layouts like learning paths */
  hideFooter?: boolean;
}

export function DashboardLayout({ children, openAboutPanel = false, hideFooter = false }: DashboardLayoutProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(openAboutPanel);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentPanelProject, setCommentPanelProject] = useState<Project | null>(null);

  // Architecture regeneration state
  const [architectureRegenerateContext, setArchitectureRegenerateContext] = useState<{
    projectId: number;
    projectTitle: string;
  } | null>(null);

  // Profile generation state
  const [profileGenerateContext, setProfileGenerateContext] = useState<{
    userId: number;
    username: string;
  } | null>(null);

  // Avatar generation state (from settings page)
  const [avatarGenerateContext, setAvatarGenerateContext] = useState<{
    userId: number;
    username: string;
  } | null>(null);

  // Learning setup context state
  const [learningSetupContext, setLearningSetupContext] = useState<LearningSetupContext | null>(null);

  // Chat context state - determines which quick actions to show in Ember chat
  const [chatContext, setChatContext] = useState<ChatContext>('default');

  // Chat expanded state - for learning sessions in expanded mode
  const [chatExpanded, setChatExpanded] = useState(false);

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

  // Messages tray context
  const messagesTray = useMessagesTrayOptional();

  // Use stable conversation ID for LangGraph checkpointing persistence
  // This ensures chat history is preserved across page refreshes
  // The ID is stable per user+context, so conversations persist
  const conversationId = useStableConversationId({
    context: chatContext as 'default' | 'learn' | 'explore' | 'project',
  });

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
    setCommentPanelOpen(false);
    setCommentPanelProject(null);
  }, [location.pathname]);

  // Define handleOpenAddProject before effects that use it
  const handleOpenAddProject = useCallback((options: boolean | OpenChatOptions = false) => {
    // Handle backwards compatibility - boolean means welcomeMode (now ignored)
    const opts: OpenChatOptions = typeof options === 'boolean'
      ? { welcomeMode: options }
      : options;

    // Open Ember chat panel with context-aware quick actions
    setAddProjectOpen(true);
    setChatContext(opts.context ?? 'default');
    setChatExpanded(opts.expanded ?? false);
    setAboutOpen(false);
    setEventsOpen(false);
  }, []);

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
  }, [handleOpenAddProject]);

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
  }, [location.pathname, handleOpenAddProject]);

  // Listen for custom event to open add project chat (used by ClippedTab, etc.)
  useEffect(() => {
    const handleOpenAddProjectEvent = () => {
      handleOpenAddProject(false);
    };
    window.addEventListener('openAddProject', handleOpenAddProjectEvent);
    return () => window.removeEventListener('openAddProject', handleOpenAddProjectEvent);
  }, [handleOpenAddProject]);

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
      setAboutOpen(false);
      setEventsOpen(false);
    };
    window.addEventListener('openArchitectureRegenerate', handleArchitectureRegenerateEvent as EventListener);
    return () => window.removeEventListener('openArchitectureRegenerate', handleArchitectureRegenerateEvent as EventListener);
  }, []);

  // Listen for profile generation event (from ProfilePage)
  useEffect(() => {
    const handleProfileGenerateEvent = (event: CustomEvent<{
      userId: number;
      username: string;
    }>) => {
      const { userId, username } = event.detail;
      setProfileGenerateContext({ userId, username });
      setAddProjectOpen(true);
      setAboutOpen(false);
      setEventsOpen(false);
    };
    window.addEventListener('openProfileGenerate', handleProfileGenerateEvent as EventListener);
    return () => window.removeEventListener('openProfileGenerate', handleProfileGenerateEvent as EventListener);
  }, []);

  // Listen for avatar generation event (from ImageUpload on settings page)
  useEffect(() => {
    const handleAvatarGenerateEvent = (event: CustomEvent<{
      userId: number;
      username: string;
    }>) => {
      const { userId, username } = event.detail;
      setAvatarGenerateContext({ userId, username });
      setAddProjectOpen(true);
      setAboutOpen(false);
      setEventsOpen(false);
    };
    window.addEventListener('openAvatarGenerate', handleAvatarGenerateEvent as EventListener);
    return () => window.removeEventListener('openAvatarGenerate', handleAvatarGenerateEvent as EventListener);
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
      // Open Ember chat panel
      setAddProjectOpen(true);
      setChatContext('default');
      setAboutOpen(false);
      setEventsOpen(false);
    } else if (menuItem === 'My Messages') {
      // Open messages tray
      messagesTray?.openMessagesTray();
    }
  }, [location.pathname, messagesTray]);

  const handleCloseAbout = () => {
    setAboutOpen(false);
  };

  const handleCloseEvents = () => {
    setEventsOpen(false);
  };

  const handleCloseAddProject = () => {
    setAddProjectOpen(false);
    setArchitectureRegenerateContext(null);
    setProfileGenerateContext(null);
    setAvatarGenerateContext(null);
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
    <PointsNotificationProvider>
    <TopicTrayProvider>
    <ProjectPreviewTrayProvider>
    <LearningPathPreviewTrayProvider>
    <LessonPreviewTrayProvider>
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
            {/* Pending Battle Banner - shows when user has created a battle challenge */}
            <PendingBattleBanner />
            {/* Async Battle Banner - shows when user has an async battle where it's their turn */}
            <AsyncBattleBanner />
            {typeof children === 'function' ? children({ openChat: handleMenuClick, openAddProject: handleOpenAddProject, openCommentPanel: handleOpenCommentPanel, openQuestTray, setLearningSetupContext }) : children}
          </div>
          {!hideFooter && <Footer />}
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

        {/* Ember Chat Panel - unified AI assistant with context-aware quick actions */}
        {addProjectOpen && (
          <ChatSidebar
            isOpen={addProjectOpen}
            onClose={handleCloseAddProject}
            conversationId={
              architectureRegenerateContext
                ? `project-${architectureRegenerateContext.projectId}-architecture`
                : profileGenerateContext
                  ? `profile-${profileGenerateContext.userId}-generate`
                  : avatarGenerateContext
                    ? `avatar-${avatarGenerateContext.userId}-generate`
                    : conversationId
            }
            context={chatContext}
            architectureRegenerateContext={architectureRegenerateContext}
            profileGenerateContext={profileGenerateContext}
            avatarGenerateContext={avatarGenerateContext}
            learningSetupContext={learningSetupContext}
            defaultExpanded={chatExpanded}
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

        {/* Messages Tray - DM conversations */}
        <MessagesTray />

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
    </LessonPreviewTrayProvider>
    </LearningPathPreviewTrayProvider>
    </ProjectPreviewTrayProvider>
    </TopicTrayProvider>
    {/* Global Points Award Overlay - shows when any component triggers a points notification */}
    <GlobalPointsAwardOverlay />
    </PointsNotificationProvider>
  );
}
