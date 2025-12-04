import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRoute,
  faBolt,
  faUserGraduate,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

// Constants
const SECTION_HEADING_STYLE = 'text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2';
const SECTION_TEXT_STYLE = 'text-gray-600 dark:text-gray-400 text-sm';

interface LearnCardProps {
  title: string;
  description: string;
  icon: typeof faRoute;
  onClick: () => void;
  comingSoon?: boolean;
}

function LearnCard({ title, description, icon, onClick, comingSoon }: LearnCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="glass-strong p-8 hover:-translate-y-1 cursor-pointer group relative overflow-hidden w-full text-left"
    >
      {/* Coming Soon Badge */}
      {comingSoon && (
        <div className="absolute top-4 right-4 bg-primary-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
          Coming Soon
        </div>
      )}

      {/* Icon */}
      <div className="mb-6 flex items-center justify-center">
        <div
          className={`w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center transition-transform duration-300 ${
            isHovered ? 'scale-110 rotate-3' : ''
          }`}
          style={{ borderRadius: 'var(--radius)' }}
        >
          <FontAwesomeIcon
            icon={icon}
            className="text-white text-3xl"
          />
        </div>
      </div>

      {/* Content */}
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
        {title}
      </h3>

      <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed">
        {description}
      </p>

      {/* Hover Effect Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-primary-500/5 to-primary-700/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
        style={{ borderRadius: 'var(--radius)' }}
      />
    </button>
  );
}

export default function LearnPage() {
  const navigate = useNavigate();
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleComingSoon = () => {
    setShowComingSoon(true);
    setTimeout(() => {
      setShowComingSoon(false);
    }, 3000);
  };

  const learnCards = [
    {
      title: 'Learning Paths',
      description: 'Follow structured learning paths to master AI concepts, tools, and best practices at your own pace.',
      icon: faRoute,
      onClick: handleComingSoon,
      comingSoon: true,
    },
    {
      title: 'Quizzes',
      description: 'Test your knowledge with quick quizzes on AI frameworks, concepts, and industry best practices.',
      icon: faBolt,
      onClick: () => navigate('/quizzes'),
      comingSoon: false,
    },
    {
      title: 'Mentorship Program',
      description: 'Connect with experienced AI practitioners and get personalized guidance on your learning journey.',
      icon: faUserGraduate,
      onClick: handleComingSoon,
      comingSoon: true,
    },
  ];

  return (
    <DashboardLayout>
      {() => (
        <div className="h-full overflow-y-auto">
          {/* Hero Banner */}
          <div className="relative h-64 bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-800 dark:to-primary-950">
            <div className="absolute inset-0 bg-[url('/learn-hero-pattern.svg')] opacity-10"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
              <h1 className="text-4xl font-bold text-white mb-4">Learn</h1>
              <p className="text-xl text-primary-100 max-w-2xl">
                Expand your AI knowledge with structured learning paths, interactive quizzes, and expert mentorship
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {learnCards.map((card) => (
                <LearnCard
                  key={card.title}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  onClick={card.onClick}
                  comingSoon={card.comingSoon}
                />
              ))}
            </div>

            {/* Additional Info Section */}
            <div className="mt-16 glass-strong p-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Why Learn with All Thrive AI?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className={SECTION_HEADING_STYLE}>
                    Practical Focus
                  </h3>
                  <p className={SECTION_TEXT_STYLE}>
                    Learn skills that you can immediately apply to real-world AI projects and challenges.
                  </p>
                </div>
                <div>
                  <h3 className={SECTION_HEADING_STYLE}>
                    Expert-Curated
                  </h3>
                  <p className={SECTION_TEXT_STYLE}>
                    Content designed by AI practitioners with years of experience in the field.
                  </p>
                </div>
                <div>
                  <h3 className={SECTION_HEADING_STYLE}>
                    Community-Driven
                  </h3>
                  <p className={SECTION_TEXT_STYLE}>
                    Connect with fellow learners and grow together in a supportive environment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon Toast */}
          {showComingSoon && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
              <div className="glass-strong px-6 py-4 shadow-glass-xl border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Coming Soon! 🚀
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
