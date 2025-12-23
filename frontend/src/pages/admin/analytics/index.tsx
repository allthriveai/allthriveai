// Analytics Index - Redirects to overview page
import { Navigate } from 'react-router-dom';

export default function AnalyticsIndex() {
  return <Navigate to="/admin/analytics/overview" replace />;
}
