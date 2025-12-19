import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Redirect component that preserves query parameters
function RedirectWithQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}
import { ProtectedRoute, setGuestBattleId, clearGuestBattleId, getGuestBattleId } from './ProtectedRoute';

// Re-export guest helpers for use elsewhere
export { setGuestBattleId, clearGuestBattleId, getGuestBattleId };
import LandingPage from '@/pages/LandingPage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import ActivitySettingsPage from '@/pages/ActivitySettingsPage';
import BattlesSettingsPage from '@/pages/BattlesSettingsPage';
import IntegrationsSettingsPage from '@/pages/settings/IntegrationsSettingsPage';
import PersonalizationSettingsPage from '@/pages/settings/PersonalizationSettingsPage';
import NotificationsSettingsPage from '@/pages/settings/NotificationsSettingsPage';
import BillingSettingsPage from '@/pages/settings/BillingSettingsPage';
import CreatorSettingsPage from '@/pages/settings/CreatorSettingsPage';
import PrivacySettingsPage from '@/pages/settings/PrivacySettingsPage';
import ReferralsPage from '@/pages/settings/ReferralsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import StyleGuidePage from '@/pages/StyleGuidePage';
import NeonGlassStyleguide from '@/pages/NeonGlassStyleguide';
import QuizListPage from '@/pages/quizzes/QuizListPage';
import QuizPage from '@/pages/quizzes/QuizPage';
import LearnPage from '@/pages/LearnPage';
import ToolDirectoryPage from '@/pages/ToolDirectoryPage';
import ToolDetailPage from '@/pages/ToolDetailPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { BattlesLobbyPage, BattlePage, BattleInvitePage } from '@/pages/battles';
import { ChallengePage } from '@/pages/challenges';
import ThriveCirclePage from '@/pages/ThriveCirclePage';
import SideQuestsPage from '@/pages/SideQuestsPage';
import EthicsDefenderGame from '@/pages/games/EthicsDefenderGame';
import ContextSnakeGame from '@/pages/games/ContextSnakeGame';
import PricingPage from '@/pages/PricingPage';
import CheckoutPage from '@/pages/CheckoutPage';
import CheckoutSuccessPage from '@/pages/CheckoutSuccessPage';
import PerksPage from '@/pages/PerksPage';
import MarketplacePage from '@/pages/MarketplacePage';
import OnboardingPage from '@/pages/OnboardingPage';
import EmberHomePage from '@/pages/EmberHomePage';
import VendorDashboardPage from '@/pages/VendorDashboardPage';
import AdminAnalyticsPage from '@/pages/AdminAnalyticsPage';
import AdminInvitationsPage from '@/pages/admin/InvitationsPage';
import AdminPromptChallengePromptsPage from '@/pages/admin/PromptChallengePromptsPage';
import AdminImpersonatePage from '@/pages/admin/ImpersonatePage';
import AdminCircleManagementPage from '@/pages/admin/CircleManagementPage';
import AdminTasksPage from '@/pages/admin/TasksPage';
import AdminUATScenariosPage from '@/pages/admin/UATScenariosPage';
import ExtensionAuthPage from '@/pages/ExtensionAuthPage';
import ExtensionPage from '@/pages/ExtensionPage';
import PitchDeckPage from '@/pages/PitchDeckPage';
import PromoPage from '@/pages/PromoPage';
import PromoVideoPage from '@/pages/PromoVideoPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import TermsOfServicePage from '@/pages/TermsOfServicePage';

export function AppRoutes() {
  return (
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
      <Route
        path="/styleguide"
        element={
          <ProtectedRoute>
            <StyleGuidePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/styleguide-neon"
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

      {/* Battles - new matchmaking UI */}
      <Route
        path="/battles"
        element={
          <ProtectedRoute>
            <BattlesLobbyPage />
          </ProtectedRoute>
        }
      />
      {/* Battle detail page - public for completed battles, requires auth for active */}
      <Route path="/battles/:battleId" element={<BattlePage />} />
      {/* Battle invitation link (from SMS) - public so users can see invitation before login */}
      <Route path="/battle/invite/:token" element={<BattleInvitePage />} />

      {/* Play routes - legacy, redirects to new battles */}
      <Route
        path="/play/prompt-battle"
        element={<Navigate to="/battles" replace />}
      />
      <Route
        path="/play/prompt-battle/:battleId"
        element={
          <ProtectedRoute>
            <BattlePage />
          </ProtectedRoute>
        }
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
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute>
            <AdminAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/invitations"
        element={
          <ProtectedRoute>
            <AdminInvitationsPage />
          </ProtectedRoute>
        }
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
        path="/admin/impersonate"
        element={
          <ProtectedRoute>
            <AdminImpersonatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/circles"
        element={
          <ProtectedRoute>
            <AdminCircleManagementPage />
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

      {/* Side Quests - protected */}
      <Route
        path="/play/side-quests"
        element={
          <ProtectedRoute>
            <SideQuestsPage />
          </ProtectedRoute>
        }
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
  );
}
