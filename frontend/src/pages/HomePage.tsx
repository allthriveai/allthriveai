import { HeroSection } from '@/components/ui/HeroSection';
import DisplayCards from '@/components/ui/DisplayCards';
import { LiquidGlassButton } from '@/components/ui/LiquidGlassButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faLightbulb, faUsers } from '@fortawesome/free-solid-svg-icons';

export default function HomePage() {
  const handleInvitationClick = () => {
    // TODO: Add invitation request functionality
    console.log('Request invitation clicked');
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
    <HeroSection
      title="Grow Your AI Curiosity"
      highlightText="In Community"
      description="Learn by doing. Showcase your work. Get real feedback."
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
  );
}
