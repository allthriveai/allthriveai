import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import PasswordSettingsPage from '@/pages/settings/PasswordSettingsPage';
import IntegrationsSettingsPage from '@/pages/settings/IntegrationsSettingsPage';
import PersonalizationSettingsPage from '@/pages/settings/PersonalizationSettingsPage';
import NotificationsSettingsPage from '@/pages/settings/NotificationsSettingsPage';
import BillingSettingsPage from '@/pages/settings/BillingSettingsPage';
import PrivacySettingsPage from '@/pages/settings/PrivacySettingsPage';
import TeamsSettingsPage from '@/pages/settings/TeamsSettingsPage';
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
import { BattlesLobbyPage, BattlePage } from '@/pages/battles';
import ThriveCirclePage from '@/pages/ThriveCirclePage';
import SideQuestsPage from '@/pages/SideQuestsPage';
import PricingPage from '@/pages/PricingPage';
import CheckoutPage from '@/pages/CheckoutPage';

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

      {/* Checkout - protected route */}
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
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

      {/* Thrive Circle - protected */}
      <Route
        path="/thrive-circle"
        element={
          <ProtectedRoute>
            <ThriveCirclePage />
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
        path="/account/settings/password"
        element={
          <ProtectedRoute>
            <PasswordSettingsPage />
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
        path="/account/settings/privacy"
        element={
          <ProtectedRoute>
            <PrivacySettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings/teams"
        element={
          <ProtectedRoute>
            <TeamsSettingsPage />
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
