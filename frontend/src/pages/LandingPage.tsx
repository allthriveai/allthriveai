import { useState } from 'react';
import { SEO, SEOPresets } from '@/components/common/SEO';
import { Modal } from '@/components/ui/Modal';
import { SkipLink } from '@/components/ui/SkipLink';
import { HeroSection } from '@/components/landing/HeroSection';
import { ExplorePreview } from '@/components/landing/ExplorePreview';
import { AutomatedProfile } from '@/components/landing/AutomatedProfile';
import { SideQuestsPreview } from '@/components/landing/SideQuestsPreview';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRequestInvite = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <SEO {...SEOPresets.home} />
      <SkipLink />

      <main id="main-content" className="min-h-screen bg-[#020617] text-white overflow-x-hidden">
        {/* Section 1: Hero with CTA */}
        <HeroSection onRequestInvite={handleRequestInvite} />

        {/* Section 2: Automated Profile Creation */}
        <AutomatedProfile />

        {/* Section 3: Explore Feed Preview */}
        <ExplorePreview />

        {/* Section 4: Side Quests Preview */}
        <SideQuestsPreview />

        {/* Section 5: Final CTA */}
        <FinalCTA onRequestInvite={handleRequestInvite} />

        {/* Section 6: Footer */}
        <Footer />
      </main>

      {/* Coming Soon Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Coming Soon"
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-400 to-green-400 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#020617]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            We're building something amazing!
          </h3>
          <p className="text-gray-400 mb-6">
            The invitation system is under development. In the meantime, feel free
            to explore our public content.
          </p>
          <a
            href="/explore"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 to-green-400 text-[#020617] font-semibold hover:shadow-neon transition-all duration-300"
          >
            Explore Projects
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      </Modal>
    </>
  );
}
