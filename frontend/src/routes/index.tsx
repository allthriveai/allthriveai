import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import ActivitySettingsPage from '@/pages/ActivitySettingsPage';
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
import PromptBattlePage from '@/pages/play/PromptBattlePage';
import BattleDetailPage from '@/pages/play/BattleDetailPage';
import { BattlesLobbyPage, BattlePage, BattleInvitePage } from '@/pages/battles';
import { ChallengePage } from '@/pages/challenges';
import ThriveCirclePage from '@/pages/ThriveCirclePage';
import SideQuestsPage from '@/pages/SideQuestsPage';
import EthicsDefenderGame from '@/pages/games/EthicsDefenderGame';
import PricingPage from '@/pages/PricingPage';
import CheckoutPage from '@/pages/CheckoutPage';
import CheckoutSuccessPage from '@/pages/CheckoutSuccessPage';
import PerksPage from '@/pages/PerksPage';
import MarketplacePage from '@/pages/MarketplacePage';
import GettingStartedPage from '@/pages/GettingStartedPage';
import VendorDashboardPage from '@/pages/VendorDashboardPage';
import AdminAnalyticsPage from '@/pages/AdminAnalyticsPage';
import AdminInvitationsPage from '@/pages/admin/InvitationsPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Landing page - public, redirects authenticated users to /explore */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AboutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/about-us"
        element={
          <ProtectedRoute>
            <AboutPage />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/battles/:battleId"
        element={
          <ProtectedRoute>
            <BattlePage />
          </ProtectedRoute>
        }
      />
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

      {/* Getting Started - protected */}
      <Route
        path="/getting-started"
        element={
          <ProtectedRoute>
            <GettingStartedPage />
          </ProtectedRoute>
        }
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

      {/* Auth routes */}
      {/* Main auth route - chat onboarding */}
      <Route
        path="/auth"
        element={
          <ProtectedRoute redirectIfAuthenticated>
            <AuthPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect all other auth routes to /auth */}
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/signup" element={<Navigate to="/auth" replace />} />

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
