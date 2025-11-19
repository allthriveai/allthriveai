import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import AccountSettingsPage from '@/pages/AccountSettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import StyleGuidePage from '@/pages/StyleGuidePage';
import QuizListPage from '@/pages/quizzes/QuizListPage';
import QuizPage from '@/pages/quizzes/QuizPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/about-us" element={<AboutPage />} />
      <Route path="/styleguide" element={<StyleGuidePage />} />
      
      {/* Quiz routes - must come before /:username routes */}
      <Route path="/quick-quizzes" element={<QuizListPage />} />
      <Route path="/quick-quizzes/:slug" element={<QuizPage />} />

      {/* Auth routes - unified chat-based auth */}
      <Route
        path="/login"
        element={
          <ProtectedRoute redirectIfAuthenticated>
            <AuthPage />
          </ProtectedRoute>
        }
      />
      
      {/* Redirect old routes to new unified auth */}
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />

      {/* Protected routes */}
      <Route
        path="/account/settings"
        element={
          <ProtectedRoute>
            <AccountSettingsPage />
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
      />
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
