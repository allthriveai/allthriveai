import type { ComponentType } from 'react';

// Route configuration
export interface RouteConfig {
  path: string;
  element: ComponentType;
  requiresAuth: boolean;
  redirectIfAuthenticated?: boolean;
  title: string;
}
