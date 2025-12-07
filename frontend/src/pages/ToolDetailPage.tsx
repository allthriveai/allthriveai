import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ToolTray } from '@/components/tools/ToolTray';

export default function ToolDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Start closed, then animate open
  const [isOpen, setIsOpen] = useState(false);

  // Animate open after mount
  useEffect(() => {
    // Small delay to ensure the closed state is rendered first
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsOpen(true);
      });
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleClose = useCallback(() => {
    // First close the tray to trigger slide-out animation
    setIsOpen(false);
    // Then navigate after animation completes
    setTimeout(() => {
      navigate('/tools', { replace: true });
    }, 300); // Match the CSS transition duration
  }, [navigate]);

  if (!slug) return null;

  return <ToolTray isOpen={isOpen} onClose={handleClose} toolSlug={slug} />;
}
