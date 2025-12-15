import { useState } from 'react';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { SkipLink } from '@/components/ui/SkipLink';
import { HeroSection } from '@/components/landing/HeroSection';
import { WhatIsAllThrive } from '@/components/landing/WhatIsAllThrive';
import { ExplorePreview } from '@/components/landing/ExplorePreview';
import { AutomatedProfile } from '@/components/landing/AutomatedProfile';
import { SideQuestsPreview } from '@/components/landing/SideQuestsPreview';
import { Testimonials } from '@/components/landing/Testimonials';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';
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

      <div id="main-content" className="bg-[#020617] text-white overflow-x-hidden">
        {/* Section 1: Hero with CTA */}
        <HeroSection onRequestInvite={handleRequestInvite} isModalOpen={isTrayOpen} />

        {/* Section 2: What Is AllThrive - Platform Overview */}
        <WhatIsAllThrive />

        {/* Section 3: Automated Profile Creation */}
        <AutomatedProfile />

        {/* Section 3: Explore Feed Preview */}
        <ExplorePreview />

        {/* Section 4: Side Quests Preview */}
        <SideQuestsPreview />

        {/* Section 5: Testimonials */}
        <Testimonials />

        {/* Section 6: Final CTA */}
        <FinalCTA onRequestInvite={handleRequestInvite} />

        {/* Footer */}
        <Footer />
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
