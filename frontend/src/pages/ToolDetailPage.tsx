import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolTray } from '@/components/tools/ToolTray';

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    // Navigate to /tools directly instead of going back in history
    // This prevents stacking issues when navigating between tools
    navigate('/tools', { replace: true });
  }, [navigate]);

  if (!slug) return null;

  return <ToolTray isOpen={true} onClose={handleClose} toolSlug={slug} />;
}
