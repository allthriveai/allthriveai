import { useState } from 'react';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { SkipLink } from '@/components/ui/SkipLink';
import { UnifiedLanding } from '@/components/landing/UnifiedLanding';
import { InvitationTray } from '@/components/landing/InvitationTray';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

function LandingPageContent() {
  const [isTrayOpen, setIsTrayOpen] = useState(false);

  const handleRequestInvite = () => {
    setIsTrayOpen(true);
  };

  const handleCloseTray = () => {
    setIsTrayOpen(false);
  };

  return (
    <>
      <SEO {...SEOPresets.home} />
      <SkipLink />

      <div id="main-content" className="landing-dark-override">
        <UnifiedLanding onRequestInvite={handleRequestInvite} />
      </div>

      {/* Request Invitation Tray */}
      <InvitationTray isOpen={isTrayOpen} onClose={handleCloseTray} />
    </>
  );
}

export default function LandingPage() {
  // Only wrap with reCAPTCHA provider if site key is configured
  if (RECAPTCHA_SITE_KEY) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
        <LandingPageContent />
      </GoogleReCaptchaProvider>
    );
  }

  // Fallback without reCAPTCHA for development
  return <LandingPageContent />;
}
