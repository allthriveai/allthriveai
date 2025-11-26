import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import ProjectEditorPage from '@/pages/ProjectEditorPage';
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
import QuizListPage from '@/pages/quizzes/QuizListPage';
import QuizPage from '@/pages/quizzes/QuizPage';
import LearnPage from '@/pages/LearnPage';
import ToolDirectoryPage from '@/pages/ToolDirectoryPage';
import ToolDetailPage from '@/pages/ToolDetailPage';
import { ExplorePage } from '@/pages/ExplorePage';
import PromptBattlePage from '@/pages/play/PromptBattlePage';
import BattleDetailPage from '@/pages/play/BattleDetailPage';
import ThriveCirclePage from '@/pages/ThriveCirclePage';
import SideQuestsPage from '@/pages/SideQuestsPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/about-us" element={<AboutPage />} />
      <Route path="/styleguide" element={<StyleGuidePage />} />

      {/* Learn route */}
      <Route path="/learn" element={<LearnPage />} />

      {/* Quiz routes - must come before /:username routes */}
      <Route path="/quick-quizzes" element={<QuizListPage />} />
      <Route path="/quick-quizzes/:slug" element={<QuizPage />} />

      {/* Tool Directory - public routes */}
      <Route path="/tools" element={<ToolDirectoryPage />}>
        <Route path=":slug" element={<ToolDetailPage />} />
      </Route>

      {/* Explore - public route */}
      <Route path="/explore" element={<ExplorePage />} />

      {/* Play routes - protected */}
      <Route
        path="/play/prompt-battle"
        element={
          <ProtectedRoute>
            <PromptBattlePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play/prompt-battle/:battleId"
        element={
          <ProtectedRoute>
            <BattleDetailPage />
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
        path="/:username/:projectSlug/edit"
        element={
          <ProtectedRoute>
            <ProjectEditorPage />
          </ProtectedRoute>
        }
      />
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
