import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import AuthPage from '@/pages/AuthPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';
import StyleGuidePage from '@/pages/StyleGuidePage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/styleguide" element={<StyleGuidePage />} />

      {/* Auth routes - unified chat-based auth */}
      <Route
        path="/auth"
        element={
          <ProtectedRoute redirectIfAuthenticated>
            <AuthPage />
          </ProtectedRoute>
        }
      />
      
      {/* Redirect old routes to new unified auth */}
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/signup" element={<Navigate to="/auth" replace />} />

      {/* Protected routes */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Navigate to="/profile" replace />
          </ProtectedRoute>
        }
      />

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
