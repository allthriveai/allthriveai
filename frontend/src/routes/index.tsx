import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

// Loading component for lazy-loaded routes
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Redirect component that preserves query parameters
function RedirectWithQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

// Redirect component for battle routes - preserves battleId
function BattleRedirect() {
  const { battleId } = useParams();
  const location = useLocation();
  return <Navigate to={`/play/prompt-battles/${battleId}${location.search}`} replace />;
}

import { ProtectedRoute, setGuestBattleId, clearGuestBattleId, getGuestBattleId } from './ProtectedRoute';

// Re-export guest helpers for use elsewhere
export { setGuestBattleId, clearGuestBattleId, getGuestBattleId };

// =============================================================================
// Lazy-loaded page components for code splitting
// Critical pages (landing, auth) are loaded immediately for fast initial load
// =============================================================================

// Critical path - load immediately
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Core pages - lazy loaded
const EmberHomePage = lazy(() => import('@/pages/EmberHomePage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));

// Settings pages - lazy loaded (rarely accessed)
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettingsPage'));
const ActivitySettingsPage = lazy(() => import('@/pages/ActivitySettingsPage'));
const BattlesSettingsPage = lazy(() => import('@/pages/BattlesSettingsPage'));
const IntegrationsSettingsPage = lazy(() => import('@/pages/settings/IntegrationsSettingsPage'));
const PersonalizationSettingsPage = lazy(() => import('@/pages/settings/PersonalizationSettingsPage'));
const NotificationsSettingsPage = lazy(() => import('@/pages/settings/NotificationsSettingsPage'));
const BillingSettingsPage = lazy(() => import('@/pages/settings/BillingSettingsPage'));
const CreatorSettingsPage = lazy(() => import('@/pages/settings/CreatorSettingsPage'));
const PrivacySettingsPage = lazy(() => import('@/pages/settings/PrivacySettingsPage'));
const ReferralsPage = lazy(() => import('@/pages/settings/ReferralsPage'));

// Feature pages - lazy loaded
const NeonGlassStyleguide = lazy(() => import('@/pages/NeonGlassStyleguide'));
const QuizListPage = lazy(() => import('@/pages/quizzes/QuizListPage'));
const QuizPage = lazy(() => import('@/pages/quizzes/QuizPage'));
const LearnPage = lazy(() => import('@/pages/LearnPage'));
const LearningPathDetailPage = lazy(() => import('@/pages/LearningPathDetailPage'));
const ToolDirectoryPage = lazy(() => import('@/pages/ToolDirectoryPage'));
const ToolDetailPage = lazy(() => import('@/pages/ToolDetailPage'));
const ExplorePage = lazy(() => import('@/pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const ThriveCirclePage = lazy(() => import('@/pages/ThriveCirclePage'));
const GamesPage = lazy(() => import('@/pages/GamesPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));

// Community pages - lazy loaded
const LoungePage = lazy(() => import('@/pages/community/LoungePage'));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage'));

// Battle pages - lazy loaded
const BattlesLobbyPage = lazy(() => import('@/pages/battles').then((m) => ({ default: m.BattlesLobbyPage })));
const BattlePage = lazy(() => import('@/pages/battles').then((m) => ({ default: m.BattlePage })));
const BattleInvitePage = lazy(() => import('@/pages/battles').then((m) => ({ default: m.BattleInvitePage })));
const ChallengePage = lazy(() => import('@/pages/challenges').then((m) => ({ default: m.ChallengePage })));

// Games - lazy loaded
const EthicsDefenderGame = lazy(() => import('@/pages/games/EthicsDefenderGame'));
const ContextSnakeGame = lazy(() => import('@/pages/games/ContextSnakeGame'));

// Commerce pages - lazy loaded
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const CheckoutSuccessPage = lazy(() => import('@/pages/CheckoutSuccessPage'));
const PerksPage = lazy(() => import('@/pages/PerksPage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));

// Admin pages - lazy loaded (admin only)
const VendorDashboardPage = lazy(() => import('@/pages/VendorDashboardPage'));
const AdminInvitationsPage = lazy(() => import('@/pages/admin/InvitationsPage'));
const AdminPromptChallengePromptsPage = lazy(() => import('@/pages/admin/PromptChallengePromptsPage'));
const AdminImpersonatePage = lazy(() => import('@/pages/admin/ImpersonatePage'));
const AdminCircleManagementPage = lazy(() => import('@/pages/admin/CircleManagementPage'));
const AdminTasksPage = lazy(() => import('@/pages/admin/TasksPage'));
const AdminUATScenariosPage = lazy(() => import('@/pages/admin/UATScenariosPage'));
const AdminEmberFlowsPage = lazy(() => import('@/pages/admin/EmberFlowsPage'));
const AdminLessonsPage = lazy(() => import('@/pages/admin/LessonsPage'));

// Analytics pages - lazy loaded (admin only)
const AnalyticsIndexPage = lazy(() => import('@/pages/admin/analytics/index'));
const AnalyticsOverviewPage = lazy(() => import('@/pages/admin/analytics/OverviewPage'));
const AnalyticsUsersPage = lazy(() => import('@/pages/admin/analytics/UsersPage'));
const AnalyticsBattlesPage = lazy(() => import('@/pages/admin/analytics/BattlesPage'));
const AnalyticsAIUsagePage = lazy(() => import('@/pages/admin/analytics/AIUsagePage'));
const AnalyticsContentPage = lazy(() => import('@/pages/admin/analytics/ContentPage'));
const AnalyticsEngagementPage = lazy(() => import('@/pages/admin/analytics/EngagementPage'));
const AnalyticsOnboardingPage = lazy(() => import('@/pages/admin/analytics/OnboardingPage'));
const AnalyticsRevenuePage = lazy(() => import('@/pages/admin/analytics/RevenuePage'));

// Extension pages - lazy loaded
const ExtensionAuthPage = lazy(() => import('@/pages/ExtensionAuthPage'));
const ExtensionPage = lazy(() => import('@/pages/ExtensionPage'));

// Marketing/promo pages - lazy loaded
const PitchDeckPage = lazy(() => import('@/pages/PitchDeckPage'));
const PromoPage = lazy(() => import('@/pages/PromoPage'));
const PromoVideoPage = lazy(() => import('@/pages/PromoVideoPage'));

// Legal pages - lazy loaded
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('@/pages/TermsOfServicePage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Landing page - public, redirects authenticated users to /home */}
      <Route path="/" element={<LandingPage />} />

      {/* Home - Ember chat-first experience for authenticated users */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <EmberHomePage />
          </ProtectedRoute>
        }
      />

      {/* About page - public route */}
      <Route path="/about" element={<AboutPage />} />
      <Route path="/about-us" element={<AboutPage />} />

      {/* Team page - public route */}
      <Route path="/team" element={<TeamPage />} />
      <Route
        path="/styleguide"
        element={
          <ProtectedRoute>
            <NeonGlassStyleguide />
          </ProtectedRoute>
        }
      />

      {/* Learn route - protected */}
      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <LearnPage />
          </ProtectedRoute>
        }
      />

      {/* Learning path detail with lesson - must come before /:username/learn/:slug */}
      <Route
        path="/:username/learn/:slug/:lessonSlug"
        element={
          <ProtectedRoute>
            <LearningPathDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Learning path detail with username - must come before /:username/:projectSlug */}
      <Route
        path="/:username/learn/:slug"
        element={
          <ProtectedRoute>
            <LearningPathDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Quiz routes - protected, must come before /:username routes */}
      <Route
        path="/quizzes"
        element={
          <ProtectedRoute>
            <QuizListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quizzes/:slug"
        element={
          <ProtectedRoute>
            <QuizPage />
          </ProtectedRoute>
        }
      />

      {/* Tool Directory - protected */}
      <Route
        path="/tools"
        element={
          <ProtectedRoute>
            <ToolDirectoryPage />
          </ProtectedRoute>
        }
      >
        <Route path=":slug" element={<ToolDetailPage />} />
      </Route>

      {/* Explore - public route */}
      <Route path="/explore" element={<ExplorePage />} />

      {/* Pricing - public route */}
      <Route path="/pricing" element={<PricingPage />} />

      {/* Legal pages - public routes */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />

      {/* Pitch deck - public route with password gate */}
      <Route path="/pitch" element={<PitchDeckPage />} />

      {/* Feature promo video - public route for screen recording */}
      <Route path="/feature-promo" element={<PromoPage />} />

      {/* Promo video with real video clips */}
      <Route path="/promo" element={<PromoVideoPage />} />

      {/* Perks - public route (coming soon) */}
      <Route path="/perks" element={<PerksPage />} />

      {/* Marketplace - public route (coming soon) */}
      <Route path="/marketplace" element={<MarketplacePage />} />

      {/* Checkout - protected route */}
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />

      {/* Checkout Success - protected route */}
      <Route
        path="/checkout/success"
        element={
          <ProtectedRoute>
            <CheckoutSuccessPage />
          </ProtectedRoute>
        }
      />

      {/* Prompt Battles - primary routes under /play */}
      <Route
        path="/play/prompt-battles"
        element={
          <ProtectedRoute>
            <BattlesLobbyPage />
          </ProtectedRoute>
        }
      />
      {/* Battle detail page - public for completed battles, requires auth for active */}
      <Route path="/play/prompt-battles/:battleId" element={<BattlePage />} />
      {/* Battle invitation link (from SMS) - public so users can see invitation before login */}
      <Route path="/battle/invite/:token" element={<BattleInvitePage />} />

      {/* Legacy /battles routes - redirect to /play/prompt-battles */}
      <Route
        path="/battles"
        element={<Navigate to="/play/prompt-battles" replace />}
      />
      <Route
        path="/battles/:battleId"
        element={<BattleRedirect />}
      />
      {/* Legacy /play/prompt-battle (singular) routes */}
      <Route
        path="/play/prompt-battle"
        element={<Navigate to="/play/prompt-battles" replace />}
      />
      <Route
        path="/play/prompt-battle/:battleId"
        element={<BattleRedirect />}
      />

      {/* Weekly Challenges */}
      <Route
        path="/challenges"
        element={
          <ProtectedRoute>
            <ChallengePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/challenges/:slug"
        element={
          <ProtectedRoute>
            <ChallengePage />
          </ProtectedRoute>
        }
      />
      {/* Alias for this week's challenge */}
      <Route
        path="/this-weeks-challenge"
        element={<Navigate to="/challenges" replace />}
      />

      {/* Thrive Circle - protected */}
      <Route
        path="/thrive-circle"
        element={
          <ProtectedRoute>
            <ThriveCirclePage />
          </ProtectedRoute>
        }
      />

      {/* The Lounge (Community Forums) - protected */}
      <Route
        path="/lounge"
        element={
          <ProtectedRoute>
            <LoungePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lounge/:roomId"
        element={
          <ProtectedRoute>
            <LoungePage />
          </ProtectedRoute>
        }
      />

      {/* Community Feedback - protected */}
      <Route
        path="/feedback"
        element={
          <ProtectedRoute>
            <FeedbackPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feedback/:id"
        element={
          <ProtectedRoute>
            <FeedbackPage />
          </ProtectedRoute>
        }
      />

      {/* Ember's Onboarding - protected */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      {/* Legacy routes - redirect to onboarding */}
      <Route
        path="/getting-started"
        element={<Navigate to="/onboarding" replace />}
      />
      <Route
        path="/quests"
        element={<Navigate to="/onboarding" replace />}
      />

      {/* Vendor Dashboard - protected, vendors only */}
      <Route
        path="/vendor/dashboard"
        element={
          <ProtectedRoute>
            <VendorDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard - protected, admins only */}
      {/* Analytics Index - redirects to overview */}
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsIndexPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/overview"
        element={
          <ProtectedRoute>
            <AnalyticsOverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/users"
        element={
          <ProtectedRoute>
            <AnalyticsUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/battles"
        element={
          <ProtectedRoute>
            <AnalyticsBattlesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/ai"
        element={
          <ProtectedRoute>
            <AnalyticsAIUsagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/content"
        element={
          <ProtectedRoute>
            <AnalyticsContentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/engagement"
        element={
          <ProtectedRoute>
            <AnalyticsEngagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/onboarding"
        element={
          <ProtectedRoute>
            <AnalyticsOnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics/revenue"
        element={
          <ProtectedRoute>
            <AnalyticsRevenuePage />
          </ProtectedRoute>
        }
      />
      {/* User Management - nested routes */}
      <Route
        path="/admin/users"
        element={<Navigate to="/admin/users/invitations" replace />}
      />
      <Route
        path="/admin/users/invitations"
        element={
          <ProtectedRoute>
            <AdminInvitationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/impersonate"
        element={
          <ProtectedRoute>
            <AdminImpersonatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/circles"
        element={
          <ProtectedRoute>
            <AdminCircleManagementPage />
          </ProtectedRoute>
        }
      />
      {/* Legacy redirects for old user management paths */}
      <Route
        path="/admin/invitations"
        element={<Navigate to="/admin/users/invitations" replace />}
      />
      <Route
        path="/admin/impersonate"
        element={<Navigate to="/admin/users/impersonate" replace />}
      />
      <Route
        path="/admin/circles"
        element={<Navigate to="/admin/users/circles" replace />}
      />
      <Route
        path="/admin/prompt-challenge-prompts"
        element={
          <ProtectedRoute>
            <AdminPromptChallengePromptsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tasks"
        element={
          <ProtectedRoute>
            <AdminTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/uat-scenarios"
        element={
          <ProtectedRoute>
            <AdminUATScenariosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/ember-flows"
        element={
          <ProtectedRoute>
            <AdminEmberFlowsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/lessons"
        element={
          <ProtectedRoute>
            <AdminLessonsPage />
          </ProtectedRoute>
        }
      />

      {/* Games - protected */}
      <Route
        path="/play/games"
        element={
          <ProtectedRoute>
            <GamesPage />
          </ProtectedRoute>
        }
      />
      {/* Legacy side-quests route - redirect to /play/games */}
      <Route
        path="/play/side-quests"
        element={<Navigate to="/play/games" replace />}
      />

      {/* Ethics Defender Game - protected */}
      <Route
        path="/play/ethics-defender"
        element={
          <ProtectedRoute>
            <EthicsDefenderGame />
          </ProtectedRoute>
        }
      />

      {/* Context Snake Game - protected */}
      <Route
        path="/play/context-snake"
        element={
          <ProtectedRoute>
            <ContextSnakeGame />
          </ProtectedRoute>
        }
      />

      {/* Auth routes */}
      {/* Main auth route - chat onboarding */}
      {/* allowGuest lets guest users convert to full accounts */}
      <Route
        path="/auth"
        element={
          <ProtectedRoute redirectIfAuthenticated allowGuest>
            <AuthPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect all other auth routes to /auth (preserving query params for referral codes) */}
      <Route path="/login" element={<RedirectWithQuery to="/auth" />} />
      <Route path="/signup" element={<RedirectWithQuery to="/auth" />} />

      {/* Extension - landing page and auth */}
      <Route
        path="/extension"
        element={
          <ProtectedRoute>
            <ExtensionPage />
          </ProtectedRoute>
        }
      />
      <Route path="/extension/auth" element={<ExtensionAuthPage />} />

      {/* Protected routes - Settings */}
      <Route
        path="/account/settings"
        element={
          <ProtectedRoute>
            <AccountSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/activity"
        element={
          <ProtectedRoute>
            <ActivitySettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/battles"
        element={
          <ProtectedRoute>
            <BattlesSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/integrations"
        element={
          <ProtectedRoute>
            <IntegrationsSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/personalization"
        element={
          <ProtectedRoute>
            <PersonalizationSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/referrals"
        element={
          <ProtectedRoute>
            <ReferralsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/notifications"
        element={
          <ProtectedRoute>
            <NotificationsSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/billing"
        element={
          <ProtectedRoute>
            <BillingSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/creator"
        element={
          <ProtectedRoute>
            <CreatorSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/privacy"
        element={
          <ProtectedRoute>
            <PrivacySettingsPage />
          </ProtectedRoute>
        }
      />
      {/* Public profile route - shows only showcase when logged out */}
      <Route path="/:username" element={<ProfilePage />} />
      <Route
        path="/:username/:projectSlug"
        element={
          <ProtectedRoute>
            <ProjectDetailPage />
          </ProtectedRoute>
        }
      >
        <Route path="tools/:slug" element={<ToolDetailPage />} />
      </Route>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
