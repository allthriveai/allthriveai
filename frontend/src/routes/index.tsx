import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import StyleGuidePage from '@/pages/StyleGuidePage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/styleguide" element={<StyleGuidePage />} />

      {/* Auth route - redirect if already authenticated */}
      <Route
        path="/login"
        element={
          <ProtectedRoute redirectIfAuthenticated>
            <LoginPage />
          </ProtectedRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
