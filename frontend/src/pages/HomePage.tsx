import { useState } from 'react';
import { HeroSection } from '@/components/ui/HeroSection';
import DisplayCards from '@/components/ui/DisplayCards';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';
import { Modal } from '@/components/ui/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faLightbulb, faUsers } from '@fortawesome/free-solid-svg-icons';
import { SEO, SEOPresets } from '@/components/common/SEO';

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInvitationClick = () => {
    setIsModalOpen(true);
  };

  const cards = [
    {
      icon: <FontAwesomeIcon icon={faBrain} className="size-4 text-primary-300" />,
      title: "Learn",
      description: "Build Challenges & Interactive Courses",
      date: "Start today",
      titleClassName: "text-primary-400",
      className: "[grid-area:stack] hover:-translate-y-20 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-white/20 grayscale-[40%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <FontAwesomeIcon icon={faLightbulb} className="size-4 text-primary-300" />,
      title: "Showcase",
      description: "Showcase your AI powered projects",
      date: "Create Your portfolio",
      titleClassName: "text-primary-400",
      className: "[grid-area:stack] translate-x-6 translate-y-12 hover:-translate-y-6 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-white/20 grayscale-[40%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <FontAwesomeIcon icon={faUsers} className="size-4 text-accent-300" />,
      title: "Connect",
      description: "Get feedback from the community",
      date: "Join others",
      titleClassName: "text-accent-400",
      className: "[grid-area:stack] translate-x-12 translate-y-24 hover:-translate-y-2",
    },
  ];

  return (
    <>
      <SEO {...SEOPresets.home} />
      <HeroSection
        title="Discover and share"
        highlightText="AI creations from any tool"
        description={`Explore AI-generated images, apps, and agents.
Showcase your work and connect with other builders.`}
        buttonText="Request invitation to join"
        onButtonClick={handleInvitationClick}
        colors={[
          "#4991e5",  // brand blue
          "#39bdd6",  // brand cyan
          "#3bd4cb",  // brand teal
          "#00a4bd",  // primary 600
          "#00bda5",  // primary 500
          "#080b12",  // brand dark
        ]}
        distortion={0.7}
        swirl={0.5}
        speed={0.3}
        veilOpacity="bg-black/30"
        className="bg-brand-dark"
        titleClassName="bg-gradient-to-r from-white via-primary-300 to-accent-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift"
        rightContent={<DisplayCards cards={cards} />}
        customButton={
          <LiquidGlassButton onClick={handleInvitationClick} variant="primary" className="max-w-[620px] w-full">
            Request invitation to join
          </LiquidGlassButton>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Coming Soon"
      >
        <p className="text-lg mb-4">
          We're putting the finishing touches on our invitation system!
        </p>
        <p className="text-gray-400">
          Stay tuned for updates. We'll be opening invitations very soon.
        </p>
      </Modal>
    </>
  );
}
