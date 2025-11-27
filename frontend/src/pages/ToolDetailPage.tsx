import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolTray } from '@/components/tools/ToolTray';

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!slug) return null;

  return <ToolTray isOpen={true} onClose={handleClose} toolSlug={slug} />;
}
